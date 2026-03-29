import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as childProcess from 'node:child_process';
import { CopilotCLIProvider } from '../../src/llm/providers/copilot-cli';
import type { ChatRequest } from '../../src/llm/gateway.js';

vi.mock('node:child_process', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:child_process')>();
  return {
    ...original,
    execFile: vi.fn(),
  };
});

const mockExecFile = vi.mocked(childProcess.execFile);
const REPO_ROOT = 'C:\\github\\worktrees\\copilot-session-reuse';
const MCP_CONFIG = 'C:\\github\\worktrees\\copilot-session-reuse\\.copilot\\mcp-config.json';

function req(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    messages: [{ role: 'user', content: 'Hello' }],
    ...overrides,
  };
}

function stubExecFile(stdout: string, stderr = ''): void {
  mockExecFile.mockImplementation(
    ((_file: string, _args: string[], _opts: unknown, cb: Function) => {
      process.nextTick(() => cb(null, stdout, stderr));
      return {} as never;
    }) as never,
  );
}

function stubExecFileError(code: number | null, stderr = '', killed = false): void {
  mockExecFile.mockImplementation(
    ((_file: string, _args: string[], _opts: unknown, cb: Function) => {
      const error = new Error(`exit code ${code}`) as Error & { code?: number | null; killed?: boolean };
      error.code = code;
      error.killed = killed;
      process.nextTick(() => cb(error, '', stderr));
      return {} as never;
    }) as never,
  );
}

describe('CopilotCLIProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct identity', () => {
    const provider = new CopilotCLIProvider();
    expect(provider.id).toBe('copilot-cli');
    expect(provider.name).toBe('GitHub Copilot CLI');
    expect(provider.configuredDefaultModel).toBe('claude-sonnet-4.6');
  });

  it('lists supported models and aliases', () => {
    const provider = new CopilotCLIProvider();
    expect(provider.listModels()).toContain('claude-sonnet-4');
    expect(provider.listModels()).toContain('gpt-5.4');
    expect(provider.supportsModel('gpt-5')).toBe(true);
    expect(provider.supportsModel('some-random-model')).toBe(false);
  });

  it('returns the Copilot CLI version', async () => {
    stubExecFile('GitHub Copilot CLI 1.0.10\n');
    const provider = new CopilotCLIProvider();
    await expect(provider.verify()).resolves.toBe('GitHub Copilot CLI 1.0.10');
  });

  it('builds a one-shot prompt request with safe defaults', async () => {
    stubExecFile('Test response');

    const provider = new CopilotCLIProvider();
    await provider.chat(req());

    const args = (mockExecFile.mock.calls[0] as unknown[])[1] as string[];
    expect(args).toContain('-p');
    expect(args).toContain('-s');
    expect(args).toContain('--no-ask-user');
    expect(args).toContain('--no-auto-update');
    expect(args).toContain('--disallow-temp-dir');
    expect(args).toContain('--model');
  });

  it('includes system instructions and JSON guidance in the prompt', async () => {
    stubExecFile('{"result":"ok"}');

    const provider = new CopilotCLIProvider();
    await provider.chat(req({
      responseFormat: 'json',
      messages: [
        { role: 'system', content: 'You are a sports analyst.' },
        { role: 'user', content: 'Analyze the Seahawks.' },
      ],
    }));

    const args = (mockExecFile.mock.calls[0] as unknown[])[1] as string[];
    const prompt = args[args.indexOf('-p') + 1];
    expect(prompt).toContain('<instructions>');
    expect(prompt).toContain('You are a sports analyst.');
    expect(prompt).toContain('Analyze the Seahawks.');
    expect(prompt).toContain('<output_format>');
  });

  it('uses the configured default or requested model', async () => {
    stubExecFile('Response');

    const provider = new CopilotCLIProvider();
    await provider.chat(req());
    let args = (mockExecFile.mock.calls[0] as unknown[])[1] as string[];
    expect(args[args.indexOf('--model') + 1]).toBe('claude-sonnet-4.6');

    stubExecFile('Response');
    const customProvider = new CopilotCLIProvider({ defaultModel: 'gpt-5.4' });
    await customProvider.chat(req());
    args = (mockExecFile.mock.calls[1] as unknown[])[1] as string[];
    expect(args[args.indexOf('--model') + 1]).toBe('gpt-5.4');

    stubExecFile('Response');
    await customProvider.chat(req({ model: 'claude-opus-4.6' }));
    args = (mockExecFile.mock.calls[2] as unknown[])[1] as string[];
    expect(args[args.indexOf('--model') + 1]).toBe('claude-opus-4.6');
  });

  it('keeps prompts under the execFile limit on the -p path', async () => {
    stubExecFile('Long prompt response');

    const provider = new CopilotCLIProvider();
    const longContent = 'A'.repeat(8_000);
    await provider.chat(req({ messages: [{ role: 'user', content: longContent }] }));

    const args = (mockExecFile.mock.calls[0] as unknown[])[1] as string[];
    expect(args).toContain('-p');
    expect(args[args.indexOf('-p') + 1]).toContain(longContent);
  });

  it('allows web fetch plus the repo MCP servers in article-tools mode', async () => {
    stubExecFile('Tool-enabled response');

    const provider = new CopilotCLIProvider({
      workingDirectory: REPO_ROOT,
      repoRoot: REPO_ROOT,
      mcpConfigPath: MCP_CONFIG,
      toolAccessMode: 'article-tools',
      enableWebFetch: true,
      enableRepoMcp: true,
    });
    const res = await provider.chat(req());

    const args = (mockExecFile.mock.calls[0] as unknown[])[1] as string[];
    expect(args).toContain('--allow-tool=url');
    expect(args).toContain('--allow-all-urls');
    expect(args).toContain('--disable-builtin-mcps');
    expect(args).toContain('--allow-tool=nfl-eval-pipeline');
    expect(args).toContain('--allow-tool=nfl-eval-local');
    expect(args).toContain(`--additional-mcp-config=@${MCP_CONFIG}`);
    expect(res.providerMetadata?.requestEnvelope).toEqual(expect.objectContaining({
      toolAccessMode: 'article-tools',
      toolAccessConfigured: true,
      toolsEnabled: true,
      allowedTools: ['url', 'nfl-eval-pipeline', 'nfl-eval-local'],
      webSearchEnabled: true,
      repoMcpEnabled: true,
      mcpServerNames: ['nfl-eval-pipeline', 'nfl-eval-local'],
    }));
  });

  it('reuses stage 4 article sessions when enabled and traces the session envelope', async () => {
    stubExecFile('Trace me');

    const provider = new CopilotCLIProvider({
      workingDirectory: REPO_ROOT,
      repoRoot: REPO_ROOT,
      mcpConfigPath: MCP_CONFIG,
      toolAccessMode: 'article-tools',
      enableWebFetch: true,
      enableRepoMcp: true,
      enableSessionReuse: true,
    });
    const res = await provider.chat(req({
      providerContext: {
        articleId: 'trace-article',
        stage: 4,
        surface: 'composePanel',
      },
    }));

    expect(res.providerMetadata?.providerMode).toBe('resumed');
    expect(res.providerMetadata?.providerSessionId).toMatch(/^copilot-session-/);
    expect(res.providerMetadata?.workingDirectory).toBe(REPO_ROOT);
    expect(res.providerMetadata?.incrementalPrompt).toContain('Hello');
    expect(res.providerMetadata?.requestEnvelope).toEqual(expect.objectContaining({
      provider: 'copilot-cli',
      sessionReuseRequested: true,
      sessionReuseEligible: true,
      sessionReuseFallback: false,
      stage: 4,
      surface: 'composePanel',
      mcpServerNames: ['nfl-eval-pipeline', 'nfl-eval-local'],
    }));

    const args = (mockExecFile.mock.calls[0] as unknown[])[1] as string[];
    expect(args.some((arg) => arg.startsWith('--resume=copilot-session-'))).toBe(true);
  });

  it('treats stage 4 article runs as session-reuse eligible when article-tools mode is active', async () => {
    stubExecFile('Stage 4 trace');

    const provider = new CopilotCLIProvider({
      workingDirectory: REPO_ROOT,
      repoRoot: REPO_ROOT,
      mcpConfigPath: MCP_CONFIG,
      toolAccessMode: 'article-tools',
      enableWebFetch: true,
      enableRepoMcp: true,
      enableSessionReuse: true,
    });
    const res = await provider.chat(req({
      providerContext: {
        articleId: 'stage-4-article',
        stage: 4,
        surface: 'outline',
      },
    }));

    const args = (mockExecFile.mock.calls[0] as unknown[])[1] as string[];
    expect(args.some((arg) => arg.startsWith('--resume=copilot-session-'))).toBe(true);
    expect(res.providerMetadata?.providerMode).toBe('resumed');
    expect(res.providerMetadata?.requestEnvelope).toEqual(expect.objectContaining({
      toolAccessMode: 'article-tools',
      sessionReuseRequested: true,
      sessionReuseEligible: true,
      stage: 4,
      surface: 'outline',
    }));
  });

  it('falls back to one-shot if a resumed session fails once', async () => {
    mockExecFile
      .mockImplementationOnce(((_file: string, _args: string[], _opts: unknown, cb: Function) => {
        const error = new Error('session missing') as Error & { code?: number; killed?: boolean };
        error.code = 1;
        process.nextTick(() => cb(error, '', 'session missing'));
        return {} as never;
      }) as never)
      .mockImplementationOnce(((_file: string, _args: string[], _opts: unknown, cb: Function) => {
        process.nextTick(() => cb(null, 'Fallback response', ''));
        return {} as never;
      }) as never);

    const provider = new CopilotCLIProvider({
      workingDirectory: REPO_ROOT,
      repoRoot: REPO_ROOT,
      toolAccessMode: 'article-tools',
      enableSessionReuse: true,
    });
    const res = await provider.chat(req({
      providerContext: {
        articleId: 'session-article',
        stage: 5,
      },
    }));

    expect(mockExecFile).toHaveBeenCalledTimes(2);
    const firstArgs = (mockExecFile.mock.calls[0] as unknown[])[1] as string[];
    const secondArgs = (mockExecFile.mock.calls[1] as unknown[])[1] as string[];
    expect(firstArgs.some((arg) => arg.startsWith('--resume='))).toBe(true);
    expect(secondArgs.some((arg) => arg.startsWith('--resume='))).toBe(false);
    expect(res.providerMetadata?.providerMode).toBe('one-shot');
    expect(res.providerMetadata?.providerSessionId).toBeNull();
    expect(res.providerMetadata?.requestEnvelope).toEqual(expect.objectContaining({
      sessionReuseRequested: true,
      sessionReuseEligible: false,
      sessionReuseFallback: true,
    }));
    expect(res.providerMetadata?.responseEnvelope).toEqual(expect.objectContaining({
      fallbackFromResumedSession: true,
      resumedSessionError: expect.stringContaining('session missing'),
    }));
  });

  it('lets explicit toolAccessMode override legacy enableTools flags', async () => {
    stubExecFile('No tools');

    const provider = new CopilotCLIProvider({
      workingDirectory: REPO_ROOT,
      repoRoot: REPO_ROOT,
      mcpConfigPath: MCP_CONFIG,
      toolAccessMode: 'none',
      enableTools: true,
      enableWebFetch: true,
      enableRepoMcp: true,
    });
    const res = await provider.chat(req());

    const args = (mockExecFile.mock.calls[0] as unknown[])[1] as string[];
    expect(args).not.toContain('--allow-tool=url');
    expect(args).not.toContain('--allow-tool=nfl-eval-pipeline');
    expect(args).not.toContain('--allow-tool=nfl-eval-local');
    expect(res.providerMetadata?.requestEnvelope).toEqual(expect.objectContaining({
      toolAccessMode: 'none',
      toolAccessConfigured: false,
      toolsEnabled: false,
      allowedTools: [],
    }));
  });

  it('does not attempt session reuse outside article stages', async () => {
    stubExecFile('No resume');

    const provider = new CopilotCLIProvider({
      workingDirectory: REPO_ROOT,
      repoRoot: REPO_ROOT,
      toolAccessMode: 'article-tools',
      enableSessionReuse: true,
    });
    const res = await provider.chat(req({
      providerContext: {
        articleId: 'session-article',
        stage: 2,
      },
    }));

    const args = (mockExecFile.mock.calls[0] as unknown[])[1] as string[];
    expect(args.some((arg) => arg.startsWith('--resume='))).toBe(false);
    expect(res.providerMetadata?.providerMode).toBe('one-shot');
    expect(res.providerMetadata?.providerSessionId).toBeNull();
    expect(res.providerMetadata?.requestEnvelope).toEqual(expect.objectContaining({
      sessionReuseRequested: true,
      sessionReuseEligible: false,
    }));
  });

  it('fails closed when the MCP config file is missing', async () => {
    stubExecFile('No MCP');

    const provider = new CopilotCLIProvider({
      workingDirectory: REPO_ROOT,
      repoRoot: REPO_ROOT,
      mcpConfigPath: 'C:\\github\\worktrees\\copilot-session-reuse\\.copilot\\missing-config.json',
      toolAccessMode: 'article-tools',
      enableRepoMcp: true,
    });
    const res = await provider.chat(req());

    const args = (mockExecFile.mock.calls[0] as unknown[])[1] as string[];
    expect(args).toContain('--disable-builtin-mcps');
    expect(args.some((arg) => arg.startsWith('--additional-mcp-config=@'))).toBe(false);
    expect(args).not.toContain('--allow-tool=nfl-eval-pipeline');
    expect(args).not.toContain('--allow-tool=nfl-eval-local');
    expect(res.providerMetadata?.requestEnvelope).toEqual(expect.objectContaining({
      repoMcpEnabled: false,
      mcpServerNames: [],
    }));
  });

  it('returns trimmed content with estimated usage', async () => {
    stubExecFile('  Hello back!  \n');

    const provider = new CopilotCLIProvider();
    const res = await provider.chat(req({ model: 'claude-sonnet-4' }));

    expect(res.content).toBe('Hello back!');
    expect(res.provider).toBe('copilot-cli');
    expect(res.model).toBe('claude-sonnet-4');
    expect(res.finishReason).toBe('stop');
    expect(res.usage?.completionTokens).toBe(Math.ceil('Hello back!'.length / 4));
  });

  it('throws on empty responses', async () => {
    stubExecFile('');
    const provider = new CopilotCLIProvider();
    await expect(provider.chat(req())).rejects.toThrow(/empty response/);
  });

  it('surfaces timeout and provider metadata on errors', async () => {
    stubExecFileError(null, '', true);

    const provider = new CopilotCLIProvider({
      timeoutMs: 5_000,
      workingDirectory: REPO_ROOT,
    });

    await expect(provider.chat(req())).rejects.toMatchObject({
      message: expect.stringContaining('timed out after 5000ms'),
      providerMetadata: expect.objectContaining({
        providerMode: 'one-shot',
        workingDirectory: expect.stringContaining('.copilot\\cli-sandbox'),
      }),
    });
  });

  it('captures stderr and exit code in provider metadata for CLI failures', async () => {
    stubExecFileError(1, 'Execution failed: upstream unknown error');

    const provider = new CopilotCLIProvider({
      workingDirectory: REPO_ROOT,
      repoRoot: REPO_ROOT,
      toolAccessMode: 'article-tools',
      enableWebFetch: true,
      enableRepoMcp: true,
      mcpConfigPath: MCP_CONFIG,
    });

    await expect(provider.chat(req({
      providerContext: {
        articleId: 'article-1',
        stage: 1,
        surface: 'generatePrompt',
      },
    }))).rejects.toMatchObject({
      message: expect.stringContaining('Execution failed: upstream unknown error'),
      providerMetadata: expect.objectContaining({
        providerMode: 'one-shot',
        responseEnvelope: expect.objectContaining({
          exitCode: 1,
          stdout: null,
          stderr: 'Execution failed: upstream unknown error',
        }),
      }),
    });
  });

  it('passes through custom path and extra flags', async () => {
    stubExecFile('Version info');

    const provider = new CopilotCLIProvider({
      copilotPath: '/custom/path/copilot',
      extraFlags: ['--add-dir=.', '--allow-tool=read'],
    });
    await provider.verify();

    let file = (mockExecFile.mock.calls[0] as unknown[])[0];
    expect(file).toBe('/custom/path/copilot');

    stubExecFile('Response');
    await provider.chat(req());
    const args = (mockExecFile.mock.calls[1] as unknown[])[1] as string[];
    expect(args).toContain('--add-dir=.');
    expect(args).toContain('--allow-tool=read');
  });

  it('reports actual sandbox cwd in metadata when toolAccessMode is none, not configured workingDirectory', async () => {
    stubExecFile('Safe response');

    const provider = new CopilotCLIProvider({
      workingDirectory: REPO_ROOT,
      repoRoot: REPO_ROOT,
      toolAccessMode: 'none',
    });
    const res = await provider.chat(req());

    const actualCwd = (mockExecFile.mock.calls[0] as unknown[])[2] as { cwd: string };
    expect(res.providerMetadata?.workingDirectory).toBe(actualCwd.cwd);
    expect(res.providerMetadata?.workingDirectory).toContain('.copilot\\cli-sandbox');
    expect(res.providerMetadata?.workingDirectory).not.toBe(REPO_ROOT);
  });
});
