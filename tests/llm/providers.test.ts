import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GeminiProvider } from '../../src/llm/providers/gemini.js';
import { LocalProvider } from '../../src/llm/providers/local.js';

// ---------------------------------------------------------------------------
// Shared fetch mock
// ---------------------------------------------------------------------------

const fetchSpy = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Helper: build a minimal Response-like object for mocked fetch. */
function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

// ===========================================================================
// GeminiProvider
// ===========================================================================

describe('GeminiProvider', () => {
  const FAKE_KEY = 'test-gemini-key';
  let provider: GeminiProvider;

  beforeEach(() => {
    provider = new GeminiProvider(FAKE_KEY);
  });

  // -- Model listing -------------------------------------------------------

  describe('listModels', () => {
    it('returns known Gemini models', () => {
      const models = provider.listModels();
      expect(models).toContain('gemini-2.5-pro');
      expect(models).toContain('gemini-2.5-flash');
      expect(models).toContain('gemini-2.0-flash');
    });
  });

  // -- supportsModel -------------------------------------------------------

  describe('supportsModel', () => {
    it('supports listed models', () => {
      expect(provider.supportsModel('gemini-2.5-pro')).toBe(true);
    });

    it('supports any gemini- prefixed model', () => {
      expect(provider.supportsModel('gemini-3.0-ultra')).toBe(true);
    });

    it('rejects non-gemini models', () => {
      expect(provider.supportsModel('gpt-4o')).toBe(false);
      expect(provider.supportsModel('claude-sonnet-4.5')).toBe(false);
    });
  });

  // -- API key validation --------------------------------------------------

  describe('API key validation', () => {
    it('throws when no API key is available', async () => {
      const noKey = new GeminiProvider();
      delete process.env['GEMINI_API_KEY'];

      await expect(
        noKey.chat({
          messages: [{ role: 'user', content: 'Hi' }],
          model: 'gemini-2.5-flash',
        }),
      ).rejects.toThrow('GEMINI_API_KEY');
    });

    it('uses env var when no constructor key', async () => {
      process.env['GEMINI_API_KEY'] = 'env-key';
      const envProvider = new GeminiProvider();

      fetchSpy.mockResolvedValueOnce(
        mockResponse({
          candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }],
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2, totalTokenCount: 7 },
        }),
      );

      await envProvider.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'gemini-2.5-flash',
      });

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('key=env-key');

      delete process.env['GEMINI_API_KEY'];
    });
  });

  // -- Request mapping (ChatMessage → Gemini format) -----------------------

  describe('request mapping', () => {
    it('maps system message to systemInstruction', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({
          candidates: [{ content: { parts: [{ text: 'reply' }] }, finishReason: 'STOP' }],
        }),
      );

      await provider.chat({
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello' },
        ],
        model: 'gemini-2.5-flash',
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.systemInstruction).toEqual({
        parts: [{ text: 'You are helpful.' }],
      });
      // System message should not appear in contents
      expect(body.contents).toEqual([
        { role: 'user', parts: [{ text: 'Hello' }] },
      ]);
    });

    it('maps assistant role to model role', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({
          candidates: [{ content: { parts: [{ text: 'reply' }] }, finishReason: 'STOP' }],
        }),
      );

      await provider.chat({
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' },
        ],
        model: 'gemini-2.5-flash',
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.contents[1].role).toBe('model');
    });

    it('sends temperature and maxOutputTokens in generationConfig', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({
          candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }],
        }),
      );

      await provider.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'gemini-2.5-flash',
        temperature: 0.3,
        maxTokens: 2048,
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.generationConfig.temperature).toBe(0.3);
      expect(body.generationConfig.maxOutputTokens).toBe(2048);
    });

    it('sets responseMimeType for json responseFormat', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({
          candidates: [{ content: { parts: [{ text: '{"a":1}' }] }, finishReason: 'STOP' }],
        }),
      );

      await provider.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'gemini-2.5-flash',
        responseFormat: 'json',
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.generationConfig.responseMimeType).toBe('application/json');
    });
  });

  // -- Response parsing ----------------------------------------------------

  describe('response parsing', () => {
    it('parses a successful response with usage', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({
          candidates: [
            { content: { parts: [{ text: 'Hello ' }, { text: 'world' }] }, finishReason: 'STOP' },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
        }),
      );

      const res = await provider.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'gemini-2.5-pro',
      });

      expect(res.content).toBe('Hello world');
      expect(res.model).toBe('gemini-2.5-pro');
      expect(res.provider).toBe('gemini');
      expect(res.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
      expect(res.finishReason).toBe('STOP');
    });

    it('handles empty candidates gracefully', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ candidates: [] }));

      const res = await provider.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'gemini-2.5-flash',
      });

      expect(res.content).toBe('');
    });

    it('throws on non-OK response', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse('rate limited', 429));

      await expect(
        provider.chat({
          messages: [{ role: 'user', content: 'Hi' }],
          model: 'gemini-2.5-flash',
        }),
      ).rejects.toThrow('Gemini API error (429)');
    });
  });

  // -- URL construction ----------------------------------------------------

  describe('URL construction', () => {
    it('builds correct endpoint URL with model and key', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({
          candidates: [{ content: { parts: [{ text: 'ok' }] } }],
        }),
      );

      await provider.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'gemini-2.5-pro',
      });

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toBe(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${FAKE_KEY}`,
      );
    });
  });
});

// ===========================================================================
// LocalProvider (Ollama)
// ===========================================================================

describe('LocalProvider', () => {
  let provider: LocalProvider;

  beforeEach(() => {
    provider = new LocalProvider();
  });

  // -- Construction --------------------------------------------------------

  describe('construction', () => {
    it('uses default base URL http://localhost:11434', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({
          id: '1',
          model: 'llama3',
          choices: [{ index: 0, message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop' }],
        }),
      );

      await provider.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'llama3',
      });

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toBe('http://localhost:11434/v1/chat/completions');
    });

    it('accepts custom base URL', async () => {
      const custom = new LocalProvider({ baseUrl: 'http://my-gpu:8080' });
      fetchSpy.mockResolvedValueOnce(
        mockResponse({
          id: '1',
          model: 'mistral',
          choices: [{ index: 0, message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop' }],
        }),
      );

      await custom.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'mistral',
      });

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toBe('http://my-gpu:8080/v1/chat/completions');
    });

    it('strips trailing slashes from base URL', async () => {
      const trailing = new LocalProvider({ baseUrl: 'http://localhost:11434/' });
      fetchSpy.mockResolvedValueOnce(
        mockResponse({
          id: '1',
          model: 'llama3',
          choices: [{ index: 0, message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop' }],
        }),
      );

      await trailing.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'llama3',
      });

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toBe('http://localhost:11434/v1/chat/completions');
    });
  });

  // -- supportsModel -------------------------------------------------------

  describe('supportsModel', () => {
    it('returns true for any model name', () => {
      expect(provider.supportsModel('llama3')).toBe(true);
      expect(provider.supportsModel('mistral')).toBe(true);
      expect(provider.supportsModel('codellama:13b')).toBe(true);
      expect(provider.supportsModel('completely-made-up-model')).toBe(true);
    });
  });

  // -- Request mapping -----------------------------------------------------

  describe('request mapping', () => {
    it('maps messages in OpenAI-compatible format', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({
          id: '1',
          model: 'llama3',
          choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
        }),
      );

      await provider.chat({
        messages: [
          { role: 'system', content: 'Be helpful.' },
          { role: 'user', content: 'Hello' },
        ],
        model: 'llama3',
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.messages).toEqual([
        { role: 'system', content: 'Be helpful.' },
        { role: 'user', content: 'Hello' },
      ]);
      expect(body.model).toBe('llama3');
    });

    it('sends temperature and max_tokens', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({
          id: '1',
          model: 'llama3',
          choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
        }),
      );

      await provider.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'llama3',
        temperature: 0.2,
        maxTokens: 1024,
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.temperature).toBe(0.2);
      expect(body.max_tokens).toBe(1024);
    });

    it('sets response_format for json mode', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({
          id: '1',
          model: 'llama3',
          choices: [{ index: 0, message: { role: 'assistant', content: '{}' }, finish_reason: 'stop' }],
        }),
      );

      await provider.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'llama3',
        responseFormat: 'json',
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.response_format).toEqual({ type: 'json_object' });
    });
  });

  // -- Response parsing ----------------------------------------------------

  describe('response parsing', () => {
    it('parses a successful response with usage', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({
          id: '1',
          model: 'llama3',
          choices: [
            { index: 0, message: { role: 'assistant', content: 'Hello!' }, finish_reason: 'stop' },
          ],
          usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 },
        }),
      );

      const res = await provider.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'llama3',
      });

      expect(res.content).toBe('Hello!');
      expect(res.model).toBe('llama3');
      expect(res.provider).toBe('local');
      expect(res.usage).toEqual({ promptTokens: 8, completionTokens: 3, totalTokens: 11 });
      expect(res.finishReason).toBe('stop');
    });

    it('throws on non-OK response', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse('connection refused', 500));

      await expect(
        provider.chat({
          messages: [{ role: 'user', content: 'Hi' }],
          model: 'llama3',
        }),
      ).rejects.toThrow('Ollama API error (500)');
    });
  });

  // -- listLocalModels (Ollama /api/tags) ----------------------------------

  describe('listLocalModels', () => {
    it('returns models from /api/tags endpoint', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({
          models: [
            { name: 'llama3:latest', size: 4_000_000_000, modified_at: '2024-01-01T00:00:00Z' },
            { name: 'mistral:7b', size: 3_500_000_000, modified_at: '2024-01-02T00:00:00Z' },
          ],
        }),
      );

      const models = await provider.listLocalModels();
      expect(models).toHaveLength(2);
      expect(models[0].name).toBe('llama3:latest');
      expect(models[1].name).toBe('mistral:7b');

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toBe('http://localhost:11434/api/tags');
    });

    it('throws on API error', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse('not found', 404));

      await expect(provider.listLocalModels()).rejects.toThrow('Ollama API error (404)');
    });
  });
});
