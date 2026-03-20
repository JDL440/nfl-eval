import { describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from '../../src/llm/providers/mock.js';
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

function stageReq(systemHint: string, userTask: string): ChatRequest {
  return {
    messages: [
      { role: 'system', content: systemHint },
      { role: 'user', content: userTask },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MockProvider', () => {
  let provider: MockProvider;

  beforeEach(() => {
    provider = new MockProvider();
  });

  // -- Identity ------------------------------------------------------------

  describe('identity', () => {
    it('has correct id and name', () => {
      expect(provider.id).toBe('mock');
      expect(provider.name).toBe('Mock (Testing)');
    });
  });

  // -- supportsModel -------------------------------------------------------

  describe('supportsModel', () => {
    it('returns true for any model', () => {
      expect(provider.supportsModel('gpt-4o')).toBe(true);
      expect(provider.supportsModel('claude-sonnet')).toBe(true);
      expect(provider.supportsModel('some-random-model')).toBe(true);
    });
  });

  // -- listModels ----------------------------------------------------------

  describe('listModels', () => {
    it('returns at least one model', () => {
      const models = provider.listModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models).toContain('mock-model');
    });
  });

  // -- Default stage-specific responses ------------------------------------

  describe('default stage responses', () => {
    it('returns discussion prompt content for generatePrompt context', async () => {
      const res = await provider.chat(
        stageReq('You are the lead agent.', 'Generate a discussion prompt from the following idea.'),
      );
      expect(res.content).toContain('Discussion Prompt');
      expect(res.content).toContain('Key Discussion Points');
    });

    it('returns panel composition content for composePanel context', async () => {
      const res = await provider.chat(
        stageReq('You are the lead agent.', 'Compose a panel of analysts for this discussion.'),
      );
      expect(res.content).toContain('Panel Composition');
      expect(res.content).toContain('Selected Analysts');
    });

    it('returns discussion summary for runDiscussion context', async () => {
      const res = await provider.chat(
        stageReq('You are the panel-moderator.', 'Moderate the panel discussion and produce a summary.'),
      );
      expect(res.content).toContain('Discussion Summary');
      expect(res.content).toContain('Key Findings');
    });

    it('returns article draft for writeDraft context', async () => {
      const res = await provider.chat(
        stageReq('You are the writer agent.', 'Write the full article draft from the panel discussion summary.'),
      );
      expect(res.content).toContain('Data-Driven Offseason Blueprint');
      expect(res.content).toContain('Offensive Line');
    });

    it('returns editor review for runEditor context', async () => {
      const res = await provider.chat(
        stageReq('You are the editor agent.', 'Review the article draft and provide editorial feedback.'),
      );
      expect(res.content).toContain('Editor Review');
      expect(res.content).toContain('PUBLISH');
    });

    it('returns publisher pass for runPublisherPass context', async () => {
      const res = await provider.chat(
        stageReq('You are the publisher agent.', 'Run the publisher pass to prepare the article for publication.'),
      );
      expect(res.content).toContain('Publisher Pass');
      expect(res.content).toContain('READY FOR PUBLICATION');
    });

    it('returns a generic fallback for unrecognized context', async () => {
      const res = await provider.chat(req({ messages: [{ role: 'user', content: 'Something unrelated' }] }));
      expect(res.content).toContain('Mock response');
    });
  });

  // -- setResponse override ------------------------------------------------

  describe('setResponse', () => {
    it('overrides the default content', async () => {
      provider.setResponse('Custom override response');
      const res = await provider.chat(req());
      expect(res.content).toBe('Custom override response');
    });

    it('override persists across multiple calls', async () => {
      provider.setResponse('Persistent override');
      const res1 = await provider.chat(req());
      const res2 = await provider.chat(req());
      expect(res1.content).toBe('Persistent override');
      expect(res2.content).toBe('Persistent override');
    });

    it('can be cleared with null', async () => {
      provider.setResponse('Temporary');
      provider.setResponse(null);
      const res = await provider.chat(req({ messages: [{ role: 'user', content: 'Something unrelated' }] }));
      expect(res.content).not.toBe('Temporary');
    });
  });

  // -- setError ------------------------------------------------------------

  describe('setError', () => {
    it('causes chat() to throw', async () => {
      provider.setError(new Error('Simulated failure'));
      await expect(provider.chat(req())).rejects.toThrow('Simulated failure');
    });

    it('error persists across calls', async () => {
      provider.setError(new Error('Persistent error'));
      await expect(provider.chat(req())).rejects.toThrow('Persistent error');
      await expect(provider.chat(req())).rejects.toThrow('Persistent error');
    });

    it('can be cleared with null', async () => {
      provider.setError(new Error('Temporary'));
      provider.setError(null);
      const res = await provider.chat(req());
      expect(res.content).toBeDefined();
    });

    it('still increments callCount when throwing', async () => {
      provider.setError(new Error('fail'));
      try { await provider.chat(req()); } catch { /* expected */ }
      expect(provider.callCount).toBe(1);
    });
  });

  // -- Token usage ---------------------------------------------------------

  describe('token usage', () => {
    it('returns usage stats', async () => {
      const res = await provider.chat(req());
      expect(res.usage).toBeDefined();
      expect(res.usage!.promptTokens).toBeGreaterThan(0);
      expect(res.usage!.completionTokens).toBeGreaterThan(0);
      expect(res.usage!.totalTokens).toBe(res.usage!.promptTokens + res.usage!.completionTokens);
    });

    it('returns finishReason', async () => {
      const res = await provider.chat(req());
      expect(res.finishReason).toBe('stop');
    });
  });

  // -- Call tracking -------------------------------------------------------

  describe('call tracking', () => {
    it('starts with zero calls', () => {
      expect(provider.callCount).toBe(0);
      expect(provider.lastRequest).toBeNull();
    });

    it('increments callCount on each call', async () => {
      await provider.chat(req());
      expect(provider.callCount).toBe(1);

      await provider.chat(req());
      expect(provider.callCount).toBe(2);
    });

    it('tracks lastRequest', async () => {
      const request = req({ model: 'gpt-4o', temperature: 0.5 });
      await provider.chat(request);
      expect(provider.lastRequest).toEqual(request);
    });

    it('resetStats clears tracking', async () => {
      await provider.chat(req());
      provider.resetStats();
      expect(provider.callCount).toBe(0);
      expect(provider.lastRequest).toBeNull();
    });
  });

  // -- Response metadata ---------------------------------------------------

  describe('response metadata', () => {
    it('uses requested model in response', async () => {
      const res = await provider.chat(req({ model: 'gpt-4o' }));
      expect(res.model).toBe('gpt-4o');
    });

    it('defaults to mock-model when no model specified', async () => {
      const res = await provider.chat(req());
      expect(res.model).toBe('mock-model');
    });

    it('provider id is mock', async () => {
      const res = await provider.chat(req());
      expect(res.provider).toBe('mock');
    });
  });
});
