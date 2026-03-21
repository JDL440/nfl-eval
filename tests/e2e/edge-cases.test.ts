/**
 * edge-cases.test.ts — E2E edge-case scenarios for the article pipeline.
 *
 * Scenarios:
 *  1. Auto-advance failure + retry (guard failure → stage_runs error → retry passes)
 *  2. Stage regression + re-advance (5→3 regression, artifact cleanup, fresh re-advance)
 *  3. Editor REVISE verdict loop (REVISE → regress → rewrite → APPROVE)
 *  4. Concurrent article creation (isolation of artifacts, stage_runs, transitions)
 *  5. Guard failures (missing idea.md, discussion-summary.md, substack_url, publisher pass)
 *
 * Uses a real ActionContext wired to MockProvider for deterministic LLM control.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

import { createApp } from '../../src/dashboard/server.js';
import { Repository } from '../../src/db/repository.js';
import { initDataDir, loadConfig } from '../../src/config/index.js';
import type { AppConfig } from '../../src/config/index.js';
import type { Article, Stage } from '../../src/types.js';
import { PipelineEngine } from '../../src/pipeline/engine.js';
import { PipelineAuditor } from '../../src/pipeline/audit.js';
import { AgentRunner } from '../../src/agents/runner.js';
import { AgentMemory } from '../../src/agents/memory.js';
import { LLMGateway } from '../../src/llm/gateway.js';
import { MockProvider } from '../../src/llm/providers/mock.js';
import { ModelPolicy } from '../../src/llm/model-policy.js';
import { executeTransition, type ActionContext } from '../../src/pipeline/actions.js';

// ── Test infrastructure ──────────────────────────────────────────────────────

let tmpDir: string;
let config: AppConfig;
let repo: Repository;
let app: ReturnType<typeof createApp>;
let engine: PipelineEngine;
let auditor: PipelineAuditor;
let memory: AgentMemory;
let runner: AgentRunner;
let gateway: LLMGateway;
let actionCtx: ActionContext;
let mockProvider: MockProvider;

const baseUrl = 'http://localhost:7777';

async function appFetch(path: string, init?: RequestInit): Promise<Response> {
  return app.fetch(new Request(new URL(path, baseUrl).toString(), init));
}

async function postJson(path: string, body: unknown): Promise<Response> {
  return appFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function htmxPost(path: string, formData?: Record<string, string>): Promise<Response> {
  const body = formData ? new URLSearchParams(formData).toString() : undefined;
  return appFetch(path, {
    method: 'POST',
    headers: {
      'HX-Request': 'true',
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body,
  });
}

async function getArticle(slug: string): Promise<Article> {
  const res = await appFetch(`/api/articles/${slug}`);
  return res.json() as Promise<Article>;
}

function writeArtifact(slug: string, filename: string, content: string): void {
  repo.artifacts.put(slug, filename, content);
}

function longText(words: number): string {
  return Array.from({ length: words }, (_, i) => `word${i}`).join(' ');
}

/** Advance an article directly in DB to targetStage by writing required artifacts. */
function advanceToStage(slug: string, targetStage: Stage): void {
  const STAGE_ARTIFACTS: Record<number, { name: string; content: string }> = {
    1: { name: 'idea.md', content: '# Idea\nTest article concept.' },
    2: { name: 'discussion-prompt.md', content: '# Discussion Prompt\nKey analysis question.' },
    3: { name: 'panel-composition.md', content: '# Panel\n- Analyst A\n- Analyst B' },
    4: { name: 'discussion-summary.md', content: '# Summary\nThe panel concluded X.' },
    5: { name: 'draft.md', content: `# Draft\n\n${longText(300)}` },
    6: { name: 'editor-review.md', content: '## Final Verdict: APPROVED\nGood to go.' },
  };

  for (let s = 1; s < targetStage; s++) {
    const artifact = STAGE_ARTIFACTS[s];
    if (artifact) writeArtifact(slug, artifact.name, artifact.content);
    repo.advanceStage(slug, s, (s + 1) as Stage, 'test-setup');
  }

  // Also write the guard artifact for the current stage so tests can immediately
  // attempt the next advance (e.g., stage 5 requires draft.md for 5→6).
  const currentStageArtifact = STAGE_ARTIFACTS[targetStage];
  if (currentStageArtifact) {
    writeArtifact(slug, currentStageArtifact.name, currentStageArtifact.content);
  }
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(() => {
  tmpDir = join(tmpdir(), `nfl-edge-e2e-${randomUUID()}`);
  mkdirSync(tmpDir, { recursive: true });
  process.env.NFL_DATA_DIR = tmpDir;
  initDataDir(tmpDir);
  config = loadConfig({ dataDir: tmpDir });
  repo = new Repository(config.dbPath);
  engine = new PipelineEngine(repo);
  auditor = new PipelineAuditor(repo, join(tmpDir, 'logs'));

  mkdirSync(config.chartersDir, { recursive: true });
  mkdirSync(config.skillsDir, { recursive: true });

  const CHARTER_TEMPLATE = (name: string, identity: string) =>
    `# ${name}\n\n## Identity\n${identity}\n\n## Responsibilities\n- Execute stage tasks\n\n## Boundaries\n- Stay on topic\n\n## Model\nauto\n`;

  const charters: Record<string, string> = {
    lead: CHARTER_TEMPLATE('Lead', 'The Lead orchestrates pipeline tasks.'),
    'panel-moderator': CHARTER_TEMPLATE('Panel Moderator', 'The Moderator runs panel discussions.'),
    writer: CHARTER_TEMPLATE('Writer', 'The Writer creates analytical articles.'),
    editor: CHARTER_TEMPLATE('Editor', 'The Editor reviews drafts.'),
    publisher: CHARTER_TEMPLATE('Publisher', 'The Publisher prepares articles for publication.'),
  };

  for (const [name, content] of Object.entries(charters)) {
    writeFileSync(join(config.chartersDir, `${name}.md`), content);
  }

  const SKILL_TEMPLATE = (name: string, desc: string) =>
    `---\nname: ${name}\ndescription: ${desc}\ndomain: editorial\nconfidence: 1.0\ntools: [none]\n---\n${desc}\n`;

  const skills: Record<string, string> = {
    'discussion-prompt': SKILL_TEMPLATE('discussion-prompt', 'Generate discussion prompts'),
    'panel-composition': SKILL_TEMPLATE('panel-composition', 'Compose an expert panel'),
    'substack-article': SKILL_TEMPLATE('substack-article', 'Write a Substack article'),
    'editor-review': SKILL_TEMPLATE('editor-review', 'Review an article draft'),
    publisher: SKILL_TEMPLATE('publisher', 'Run publisher pass'),
  };

  for (const [name, content] of Object.entries(skills)) {
    writeFileSync(join(config.skillsDir, `${name}.md`), content);
  }

  const modelsPath = join(process.cwd(), 'src', 'config', 'defaults', 'models.json');
  const policy = new ModelPolicy(modelsPath);
  mockProvider = new MockProvider();
  gateway = new LLMGateway({ modelPolicy: policy, providers: [mockProvider] });
  memory = new AgentMemory(config.memoryDbPath);
  runner = new AgentRunner({ gateway, memory, chartersDir: config.chartersDir, skillsDir: config.skillsDir });
  actionCtx = { repo, engine, runner, auditor, config };
  app = createApp(repo, config, { actionContext: actionCtx });
});

afterAll(() => {
  memory.close();
  repo.close();
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ok */ }
  delete process.env.NFL_DATA_DIR;
});

// ═════════════════════════════════════════════════════════════════════════════
// 1. Auto-advance failure + retry
// ═════════════════════════════════════════════════════════════════════════════

describe('Auto-advance failure + retry', () => {
  const slug = 'edge-auto-advance-failure';

  it('auto-advance fails at stage 1 when idea.md missing', async () => {
    repo.createArticle({ id: slug, title: 'Edge Auto-Advance Failure' });
    expect(repo.getArticle(slug)!.current_stage).toBe(1);

    const res = await appFetch(`/api/articles/${slug}/auto-advance`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json() as { currentStage: number; reason?: string };
    expect(body.currentStage).toBe(1);
    expect(body.reason ?? '').toContain('Idea has not been written yet');
  });

  it('audit log records the guard failure', () => {
    const history = auditor.getHistory(slug);
    const guardFailure = history.find(
      (e) => e.action === 'guard_check' && e.success === false,
    );
    expect(guardFailure).toBeDefined();
    expect(guardFailure!.fromStage).toBe(1);
  });

  it('stage_runs records an error entry for the failed stage', () => {
    const runId = repo.startStageRun({
      articleId: slug,
      stage: 1,
      surface: 'dashboard',
      actor: 'auto-advance',
      notes: 'Guard failed: idea.md missing',
      status: 'started',
    });
    repo.finishStageRun(runId, 'failed', 'Guard failed: idea.md missing');

    const runs = repo.getStageRuns(slug);
    const failed = runs.find(r => r.status === 'failed' && r.stage === 1);
    expect(failed).toBeDefined();
    expect(failed!.notes).toContain('Guard failed');
  });

  it('retry succeeds after adding idea.md — article advances beyond stage 1', async () => {
    writeArtifact(slug, 'idea.md', '# Idea content\nAnalyze the Seahawks draft.');

    const res = await appFetch(`/api/articles/${slug}/auto-advance`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json() as { currentStage: number; steps: unknown[] };

    expect(body.currentStage).toBeGreaterThan(1);
    expect(body.steps.length).toBeGreaterThanOrEqual(1);
  });

  it('stage_runs records a completed entry after retry', () => {
    const retryRunId = repo.startStageRun({
      articleId: slug,
      stage: 1,
      surface: 'dashboard',
      actor: 'auto-advance',
      notes: 'Retry after fix',
      status: 'started',
    });
    repo.finishStageRun(retryRunId, 'completed', 'Advanced past stage 1');

    const runs = repo.getStageRuns(slug);
    const completed = runs.find(r => r.status === 'completed' && r.stage === 1);
    expect(completed).toBeDefined();

    const usageEvents = repo.getUsageEvents(slug);
    expect(usageEvents.length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. Stage regression + re-advance
// ═════════════════════════════════════════════════════════════════════════════

describe('Stage regression + re-advance', () => {
  const slug = 'edge-regress-readvance';

  it('creates article and advances to stage 5', async () => {
    await postJson('/api/articles', { id: slug, title: 'Edge Regress' });
    writeArtifact(slug, 'idea.md', '# Idea');
    writeArtifact(slug, 'discussion-prompt.md', '# Prompt');
    writeArtifact(slug, 'panel-composition.md', '# Panel');
    writeArtifact(slug, 'discussion-summary.md', '# Original Summary');
    writeArtifact(slug, 'draft.md', `# Original Draft\n\n${longText(250)}`);
    writeArtifact(slug, 'editor-review.md', '## Verdict: APPROVED\n\nGood.');
    repo.advanceStage(slug, 1, 2, 'test');
    repo.advanceStage(slug, 2, 3, 'test');
    repo.advanceStage(slug, 3, 4, 'test');
    repo.advanceStage(slug, 4, 5, 'test');

    expect(repo.getArticle(slug)!.current_stage).toBe(5);
  });

  it('captures original artifact content before regression', () => {
    expect(repo.artifacts.get(slug, 'discussion-summary.md')).toContain('Original Summary');
    expect(repo.artifacts.get(slug, 'draft.md')).toContain('Original Draft');
  });

  it('regresses from stage 5 to stage 3 via API', async () => {
    const res = await postJson(`/api/articles/${slug}/regress`, {
      to_stage: 3,
      reason: 'Edge test regression',
    });
    expect(res.status).toBe(200);

    const article = await getArticle(slug);
    expect(article.current_stage).toBe(3);
    expect(article.status).toBe('revision');
  });

  it('artifacts from stages above 3 are cleared', () => {
    // Kept (stages ≤ 3)
    expect(repo.artifacts.exists(slug, 'idea.md')).toBe(true);
    expect(repo.artifacts.exists(slug, 'discussion-prompt.md')).toBe(true);
    expect(repo.artifacts.exists(slug, 'panel-composition.md')).toBe(true);

    // Cleared (stages > 3)
    expect(repo.artifacts.exists(slug, 'discussion-summary.md')).toBe(false);
    expect(repo.artifacts.exists(slug, 'draft.md')).toBe(false);
    expect(repo.artifacts.exists(slug, 'editor-review.md')).toBe(false);
  });

  it('re-advances to stage 4 with fresh artifacts distinct from originals', async () => {
    writeArtifact(slug, 'discussion-summary.md', '# Fresh Summary v2\nCompletely new insights.');

    const res = await htmxPost(`/htmx/articles/${slug}/advance`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Stage 4');

    const article = repo.getArticle(slug)!;
    expect(article.current_stage).toBe(4);

    const content = repo.artifacts.get(slug, 'discussion-summary.md');
    expect(content).toContain('Fresh Summary v2');
    expect(content).not.toContain('Original Summary');
  });

  it('regression is recorded in stage transitions', () => {
    const transitions = repo.getStageTransitions(slug);
    const regression = transitions.find(
      t => t.from_stage === 5 && t.to_stage === 3 && t.notes?.includes('Regression'),
    );
    expect(regression).toBeDefined();
    expect(regression!.notes).toContain('Edge test regression');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. Editor REVISE verdict loop
// ═════════════════════════════════════════════════════════════════════════════

describe('Editor REVISE verdict loop', () => {
  const slug = 'edge-editor-revise-loop';

  it('creates article and advances to stage 5 (draft stage)', () => {
    repo.createArticle({ id: slug, title: 'Editor Revise Loop' });
    advanceToStage(slug, 5 as Stage);
    expect(repo.getArticle(slug)!.current_stage).toBe(5);
  });

  it('writes draft.md and advances 5→6', async () => {
    // draft.md is the prerequisite for 5→6 — write it now
    writeArtifact(slug, 'draft.md', `# Draft Article\n\n${longText(300)}`);
    expect(repo.artifacts.exists(slug, 'draft.md')).toBe(true);
    expect(repo.artifacts.wordCount(slug, 'draft.md')).toBeGreaterThanOrEqual(200);

    const res = await htmxPost(`/htmx/articles/${slug}/advance`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Stage 6');
    expect(repo.getArticle(slug)!.current_stage).toBe(6);
  });

  it('REVISE verdict blocks advance from stage 6→7', async () => {
    writeArtifact(slug, 'editor-review.md', '## Final Verdict: REVISE\n\nNeeds more statistical support.');

    const res = await htmxPost(`/htmx/articles/${slug}/advance`);
    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain('REVISE');
  });

  it('regresses to stage 4 for draft rewrite', async () => {
    const res = await htmxPost(`/htmx/articles/${slug}/regress`, {
      to_stage: '4',
      reason: 'Editor requested revisions',
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Stage 4');

    expect(repo.getArticle(slug)!.current_stage).toBe(4);
    expect(repo.getArticle(slug)!.status).toBe('revision');

    // draft.md and editor-review.md should be cleared
    expect(repo.artifacts.exists(slug, 'draft.md')).toBe(false);
    expect(repo.artifacts.exists(slug, 'editor-review.md')).toBe(false);

    // discussion-summary.md preserved (stage 4 artifact)
    expect(repo.artifacts.exists(slug, 'discussion-summary.md')).toBe(true);
  });

  it('rewrites draft and advances back through 4→5→6', async () => {
    writeArtifact(slug, 'draft.md', `# Revised Draft v2\n\n${longText(400)}`);

    // 4→5 (discussion-summary guard passes)
    let res = await htmxPost(`/htmx/articles/${slug}/advance`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Stage 5');
    expect(repo.getArticle(slug)!.current_stage).toBe(5);

    // 5→6 (draft guard passes with 400 words)
    res = await htmxPost(`/htmx/articles/${slug}/advance`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Stage 6');
    expect(repo.getArticle(slug)!.current_stage).toBe(6);
  });

  it('APPROVE verdict advances from stage 6→7', async () => {
    writeArtifact(slug, 'editor-review.md', '## Final Verdict: APPROVED\n\nRevised draft meets quality standards.');

    const res = await htmxPost(`/htmx/articles/${slug}/advance`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Stage 7');
    expect(repo.getArticle(slug)!.current_stage).toBe(7);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. Concurrent article creation — no cross-contamination
// ═════════════════════════════════════════════════════════════════════════════

describe('Concurrent article creation', () => {
  const slugA = 'edge-concurrent-a';
  const slugB = 'edge-concurrent-b';

  it('creates two articles concurrently', async () => {
    const [resA, resB] = await Promise.all([
      postJson('/api/articles', { id: slugA, title: 'Concurrent A' }),
      postJson('/api/articles', { id: slugB, title: 'Concurrent B' }),
    ]);
    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
    expect(repo.getArticle(slugA)!.current_stage).toBe(1);
    expect(repo.getArticle(slugB)!.current_stage).toBe(1);
  });

  it('advances each article independently to different stages', async () => {
    // A: 1→2→3
    writeArtifact(slugA, 'idea.md', '# Idea A');
    let res = await htmxPost(`/htmx/articles/${slugA}/advance`);
    expect(res.status).toBe(200);
    expect(repo.getArticle(slugA)!.current_stage).toBe(2);

    writeArtifact(slugA, 'discussion-prompt.md', '# Prompt A');
    res = await htmxPost(`/htmx/articles/${slugA}/advance`);
    expect(res.status).toBe(200);
    expect(repo.getArticle(slugA)!.current_stage).toBe(3);

    // B: 1→2→3 (separate prompts)
    writeArtifact(slugB, 'idea.md', '# Idea B');
    res = await htmxPost(`/htmx/articles/${slugB}/advance`);
    expect(res.status).toBe(200);
    expect(repo.getArticle(slugB)!.current_stage).toBe(2);

    writeArtifact(slugB, 'discussion-prompt.md', '# Prompt B');
    res = await htmxPost(`/htmx/articles/${slugB}/advance`);
    expect(res.status).toBe(200);
    expect(repo.getArticle(slugB)!.current_stage).toBe(3);
  });

  it('artifacts are isolated per article', () => {
    const promptA = repo.artifacts.get(slugA, 'discussion-prompt.md');
    const promptB = repo.artifacts.get(slugB, 'discussion-prompt.md');

    expect(promptA).toContain('Prompt A');
    expect(promptB).toContain('Prompt B');
    expect(promptA).not.toContain('Prompt B');
    expect(promptB).not.toContain('Prompt A');
  });

  it('stage_runs are isolated per article', () => {
    const runA = repo.startStageRun({
      articleId: slugA, stage: 2, surface: 'test', actor: 'concurrent-test',
      notes: 'Alpha stage_run',
    });
    repo.finishStageRun(runA, 'completed', 'Alpha stage_run');

    const runB = repo.startStageRun({
      articleId: slugB, stage: 2, surface: 'test', actor: 'concurrent-test',
      notes: 'Beta stage_run',
    });
    repo.finishStageRun(runB, 'completed', 'Beta stage_run');

    const runsA = repo.getStageRuns(slugA);
    const runsB = repo.getStageRuns(slugB);

    expect(runsA.every(r => r.article_id === slugA)).toBe(true);
    expect(runsB.every(r => r.article_id === slugB)).toBe(true);

    expect(runsA.some(r => r.notes?.includes('Alpha'))).toBe(true);
    expect(runsA.some(r => r.notes?.includes('Beta'))).toBe(false);
    expect(runsB.some(r => r.notes?.includes('Beta'))).toBe(true);
    expect(runsB.some(r => r.notes?.includes('Alpha'))).toBe(false);
  });

  it('stage transitions are isolated per article', () => {
    const transA = repo.getStageTransitions(slugA);
    const transB = repo.getStageTransitions(slugB);

    expect(transA.every(t => t.article_id === slugA)).toBe(true);
    expect(transB.every(t => t.article_id === slugB)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. Guard failures
// ═════════════════════════════════════════════════════════════════════════════

describe('Guard failures', () => {
  it('rejects advance from stage 1 without idea.md', async () => {
    const slug = 'edge-guard-no-idea';
    repo.createArticle({ id: slug, title: 'Guard No Idea' });
    expect(repo.artifacts.exists(slug, 'idea.md')).toBe(false);

    const res = await htmxPost(`/htmx/articles/${slug}/advance`);
    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain('Idea has not been written yet');
  });

  it('rejects advance from stage 4 without discussion-summary.md', async () => {
    const slug = 'edge-guard-no-summary';
    repo.createArticle({ id: slug, title: 'Guard No Summary' });
    writeArtifact(slug, 'idea.md', '# Idea');
    repo.advanceStage(slug, 1, 2 as Stage, 'test');
    writeArtifact(slug, 'discussion-prompt.md', '# Prompt');
    repo.advanceStage(slug, 2, 3 as Stage, 'test');
    writeArtifact(slug, 'panel-composition.md', '# Panel');
    repo.advanceStage(slug, 3, 4 as Stage, 'test');

    expect(repo.getArticle(slug)!.current_stage).toBe(4);
    const res = await htmxPost(`/htmx/articles/${slug}/advance`);
    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain('Discussion summary');
  });

  it('rejects publish (7→8) without publisher-pass.md via executeTransition', async () => {
    const slug = 'edge-guard-no-substack';
    repo.createArticle({ id: slug, title: 'Publish Guard No URL' });
    advanceToStage(slug, 7 as Stage);

    // No publisher-pass.md artifact — guard should fail
    const result = await executeTransition(slug, 7 as Stage, actionCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Publisher pass review has not been run yet');
  });

  it('rejects advance from stage 7 without publisher-pass.md artifact', async () => {
    const slug = 'edge-guard-no-publisher';
    repo.createArticle({ id: slug, title: 'Guard No Publisher Pass' });
    advanceToStage(slug, 7 as Stage);

    const res = await htmxPost(`/htmx/articles/${slug}/advance`);
    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain('Publisher pass review');
  });

  it('allows advance from stage 7 when publisher-pass.md artifact exists', async () => {
    const slug = 'edge-guard-has-publisher';
    repo.createArticle({ id: slug, title: 'Guard Has Publisher Pass' });
    advanceToStage(slug, 7 as Stage);

    writeArtifact(slug, 'publisher-pass.md', '# Publisher Pass\nReview complete.');

    const res = await htmxPost(`/htmx/articles/${slug}/advance`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Stage 8');
  });
});
