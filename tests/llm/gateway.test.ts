import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { z } from 'zod';
import {
  LLMGateway,
  GatewayError,
  NoProviderError,
  StructuredOutputError,
  type LLMProvider,
  type ChatRequest,
  type ChatResponse,
} from '../../src/llm/gateway.js';
import { LMStudioProvider } from '../../src/llm/providers/lmstudio.js';
import { StubProvider } from '../../src/llm/providers/stub.js';
import { ModelPolicy } from '../../src/llm/model-policy.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadPolicy(): ModelPolicy {
  return new ModelPolicy(
    join(process.cwd(), 'src', 'config', 'defaults', 'models.json'),
  );
}

/** A provider that only supports specific model prefixes. */
class FakeProvider implements LLMProvider {
  id: string;
  name: string;
  private prefix: string;
  private shouldFail: boolean;

  constructor(id: string, prefix: string, opts?: { shouldFail?: boolean }) {
    this.id = id;
    this.name = `Fake ${id}`;
    this.prefix = prefix;
    this.shouldFail = opts?.shouldFail ?? false;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (this.shouldFail) {
      throw new Error(`${this.id} provider failed`);
    }
    return {
      content: `Response from ${this.id}`,
      model: request.model ?? 'unknown',
      provider: this.id,
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: 'stop',
    };
  }

  listModels(): string[] {
    return [`${this.prefix}-model`];
  }

  supportsModel(model: string): boolean {
    return model.startsWith(this.prefix);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LLMGateway', () => {
  let policy: ModelPolicy;

  beforeEach(() => {
    policy = loadPolicy();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -- Provider management -------------------------------------------------

  describe('provider management', () => {
    it('registers and retrieves a provider', () => {
      const gw = new LLMGateway({ modelPolicy: policy });
      const stub = new StubProvider();
      gw.registerProvider(stub);
      expect(gw.getProvider('stub')).toBe(stub);
    });

    it('removes a provider', () => {
      const gw = new LLMGateway({ modelPolicy: policy, providers: [new StubProvider()] });
      expect(gw.getProvider('stub')).toBeDefined();
      gw.removeProvider('stub');
      expect(gw.getProvider('stub')).toBeUndefined();
    });

    it('accepts providers via constructor', () => {
      const stub = new StubProvider();
      const gw = new LLMGateway({ modelPolicy: policy, providers: [stub] });
      expect(gw.getProvider('stub')).toBe(stub);
    });

    it('lists registered providers in insertion order', () => {
      const stub = new StubProvider();
      const fake = new FakeProvider('openai', 'gpt');
      const gw = new LLMGateway({ modelPolicy: policy, providers: [stub, fake] });
      expect(gw.listProviders()).toEqual([
        { id: 'stub', name: 'Stub Provider' },
        { id: 'openai', name: 'Fake openai' },
      ]);
    });

    it('returns undefined for unknown provider', () => {
      const gw = new LLMGateway({ modelPolicy: policy });
      expect(gw.getProvider('nonexistent')).toBeUndefined();
    });
  });

  // -- Routing -------------------------------------------------------------

  describe('routing', () => {
    it('routes to the correct provider based on model', async () => {
      const claudeProvider = new FakeProvider('anthropic', 'claude');
      const gptProvider = new FakeProvider('openai', 'gpt');
      const gw = new LLMGateway({
        modelPolicy: policy,
        providers: [claudeProvider, gptProvider],
      });

      const res = await gw.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-sonnet-4.5',
      });
      expect(res.provider).toBe('anthropic');

      const res2 = await gw.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o',
      });
      expect(res2.provider).toBe('openai');
    });

    it('routes via model policy with stageKey', async () => {
      // writer stage resolves to gpt-5-mini
      const gptProvider = new FakeProvider('openai', 'gpt');
      const gw = new LLMGateway({
        modelPolicy: policy,
        providers: [gptProvider],
      });

      const res = await gw.chat({
        messages: [{ role: 'user', content: 'Write article' }],
        stageKey: 'writer',
      });
      expect(res.provider).toBe('openai');
      expect(res.model).toContain('gpt');
    });

    it('routes via model policy with taskFamily', async () => {
      const gptProvider = new FakeProvider('openai', 'gpt');
      const gw = new LLMGateway({
        modelPolicy: policy,
        providers: [gptProvider],
      });

      const res = await gw.chat({
        messages: [{ role: 'user', content: 'Do something' }],
        taskFamily: 'balanced',
      });
      // balanced family should resolve to a gpt model
      expect(res.provider).toBe('openai');
    });

    it('routes to an explicitly requested provider', async () => {
      const claudeProvider = new FakeProvider('anthropic', 'claude');
      const gptProvider = new FakeProvider('openai', 'gpt');
      const gw = new LLMGateway({
        modelPolicy: policy,
        providers: [claudeProvider, gptProvider],
      });

      const res = await gw.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        provider: 'anthropic',
      });

      expect(res.provider).toBe('anthropic');
    });
  });

  // -- StubProvider --------------------------------------------------------

  describe('StubProvider', () => {
    it('returns canned response when message matches', async () => {
      const stub = new StubProvider({ 'What is 2+2?': '4' });
      const res = await stub.chat({
        messages: [{ role: 'user', content: 'What is 2+2?' }],
      });
      expect(res.content).toBe('4');
      expect(res.provider).toBe('stub');
    });

    it('returns default response for unmatched messages', async () => {
      const stub = new StubProvider();
      const res = await stub.chat({
        messages: [{ role: 'user', content: 'Hello world' }],
      });
      expect(res.content).toBe('Stub response for: Hello world');
    });

    it('handles messages with no user message', async () => {
      const stub = new StubProvider();
      const res = await stub.chat({
        messages: [{ role: 'system', content: 'You are helpful' }],
      });
      expect(res.content).toBe('Stub response for: ');
    });

    it('supports all models', () => {
      const stub = new StubProvider();
      expect(stub.supportsModel('claude-opus-4.6')).toBe(true);
      expect(stub.supportsModel('gpt-4o')).toBe(true);
      expect(stub.supportsModel('any-random-model')).toBe(true);
    });

    it('uses request model in response', async () => {
      const stub = new StubProvider();
      const res = await stub.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'my-custom-model',
      });
      expect(res.model).toBe('my-custom-model');
    });
  });

  // -- chatStructured ------------------------------------------------------

  describe('chatStructured', () => {
    it('parses valid JSON matching schema', async () => {
      const schema = z.object({ name: z.string(), age: z.number() });
      const stub = new StubProvider({
        'get person': '{"name": "Alice", "age": 30}',
      });
      const gw = new LLMGateway({ modelPolicy: policy, providers: [stub] });

      const result = await gw.chatStructured(
        {
          messages: [{ role: 'user', content: 'get person' }],
          model: 'stub-model',
        },
        schema,
      );
      expect(result).toEqual({ name: 'Alice', age: 30 });
    });

    it('throws StructuredOutputError on invalid JSON', async () => {
      const schema = z.object({ name: z.string() });
      const stub = new StubProvider({ 'bad json': 'not json at all' });
      const gw = new LLMGateway({ modelPolicy: policy, providers: [stub] });

      await expect(
        gw.chatStructured(
          { messages: [{ role: 'user', content: 'bad json' }], model: 'stub-model' },
          schema,
        ),
      ).rejects.toThrow(StructuredOutputError);
    });

    it('passes the derived JSON schema to providers', async () => {
      const captured: ChatRequest[] = [];
      class CapturingProvider extends FakeProvider {
        override async chat(request: ChatRequest): Promise<ChatResponse> {
          captured.push(request);
          return {
            content: '{"name":"Alice"}',
            model: request.model ?? 'stub-model',
            provider: this.id,
            finishReason: 'stop',
          };
        }
      }

      const schema = z.object({ name: z.string() });
      const provider = new CapturingProvider('stub', 'stub');
      const gw = new LLMGateway({ modelPolicy: policy, providers: [provider] });

      await gw.chatStructured(
        {
          messages: [{ role: 'user', content: 'get person' }],
          model: 'stub-model',
        },
        schema,
      );

      expect(captured).toHaveLength(1);
      expect(captured[0]).toEqual(expect.objectContaining({
        responseFormat: 'json',
        responseSchema: expect.objectContaining({
          type: 'object',
          properties: expect.objectContaining({
            name: expect.objectContaining({ type: 'string' }),
          }),
          required: ['name'],
          additionalProperties: false,
        }),
      }));
    });

    it('parses JSON wrapped in qwen think tags and code fences', async () => {
      const schema = z.object({ type: z.literal('tool_call'), toolName: z.string() });
      const stub = new StubProvider({
        'wrapped json': '<think>Need the article id first.</think>\n```json\n{"type":"tool_call","toolName":"article_get"}\n```',
      });
      const gw = new LLMGateway({ modelPolicy: policy, providers: [stub] });

      const result = await gw.chatStructured(
        { messages: [{ role: 'user', content: 'wrapped json' }], model: 'stub-model' },
        schema,
      );

      expect(result).toEqual({ type: 'tool_call', toolName: 'article_get' });
    });

    it('parses the first balanced JSON object from mixed-content responses', async () => {
      const schema = z.object({ type: z.literal('final'), content: z.string() });
      const stub = new StubProvider({
        'mixed json': 'Sure — use this.\n{"type":"final","content":"done"}\nThanks!',
      });
      const gw = new LLMGateway({ modelPolicy: policy, providers: [stub] });

      const result = await gw.chatStructured(
        { messages: [{ role: 'user', content: 'mixed json' }], model: 'stub-model' },
        schema,
      );

      expect(result).toEqual({ type: 'final', content: 'done' });
    });

    it('throws StructuredOutputError on schema mismatch', async () => {
      const schema = z.object({ name: z.string(), age: z.number() });
      const stub = new StubProvider({
        'wrong shape': '{"name": "Bob"}',
      });
      const gw = new LLMGateway({ modelPolicy: policy, providers: [stub] });

      await expect(
        gw.chatStructured(
          { messages: [{ role: 'user', content: 'wrong shape' }], model: 'stub-model' },
          schema,
        ),
      ).rejects.toThrow(StructuredOutputError);
    });

    it('sets responseFormat to json on the inner request', async () => {
      const schema = z.object({ ok: z.boolean() });
      const chatSpy = vi.fn().mockResolvedValue({
        content: '{"ok": true}',
        model: 'test',
        provider: 'spy',
      } satisfies ChatResponse);

      const spyProvider: LLMProvider = {
        id: 'spy',
        name: 'Spy',
        chat: chatSpy,
        listModels: () => ['test'],
        supportsModel: () => true,
      };

      const gw = new LLMGateway({ modelPolicy: policy, providers: [spyProvider] });
      await gw.chatStructured(
        { messages: [{ role: 'user', content: 'check' }], model: 'test' },
        schema,
      );

      expect(chatSpy).toHaveBeenCalledWith(
        expect.objectContaining({ responseFormat: 'json' }),
      );
    });

    it('keeps LM Studio structured calls in json_schema mode', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          id: 'chatcmpl-test',
          object: 'chat.completion',
          model: 'qwen/qwen3.5-35b-a3b',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: '```json\n{"ok":true}\n```' },
              finish_reason: 'stop',
            },
          ],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const gw = new LLMGateway({
        modelPolicy: policy,
        providers: [new LMStudioProvider({ defaultModel: 'qwen/qwen3.5-35b-a3b' })],
      });

      const result = await gw.chatStructured(
        {
          messages: [{ role: 'user', content: 'Return {"ok": true}' }],
          provider: 'lmstudio',
        },
        z.object({ ok: z.boolean() }),
      );

      const body = JSON.parse((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.response_format).toEqual(expect.objectContaining({
        type: 'json_schema',
        json_schema: expect.objectContaining({
          name: 'structured_output',
          schema: expect.objectContaining({
            type: 'object',
            properties: expect.objectContaining({
              ok: expect.objectContaining({ type: 'boolean' }),
            }),
            required: ['ok'],
            additionalProperties: false,
          }),
        }),
      }));
      expect(result).toEqual({ ok: true });
    });
  });

  // -- Error handling ------------------------------------------------------

  describe('error handling', () => {
    it('throws NoProviderError when no provider supports model', async () => {
      const gw = new LLMGateway({ modelPolicy: policy, providers: [] });

      await expect(
        gw.chat({
          messages: [{ role: 'user', content: 'Hi' }],
          model: 'nonexistent-model',
        }),
      ).rejects.toThrow(NoProviderError);
    });

    it('throws GatewayError when no model and no context', async () => {
      const gw = new LLMGateway({ modelPolicy: policy, providers: [new StubProvider()] });

      await expect(
        gw.chat({ messages: [{ role: 'user', content: 'Hi' }] }),
      ).rejects.toThrow(GatewayError);
    });

    it('propagates provider error when no fallback', async () => {
      const failing = new FakeProvider('bad', 'fail', { shouldFail: true });
      const gw = new LLMGateway({ modelPolicy: policy, providers: [failing] });

      await expect(
        gw.chat({
          messages: [{ role: 'user', content: 'Hi' }],
          model: 'fail-model',
        }),
      ).rejects.toThrow('bad provider failed');
    });
  });

  // -- Fallback behavior ---------------------------------------------------

  describe('fallback behavior', () => {
    it('falls back to next candidate when first provider fails', async () => {
      // Create a provider that fails for claude models and one that succeeds for gpt
      const failingClaude = new FakeProvider('anthropic', 'claude', { shouldFail: true });
      const workingGpt = new FakeProvider('openai', 'gpt');
      const gw = new LLMGateway({
        modelPolicy: policy,
        providers: [failingClaude, workingGpt],
      });

      // balanced task family has claude as first candidate, but should fall back to gpt
      const res = await gw.chat({
        messages: [{ role: 'user', content: 'Test fallback' }],
        taskFamily: 'balanced',
      });
      expect(res.provider).toBe('openai');
    });

    it('tries all candidates before failing', async () => {
      const failingClaude = new FakeProvider('anthropic', 'claude', { shouldFail: true });
      const failingGpt = new FakeProvider('openai', 'gpt', { shouldFail: true });
      const gw = new LLMGateway({
        modelPolicy: policy,
        providers: [failingClaude, failingGpt],
      });

      await expect(
        gw.chat({
          messages: [{ role: 'user', content: 'Test fallback' }],
          taskFamily: 'balanced',
        }),
      ).rejects.toThrow();
    });

    it('skips candidates with no matching provider', async () => {
      // Only GPT provider registered — claude candidates are skipped
      const gptProvider = new FakeProvider('openai', 'gpt');
      const gw = new LLMGateway({
        modelPolicy: policy,
        providers: [gptProvider],
      });

      // lightweight stage should have gpt-5-mini as candidate
      const res = await gw.chat({
        messages: [{ role: 'user', content: 'Skip test' }],
        stageKey: 'lightweight',
      });
      expect(res.provider).toBe('openai');
    });
  });

  // -- Model policy integration -------------------------------------------

  describe('model policy integration', () => {
    it('passes resolved model to provider', async () => {
      const chatSpy = vi.fn().mockResolvedValue({
        content: 'ok',
        model: 'gpt-5-mini',
        provider: 'spy',
      } satisfies ChatResponse);

      const spyProvider: LLMProvider = {
        id: 'spy',
        name: 'Spy',
        chat: chatSpy,
        listModels: () => [],
        supportsModel: () => true,
      };

      const gw = new LLMGateway({ modelPolicy: policy, providers: [spyProvider] });
      await gw.chat({
        messages: [{ role: 'user', content: 'Test' }],
        stageKey: 'writer',
      });

      // writer resolves to gpt-5-mini
      expect(chatSpy).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-5-mini' }),
      );
    });

    it('resolves panel stage with depth level', async () => {
      const stub = new StubProvider();
      const gw = new LLMGateway({ modelPolicy: policy, providers: [stub] });

      const res = await gw.chat({
        messages: [{ role: 'user', content: 'Discuss' }],
        stageKey: 'panel',
        depthLevel: 1,
      });
      // Panel depth 1 → gpt-5-nano
      expect(res.model).toBe('gpt-5-nano');
    });
  });
});
