import type { ArticleSchedule, ArticleScheduleRun, ArticleScheduleRunStatus } from '../types.js';
import type { AppConfig } from '../config/index.js';
import type { Repository } from '../db/repository.js';
import { autoAdvanceArticle, getLeagueDataTool, type ActionContext } from './actions.js';
import {
  ANALYTICS_MODE_LABELS,
  ARTICLE_FORM_LABELS,
  PANEL_SHAPE_LABELS,
  READER_PROFILE_LABELS,
  resolveEditorialControls,
} from '../types.js';
import {
  IDEA_DEPTH_LABELS,
  createIdeaArticle,
  parseScheduledStoryDiscovery,
  type ScheduledStoryCandidate,
} from './idea-generation.js';

export interface ArticleSchedulerServiceOptions {
  repo: Repository;
  config: AppConfig;
  actionContext: ActionContext;
  pollIntervalMs?: number;
  now?: () => Date;
  logger?: Pick<Console, 'log' | 'warn' | 'error'>;
}

export interface ArticleSchedulerTickResult {
  processed: number;
  results: Array<{
    scheduleId: string;
    runId?: string;
    status: ArticleScheduleRunStatus | 'duplicate';
    articleId?: string;
    error?: string;
  }>;
}

export class ArticleSchedulerService {
  private readonly repo: Repository;
  private readonly config: AppConfig;
  private readonly actionContext: ActionContext;
  private readonly pollIntervalMs: number;
  private readonly nowProvider: () => Date;
  private readonly logger: Pick<Console, 'log' | 'warn' | 'error'>;
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;

  constructor(options: ArticleSchedulerServiceOptions) {
    this.repo = options.repo;
    this.config = options.config;
    this.actionContext = options.actionContext;
    this.pollIntervalMs = options.pollIntervalMs ?? 60_000;
    this.nowProvider = options.now ?? (() => new Date());
    this.logger = options.logger ?? console;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<ArticleSchedulerTickResult> {
    if (this.ticking) {
      return { processed: 0, results: [] };
    }
    this.ticking = true;
    try {
      const now = this.nowProvider();
      const dueSchedules = this.repo.listArticleSchedules({
        enabledOnly: true,
        dueBefore: toDbDateTime(now),
      });
      const results: ArticleSchedulerTickResult['results'] = [];
      for (const schedule of dueSchedules) {
        results.push(await this.processSchedule(schedule));
      }
      return {
        processed: results.length,
        results,
      };
    } finally {
      this.ticking = false;
    }
  }

  /**
   * Recover runs that were interrupted by a server restart.
   * - `created_article` runs with an article_id → resume auto-advance.
   * - `claimed` runs (no article yet) → mark failed (discovery can't be resumed).
   */
  async recoverOrphanedRuns(): Promise<number> {
    const orphans = this.repo.listOrphanedScheduleRuns();
    if (orphans.length === 0) return 0;

    this.logger.log(`[article-scheduler] Recovering ${orphans.length} orphaned run(s)…`);
    let recovered = 0;

    for (const run of orphans) {
      try {
        if (run.status === 'created_article' && run.article_id) {
          const schedule = this.repo.getArticleSchedule(run.schedule_id);
          const maxStage = schedule?.max_advance_stage ?? 7;
          let advanceError: string | undefined;
          if (maxStage > 1) {
            const result = await autoAdvanceArticle(run.article_id, this.actionContext, { maxStage });
            advanceError = result.error ?? undefined;
          }
          this.repo.markArticleScheduleRunCompleted(run.id, {
            status: advanceError ? 'failed' : 'completed',
            article_id: run.article_id,
            error_text: advanceError ?? null,
          });
          this.logger.log(`[article-scheduler] Recovered run ${run.id} → article ${run.article_id} (${advanceError ? 'failed' : 'completed'})`);
        } else {
          // claimed but never reached article creation — can't resume
          this.repo.markArticleScheduleRunCompleted(run.id, {
            status: 'failed',
            error_text: 'Interrupted by server restart before article creation',
          });
          this.logger.warn(`[article-scheduler] Marked orphaned run ${run.id} as failed (no article created)`);
        }
        recovered++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[article-scheduler] Recovery failed for run ${run.id}: ${msg}`);
        try {
          this.repo.markArticleScheduleRunCompleted(run.id, {
            status: 'failed',
            error_text: `Recovery failed: ${msg}`,
          });
        } catch { /* best-effort */ }
      }
    }
    return recovered;
  }

  private async processSchedule(schedule: ArticleSchedule): Promise<ArticleSchedulerTickResult['results'][number]> {
    const run = this.repo.claimArticleScheduleRun(schedule.id, schedule.next_run_at);
    if (!run) {
      return { scheduleId: schedule.id, status: 'duplicate' };
    }

    // Advance schedule timing immediately so the dashboard reflects the
    // run-in-progress and a second tick can never re-fire this slot.
    const nextRunAt = computeNextRunAt(schedule, new Date(schedule.next_run_at));
    this.repo.updateArticleSchedule(schedule.id, {
      last_run_at: schedule.next_run_at,
      next_run_at: nextRunAt,
    });

    try {
      const discovery = await this.runStoryDiscovery(schedule);
      const selected = selectScheduledStory(discovery.candidates, discovery.selectedIndex);
      this.repo.updateArticleScheduleRun(run.id, {
        discovery_json: JSON.stringify(discovery),
        selected_story_json: JSON.stringify(selected),
      });

      const article = await createIdeaArticle({
        repo: this.repo,
        config: this.config,
        actionContext: this.actionContext,
        prompt: buildScheduledIdeaPrompt(schedule, selected, discovery.selectionReason),
        teams: [schedule.team_abbr],
        depthLevel: schedule.depth_level,
        presetId: schedule.preset_id,
        readerProfile: schedule.reader_profile,
        articleForm: schedule.article_form,
        panelShape: schedule.panel_shape,
        analyticsMode: schedule.analytics_mode,
        panelConstraintsJson: schedule.panel_constraints_json,
        provider: schedule.provider_mode === 'override' ? (schedule.provider_id ?? undefined) : undefined,
        pinnedAgents: [],
      });

      this.repo.updateArticleScheduleRun(run.id, {
        status: 'created_article',
        article_id: article.id,
      });

      let advanceError: string | undefined;
      if (schedule.max_advance_stage > 1) {
        const autoAdvance = await autoAdvanceArticle(article.id, this.actionContext, { maxStage: schedule.max_advance_stage });
        advanceError = autoAdvance.error ?? undefined;
      }
      this.repo.markArticleScheduleRunCompleted(run.id, {
        status: advanceError ? 'failed' : 'completed',
        article_id: article.id,
        error_text: advanceError ?? null,
      });
      if (advanceError) {
        return { scheduleId: schedule.id, runId: run.id, status: 'failed', articleId: article.id, error: advanceError };
      }
      this.logger.log(`[article-scheduler] Completed schedule ${schedule.id} → article ${article.id}`);
      return { scheduleId: schedule.id, runId: run.id, status: 'completed', articleId: article.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.repo.markArticleScheduleRunCompleted(run.id, {
        status: 'failed',
        error_text: message,
      });
      this.logger.warn(`[article-scheduler] Schedule ${schedule.id} failed: ${message}`);
      return { scheduleId: schedule.id, runId: run.id, status: 'failed', error: message };
    }
  }

  private async runStoryDiscovery(schedule: ArticleSchedule): Promise<{
    candidates: ScheduledStoryCandidate[];
    selectedIndex?: number;
    selectionReason?: string;
  }> {
    const team = (this.config.teams ?? []).find((entry) => entry.abbr === schedule.team_abbr);
    const teamContext = team ? `${team.abbr} — ${team.city} ${team.name}` : schedule.team_abbr;
    const editorial = resolveEditorialControls({
      preset_id: schedule.preset_id,
      reader_profile: schedule.reader_profile,
      article_form: schedule.article_form,
      panel_shape: schedule.panel_shape,
      analytics_mode: schedule.analytics_mode,
      panel_constraints_json: schedule.panel_constraints_json,
      depth_level: schedule.depth_level,
      content_profile: schedule.content_profile,
    });
    const result = await this.actionContext.runner.run({
      agentName: 'lead',
      provider: schedule.provider_mode === 'override' ? (schedule.provider_id ?? undefined) : undefined,
      task: [
        'You are planning a recurring scheduled article for a sports editorial workflow.',
        `Team: ${teamContext}`,
        `Content profile: ${schedule.content_profile}`,
        `Preset: ${schedule.preset_id}`,
        `Reader profile: ${READER_PROFILE_LABELS[editorial.reader_profile]}`,
        `Article form: ${ARTICLE_FORM_LABELS[editorial.article_form]}`,
        `Panel shape: ${PANEL_SHAPE_LABELS[editorial.panel_shape]}`,
        `Analytics mode: ${ANALYTICS_MODE_LABELS[editorial.analytics_mode]}`,
        `Legacy depth level: ${IDEA_DEPTH_LABELS[schedule.depth_level] ?? IDEA_DEPTH_LABELS[2]}`,
        `Base prompt: ${schedule.prompt}`,
        '',
        'Search the web and rank 3 to 5 timely candidate story angles that best fit this schedule.',
        'Prefer angles that are relevant right now, evidence-backed, and useful to fans.',
        'Return ONLY JSON in this shape:',
        '{"candidates":[{"title":"","angle":"","whyNow":"","score":0,"prompt":"","evidence":[{"url":"","note":""}]}],"selectedIndex":0,"selectionReason":""}',
      ].join('\n'),
      skills: ['idea-generation'],
      toolCalling: {
        enabled: true,
        includeLocalExtensions: true,
        includeWebSearch: true,
        allowWriteTools: false,
        requestedTools: [getLeagueDataTool(this.config.league), 'prediction-markets', 'web_search'],
        maxToolCalls: 50,
        context: {
          repo: this.repo,
          engine: this.actionContext.engine,
          config: this.config,
          actionContext: this.actionContext,
          stage: 1,
          surface: 'scheduledDiscovery',
          agentName: 'lead',
        },
      },
      trace: {
        repo: this.repo,
        stage: 1,
        surface: 'scheduledDiscovery',
      },
    });
    return parseScheduledStoryDiscovery(result.content);
  }
}

function selectScheduledStory(candidates: ScheduledStoryCandidate[], selectedIndex?: number): ScheduledStoryCandidate {
  if (selectedIndex != null && selectedIndex >= 0 && selectedIndex < candidates.length) {
    return candidates[selectedIndex];
  }
  return [...candidates].sort((left, right) => right.score - left.score)[0]!;
}

function buildScheduledIdeaPrompt(
  schedule: ArticleSchedule,
  selected: ScheduledStoryCandidate,
  selectionReason?: string,
): string {
  const editorial = resolveEditorialControls({
    preset_id: schedule.preset_id,
    reader_profile: schedule.reader_profile,
    article_form: schedule.article_form,
    panel_shape: schedule.panel_shape,
    analytics_mode: schedule.analytics_mode,
    panel_constraints_json: schedule.panel_constraints_json,
    depth_level: schedule.depth_level,
    content_profile: schedule.content_profile,
  });
  const accessibilityGuidance = editorial.analytics_mode === 'explain_only'
    ? 'Write for a broad fan audience. Minimize jargon, explain stakes cleanly, and keep analytics plain-language.'
    : editorial.analytics_mode === 'metrics_forward'
      ? 'Lean into sharper evidence, deeper context, and a more analytical framing for highly engaged readers.'
      : 'Balance readability with evidence-backed analysis for engaged fans.';
  const evidenceLines = selected.evidence.map((item: ScheduledStoryCandidate['evidence'][number]) => `- ${item.url}${item.note ? ` — ${item.note}` : ''}`);
  return [
    `This is a recurring scheduled article for ${schedule.team_abbr}.`,
    `Base schedule prompt: ${schedule.prompt}`,
    `Reader profile: ${READER_PROFILE_LABELS[editorial.reader_profile]}`,
    `Article form: ${ARTICLE_FORM_LABELS[editorial.article_form]}`,
    `Panel shape: ${PANEL_SHAPE_LABELS[editorial.panel_shape]}`,
    `Analytics mode: ${ANALYTICS_MODE_LABELS[editorial.analytics_mode]}`,
    `Selected story: ${selected.title}`,
    `Angle: ${selected.angle}`,
    `Why now: ${selected.whyNow}`,
    `Selection reason: ${selectionReason ?? 'Highest ranked candidate for this schedule.'}`,
    accessibilityGuidance,
    'Use the evidence below as guidance for a timely idea, but keep the article idea honest and specific.',
    evidenceLines.length > 0 ? evidenceLines.join('\n') : '- No evidence links returned',
    '',
    `Candidate prompt seed: ${selected.prompt}`,
  ].join('\n');
}

export function computeNextRunAt(schedule: Pick<ArticleSchedule, 'weekday_utc' | 'time_of_day_utc'>, from: Date): string {
  const next = new Date(Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
    from.getUTCHours(),
    from.getUTCMinutes(),
    0,
    0,
  ));
  const [hours, minutes] = schedule.time_of_day_utc.split(':').map((value) => parseInt(value, 10));
  const dayOffset = (schedule.weekday_utc - next.getUTCDay() + 7) % 7;
  next.setUTCDate(next.getUTCDate() + dayOffset);
  next.setUTCHours(hours, minutes, 0, 0);
  if (next <= from) {
    next.setUTCDate(next.getUTCDate() + 7);
  }
  return toDbDateTime(next);
}

export function buildInitialNextRunAt(schedule: Pick<ArticleSchedule, 'weekday_utc' | 'time_of_day_utc'>, now: Date): string {
  return computeNextRunAt(schedule, now);
}

function toDbDateTime(value: Date): string {
  return value.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}

export function createArticleSchedulerService(options: ArticleSchedulerServiceOptions): ArticleSchedulerService {
  return new ArticleSchedulerService(options);
}
