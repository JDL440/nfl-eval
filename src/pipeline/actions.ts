/**
 * actions.ts — Stage transition actions.
 *
 * Each action executes the actual work for a stage transition:
 * loading input artifacts, calling the appropriate agent, and writing output.
 */

import type { Stage } from '../types.js';
import { STAGE_NAMES } from '../types.js';
import type { Repository } from '../db/repository.js';
import type { PipelineEngine } from './engine.js';
import type { AgentRunner } from '../agents/runner.js';
import type { PipelineAuditor } from './audit.js';
import type { AppConfig } from '../config/index.js';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ActionContext {
  repo: Repository;
  engine: PipelineEngine;
  runner: AgentRunner;
  auditor: PipelineAuditor;
  config: AppConfig;
}

export interface ActionResult {
  success: boolean;
  artifactPath?: string;
  error?: string;
  duration: number;
}

export type StageAction = (articleId: string, ctx: ActionContext) => Promise<ActionResult>;

// ── Helpers ─────────────────────────────────────────────────────────────────

function readArtifact(repo: Repository, articleId: string, filename: string): string {
  const content = repo.artifacts.get(articleId, filename);
  if (content == null) {
    throw new Error(`Required artifact not found: ${filename}`);
  }
  return content;
}

function writeArtifact(repo: Repository, articleId: string, filename: string, content: string): void {
  repo.artifacts.put(articleId, filename, content);
}

// ── Action implementations ──────────────────────────────────────────────────

/** Stage 1→2: Generate discussion prompt from idea. */
async function generatePrompt(articleId: string, ctx: ActionContext): Promise<ActionResult> {
  const start = Date.now();
  try {
    const article = ctx.repo.getArticle(articleId);
    if (!article) throw new Error(`Article '${articleId}' not found`);

    const idea = readArtifact(ctx.repo, articleId, 'idea.md');

    const result = await ctx.runner.run({
      agentName: 'lead',
      task: 'Generate a discussion prompt from the following idea.',
      skills: ['discussion-prompt'],
      articleContext: {
        slug: articleId,
        title: article.title,
        stage: article.current_stage,
        content: idea,
      },
    });

    writeArtifact(ctx.repo, articleId, 'discussion-prompt.md', result.content);
    return { success: true, duration: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - start,
    };
  }
}

/** Stage 2→3: Compose panel of analysts. */
async function composePanel(articleId: string, ctx: ActionContext): Promise<ActionResult> {
  const start = Date.now();
  try {
    const article = ctx.repo.getArticle(articleId);
    if (!article) throw new Error(`Article '${articleId}' not found`);

    const prompt = readArtifact(ctx.repo, articleId, 'discussion-prompt.md');

    const result = await ctx.runner.run({
      agentName: 'lead',
      task: 'Compose a panel of analysts for this discussion.',
      skills: ['panel-composition'],
      articleContext: {
        slug: articleId,
        title: article.title,
        stage: article.current_stage,
        content: prompt,
      },
    });

    writeArtifact(ctx.repo, articleId, 'panel-composition.md', result.content);
    return { success: true, duration: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - start,
    };
  }
}

/** Stage 3→4: Run panel discussion. */
async function runDiscussion(articleId: string, ctx: ActionContext): Promise<ActionResult> {
  const start = Date.now();
  try {
    const article = ctx.repo.getArticle(articleId);
    if (!article) throw new Error(`Article '${articleId}' not found`);

    const prompt = readArtifact(ctx.repo, articleId, 'discussion-prompt.md');
    const panel = readArtifact(ctx.repo, articleId, 'panel-composition.md');

    const result = await ctx.runner.run({
      agentName: 'panel-moderator',
      task: 'Moderate the panel discussion and produce a summary.',
      articleContext: {
        slug: articleId,
        title: article.title,
        stage: article.current_stage,
        content: `## Discussion Prompt\n${prompt}\n\n## Panel\n${panel}`,
      },
    });

    writeArtifact(ctx.repo, articleId, 'discussion-summary.md', result.content);
    return { success: true, duration: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - start,
    };
  }
}

/** Stage 4→5: Write article draft. */
async function writeDraft(articleId: string, ctx: ActionContext): Promise<ActionResult> {
  const start = Date.now();
  try {
    const article = ctx.repo.getArticle(articleId);
    if (!article) throw new Error(`Article '${articleId}' not found`);

    const summary = readArtifact(ctx.repo, articleId, 'discussion-summary.md');

    const result = await ctx.runner.run({
      agentName: 'writer',
      task: 'Write the full article draft from the panel discussion summary.',
      skills: ['substack-article'],
      articleContext: {
        slug: articleId,
        title: article.title,
        stage: article.current_stage,
        content: summary,
      },
    });

    writeArtifact(ctx.repo, articleId, 'draft.md', result.content);
    return { success: true, duration: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - start,
    };
  }
}

/** Stage 5→6: Run editor review. */
async function runEditor(articleId: string, ctx: ActionContext): Promise<ActionResult> {
  const start = Date.now();
  try {
    const article = ctx.repo.getArticle(articleId);
    if (!article) throw new Error(`Article '${articleId}' not found`);

    const draft = readArtifact(ctx.repo, articleId, 'draft.md');

    const result = await ctx.runner.run({
      agentName: 'editor',
      task: 'Review the article draft and provide editorial feedback.',
      skills: ['editor-review'],
      articleContext: {
        slug: articleId,
        title: article.title,
        stage: article.current_stage,
        content: draft,
      },
    });

    writeArtifact(ctx.repo, articleId, 'editor-review.md', result.content);
    return { success: true, duration: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - start,
    };
  }
}

/** Stage 6→7: Run publisher pass. */
async function runPublisherPass(articleId: string, ctx: ActionContext): Promise<ActionResult> {
  const start = Date.now();
  try {
    const article = ctx.repo.getArticle(articleId);
    if (!article) throw new Error(`Article '${articleId}' not found`);

    const draft = readArtifact(ctx.repo, articleId, 'draft.md');

    const result = await ctx.runner.run({
      agentName: 'publisher',
      task: 'Run the publisher pass to prepare the article for publication.',
      skills: ['publisher'],
      articleContext: {
        slug: articleId,
        title: article.title,
        stage: article.current_stage,
        content: draft,
      },
    });

    writeArtifact(ctx.repo, articleId, 'publisher-pass.md', result.content);
    return { success: true, duration: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - start,
    };
  }
}

/** Stage 7→8: Publish (no agent needed — handled externally). */
async function publish(articleId: string, ctx: ActionContext): Promise<ActionResult> {
  const start = Date.now();
  try {
    const article = ctx.repo.getArticle(articleId);
    if (!article) throw new Error(`Article '${articleId}' not found`);

    if (!article.substack_url) {
      return {
        success: false,
        error: 'substack_url not set — publish via dashboard first',
        duration: Date.now() - start,
      };
    }

    return { success: true, duration: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - start,
    };
  }
}

// ── Action registry ─────────────────────────────────────────────────────────

export const STAGE_ACTIONS: Record<string, StageAction> = {
  generatePrompt,
  composePanel,
  runDiscussion,
  writeDraft,
  runEditor,
  runPublisherPass,
  publish,
};

// ── Transition map (stage → action name) ────────────────────────────────────

const STAGE_ACTION_MAP: Partial<Record<Stage, string>> = {
  1: 'generatePrompt',
  2: 'composePanel',
  3: 'runDiscussion',
  4: 'writeDraft',
  5: 'runEditor',
  6: 'runPublisherPass',
  7: 'publish',
};

// ── Execute a full transition ───────────────────────────────────────────────

export async function executeTransition(
  articleId: string,
  fromStage: Stage,
  ctx: ActionContext,
): Promise<ActionResult> {
  const start = Date.now();
  const actionName = STAGE_ACTION_MAP[fromStage];

  if (!actionName) {
    return {
      success: false,
      error: `No action defined for stage ${fromStage} (${STAGE_NAMES[fromStage]})`,
      duration: Date.now() - start,
    };
  }

  const action = STAGE_ACTIONS[actionName];
  if (!action) {
    return {
      success: false,
      error: `Action '${actionName}' not found in STAGE_ACTIONS`,
      duration: Date.now() - start,
    };
  }

  // 1. Check guard
  const check = ctx.engine.canAdvance(articleId, fromStage);
  if (!check.allowed) {
    const result: ActionResult = {
      success: false,
      error: `Guard failed: ${check.reason}`,
      duration: Date.now() - start,
    };

    ctx.auditor.log({
      articleId,
      action: 'guard_check',
      fromStage,
      toStage: check.nextStage,
      trigger: 'auto',
      success: false,
      error: check.reason,
      duration: result.duration,
    });

    return result;
  }

  // 2. Run the action
  const actionResult = await action(articleId, ctx);

  if (!actionResult.success) {
    ctx.auditor.log({
      articleId,
      action: 'advance',
      fromStage,
      toStage: check.nextStage,
      trigger: 'auto',
      agent: actionName,
      success: false,
      error: actionResult.error,
      duration: actionResult.duration,
    });

    return actionResult;
  }

  // 3. Advance the stage
  try {
    ctx.engine.advance(articleId, fromStage, actionName);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Action succeeded but advance failed: ${msg}`,
      duration: Date.now() - start,
    };
  }

  // 4. Audit
  ctx.auditor.log({
    articleId,
    action: 'advance',
    fromStage,
    toStage: check.nextStage,
    trigger: 'auto',
    agent: actionName,
    success: true,
    duration: actionResult.duration,
    metadata: actionResult.artifactPath
      ? { artifactPath: actionResult.artifactPath }
      : undefined,
  });

  return actionResult;
}
