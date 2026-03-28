/**
 * Pipeline integration coverage for the plain GitHub Models Copilot provider.
 *
 * The dashboard may pass article-stage context through the gateway, but the
 * legacy API provider should remain a thin adapter. Guarded tool access and
 * session reuse are covered by the Copilot CLI provider tests instead.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CopilotProvider } from '../../src/llm/providers/copilot.js';
import { LLMGateway } from '../../src/llm/gateway.js';
import type { ChatRequest } from '../../src/llm/gateway.js';

global.fetch = vi.fn();

describe('Pipeline - Copilot provider integration', () => {
  let gateway: LLMGateway;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_TOKEN = 'test-token';

    const mockModelPolicy = {
      config: {},
      resolve: () => ({ candidates: ['gpt-4o'], selectedModel: 'gpt-4o' }),
    };

    gateway = new LLMGateway({
      modelPolicy: mockModelPolicy as any,
      providers: [new CopilotProvider()],
    });
  });

  it('routes article-stage requests through the gateway without CLI-only metadata', async () => {
    const mockResponse = {
      id: 'test-writer',
      object: 'chat.completion',
      model: 'gpt-4o',
      choices: [{ index: 0, message: { role: 'assistant', content: 'Draft' }, finish_reason: 'stop' }],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const request: ChatRequest = {
      messages: [
        { role: 'system', content: 'You are writing an article.' },
        { role: 'user', content: 'Write the article.' },
      ],
      model: 'gpt-4o',
      providerContext: {
        stage: 5,
        articleId: 'test-123',
        traceId: 'trace-1',
      },
    };

    const response = await gateway.chat(request);
    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);

    expect(response.content).toBe('Draft');
    expect(response.provider).toBe('copilot');
    expect(response.providerMetadata).toBeUndefined();
    expect(body.messages).toHaveLength(2);
    expect(body.copilot_extensions).toBeUndefined();
  });

  it('keeps non-article requests on the same plain provider contract', async () => {
    const mockResponse = {
      id: 'test-idea',
      object: 'chat.completion',
      model: 'gpt-4o',
      choices: [{ index: 0, message: { role: 'assistant', content: 'Idea' }, finish_reason: 'stop' }],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const request: ChatRequest = {
      messages: [{ role: 'user', content: 'Generate ideas.' }],
      model: 'gpt-4o',
      providerContext: {
        stage: 1,
      },
    };

    const response = await gateway.chat(request);

    expect(response.content).toBe('Idea');
    expect(response.providerMetadata).toBeUndefined();
  });
});
