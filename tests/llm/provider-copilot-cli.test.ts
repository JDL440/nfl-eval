import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CopilotCLIProvider } from '../../src/llm/providers/copilot-cli.js';
import type { ChatRequest } from '../../src/llm/gateway.js';
import * as childProcess from 'node:child_process';

// ---------------------------------------------------------------------------
// Mock child_process.execFile to avoid actual CLI calls in tests
// ---------------------------------------------------------------------------

vi.mock('node:child_process', async (importOriginal) => {
  const orig = await importOriginal<typeof import('node:child_process')>();
  return {
    ...orig,
    execFile: vi.fn(),
  };
});

const mockExecFile = vi.mocked(childProcess.execFile);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function req(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    messages: [{ role: 'user', content: 'Hello' }],
    ...overrides,
  };
}

/**
 * Configure mockExecFile to resolve with given stdout.
 * execFile is callback-based, so we simulate the callback signature.
 */
function stubExecFile(stdout: string, stderr = ''): void {
  mockExecFile.mockImplementation(
    ((_file: string, _args: string[], _opts: unknown, cb: Function) => {
      process.nextTick(() => cb(null, stdout, stderr));
      return {} as any; // Return value (ChildProcess) not used in our tests
    }) as any,
  );
}

/** Configure mockExecFile to fail with given error. */
function stubExecFileError(code: number | null, stderr = '', killed = false): void {
  mockExecFile.mockImplementation(
    ((_file: string, _args: string[], _opts: unknown, cb: Function) => {
      const err = new Error(`exit code ${code}`) as any;
      err.code = code;
      err.killed = killed;
      process.nextTick(() => cb(err, '', stderr));
      return {} as any;
    }) as any,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CopilotCLIProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -- Identity ------------------------------------------------------------

  describe('identity', () => {
    it('has correct id and name', () => {
      const provider = new CopilotCLIProvider();
      expect(provider.id).toBe('copilot-cli');
      expect(provider.name).toBe('GitHub Copilot CLI');
    });
  });

  // -- Model listing -------------------------------------------------------

  describe('listModels', () => {
    it('returns supported CLI model ids', () => {
      const provider = new CopilotCLIProvider();
      const models = provider.listModels();
      expect(models).toContain('claude-sonnet-4');
      expect(models).toContain('gpt-5.4');
      expect(models).toContain('claude-haiku-4.5');
      expect(models.length).toBeGreaterThan(0);
    });
  });

  // -- supportsModel -------------------------------------------------------

  describe('supportsModel', () => {
    it('returns true for listed models', () => {
      const provider = new CopilotCLIProvider();
      expect(provider.supportsModel('claude-sonnet-4')).toBe(true);
      expect(provider.supportsModel('gpt-5.4')).toBe(true);
      expect(provider.supportsModel('claude-haiku-4.5')).toBe(true);
    });

    it('returns true for claude- prefixed models', () => {
      const provider = new CopilotCLIProvider();
      expect(provider.supportsModel('claude-future-model')).toBe(true);
    });

    it('returns true for gpt- prefixed models', () => {
      const provider = new CopilotCLIProvider();
      expect(provider.supportsModel('gpt-99')).toBe(true);
    });

    it('returns false for unknown models', () => {
      const provider = new CopilotCLIProvider();
      expect(provider.supportsModel('some-random-model')).toBe(false);
      expect(provider.supportsModel('llama-3-70b')).toBe(false);
    });
  });

  // -- verify() ------------------------------------------------------------

  describe('verify', () => {
    it('returns CLI version string', async () => {
      stubExecFile('GitHub Copilot CLI 1.0.10\n');

      const provider = new CopilotCLIProvider();
      const version = await provider.verify();

      expect(version).toBe('GitHub Copilot CLI 1.0.10');
      expect(mockExecFile).toHaveBeenCalledTimes(1);
      const args = (mockExecFile.mock.calls[0] as any[])[1];
      expect(args).toContain('--version');
    });

    it('throws if CLI is not installed', async () => {
      stubExecFileError(1, 'copilot: command not found');

      const provider = new CopilotCLIProvider();
      await expect(provider.verify()).rejects.toThrow(/copilot: command not found/);
    });
  });

  // -- chat() — prompt building -------------------------------------------

  describe('chat — prompt building', () => {
    it('sends user message via -p flag for short prompts', async () => {
      stubExecFile('Test response');

      const provider = new CopilotCLIProvider();
      await provider.chat(req());

      const args = (mockExecFile.mock.calls[0] as any[])[1] as string[];
      expect(args).toContain('-p');
      expect(args).toContain('-s');
      expect(args).toContain('--no-ask-user');
      expect(args).toContain('--model');
    });

    it('includes system prompt as instructions block', async () => {
      stubExecFile('Test response');

      const provider = new CopilotCLIProvider();
      await provider.chat(
        req({
          messages: [
            { role: 'system', content: 'You are a sports analyst.' },
            { role: 'user', content: 'Analyze the Seahawks.' },
          ],
        }),
      );

      const args = (mockExecFile.mock.calls[0] as any[])[1] as string[];
      const promptIdx = args.indexOf('-p');
      const prompt = args[promptIdx + 1];
      expect(prompt).toContain('<instructions>');
      expect(prompt).toContain('You are a sports analyst.');
      expect(prompt).toContain('</instructions>');
      expect(prompt).toContain('Analyze the Seahawks.');
    });

    it('adds JSON format hint when responseFormat is json', async () => {
      stubExecFile('{"result": "ok"}');

      const provider = new CopilotCLIProvider();
      await provider.chat(req({ responseFormat: 'json' }));

      const args = (mockExecFile.mock.calls[0] as any[])[1] as string[];
      const promptIdx = args.indexOf('-p');
      const prompt = args[promptIdx + 1];
      expect(prompt).toContain('<output_format>');
      expect(prompt).toContain('valid JSON only');
    });

    it('uses specified model', async () => {
      stubExecFile('Response');

      const provider = new CopilotCLIProvider();
      await provider.chat(req({ model: 'claude-opus-4.6' }));

      const args = (mockExecFile.mock.calls[0] as any[])[1] as string[];
      const modelIdx = args.indexOf('--model');
      expect(args[modelIdx + 1]).toBe('claude-opus-4.6');
    });

    it('uses default model when none specified', async () => {
      stubExecFile('Response');

      const provider = new CopilotCLIProvider({ defaultModel: 'gpt-5.4' });
      await provider.chat(req());

      const args = (mockExecFile.mock.calls[0] as any[])[1] as string[];
      const modelIdx = args.indexOf('--model');
      expect(args[modelIdx + 1]).toBe('gpt-5.4');
    });

    it('uses -p flag for prompts under 30K chars (execFile limit)', async () => {
      stubExecFile('Long prompt response');
      const provider = new CopilotCLIProvider();
      const longContent = 'A'.repeat(8000);
      await provider.chat(
        req({ messages: [{ role: 'user', content: longContent }] }),
      );

      // Should still use -p flag — execFile (CreateProcessW) supports ~32K
      const args = (mockExecFile.mock.calls[0] as any[])[1] as string[];
      expect(args).toContain('-p');
      expect(args[args.indexOf('-p') + 1]).toContain(longContent);
    });
  });

  // -- chat() — response parsing ------------------------------------------

  describe('chat — response parsing', () => {
    it('returns trimmed content with provider id', async () => {
      stubExecFile('  Hello back!  \n');

      const provider = new CopilotCLIProvider();
      const res = await provider.chat(req({ model: 'claude-sonnet-4' }));

      expect(res.content).toBe('Hello back!');
      expect(res.provider).toBe('copilot-cli');
      expect(res.model).toBe('claude-sonnet-4');
      expect(res.finishReason).toBe('stop');
      expect(res.usage).toBeUndefined();
    });

    it('throws on empty response', async () => {
      stubExecFile('');

      const provider = new CopilotCLIProvider();
      await expect(provider.chat(req())).rejects.toThrow(/empty response/);
    });

    it('throws on whitespace-only response', async () => {
      stubExecFile('   \n\n  ');

      const provider = new CopilotCLIProvider();
      await expect(provider.chat(req())).rejects.toThrow(/empty response/);
    });
  });

  // -- chat() — error handling --------------------------------------------

  describe('chat — error handling', () => {
    it('throws on non-zero exit code', async () => {
      stubExecFileError(1, 'Authentication failed');

      const provider = new CopilotCLIProvider();
      await expect(provider.chat(req())).rejects.toThrow(/Authentication failed/);
    });

    it('reports timeout when killed', async () => {
      stubExecFileError(null, '', true);

      const provider = new CopilotCLIProvider({ timeoutMs: 5000 });
      await expect(provider.chat(req())).rejects.toThrow(/timed out after 5000ms/);
    });
  });

  // -- Options -------------------------------------------------------------

  describe('options', () => {
    it('uses custom copilot path', async () => {
      stubExecFile('Version info');

      const provider = new CopilotCLIProvider({
        copilotPath: '/custom/path/copilot',
      });
      await provider.verify();

      const file = (mockExecFile.mock.calls[0] as any[])[0];
      expect(file).toBe('/custom/path/copilot');
    });

    it('passes extra flags', async () => {
      stubExecFile('Response');

      const provider = new CopilotCLIProvider({
        extraFlags: ['--add-dir=.', '--allow-tool=read'],
      });
      await provider.chat(req());

      const args = (mockExecFile.mock.calls[0] as any[])[1] as string[];
      expect(args).toContain('--add-dir=.');
      expect(args).toContain('--allow-tool=read');
    });

    it('disables auto-update in env', async () => {
      stubExecFile('Response');

      const provider = new CopilotCLIProvider();
      await provider.chat(req());

      const opts = (mockExecFile.mock.calls[0] as any[])[2] as any;
      expect(opts.env.COPILOT_AUTO_UPDATE).toBe('false');
    });
  });
});
