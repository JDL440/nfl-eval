/**
 * scheduler.ts — Pipeline Scheduler for batch discovery and advancement.
 *
 * Wraps PipelineEngine to add batch operations: find articles ready for
 * advancement, advance them individually or in batch, and summarise the
 * pipeline state.
 */

import type { Stage } from '../types.js';
import { STAGE_NAMES, VALID_STAGES } from '../types.js';
import type { Repository } from '../db/repository.js';
import type { PipelineEngine } from './engine.js';
import { executeTransition, type ActionContext } from './actions.js';

// ── Config ──────────────────────────────────────────────────────────────────

export interface SchedulerConfig {
  maxConcurrent?: number;   // Max articles to process at once (default 5)
  dryRun?: boolean;         // Log actions without executing (default false)
}

// ── Result types ────────────────────────────────────────────────────────────

export interface PendingAction {
  articleId: string;
  title: string;
  currentStage: Stage;
  nextStage: Stage;
  stageName: string;
  nextStageName: string;
  reason: string;
}

export interface BatchResult {
  attempted: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: Array<{
    articleId: string;
    fromStage: Stage;
    toStage: Stage;
    success: boolean;
    error?: string;
  }>;
}

// ── Pipeline Scheduler ──────────────────────────────────────────────────────

export class PipelineScheduler {
  private engine: PipelineEngine;
  private repo: Repository;
  private config: Required<SchedulerConfig>;

  constructor(engine: PipelineEngine, repo: Repository, config?: SchedulerConfig) {
    this.engine = engine;
    this.repo = repo;
    this.config = {
      maxConcurrent: config?.maxConcurrent ?? 5,
      dryRun: config?.dryRun ?? false,
    };
  }

  /**
   * Find all articles that can advance to the next stage.
   */
  findReady(): PendingAction[] {
    const articles = this.repo.getAllArticles();
    const pending: PendingAction[] = [];

    for (const article of articles) {
      if (article.current_stage === 8) continue;

      const check = this.engine.canAdvance(article.id, article.current_stage);
      if (check.allowed) {
        pending.push({
          articleId: article.id,
          title: article.title,
          currentStage: article.current_stage,
          nextStage: check.nextStage,
          stageName: STAGE_NAMES[article.current_stage],
          nextStageName: STAGE_NAMES[check.nextStage],
          reason: check.reason,
        });
      }
    }

    return pending;
  }

  /**
   * Find articles ready to advance at a specific stage.
   */
  findReadyAtStage(stage: Stage): PendingAction[] {
    return this.findReady().filter((p) => p.currentStage === stage);
  }

  /**
   * Advance a single article to its next stage.
   */
  async advanceSingle(
    articleId: string,
    agent = 'scheduler',
    actionContext?: ActionContext,
  ): Promise<{ success: boolean; error?: string }> {
    const article = this.repo.getArticle(articleId);
    if (article == null) {
      return { success: false, error: `Article '${articleId}' not found` };
    }

    if (this.config.dryRun) {
      const check = this.engine.canAdvance(articleId, article.current_stage);
      if (!check.allowed) {
        return { success: false, error: check.reason };
      }
      return { success: true };
    }

    if (actionContext) {
      // Full execution: run agent → write artifact → advance
      const result = await executeTransition(articleId, article.current_stage as Stage, actionContext);
      if (!result.success) {
        return { success: false, error: result.error };
      }
      return { success: true };
    }

    // Lightweight mode: just check guards and advance
    const check = this.engine.canAdvance(articleId, article.current_stage);
    if (!check.allowed) {
      return { success: false, error: check.reason };
    }

    try {
      this.engine.advance(articleId, article.current_stage, agent);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  /**
   * Advance all ready articles in batch.
   * Processes sequentially (SQLite is single-writer).
   */
  async advanceBatch(options?: {
    stage?: Stage;
    limit?: number;
    agent?: string;
  }): Promise<BatchResult> {
    const agent = options?.agent ?? 'scheduler';
    const limit = options?.limit ?? this.config.maxConcurrent;

    let ready = options?.stage != null
      ? this.findReadyAtStage(options.stage)
      : this.findReady();

    const skipped = Math.max(0, ready.length - limit);
    ready = ready.slice(0, limit);

    const result: BatchResult = {
      attempted: ready.length,
      succeeded: 0,
      failed: 0,
      skipped,
      results: [],
    };

    for (const action of ready) {
      const outcome = await this.advanceSingle(action.articleId, agent);
      result.results.push({
        articleId: action.articleId,
        fromStage: action.currentStage,
        toStage: action.nextStage,
        success: outcome.success,
        error: outcome.error,
      });
      if (outcome.success) {
        result.succeeded++;
      } else {
        result.failed++;
      }
    }

    return result;
  }

  /**
   * Return a summary of the pipeline: counts per stage and readiness.
   */
  summary(): Record<Stage, { name: string; count: number; ready: number }> {
    const articles = this.repo.getAllArticles();

    const out = {} as Record<Stage, { name: string; count: number; ready: number }>;
    for (const s of VALID_STAGES) {
      out[s] = { name: STAGE_NAMES[s], count: 0, ready: 0 };
    }

    for (const article of articles) {
      out[article.current_stage].count++;

      if (article.current_stage === 8) continue;
      const check = this.engine.canAdvance(article.id, article.current_stage);
      if (check.allowed) {
        out[article.current_stage].ready++;
      }
    }

    return out;
  }
}
