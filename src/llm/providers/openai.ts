/**
 * OpenAI LLM provider — routes requests to the OpenAI Chat Completions API.
 *
 * Uses native fetch (Node 18+). Requires OPENAI_API_KEY env var.
 */

import type { LLMProvider, ChatRequest, ChatResponse } from '../gateway.js';

const OPENAI_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-5',
  'gpt-5-mini',
  'gpt-5.1',
  'gpt-5.1-codex',
  'gpt-5.4',
  'o1',
  'o1-mini',
  'o3',
  'o3-mini',
  'o4-mini',
] as const;

const API_BASE = 'https://api.openai.com';

interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIChoice {
  index: number;
  message: { role: string; content: string | null };
  finish_reason: string | null;
}

interface OpenAIResponse {
  id: string;
  object: string;
  model: string;
  choices: OpenAIChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIProvider implements LLMProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';

  private get apiKey(): string {
    const key = process.env['OPENAI_API_KEY'];
    if (!key) {
      throw new Error('OPENAI_API_KEY environment variable is not set.');
    }
    return key;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const apiKey = this.apiKey;
    const model = request.model ?? 'gpt-4o';

    const messages: OpenAIChatMessage[] = request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: request.temperature ?? 0.7,
    };

    if (request.maxTokens) {
      body['max_tokens'] = request.maxTokens;
    }

    if (request.responseFormat === 'json') {
      body['response_format'] = { type: 'json_object' };
    }

    const res = await fetch(`${API_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${errorBody}`);
    }

    const data = (await res.json()) as OpenAIResponse;
    const choice = data.choices[0];

    return {
      content: choice?.message?.content ?? '',
      model: data.model,
      provider: this.id,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      finishReason: choice?.finish_reason ?? undefined,
    };
  }

  listModels(): string[] {
    return [...OPENAI_MODELS];
  }

  supportsModel(model: string): boolean {
    return OPENAI_MODELS.includes(model as typeof OPENAI_MODELS[number])
      || model.startsWith('gpt-')
      || model.startsWith('o1')
      || model.startsWith('o3')
      || model.startsWith('o4');
  }
}
