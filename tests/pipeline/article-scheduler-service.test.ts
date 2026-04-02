import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Repository } from '../../src/db/repository.js';
import * as actionsModule from '../../src/pipeline/actions.js';
import {
  buildInitialNextRunAt,
  computeNextRunAt,
  createArticleSchedulerService,
} from '../../src/pipeline/article-scheduler-service.js';
import { parseScheduledStoryDiscovery } from '../../src/pipeline/idea-generation.js';
import type { AppConfig } from '../../src/config/index.js';
import type { ActionContext } from '../../src/pipeline/actions.js';

describe('article scheduler service utilities', () => {
  it('computes next Tuesday slot from Monday', () => {
    const next = computeNextRunAt(
      { weekday_utc: 2, time_of_day_utc: '14:00' },
      new Date('2025-07-14T08:00:00Z'),
    );
    expect(next).toBe('2025-07-15 14:00:00');
  });

  it('rolls forward a week when the same-day slot has passed', () => {
    const next = buildInitialNextRunAt(
      { weekday_utc: 4, time_of_day_utc: '10:30' },
      new Date('2025-07-17T12:00:00Z'),
    );
    expect(next).toBe('2025-07-24 10:30:00');
  });

  it('parses ranked discovery JSON and preserves the selected candidate', () => {
    const discovery = parseScheduledStoryDiscovery(JSON.stringify({
      candidates: [
        {
          title: 'Camp battle is heating up',
          angle: 'Competition is reshaping the depth chart',
          whyNow: 'Beat writers are reporting daily changes',
          score: 8.5,
          prompt: 'Turn the roster battle into a fan-friendly idea',
          evidence: [{ url: 'https://example.com/story', note: 'latest report' }],
        },
      ],
      selectedIndex: 0,
      selectionReason: 'Most timely angle this week',
    }));

    expect(discovery.candidates).toHaveLength(1);
    expect(discovery.selectedIndex).toBe(0);
    expect(discovery.selectionReason).toBe('Most timely angle this week');
    expect(discovery.candidates[0]?.title).toBe('Camp battle is heating up');
  });

  it('rejects discovery output without valid candidates', () => {
    expect(() => parseScheduledStoryDiscovery(JSON.stringify({ candidates: [{}] }))).toThrow(
      'Scheduled discovery returned no valid candidates',
    );
  });
});

describe('ArticleSchedulerService', () => {
  let tempDir: string;
  let repo: Repository;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'article-scheduler-'));
    repo = new Repository(join(tempDir, 'pipeline.db'));
  });

  afterEach(() => {
    repo.close();
    rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('runs a mocked schedule tick end to end with preset-driven controls', async () => {
    const runner = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          content: JSON.stringify({
            candidates: [{
              title: 'Camp battle is heating up',
              angle: 'Competition is reshaping the depth chart',
              whyNow: 'Beat writers are reporting daily changes',
              score: 8.5,
              prompt: 'Turn the roster battle into a fan-friendly idea',
              evidence: [{ url: 'https://example.com/story', note: 'latest report' }],
            }],
            selectedIndex: 0,
            selectionReason: 'Most timely angle this week',
          }),
        })
        .mockResolvedValueOnce({
          content: '# Article Idea: Seahawks camp battle\n\n## Working Title\nSeahawks camp battle\n\n## Angle / Tension\nCompetition is reshaping the depth chart',
          thinking: null,
          model: 'gpt-5-mini',
          agentName: 'lead',
          provider: 'mock',
          tokensUsed: { prompt: 10, completion: 20 },
          traceId: null,
        }),
      gateway: {
        getProvider: vi.fn().mockReturnValue({}),
      },
    };
    vi.spyOn(actionsModule, 'autoAdvanceArticle').mockResolvedValue({
      success: true,
      duration: 1,
    });

    const config = {
      league: 'nfl',
      scriptsDir: tempDir,
      teams: [{ abbr: 'SEA', city: 'Seattle', name: 'Seahawks' }],
      leagueConfig: { name: 'NFL Lab' },
    } as unknown as AppConfig;
    const actionContext = {
      repo,
      config,
      runner,
      engine: {},
      auditor: {},
    } as unknown as ActionContext;

    const schedule = repo.createArticleSchedule({
      name: 'Seahawks Tuesday',
      team_abbr: 'SEA',
      prompt: 'Find the best Seahawks story',
      weekday_utc: 2,
      time_of_day_utc: '14:00',
      content_profile: 'accessible',
      depth_level: 1,
      preset_id: 'casual_explainer',
      reader_profile: 'casual',
      article_form: 'brief',
      panel_shape: 'news_reaction',
      analytics_mode: 'explain_only',
      panel_constraints_json: JSON.stringify({ min_agents: 2, max_agents: 2 }),
      next_run_at: '2025-07-15 14:00:00',
    });

    const service = createArticleSchedulerService({
      repo,
      config,
      actionContext,
      now: () => new Date('2025-07-15T14:05:00Z'),
      logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    const result = await service.tick();

    expect(result.processed).toBe(1);
    expect(result.results[0]?.status).toBe('completed');
    const articleId = result.results[0]?.articleId;
    expect(articleId).toBeTruthy();
    const article = repo.getArticle(articleId!);
    expect(article?.preset_id).toBe('casual_explainer');
    expect(article?.reader_profile).toBe('casual');
    expect(article?.article_form).toBe('brief');
    expect(article?.panel_shape).toBe('news_reaction');
    expect(article?.analytics_mode).toBe('explain_only');
    expect(article?.depth_level).toBe(1);

    const runCalls = vi.mocked(runner.run).mock.calls;
    expect(runCalls[0]?.[0].task).toContain('Preset: casual_explainer');
    expect(runCalls[1]?.[0].task).toContain('Reader profile: Casual');
    expect(runCalls[1]?.[0].task).toContain('Panel shape: News reaction');

    const runs = repo.listArticleScheduleRuns(schedule.id);
    expect(runs[0]?.status).toBe('completed');
    expect(runs[0]?.article_id).toBe(articleId);
  });
});
