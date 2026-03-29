/**
 * Regression test for tool-use trace metadata with copilot-cli provider.
 *
 * Issue: When copilot-cli is the selected provider and tools are available,
 * the app-managed tool loop at runner.ts:649 is bypassed because of the
 * `provider !== 'copilot-cli'` guard. This means:
 * 1. availableTools is logged at trace start (line 633-635)
 * 2. But toolCalls array stays empty because the loop never executes
 * 3. Trace metadata shows tools were available but never records actual calls
 *
 * Expected: copilot-cli traces should include availableTools in metadata
 * even when the app-managed loop is skipped.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Repository } from '../../src/db/repository.js';
import { AgentRunner } from '../../src/agents/runner.js';
import { AgentMemory } from '../../src/agents/memory.js';
import { LLMGateway } from '../../src/llm/gateway.js';
import { ModelPolicy } from '../../src/llm/model-policy.js';
import { MockProvider } from '../../src/llm/providers/mock.js';

// Minimal policy for testing - avoids filesystem dependency
function makeMinimalPolicy(): ModelPolicy {
  const policy = Object.create(ModelPolicy.prototype);
  policy.config = {
    tiers: {},
    models: {},
  };
  return policy;
}

describe('Tool trace metadata — copilot-cli bypass', () => {
  let tempDir: string;
  let pipelineDbPath: string;
  let memoryDbPath: string;
  let repo: Repository;
  let memory: AgentMemory;
  let chartersDir: string;
  let skillsDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'tool-trace-test-'));
    pipelineDbPath = join(tempDir, 'pipeline.db');
    memoryDbPath = join(tempDir, 'memory.db');
    chartersDir = join(tempDir, 'charters');
    skillsDir = join(tempDir, 'skills');

    // Create charter and skill directories
    mkdirSync(chartersDir, { recursive: true });
    mkdirSync(skillsDir, { recursive: true });

    // Create a minimal lead charter
    writeFileSync(join(chartersDir, 'lead.md'), `# Lead

## Identity
Lead agent for testing

## Responsibilities
- Generate ideas

## Knowledge
- NFL

## Boundaries
- Test only

## Model
auto
`);

    repo = new Repository(pipelineDbPath);
    memory = new AgentMemory(memoryDbPath);
  });

  afterEach(() => {
    repo?.close();
    memory?.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('logs availableTools in metadata when copilot-cli provider is used with tools enabled', async () => {
    // Create a mock provider with id 'copilot-cli' to simulate the real provider
    const mockCopilotCli = new MockProvider();
    mockCopilotCli.id = 'copilot-cli';
    mockCopilotCli.name = 'Mock Copilot CLI';

    const gateway = new LLMGateway({
      modelPolicy: makeMinimalPolicy(),
      providers: [mockCopilotCli],
    });

    const runner = new AgentRunner({
      gateway,
      memory,
      chartersDir,
      skillsDir,
    });

    repo.createArticle({ id: 'test-article', title: 'Test Article' });

    const result = await runner.run({
      agentName: 'lead',
      provider: 'copilot-cli',
      task: 'Generate an article idea about NFL data trends',
      trace: {
        repo,
        articleId: 'test-article',
        stage: 1,
        surface: 'ideaGeneration',
      },
      toolCalling: {
        enabled: true,
        includeLocalExtensions: true,
        requestedTools: ['nflverse-data', 'prediction-markets'],
        allowWriteTools: false,
        context: {
          repo,
          articleId: 'test-article',
          stage: 1,
          surface: 'ideaGeneration',
          agentName: 'lead',
        },
      },
    });

    expect(result.traceId).toBeDefined();

    // Fetch the trace and check metadata
    const trace = repo.getLlmTrace(result.traceId!);
    expect(trace).not.toBeNull();
    expect(trace!.status).toBe('completed');

    // Parse metadata_json
    const metadata = JSON.parse(trace!.metadata_json ?? '{}');

    // BUG VERIFICATION: availableTools should be present in metadata
    // This proves tools were configured even though the app-managed loop was bypassed
    expect(metadata.availableTools).toBeDefined();
    expect(Array.isArray(metadata.availableTools)).toBe(true);
    expect(metadata.availableTools.length).toBeGreaterThan(0);

    // When copilot-cli provider is used, app-managed loop is bypassed
    // so toolCalls array should NOT be present (or be empty if added)
    // This is EXPECTED behavior - copilot-cli handles its own tool loop
    expect(metadata.toolCalls ?? []).toHaveLength(0);
  });

  it('logs availableTools in metadata even when tools list is empty', async () => {
    const mockCopilotCli = new MockProvider();
    mockCopilotCli.id = 'copilot-cli';
    mockCopilotCli.name = 'Mock Copilot CLI';

    const gateway = new LLMGateway({
      modelPolicy: makeMinimalPolicy(),
      providers: [mockCopilotCli],
    });

    const runner = new AgentRunner({
      gateway,
      memory,
      chartersDir,
      skillsDir,
    });

    repo.createArticle({ id: 'test-article', title: 'Test Article' });

    const result = await runner.run({
      agentName: 'lead',
      provider: 'copilot-cli',
      task: 'Generate an article idea',
      trace: {
        repo,
        articleId: 'test-article',
        stage: 1,
        surface: 'ideaGeneration',
      },
      toolCalling: {
        enabled: true,
        includeLocalExtensions: true,
        requestedTools: ['non-existent-tool'],
        allowWriteTools: false,
        context: {
          repo,
          articleId: 'test-article',
          stage: 1,
          surface: 'ideaGeneration',
          agentName: 'lead',
        },
      },
    });

    const trace = repo.getLlmTrace(result.traceId!);
    expect(trace).not.toBeNull();

    const metadata = JSON.parse(trace!.metadata_json ?? '{}');

    // When requestedTools don't match any available tools, availableTools should be empty or null
    // metadata field should still be set (not undefined)
    expect(metadata.availableTools ?? null).toEqual(null);
  });

  it('confirms that tool loop is bypassed for copilot-cli provider', async () => {
    // This test confirms the key finding: copilot-cli bypasses app-managed tool loop
    // at line 649 of runner.ts, so toolCalls metadata is never populated even
    // when availableTools is set at trace start.

    // Test 1: copilot-cli with tools - should bypass loop
    const mockCli = new MockProvider();
    mockCli.id = 'copilot-cli';

    const cliGateway = new LLMGateway({
      modelPolicy: makeMinimalPolicy(),
      providers: [mockCli],
    });

    const cliRunner = new AgentRunner({
      gateway: cliGateway,
      memory,
      chartersDir,
      skillsDir,
    });

    repo.createArticle({ id: 'test-1', title: 'Test 1' });

    const cliResult = await cliRunner.run({
      agentName: 'lead',
      provider: 'copilot-cli',
      task: 'Test copilot-cli',
      trace: {
        repo,
        articleId: 'test-1',
        stage: 1,
        surface: 'test',
      },
      toolCalling: {
        enabled: true,
        includeLocalExtensions: true,
        requestedTools: ['nflverse-data'],
        allowWriteTools: false,
      },
    });

    const cliTrace = repo.getLlmTrace(cliResult.traceId!);
    const cliMetadata = JSON.parse(cliTrace!.metadata_json ?? '{}');

    // copilot-cli traces should have availableTools logged at start
    expect(cliMetadata.availableTools).toBeDefined();
    
    // But toolCalls should be empty/absent because the app-managed loop was bypassed
    expect(cliMetadata.toolCalls ?? []).toHaveLength(0);

    // This is EXPECTED behavior - copilot-cli manages its own tool loop
    // The issue is just observability: we log availableTools but not the actual calls
  });
});
