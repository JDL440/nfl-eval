import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CopilotProvider } from '../../src/llm/providers/copilot.js';
import type { ChatRequest } from '../../src/llm/gateway.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal ChatRequest. */
function req(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    messages: [{ role: 'user', content: 'Hello' }],
    ...overrides,
  };
}

/** Build a fake GitHub Models API JSON response. */
function fakeApiResponse(overrides: Record<string, unknown> = {}): object {
  return {
    id: 'chatcmpl-abc123',
    object: 'chat.completion',
    model: 'openai/gpt-4o',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'Hello back!' },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CopilotProvider', () => {
  let savedEnv: string | undefined;

  beforeEach(() => {
    savedEnv = process.env['GITHUB_TOKEN'];
    process.env['GITHUB_TOKEN'] = 'ghp_test_token_12345';
  });

  afterEach(() => {
    if (savedEnv === undefined) {
      delete process.env['GITHUB_TOKEN'];
    } else {
      process.env['GITHUB_TOKEN'] = savedEnv;
    }
    vi.restoreAllMocks();
  });

  // -- Model listing -------------------------------------------------------

  describe('listModels', () => {
    it('returns supported model ids', () => {
      const provider = new CopilotProvider();
      const models = provider.listModels();
      expect(models).toContain('gpt-4o');
      expect(models).toContain('gpt-4o-mini');
      expect(models).toContain('gpt-4.1');
      expect(models).toContain('o4-mini');
      expect(models).toContain('o1');
      expect(models.length).toBeGreaterThan(0);
    });
  });

  // -- supportsModel -------------------------------------------------------

  describe('supportsModel', () => {
    it('returns true for listed models', () => {
      const provider = new CopilotProvider();
      expect(provider.supportsModel('gpt-4o')).toBe(true);
      expect(provider.supportsModel('gpt-4.1')).toBe(true);
      expect(provider.supportsModel('o4-mini')).toBe(true);
    });

    it('returns false for unknown models', () => {
      const provider = new CopilotProvider();
      expect(provider.supportsModel('some-random-model')).toBe(false);
      expect(provider.supportsModel('llama-3-70b')).toBe(false);
    });
  });

  // -- Auth / token resolution ---------------------------------------------

  describe('token resolution', () => {
    it('uses explicit token when provided', () => {
      const provider = new CopilotProvider({ token: 'explicit_token' });
      expect(provider.resolveToken()).toBe('explicit_token');
    });

    it('uses GITHUB_TOKEN env var', () => {
      const provider = new CopilotProvider();
      expect(provider.resolveToken()).toBe('ghp_test_token_12345');
    });

    it('explicit token takes priority over env var', () => {
      const provider = new CopilotProvider({ token: 'explicit' });
      expect(provider.resolveToken()).toBe('explicit');
    });

    it('throws clear error when no token available', () => {
      delete process.env['GITHUB_TOKEN'];
      // Mock execSync to simulate gh CLI not being available
      vi.mock('node:child_process', async (importOriginal) => {
        const orig = await importOriginal<typeof import('node:child_process')>();
        return {
          ...orig,
          execSync: vi.fn(() => { throw new Error('gh not found'); }),
        };
      });

      const provider = new CopilotProvider();
      expect(() => provider.resolveToken()).toThrow(/GitHub token not found/);
    });
  });

  // -- Request building (fetch calls) --------------------------------------

  describe('chat — request building', () => {
    it('sends correct headers and model mapping', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => fakeApiResponse(),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new CopilotProvider();
      await provider.chat(req({ model: 'gpt-4o' }));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];

      // Correct endpoint
      expect(url).toBe('https://models.github.ai/inference/chat/completions');

      // Auth header
      expect(options.headers).toEqual(
        expect.objectContaining({
          Authorization: 'Bearer ghp_test_token_12345',
          'Content-Type': 'application/json',
        }),
      );

      // Model mapped to qualified name (identity mapping — no prefix)
      const body = JSON.parse(options.body as string);
      expect(body.model).toBe('gpt-4o');
    });

    it('maps gpt-4.1 model correctly', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () =>
          fakeApiResponse({ model: 'gpt-4.1' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new CopilotProvider();
      await provider.chat(req({ model: 'gpt-4.1' }));

      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body.model).toBe('gpt-4.1');
    });

    it('passes temperature and maxTokens', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => fakeApiResponse(),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new CopilotProvider();
      await provider.chat(
        req({ model: 'gpt-4o', temperature: 0.2, maxTokens: 1024 }),
      );

      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body.temperature).toBe(0.2);
      expect(body.max_tokens).toBe(1024);
    });

    it('sets response_format for JSON mode', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => fakeApiResponse(),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new CopilotProvider();
      await provider.chat(req({ model: 'gpt-4o', responseFormat: 'json' }));

      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body.response_format).toEqual({ type: 'json_object' });
    });

    it('defaults to gpt-4o when no model specified', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => fakeApiResponse(),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new CopilotProvider();
      await provider.chat(req());

      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body.model).toBe('gpt-4o');
    });

    it('uses max_completion_tokens and omits temperature for reasoning models', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => fakeApiResponse({ model: 'o4-mini' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new CopilotProvider();
      await provider.chat(req({ model: 'o4-mini', maxTokens: 2048, temperature: 0.5 }));

      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body.model).toBe('o4-mini');
      expect(body.max_completion_tokens).toBe(2048);
      expect(body.max_tokens).toBeUndefined();
      expect(body.temperature).toBeUndefined();
    });
  });

  // -- Response parsing ----------------------------------------------------

  describe('chat — response parsing', () => {
    it('parses a successful response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => fakeApiResponse(),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new CopilotProvider();
      const res = await provider.chat(req({ model: 'gpt-4o' }));

      expect(res.content).toBe('Hello back!');
      expect(res.model).toBe('openai/gpt-4o');
      expect(res.provider).toBe('copilot');
      expect(res.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
      expect(res.finishReason).toBe('stop');
    });

    it('handles missing usage gracefully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          const resp = fakeApiResponse();
          delete (resp as Record<string, unknown>)['usage'];
          return resp;
        },
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new CopilotProvider();
      const res = await provider.chat(req({ model: 'gpt-4o' }));

      expect(res.content).toBe('Hello back!');
      expect(res.usage).toBeUndefined();
    });

    it('handles null content in choice', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () =>
          fakeApiResponse({
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: null },
                finish_reason: 'stop',
              },
            ],
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new CopilotProvider();
      const res = await provider.chat(req({ model: 'gpt-4o' }));

      expect(res.content).toBe('');
    });
  });

  // -- Error handling ------------------------------------------------------

  describe('chat — error handling', () => {
    it('throws on non-ok HTTP status', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => '{"error":"Unauthorized"}',
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new CopilotProvider();
      await expect(provider.chat(req({ model: 'gpt-4o' }))).rejects.toThrow(
        /GitHub Models API error \(401\)/,
      );
    });

    it('throws on 429 rate limit', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new CopilotProvider();
      await expect(provider.chat(req({ model: 'gpt-4o' }))).rejects.toThrow(
        /GitHub Models API error \(429\)/,
      );
      // Retries 3 times before throwing (1 initial + 3 retries = 4 total calls)
      expect(mockFetch).toHaveBeenCalledTimes(4);
    }, 30_000);

    it('throws on network error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('fetch', mockFetch);

      const provider = new CopilotProvider();
      await expect(provider.chat(req({ model: 'gpt-4o' }))).rejects.toThrow(
        'Network error',
      );
    });
  });

  // -- Provider identity ---------------------------------------------------

  describe('identity', () => {
    it('has correct id and name', () => {
      const provider = new CopilotProvider();
      expect(provider.id).toBe('copilot');
      expect(provider.name).toBe('GitHub Copilot Pro+');
    });
  });
});
