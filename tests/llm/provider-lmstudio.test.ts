import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LMStudioProvider } from '../../src/llm/providers/lmstudio.js';
import type { ChatRequest } from '../../src/llm/gateway.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function req(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    messages: [{ role: 'user', content: 'Hello' }],
    ...overrides,
  };
}

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, text: string): Response {
  return new Response(text, { status });
}

/** Build a minimal OpenAI-compatible chat completions response. */
function chatResponse(overrides: {
  content?: string;
  model?: string;
  finishReason?: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
} = {}): Response {
  return okResponse({
    id: 'chatcmpl-test',
    object: 'chat.completion',
    model: overrides.model ?? 'qwen-35',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: overrides.content ?? 'Hello!' },
        finish_reason: overrides.finishReason ?? 'stop',
      },
    ],
    usage: overrides.usage ?? {
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LMStudioProvider', () => {
  let provider: LMStudioProvider;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    provider = new LMStudioProvider();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -- Constructor defaults ------------------------------------------------

  describe('constructor defaults', () => {
    it('has correct id and name', () => {
      expect(provider.id).toBe('lmstudio');
      expect(provider.name).toBe('LM Studio (Local)');
    });

    it('defaults baseUrl to localhost:1234', () => {
      expect(provider.baseUrl).toBe('http://localhost:1234/v1');
    });

    it('defaults model to qwen-35', () => {
      expect(provider.defaultModel).toBe('qwen-35');
    });
  });

  // -- Custom constructor options ------------------------------------------

  describe('custom constructor options', () => {
    it('accepts custom baseUrl', () => {
      const custom = new LMStudioProvider({ baseUrl: 'http://myhost:9999/v1' });
      expect(custom.baseUrl).toBe('http://myhost:9999/v1');
    });

    it('strips trailing slashes from baseUrl', () => {
      const custom = new LMStudioProvider({ baseUrl: 'http://myhost:9999/v1/' });
      expect(custom.baseUrl).toBe('http://myhost:9999/v1');
    });

    it('accepts custom defaultModel', () => {
      const custom = new LMStudioProvider({ defaultModel: 'llama-3' });
      expect(custom.defaultModel).toBe('llama-3');
    });
  });

  // -- supportsModel -------------------------------------------------------

  describe('supportsModel', () => {
    it('returns true for any model name', () => {
      expect(provider.supportsModel('qwen-35')).toBe(true);
      expect(provider.supportsModel('llama-3')).toBe(true);
      expect(provider.supportsModel('gpt-4o')).toBe(true);
      expect(provider.supportsModel('some-random-model')).toBe(true);
    });
  });

  // -- listModels ----------------------------------------------------------

  describe('listModels', () => {
    it('returns default model before fetchModels is called', () => {
      expect(provider.listModels()).toEqual(['qwen-35']);
    });

    it('returns copy of internal list (not a reference)', () => {
      const a = provider.listModels();
      const b = provider.listModels();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  // -- fetchModels ---------------------------------------------------------

  describe('fetchModels', () => {
    it('fetches models from the /models endpoint', async () => {
      fetchSpy.mockResolvedValueOnce(
        okResponse({
          data: [
            { id: 'model-a', object: 'model' },
            { id: 'model-b', object: 'model' },
          ],
        }),
      );

      const models = await provider.fetchModels();
      expect(models).toEqual(['model-a', 'model-b']);
      expect(fetchSpy).toHaveBeenCalledWith('http://localhost:1234/v1/models');
    });

    it('updates listModels cache after successful fetch', async () => {
      fetchSpy.mockResolvedValueOnce(
        okResponse({ data: [{ id: 'cached-model', object: 'model' }] }),
      );

      await provider.fetchModels();
      expect(provider.listModels()).toEqual(['cached-model']);
    });

    it('returns empty array on connection failure', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const models = await provider.fetchModels();
      expect(models).toEqual([]);
    });

    it('clears cache on connection failure', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await provider.fetchModels();
      expect(provider.listModels()).toEqual([]);
    });

    it('returns empty array on non-OK response', async () => {
      fetchSpy.mockResolvedValueOnce(errorResponse(500, 'Internal Server Error'));

      const models = await provider.fetchModels();
      expect(models).toEqual([]);
    });
  });

  // -- chat ----------------------------------------------------------------

  describe('chat', () => {
    it('sends correct request format', async () => {
      fetchSpy.mockResolvedValueOnce(chatResponse());

      await provider.chat(req({ model: 'qwen-35' }));

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:1234/v1/chat/completions');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' });

      const body = JSON.parse(init.body as string);
      expect(body.model).toBe('qwen-35');
      expect(body.messages).toEqual([{ role: 'user', content: 'Hello' }]);
      expect(body.temperature).toBe(0.7);
    });

    it('does not send auth headers', async () => {
      fetchSpy.mockResolvedValueOnce(chatResponse());

      await provider.chat(req());

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['Authorization']).toBeUndefined();
    });

    it('uses defaultModel when no model specified', async () => {
      fetchSpy.mockResolvedValueOnce(chatResponse());

      await provider.chat(req());

      const body = JSON.parse((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.model).toBe('qwen-35');
    });

    it('passes custom temperature', async () => {
      fetchSpy.mockResolvedValueOnce(chatResponse());

      await provider.chat(req({ temperature: 0.2 }));

      const body = JSON.parse((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.temperature).toBe(0.2);
    });

    it('passes maxTokens as max_tokens', async () => {
      fetchSpy.mockResolvedValueOnce(chatResponse());

      await provider.chat(req({ maxTokens: 500 }));

      const body = JSON.parse((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.max_tokens).toBe(500);
    });

    it('passes responseFormat as json_object', async () => {
      fetchSpy.mockResolvedValueOnce(chatResponse());

      await provider.chat(req({ responseFormat: 'json' }));

      const body = JSON.parse((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.response_format).toEqual({ type: 'json_object' });
    });

    it('returns parsed ChatResponse', async () => {
      fetchSpy.mockResolvedValueOnce(
        chatResponse({
          content: 'Test response',
          model: 'qwen-35',
          finishReason: 'stop',
          usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 },
        }),
      );

      const res = await provider.chat(req());
      expect(res.content).toBe('Test response');
      expect(res.model).toBe('qwen-35');
      expect(res.provider).toBe('lmstudio');
      expect(res.finishReason).toBe('stop');
      expect(res.usage).toEqual({
        promptTokens: 20,
        completionTokens: 30,
        totalTokens: 50,
      });
    });

    it('returns provider metadata envelopes for trace persistence', async () => {
      fetchSpy.mockResolvedValueOnce(
        chatResponse({
          content: 'Test response',
          model: 'qwen-35',
          finishReason: 'stop',
          usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 },
        }),
      );

      const res = await provider.chat(req({
        temperature: 0.2,
        maxTokens: 500,
        responseFormat: 'json',
      }));

      expect(res.providerMetadata?.requestEnvelope).toEqual({
        endpoint: 'http://localhost:1234/v1/chat/completions',
        body: {
          model: 'qwen-35',
          messages: [{ role: 'user', content: 'Hello' }],
          temperature: 0.2,
          max_tokens: 500,
          response_format: { type: 'json_object' },
        },
      });
      expect(res.providerMetadata?.responseEnvelope).toEqual({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        model: 'qwen-35',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Test response' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 },
      });
    });

    it('handles missing usage gracefully', async () => {
      fetchSpy.mockResolvedValueOnce(
        okResponse({
          id: 'chatcmpl-test',
          object: 'chat.completion',
          model: 'qwen-35',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }],
        }),
      );

      const res = await provider.chat(req());
      expect(res.content).toBe('Hi');
      expect(res.usage).toBeUndefined();
    });

    it('throws clear error when LM Studio is not running', async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError('fetch failed'));

      await expect(provider.chat(req())).rejects.toThrow(
        /LM Studio not running at http:\/\/localhost:1234\/v1/,
      );
    });

    it('throws on non-OK HTTP response', async () => {
      fetchSpy.mockResolvedValueOnce(errorResponse(500, 'Model not loaded'));

      await expect(provider.chat(req())).rejects.toThrow(
        /LM Studio API error \(500\): Model not loaded/,
      );
    });

    it('uses custom baseUrl for requests', async () => {
      const custom = new LMStudioProvider({ baseUrl: 'http://myhost:9999/v1' });
      fetchSpy.mockResolvedValueOnce(chatResponse());

      await custom.chat(req());

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://myhost:9999/v1/chat/completions');
    });
  });
});
