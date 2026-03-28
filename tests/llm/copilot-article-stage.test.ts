/**
 * Regression coverage for the legacy GitHub Models Copilot provider.
 *
 * Article-stage tool gating and session reuse belong to `copilot-cli.ts`.
 * The plain API-backed provider should continue to ignore that context while
 * still accepting the same request shape.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CopilotProvider } from '../../src/llm/providers/copilot.js';
import type { ChatRequest } from '../../src/llm/gateway.js';

global.fetch = vi.fn();

describe('CopilotProvider - article stage compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_TOKEN = 'test-token';
  });

  it('accepts article-stage context without emitting CLI-only tool fields', async () => {
    const provider = new CopilotProvider();
    const mockResponse = {
      id: 'test-1',
      object: 'chat.completion',
      model: 'gpt-4o',
      choices: [{ index: 0, message: { role: 'assistant', content: 'Test response' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const request: ChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      providerContext: {
        stage: 4,
        articleId: 'test-article',
        traceId: 'trace-123',
      },
    };

    const response = await provider.chat(request);
    const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);

    expect(callBody.model).toBe('gpt-4o');
    expect(callBody.copilot_extensions).toBeUndefined();
    expect(response.providerMetadata).toBeUndefined();
  });

  it('does not create reusable sessions for article-stage calls', async () => {
    const provider = new CopilotProvider();
    const mockResponse = {
      id: 'test-2',
      object: 'chat.completion',
      model: 'gpt-4o',
      choices: [{ index: 0, message: { role: 'assistant', content: 'Test' }, finish_reason: 'stop' }],
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const request: ChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      providerContext: {
        stage: 5,
        articleId: 'article-123',
      },
    };

    const response1 = await provider.chat(request);
    const response2 = await provider.chat(request);

    expect(response1.providerMetadata?.providerSessionId).toBeUndefined();
    expect(response2.providerMetadata?.providerSessionId).toBeUndefined();
    expect((global.fetch as any).mock.calls).toHaveLength(2);
  });
});
