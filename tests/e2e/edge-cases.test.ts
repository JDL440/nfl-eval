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
import { executeTransition, autoAdvanceArticle, type ActionContext } from '../../src/pipeline/actions.js';

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

function buildValidDraft(totalWords: number, title = 'Draft'): string {
  const prefix = [
    `# ${title}`,
    '',
    '> **📋 TLDR**',
    '> - Fix the line first.',
    '> - Preserve flexibility for core extensions.',
    '> - Target Day 2 value in the secondary.',
    '> - Turn the panel consensus into a clear offseason plan.',
    '',
  ].join('\n');
  const prefixWords = prefix.split(/\s+/).filter(Boolean).length;
  const remaining = Math.max(totalWords - prefixWords, 0);
  return `${prefix}${remaining > 0 ? `\n${longText(remaining)}` : ''}`;
}

/** Advance an article directly in DB to targetStage by writing required artifacts. */
function advanceToStage(slug: string, targetStage: Stage): void {
  const STAGE_ARTIFACTS: Record<number, { name: string; content: string }> = {
    1: { name: 'idea.md', content: '# Idea\nTest article concept.' },
    2: { name: 'discussion-prompt.md', content: '# Discussion Prompt\nKey analysis question.' },
    3: { name: 'panel-composition.md', content: '# Panel\n- Analyst A\n- Analyst B' },
    4: { name: 'discussion-summary.md', content: '# Summary\nThe panel concluded X.' },
    5: { name: 'draft.md', content: buildValidDraft(300) },
    6: { name: 'editor-review.md', content: '## Final Verdict: APPROVED\nGood to go.' },
  };

  for (let s = 1; s < targetStage; s++) {
    const artifact = STAGE_ARTIFACTS[s];
    if (artifact) writeArtifact(slug, artifact.name, artifact.content);
    
    // After writing discussion-summary.md (stage 4), also write article-contract.md
    if (s === 4) {
      writeArtifact(slug, 'article-contract.md', '# Article Contract\n\n## Structure\n- Introduction\n- Analysis\n- Conclusion\n\n## Word Count Target\n300 words');
    }
    
    repo.advanceStage(slug, s, (s + 1) as Stage, 'test-setup');
  }

  // Also write the guard artifact for the current stage so tests can immediately
  // attempt the next advance (e.g., stage 5 requires draft.md for 5→6).
  const currentStageArtifact = STAGE_ARTIFACTS[targetStage];
  if (currentStageArtifact) {
    writeArtifact(slug, currentStageArtifact.name, currentStageArtifact.content);
  }
  
  // If at stage 4, also write article-contract.md for the next advance
  if (targetStage === 4) {
    writeArtifact(slug, 'article-contract.md', '# Article Contract\n\n## Structure\n- Introduction\n- Analysis\n- Conclusion\n\n## Word Count Target\n300 words');
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
  mockProvider.setLatency(false); // Disable simulated latency in tests
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
    const body = await res.json() as { id: string; status: string };
    expect(body.status).toBe('started');

    // Wait for background auto-advance to complete
    await new Promise(r => setTimeout(r, 500));
    // Should still be at stage 1 — guard failed
    expect(repo.getArticle(slug)!.current_stage).toBe(1);
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
    const body = await res.json() as { id: string; status: string };
    expect(body.status).toBe('started');

    // Wait for background auto-advance to complete
    await new Promise(r => setTimeout(r, 1000));
    expect(repo.getArticle(slug)!.current_stage).toBeGreaterThan(1);
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
    writeArtifact(slug, 'article-contract.md', '# Article Contract\n\n## Structure\n- Introduction\n- Analysis\n- Conclusion\n\n## Word Count Target\n250 words');
    writeArtifact(slug, 'draft.md', buildValidDraft(250, 'Original Draft'));
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
    expect(repo.artifacts.exists(slug, 'article-contract.md')).toBe(false);
    expect(repo.artifacts.exists(slug, 'draft.md')).toBe(false);
    expect(repo.artifacts.exists(slug, 'editor-review.md')).toBe(false);
  });

  it('re-advances to stage 4 with fresh artifacts distinct from originals', async () => {
    writeArtifact(slug, 'discussion-summary.md', '# Fresh Summary v2\nCompletely new insights.');
    writeArtifact(slug, 'article-contract.md', '# Article Contract v2\n\n## Structure\n- New Introduction\n- Fresh Analysis\n- Updated Conclusion\n\n## Word Count Target\n400 words');

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
    writeArtifact(slug, 'draft.md', buildValidDraft(300, 'Draft Article'));
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

    // discussion-summary.md and article-contract.md preserved (stage 4 artifacts)
    expect(repo.artifacts.exists(slug, 'discussion-summary.md')).toBe(true);
    expect(repo.artifacts.exists(slug, 'article-contract.md')).toBe(true);
  });

  it('rewrites draft and advances back through 4→5→6', async () => {
    writeArtifact(slug, 'draft.md', buildValidDraft(400, 'Revised Draft v2'));

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

  it('blocks htmx advance from stage 7 even with publisher-pass.md (substack_url guard)', async () => {
    const slug = 'edge-guard-has-publisher';
    repo.createArticle({ id: slug, title: 'Guard Has Publisher Pass' });
    advanceToStage(slug, 7 as Stage);

    writeArtifact(slug, 'publisher-pass.md', '# Publisher Pass\nReview complete.');

    // htmx advance is blocked by substack_url defense-in-depth guard
    const res = await htmxPost(`/htmx/articles/${slug}/advance`);
    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain('substack_url not set');

    // Real publish path works
    repo.recordPublish(slug, 'https://example.substack.com/p/edge-guard', 'test');
    const article = repo.getArticle(slug);
    expect(article!.current_stage).toBe(8);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. Auto-advance REVISE loop (extracted autoAdvanceArticle)
// ═════════════════════════════════════════════════════════════════════════════

describe('Auto-advance REVISE loop via autoAdvanceArticle', () => {
  const REVISE_REVIEW = `# Editor Review\n\n## Verdict: REVISE\n\nThe draft needs stronger statistical support and clearer structure.\n\n## Issues\n- [BLOCKER evidence:missing-epa] Missing EPA citations\n- [BLOCKER structure:weak-conclusion] Weak conclusion`;
  const APPROVED_REVIEW = `# Editor Review\n\n## Verdict: APPROVED\n\nStrong analytical piece. Ready for publication.\n\n## Strengths\n- Clear thesis\n- Good data support`;

  // The mock's detectStageContext gets confused when gathered context includes
  // keywords from earlier stages (e.g., "discussion prompt" in the context causes
  // writeDraft to get the wrong mock response). We need to set the correct mock
  // response before each stage runs.
  //
  // Stage-to-action mapping:
  //  1→2: generatePrompt (result doesn't need word count)
  //  2→3: composePanel (result doesn't need word count)
  //  3→4: runDiscussion (result doesn't need word count)
  //  4→5: writeDraft (draft MUST have 200+ words for guard at 5→6)
  //  5→6: runEditor (writes editor-review.md)
  //  6→7: runPublisherPass (writes publisher-pass.md)
  //
  // The critical override is at stage 4 (writeDraft) and stage 5 (runEditor).

  // A 300-word draft to satisfy the requireDraft guard
  const MOCK_DRAFT = buildValidDraft(300, 'Test Article Draft');

  // Publisher pass content
  const MOCK_PUBLISHER = `# Publisher Pass\n\n## Pre-Publication Checklist\n- [x] Title finalized\n- [x] Content verified\n- [x] Images checked\n\nReady for publication.`;

  /** Set the correct mock response before a stage's action runs. */
  function setMockForStage(stage: number, editorResponse?: string): void {
    if (stage === 4) {
      // writeDraft needs 200+ word content
      mockProvider.setStage(null);
      mockProvider.setResponse(MOCK_DRAFT);
    } else if (stage === 5) {
      // runEditor needs a verdict
      mockProvider.setStage(null);
      mockProvider.setResponse(editorResponse ?? APPROVED_REVIEW);
    } else if (stage === 6) {
      // runPublisherPass
      mockProvider.setStage(null);
      mockProvider.setResponse(MOCK_PUBLISHER);
    } else {
      // Other stages: use stage-aware mock (bypasses keyword detection)
      mockProvider.setResponse(null);
      mockProvider.setStage(stage);
    }
  }

  it('REVISE → retry → APPROVED: auto-advances with one revision cycle', async () => {
    const slug = 'edge-auto-revise-retry';
    repo.createArticle({ id: slug, title: 'Auto-Advance REVISE Retry' });

    // Set up idea.md so we can start from stage 1
    writeArtifact(slug, 'idea.md', '# Idea\nTest concept for REVISE loop.');

    let editorCallCount = 0;

    // Track steps from the callback
    const collectedSteps: Array<{ type: string; from: number; to: number; action: string }> = [];

    const result = await autoAdvanceArticle(slug, actionCtx, {
      maxStage: 7,
      maxRevisions: 2,
      onStep: (step) => {
        collectedSteps.push({ type: step.type, from: step.from, to: step.to, action: step.action });

        if (step.type === 'working') {
          if (step.from === 5) {
            editorCallCount++;
            // First editor pass: REVISE. Second: APPROVED.
            setMockForStage(5, editorCallCount === 1 ? REVISE_REVIEW : APPROVED_REVIEW);
          } else {
            setMockForStage(step.from);
          }
        }
      },
    });

    // Clean up override
    mockProvider.setResponse(null);

    // The article should reach stage 7
    expect(result.finalStage).toBe(7);
    expect(result.revisionCount).toBe(1);
    expect(result.error).toBeUndefined();

    // Steps should include a regression
    const regressionSteps = result.steps.filter(s => s.type === 'regress');
    expect(regressionSteps.length).toBe(1);
    expect(regressionSteps[0].to).toBe(4);

    // onStep callbacks should have fired
    expect(collectedSteps.length).toBeGreaterThan(0);
    expect(collectedSteps.some(s => s.type === 'regress')).toBe(true);
    expect(collectedSteps.some(s => s.type === 'advance' && s.to === 7)).toBe(true);
  });

  it('force-approves after maxRevisions exceeded', async () => {
    const slug = 'edge-auto-max-revisions';
    repo.createArticle({ id: slug, title: 'Auto-Advance Max Revisions' });
    writeArtifact(slug, 'idea.md', '# Idea\nTest max revisions.');

    let editorIteration = 0;

    const result = await autoAdvanceArticle(slug, actionCtx, {
      maxStage: 7,
      maxRevisions: 2,
      onStep: (step) => {
        if (step.type === 'working') {
          if (step.from === 5) {
            editorIteration++;
            // Always REVISE but with DIFFERENT blocker IDs each time to avoid
            // triggering the repeated-blocker escalation detector.
            const review = `# Editor Review\n\n## Verdict: REVISE\n\nRevision ${editorIteration} needed.\n\n## Issues\n- [BLOCKER evidence:issue-${editorIteration}] Needs more data (iteration ${editorIteration})`;
            setMockForStage(5, review);
          } else {
            setMockForStage(step.from);
          }
        }
      },
    });

    mockProvider.setResponse(null);

    // After force-approve, the article should reach stage 7
    expect(result.finalStage).toBe(7);
    expect(result.revisionCount).toBeGreaterThanOrEqual(2);
    // No error — force-approve lets it continue
    expect(result.error).toBeUndefined();
  });

  it('calls autoAdvanceArticle directly with correct step tracking', async () => {
    const slug = 'edge-auto-direct-call';
    repo.createArticle({ id: slug, title: 'Direct autoAdvanceArticle Test' });
    writeArtifact(slug, 'idea.md', '# Idea\nDirect call test.');

    const stepLog: Array<{ type: string; from: number; to: number }> = [];

    const result = await autoAdvanceArticle(slug, actionCtx, {
      maxStage: 7,
      maxRevisions: 2,
      onStep: (step) => {
        stepLog.push({ type: step.type, from: step.from, to: step.to });
        if (step.type === 'working') {
          setMockForStage(step.from);
        }
      },
    });

    mockProvider.setResponse(null);

    // Should advance cleanly to stage 7 with no revisions
    expect(result.finalStage).toBe(7);
    expect(result.revisionCount).toBe(0);
    expect(result.error).toBeUndefined();

    // Should have advance steps: 1→2, 2→3, 3→4, 4→5, 5→6, 6→7
    const advanceSteps = result.steps.filter(s => s.type === 'advance');
    expect(advanceSteps.length).toBe(6);
    expect(advanceSteps[0].from).toBe(1);
    expect(advanceSteps[0].to).toBe(2);
    expect(advanceSteps[advanceSteps.length - 1].to).toBe(7);

    // onStep should have fired for each advance + working
    const workingSteps = stepLog.filter(s => s.type === 'working');
    expect(workingSteps.length).toBe(6); // one per stage transition

    // Each step should have a duration
    for (const step of result.steps) {
      if (step.type === 'advance') {
        expect(step.duration).toBeDefined();
        expect(step.duration).toBeGreaterThan(0);
      }
    }
  });

  it('works in lightweight mode (no ActionContext)', async () => {
    const slug = 'edge-auto-lightweight';
    repo.createArticle({ id: slug, title: 'Lightweight Auto-Advance' });

    // Pre-write all artifacts for lightweight (guard-only) advance
    writeArtifact(slug, 'idea.md', '# Idea\nLightweight test.');
    writeArtifact(slug, 'discussion-prompt.md', '# Prompt\nKey question.');
    writeArtifact(slug, 'panel-composition.md', '# Panel\n- Analyst A\n- Analyst B');
    writeArtifact(slug, 'discussion-summary.md', '# Summary\nConclusion X.');
    writeArtifact(slug, 'article-contract.md', '# Article Contract\n\n## Structure\n- Introduction\n- Analysis\n- Conclusion\n\n## Word Count Target\n300 words');
    writeArtifact(slug, 'draft.md', buildValidDraft(300));
    writeArtifact(slug, 'editor-review.md', '## Final Verdict: APPROVED\nGood to go.');
    writeArtifact(slug, 'publisher-pass.md', '# Publisher Pass\nAll clear.');

    const stepLog: Array<{ type: string; from: number; to: number }> = [];

    // Call with null context (lightweight) but provide repo + engine
    const result = await autoAdvanceArticle(slug, null, {
      maxStage: 7,
      repo,
      engine,
      onStep: (step) => {
        stepLog.push({ type: step.type, from: step.from, to: step.to });
      },
    });

    expect(result.finalStage).toBe(7);
    expect(result.revisionCount).toBe(0);
    expect(result.error).toBeUndefined();

    // All 6 advance steps (1→2 through 6→7)
    const advanceSteps = result.steps.filter(s => s.type === 'advance');
    expect(advanceSteps.length).toBe(6);

    // onStep callbacks fired for advances only (no 'working' in lightweight mode)
    expect(stepLog.filter(s => s.type === 'advance').length).toBe(6);
    expect(stepLog.filter(s => s.type === 'working').length).toBe(0);
  });
});
