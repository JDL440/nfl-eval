import { describe, it, expect, beforeEach, vi } from 'vitest';
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
      // writer stage resolves to claude-opus-4.6
      const claudeProvider = new FakeProvider('anthropic', 'claude');
      const gw = new LLMGateway({
        modelPolicy: policy,
        providers: [claudeProvider],
      });

      const res = await gw.chat({
        messages: [{ role: 'user', content: 'Write article' }],
        stageKey: 'writer',
      });
      expect(res.provider).toBe('anthropic');
      expect(res.model).toContain('claude');
    });

    it('routes via model policy with taskFamily', async () => {
      const claudeProvider = new FakeProvider('anthropic', 'claude');
      const gw = new LLMGateway({
        modelPolicy: policy,
        providers: [claudeProvider],
      });

      const res = await gw.chat({
        messages: [{ role: 'user', content: 'Do something' }],
        taskFamily: 'balanced',
      });
      // balanced family should resolve to a claude model
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
        model: 'claude-opus-4.6',
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

      // writer resolves to claude-opus-4.6
      expect(chatSpy).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-opus-4.6' }),
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
      // Panel depth 1 → claude-sonnet-4.5
      expect(res.model).toBe('claude-sonnet-4.5');
    });
  });
});
