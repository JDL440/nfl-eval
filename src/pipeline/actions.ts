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
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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

// ── Configurable upstream context ───────────────────────────────────────────

/**
 * Per-action context configuration. Each action has a primary artifact and an
 * optional list of upstream artifacts to include for richer agent context.
 * Set include to ['*'] to include ALL prior artifacts.
 */
export interface StageContextEntry {
  primary: string;
  include: string[];
}

/** Default context config — smart defaults that balance quality vs token cost. */
const DEFAULT_STAGE_CONTEXT: Record<string, StageContextEntry> = {
  generatePrompt:  { primary: 'idea.md',               include: [] },
  composePanel:    { primary: 'discussion-prompt.md',   include: ['idea.md'] },
  runDiscussion:   { primary: 'discussion-prompt.md',   include: [] },  // panel-composition injected separately
  writeDraft:      { primary: 'discussion-summary.md',  include: ['idea.md'] },
  runEditor:       { primary: 'draft.md',               include: ['idea.md', 'discussion-summary.md'] },
  runPublisherPass:{ primary: 'draft.md',               include: ['editor-review.md'] },
};

let _contextOverrides: Record<string, StageContextEntry> | undefined;

/** Load context config overrides from dataDir/config/pipeline-context.json if present. */
function loadContextConfig(config: AppConfig): Record<string, StageContextEntry> {
  if (_contextOverrides !== undefined) return _contextOverrides;

  const configPath = join(config.dataDir, 'config', 'pipeline-context.json');
  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, 'utf-8');
      _contextOverrides = JSON.parse(raw) as Record<string, StageContextEntry>;
    } catch {
      _contextOverrides = {};
    }
  } else {
    _contextOverrides = {};
  }
  return _contextOverrides;
}

/** Reset cached overrides (for testing). */
export function resetContextConfigCache(): void {
  _contextOverrides = undefined;
}

/** Resolve the context config for an action, merging defaults with overrides. */
function getContextConfig(actionName: string, config: AppConfig): StageContextEntry {
  const overrides = loadContextConfig(config);
  return overrides[actionName] ?? DEFAULT_STAGE_CONTEXT[actionName] ?? { primary: '', include: [] };
}

/**
 * Gather upstream context for an agent. Returns the primary artifact content
 * with any configured upstream artifacts prepended as labeled sections.
 */
function gatherContext(
  repo: Repository,
  articleId: string,
  actionName: string,
  config: AppConfig,
): string {
  const ctx = getContextConfig(actionName, config);
  const parts: string[] = [];

  // Resolve included artifacts
  let includeList = ctx.include;
  if (includeList.includes('*')) {
    // Include all existing artifacts except the primary
    const all = repo.artifacts.list(articleId);
    includeList = all
      .map(a => a.name)
      .filter(name => name !== ctx.primary);
  }

  for (const name of includeList) {
    const content = repo.artifacts.get(articleId, name);
    if (content) {
      parts.push(`## Upstream Context: ${name}\n${content}`);
    }
  }

  // Primary artifact last (most important, freshest context)
  const primary = readArtifact(repo, articleId, ctx.primary);
  if (parts.length > 0) {
    parts.push(`## Primary Input: ${ctx.primary}\n${primary}`);
    return parts.join('\n\n---\n\n');
  }

  return primary;
}

// ── Roster helpers ──────────────────────────────────────────────────────────

const PRODUCTION_AGENTS = new Set([
  'lead', 'writer', 'editor', 'scribe', 'coordinator', 'panel-moderator', 'publisher',
]);

const TEAM_ABBRS = new Set([
  'ari','atl','bal','buf','car','chi','cin','cle','dal','den','det','gb',
  'hou','ind','jax','kc','lac','lar','lv','mia','min','ne','no','nyg',
  'nyj','phi','pit','sea','sf','tb','ten','wsh',
]);

/** Build a categorized roster string from available agent charters. */
function buildAgentRoster(runner: AgentRunner): string {
  const agents = runner.listAgents();
  const specialists: string[] = [];
  const teamAgents: string[] = [];

  for (const name of agents) {
    if (PRODUCTION_AGENTS.has(name)) continue;

    const charter = runner.loadCharter(name);
    const identity = charter?.identity ?? '';
    const summary = identity.split('\n')[0]?.slice(0, 120) || name;

    if (TEAM_ABBRS.has(name)) {
      teamAgents.push(`- **${name.toUpperCase()}**: ${summary}`);
    } else {
      specialists.push(`- **${name}**: ${summary}`);
    }
  }

  return [
    '### Specialists',
    ...specialists,
    '',
    '### Team Agents',
    ...teamAgents,
  ].join('\n');
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

    const promptContent = gatherContext(ctx.repo, articleId, 'composePanel', ctx.config);

    const roster = buildAgentRoster(ctx.runner);
    const depthLevel = article.depth_level ?? 2;

    const task = [
      'Select a panel of analysts for this discussion from the available roster.',
      '',
      `Depth Level: ${depthLevel} (${depthLevel === 1 ? '2 agents max' : depthLevel === 2 ? '3-4 agents' : '4-5 agents'})`,
      '',
      '## Available Agents',
      roster,
      '',
      'Rules:',
      '- Always include the relevant team agent for the primary team',
      '- Always include at least one specialist',
      '- Select agents whose expertise matches the article topic',
      '- Panel size must respect the depth level limits',
      '- Each panelist should have a distinct analytical lane',
    ].join('\n');

    const result = await ctx.runner.run({
      agentName: 'lead',
      task,
      skills: ['panel-composition'],
      articleContext: {
        slug: articleId,
        title: article.title,
        stage: article.current_stage,
        content: promptContent,
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
      skills: ['article-discussion'],
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

    const content = gatherContext(ctx.repo, articleId, 'writeDraft', ctx.config);

    const result = await ctx.runner.run({
      agentName: 'writer',
      task: 'Write the full article draft from the panel discussion summary.',
      skills: ['substack-article'],
      articleContext: {
        slug: articleId,
        title: article.title,
        stage: article.current_stage,
        content,
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

    const content = gatherContext(ctx.repo, articleId, 'runEditor', ctx.config);

    const result = await ctx.runner.run({
      agentName: 'editor',
      task: 'Review the article draft and provide editorial feedback.',
      skills: ['editor-review'],
      articleContext: {
        slug: articleId,
        title: article.title,
        stage: article.current_stage,
        content,
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

    const content = gatherContext(ctx.repo, articleId, 'runPublisherPass', ctx.config);

    const result = await ctx.runner.run({
      agentName: 'publisher',
      task: 'Run the publisher pass to prepare the article for publication.',
      skills: ['publisher'],
      articleContext: {
        slug: articleId,
        title: article.title,
        stage: article.current_stage,
        content,
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
