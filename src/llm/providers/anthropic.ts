/**
 * Anthropic LLM provider — routes requests to the Anthropic Messages API.
 *
 * Uses native fetch (Node 18+). Requires ANTHROPIC_API_KEY env var.
 */

import type { LLMProvider, ChatRequest, ChatResponse, ChatMessage } from '../gateway.js';

const ANTHROPIC_MODELS = [
  'claude-opus-4-20250514',
  'claude-opus-4.5',
  'claude-opus-4.6',
  'claude-sonnet-4-20250514',
  'claude-sonnet-4',
  'claude-sonnet-4.5',
  'claude-sonnet-4.6',
  'claude-haiku-4-20250514',
  'claude-haiku-4.5',
] as const;

const API_BASE = 'https://api.anthropic.com';
const API_VERSION = '2023-06-01';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{ type: string; text: string }>;
  model: string;
  stop_reason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic';

  private get apiKey(): string {
    const key = process.env['ANTHROPIC_API_KEY'];
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set.');
    }
    return key;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const apiKey = this.apiKey;
    const model = request.model ?? 'claude-sonnet-4-20250514';

    // Separate system message from conversation messages
    const systemMsg = request.messages.find((m) => m.role === 'system');
    const conversationMsgs: AnthropicMessage[] = request.messages
      .filter((m): m is Exclude<ChatMessage, { role: 'system' }> => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.role === 'tool'
          ? `Tool result for ${m.name ?? m.tool_call_id}:\n${m.content}`
          : m.content,
      }));

    const body: Record<string, unknown> = {
      model,
      messages: conversationMsgs,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7,
    };

    if (systemMsg) {
      body['system'] = systemMsg.content;
    }

    const res = await fetch(`${API_BASE}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${errorBody}`);
    }

    const data = (await res.json()) as AnthropicResponse;
    const textContent = data.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('');

    return {
      content: textContent,
      model: data.model,
      provider: this.id,
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        cachedTokens: (data.usage.cache_read_input_tokens ?? 0) > 0
          ? data.usage.cache_read_input_tokens
          : undefined,
      },
      finishReason: data.stop_reason ?? undefined,
    };
  }

  listModels(): string[] {
    return [...ANTHROPIC_MODELS];
  }

  supportsModel(model: string): boolean {
    return ANTHROPIC_MODELS.includes(model as typeof ANTHROPIC_MODELS[number])
      || model.startsWith('claude-');
  }
}
