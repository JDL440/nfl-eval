import { afterAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { Repository } from '../../src/db/repository.js';

interface StageRunRow {
  stage: number;
  surface: string;
  status: string;
  notes: string | null;
}

interface TraceRow {
  stage: number | null;
  surface: string | null;
  status: string;
  error_message: string | null;
  metadata_json: string | null;
}

interface ToolCallSummary {
  total: number;
  successful: number;
  failed: number;
  byTool: Record<string, { total: number; successful: number; failed: number }>;
}

interface ScenarioSnapshot {
  article: { id: string; current_stage: number; status: string } | null;
  stageRuns: StageRunRow[];
  traces: TraceRow[];
  toolSummary: ToolCallSummary;
}

const runScenario = process.env['RUN_LMSTUDIO_SCENARIO'] === '1';
const describeScenario = runScenario ? describe : describe.skip;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not determine free port'));
        return;
      }
      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
    server.on('error', reject);
  });
}

async function waitForServerReady(baseUrl: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'server never responded';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/ideas/new`);
      if (response.status === 200) {
        return;
      }
      lastError = `unexpected status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(2_000);
  }
  throw new Error(`LM Studio scenario server did not become ready: ${lastError}`);
}

async function waitForArticleProgress(repo: Repository, articleId: string, timeoutMs: number): Promise<ScenarioSnapshot> {
  const deadline = Date.now() + timeoutMs;
  let latest = readScenarioSnapshot(repo, articleId);
  while (Date.now() < deadline) {
    latest = readScenarioSnapshot(repo, articleId);
    const reachedDraftStage = latest.stageRuns.some((run) => run.stage >= 4 && (run.status === 'completed' || run.status === 'failed'));
    const completed = latest.article?.current_stage != null && latest.article.current_stage >= 7;
    if (reachedDraftStage || completed) {
      return latest;
    }
    await sleep(10_000);
  }
  throw new Error(`LM Studio scenario timed out before reaching draft stage:\n${JSON.stringify(latest, null, 2)}`);
}

function readScenarioSnapshot(repo: Repository, articleId: string): ScenarioSnapshot {
  const db = repo.getDb();
  const article = db.prepare(
    'SELECT id, current_stage, status FROM articles WHERE id = ?',
  ).get(articleId) as { id: string; current_stage: number; status: string } | undefined;
  const stageRuns = db.prepare(
    'SELECT stage, surface, status, notes FROM stage_runs WHERE article_id = ? ORDER BY started_at ASC, id ASC',
  ).all(articleId) as StageRunRow[];
  const traces = db.prepare(
    'SELECT stage, surface, status, error_message, metadata_json FROM llm_traces WHERE article_id = ? ORDER BY started_at ASC, id ASC',
  ).all(articleId) as TraceRow[];

  const byTool: ToolCallSummary['byTool'] = {};
  let successful = 0;
  let failed = 0;

  for (const trace of traces) {
    const metadata = parseJson(trace.metadata_json);
    const toolCalls = Array.isArray(metadata?.toolCalls) ? metadata.toolCalls : [];
    for (const rawCall of toolCalls) {
      const toolName = typeof rawCall?.toolName === 'string' ? rawCall.toolName : 'UNKNOWN';
      const isError = Boolean(rawCall?.isError);
      const stats = byTool[toolName] ?? { total: 0, successful: 0, failed: 0 };
      stats.total += 1;
      if (isError) {
        stats.failed += 1;
        failed += 1;
      } else {
        stats.successful += 1;
        successful += 1;
      }
      byTool[toolName] = stats;
    }
  }

  return {
    article: article ?? null,
    stageRuns,
    traces,
    toolSummary: {
      total: successful + failed,
      successful,
      failed,
      byTool,
    },
  };
}

function parseJson(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

describeScenario('LM Studio real-provider scenario', () => {
  const tempDataDir = join(tmpdir(), `nfl-lmstudio-scenario-${randomUUID()}`);
  const repoRoot = process.cwd();
  const serverCommand = process.execPath;
  const serverArgs = ['--import', 'tsx', 'src/cli.ts', 'serve'];

  let server: ChildProcessWithoutNullStreams | null = null;
  let repo: Repository | null = null;
  let port = 0;
  let baseUrl = '';
  let stdout = '';
  let stderr = '';

  afterAll(async () => {
    if (repo) {
      repo.close();
      repo = null;
    }
    if (server && !server.killed) {
      server.kill();
      await sleep(1_000);
    }
    try {
      rmSync(tempDataDir, { recursive: true, force: true });
    } catch {
      // best effort cleanup
    }
  });

  it('runs idea generation through draft-stage audit on a clean runtime', async () => {
    mkdirSync(tempDataDir, { recursive: true });
    port = await findFreePort();
    baseUrl = `http://127.0.0.1:${port}`;

    server = spawn(serverCommand, serverArgs, {
      cwd: repoRoot,
      env: {
        ...process.env,
        MOCK_LLM: '0',
        NFL_DATA_DIR: tempDataDir,
        NFL_PORT: String(port),
        DASHBOARD_AUTH_MODE: 'off',
        LLM_PROVIDER: 'lmstudio',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    server.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    server.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    await waitForServerReady(baseUrl, 180_000);
    expect(stdout).toContain('LM Studio provider registered');

    const repoPath = join(tempDataDir, 'pipeline.db');
    expect(existsSync(repoPath)).toBe(true);
    repo = new Repository(repoPath);

    const createResponse = await fetch(`${baseUrl}/api/ideas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Write an evidence-driven Seahawks secondary article that should use tools where helpful, including roster context, depth questions, and likely offseason decisions for 2026.',
        teams: ['SEA'],
        depthLevel: 2,
        provider: 'lmstudio',
        autoAdvance: true,
      }),
    });
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json() as { id: string; traceId?: string | null; traceUrl?: string | null };
    expect(created.id).toBeTruthy();

    const autoAdvanceResponse = await fetch(`${baseUrl}/api/articles/${created.id}/auto-advance`, {
      method: 'POST',
    });
    expect(autoAdvanceResponse.status).toBe(200);

    const snapshot = await waitForArticleProgress(repo, created.id, 900_000);
    const summaryJson = JSON.stringify({
      article: snapshot.article,
      stageRuns: snapshot.stageRuns,
      traces: snapshot.traces,
      toolSummary: snapshot.toolSummary,
      stdoutTail: stdout.slice(-4_000),
      stderrTail: stderr.slice(-2_000),
    }, null, 2);

    expect(snapshot.stageRuns.some((run) => run.surface === 'ideaGeneration' && run.status === 'completed'), summaryJson).toBe(true);
    expect(snapshot.stageRuns.some((run) => run.surface === 'generatePrompt' && run.status === 'completed'), summaryJson).toBe(true);
    expect(snapshot.stageRuns.some((run) => run.surface === 'composePanel' && run.status === 'completed'), summaryJson).toBe(true);
    expect(snapshot.stageRuns.some((run) => run.surface === 'runDiscussion' && run.status === 'completed'), summaryJson).toBe(true);
    expect(snapshot.stageRuns.some((run) => run.surface === 'writeDraft' && (run.status === 'completed' || run.status === 'failed')), summaryJson).toBe(true);
    expect(snapshot.stageRuns.every((run) => !(run.notes ?? '').includes('Agent charter not found: panel-moderator')), summaryJson).toBe(true);
    expect(snapshot.traces.length, summaryJson).toBeGreaterThan(0);
    expect(snapshot.toolSummary.total, summaryJson).toBeGreaterThan(0);
    expect(snapshot.toolSummary.successful, summaryJson).toBeGreaterThan(0);
    expect(Object.keys(snapshot.toolSummary.byTool).length, summaryJson).toBeGreaterThan(0);
    expect(snapshot.traces.some((trace) => trace.surface === 'runDiscussion-fallback' && trace.status === 'completed'), summaryJson).toBe(true);
  }, 960_000);
});
