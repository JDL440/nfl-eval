/**
 * recurring-scheduler.ts — In-process wall-clock scheduler for article schedules.
 *
 * Polls the database for due schedules, claims a run slot transactionally,
 * generates an article idea, then calls autoAdvanceArticle to reach Stage 7.
 *
 * SQLite single-writer constraint: runs are processed sequentially.
 * Duplicate protection: claimArticleScheduleRun uses INSERT OR IGNORE + UNIQUE guard.
 */

import type { Repository } from '../db/repository.js';
import type { AppConfig } from '../config/index.js';
import type { ActionContext } from '../pipeline/actions.js';
import type { ArticleSchedule } from '../types.js';
import { autoAdvanceArticle } from '../pipeline/actions.js';
import { PipelineEngine } from '../pipeline/engine.js';
import { createArticleFromPrompt } from './article-creation.js';

export interface RecurringSchedulerOptions {
  /** How often to check for due schedules, in milliseconds. Default: 60_000 (1 min). */
  pollIntervalMs?: number;
  /** Only process schedules due on or before this ISO string. Defaults to now(). */
  asOf?: () => string;
}

/**
 * Calculate the ISO datetime for the next occurrence of a weekday/time after `after`.
 * weekday: 0=Sun…6=Sat (JS Date convention)
 * time: "HH:MM" in UTC
 */
export function calcNextRunAt(
  weekday: number,
  timeOfDay: string,
  after: Date = new Date(),
): Date {
  const [hourStr, minuteStr] = timeOfDay.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  // For v1, UTC only. Timezone is stored but not yet applied.
  const d = new Date(after);
  // Advance to the same or next occurrence of the target weekday
  const currentDay = d.getUTCDay();
  let daysAhead = (weekday - currentDay + 7) % 7;
  // If today matches and the time has already passed (or equals now), push to next week
  if (daysAhead === 0) {
    const todaySlot = new Date(d);
    todaySlot.setUTCHours(hour, minute, 0, 0);
    if (d >= todaySlot) {
      daysAhead = 7;
    }
  }
  const next = new Date(d);
  next.setUTCDate(d.getUTCDate() + daysAhead);
  next.setUTCHours(hour, minute, 0, 0);
  return next;
}

export class RecurringScheduler {
  private repo: Repository;
  private config: AppConfig;
  private actionContext: ActionContext | null;
  private pollIntervalMs: number;
  private asOf: () => string;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    repo: Repository,
    config: AppConfig,
    actionContext: ActionContext | null,
    options?: RecurringSchedulerOptions,
  ) {
    this.repo = repo;
    this.config = config;
    this.actionContext = actionContext;
    this.pollIntervalMs = options?.pollIntervalMs ?? 60_000;
    this.asOf = options?.asOf ?? (() => new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''));
  }

  /** Start the polling loop. Safe to call multiple times — ignores re-entrant calls. */
  start(): void {
    if (this.timer !== null) return;
    // Run once immediately on start (catch-up for overdue schedules)
    this.tick().catch(err =>
      console.error('[RecurringScheduler] Initial tick error:', err instanceof Error ? err.message : err),
    );
    this.timer = setInterval(() => {
      if (this.running) return; // skip if previous tick is still in progress
      this.tick().catch(err =>
        console.error('[RecurringScheduler] Tick error:', err instanceof Error ? err.message : err),
      );
    }, this.pollIntervalMs);
  }

  /** Stop the polling loop. */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Single poll cycle: find due schedules, process sequentially. */
  async tick(): Promise<void> {
    this.running = true;
    try {
      const due = this.repo.listArticleSchedules({
        enabledOnly: true,
        dueBefore: this.asOf(),
      });
      for (const schedule of due) {
        await this.processSchedule(schedule);
      }
    } finally {
      this.running = false;
    }
  }

  private async processSchedule(schedule: ArticleSchedule): Promise<void> {
    const scheduledFor = schedule.next_run_at!;

    // Claim the run slot — prevents duplicate execution
    const run = this.repo.claimArticleScheduleRun(schedule.id, scheduledFor);
    if (!run) {
      console.log(`[RecurringScheduler] Slot already claimed for schedule '${schedule.name}' at ${scheduledFor} — skipping`);
      return;
    }

    console.log(`[RecurringScheduler] Processing schedule '${schedule.name}' (${schedule.team_abbr}, depth=${schedule.depth_level})`);

    let articleId: string | null = null;
    let discoveryOutput: string | null = null;
    let selectedStory: string | null = null;

    try {
      // Build discovery prompt: search for current stories for this team
      const discoveryPrompt = buildDiscoveryPrompt(schedule.team_abbr, schedule.prompt, schedule.content_profile);

      // Step 1: Generate article idea (includes web_search via toolCalling)
      const result = await createArticleFromPrompt(
        {
          prompt: discoveryPrompt,
          teams: [schedule.team_abbr],
          depthLevel: schedule.depth_level,
          presetId: schedule.preset_id,
          readerProfile: schedule.reader_profile,
          articleForm: schedule.article_form,
          panelShape: schedule.panel_shape,
          analyticsMode: schedule.analytics_mode,
          panelConstraintsJson: schedule.panel_constraints_json,
          provider: schedule.provider_mode === 'override' && schedule.provider_id ? schedule.provider_id : undefined,
          surface: 'scheduledGeneration',
          actor: 'recurringScheduler',
        },
        this.repo,
        this.config,
        this.actionContext,
      );

      articleId = result.id;
      selectedStory = result.title;
      discoveryOutput = JSON.stringify({ prompt: discoveryPrompt, articleId: result.id, title: result.title });

      // Update run status to 'created_article'
      this.repo.updateArticleScheduleRun(run.id, {
        status: 'created_article',
        article_id: articleId,
        selected_story_json: JSON.stringify({ title: selectedStory }),
        discovery_json: discoveryOutput,
      });

      // Step 2: Auto-advance through pipeline to Stage 7
      if (this.actionContext) {
        const engine = this.actionContext.engine ?? new PipelineEngine(this.repo);
        const advanceResult = await autoAdvanceArticle(articleId, this.actionContext, {
          maxStage: 7,
          repo: this.repo,
          engine,
        });
        if (advanceResult.error) {
          console.warn(`[RecurringScheduler] Auto-advance warning for '${articleId}': ${advanceResult.error}`);
        }
        console.log(`[RecurringScheduler] Article '${articleId}' advanced to Stage ${advanceResult.finalStage}`);
      }

      this.repo.markArticleScheduleRunCompleted(run.id, {
        status: 'completed',
        discovery_json: discoveryOutput,
        selected_story_json: JSON.stringify({ title: selectedStory }),
        article_id: articleId,
      });
    } catch (err) {
      const errorText = err instanceof Error ? err.message : String(err);
      console.error(`[RecurringScheduler] Schedule '${schedule.name}' failed: ${errorText}`);
      this.repo.markArticleScheduleRunCompleted(run.id, {
        status: 'failed',
        error_text: errorText,
        article_id: articleId,
      });
    } finally {
      // Always advance next_run_at so the schedule doesn't re-fire the same slot
      const nextRun = calcNextRunAt(
        schedule.weekday_utc,
        schedule.time_of_day_utc,
        new Date(),
      );
      const nextRunISO = nextRun.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
      this.repo.updateArticleSchedule(schedule.id, {
        last_run_at: scheduledFor,
        next_run_at: nextRunISO,
      });
    }
  }
}

function buildDiscoveryPrompt(team: string, basePrompt: string, contentProfile: string): string {
  const profileNote =
    contentProfile === 'accessible'
      ? 'Write for casual fans — clear, friendly, accessible (depth 1 style).'
      : contentProfile === 'deep_dive'
      ? 'Write for hardcore fans — detailed analysis, advanced stats, deep context (depth 3 style).'
      : 'Write for engaged fans — balanced coverage with meaningful analysis (depth 2 style).';

  return [
    basePrompt,
    `\nPrimary team: ${team}`,
    `\nContent profile: ${profileNote}`,
    '\nSearch the web for the most recent, most impactful stories about this team.',
    'Identify the best angle for an article right now based on current events.',
    'Select the story with the highest reader interest and timeliness.',
  ].join('\n');
}
