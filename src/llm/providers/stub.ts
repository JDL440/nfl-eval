/**
 * Stub / mock LLM provider for testing and development.
 */

import type { LLMProvider, ChatRequest, ChatResponse } from '../gateway.js';

export class StubProvider implements LLMProvider {
  readonly id = 'stub';
  readonly name = 'Stub Provider';
  private readonly responses: Record<string, string>;

  /**
   * @param responses  Optional map of user-message → canned-response.
   *                   Keys are matched against the **first** user message content.
   */
  constructor(responses: Record<string, string> = {}) {
    this.responses = responses;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const firstUser = request.messages.find((m) => m.role === 'user');
    const userContent = firstUser?.content ?? '';

    let content: string;
    if (this.responses[userContent] !== undefined) {
      content = this.responses[userContent];
    } else {
      content = `Stub response for: ${userContent}`;
    }

    return {
      content,
      model: request.model ?? 'stub-model',
      provider: this.id,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      finishReason: 'stop',
    };
  }

  /** Stub supports every model — useful for testing. */
  listModels(): string[] {
    return ['*'];
  }

  supportsModel(_model: string): boolean {
    return true;
  }
}
