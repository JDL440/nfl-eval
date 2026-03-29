/**
 * Local / Ollama LLM provider — routes requests to a locally-running Ollama
 * instance via its OpenAI-compatible chat completions endpoint.
 *
 * Uses native fetch (Node 18+). No API key required.
 */

import type { LLMProvider, ChatRequest, ChatResponse } from '../gateway.js';

const DEFAULT_BASE_URL = 'http://localhost:11434';

// ---------------------------------------------------------------------------
// Ollama OpenAI-compat types (subset)
// ---------------------------------------------------------------------------

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

interface OllamaChoice {
  index: number;
  message: { role: string; content: string | null };
  finish_reason: string | null;
}

interface OllamaResponse {
  id: string;
  model: string;
  choices: OllamaChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class LocalProvider implements LLMProvider {
  readonly id = 'local';
  readonly name = 'Local (Ollama)';

  private readonly baseUrl: string;

  constructor(options?: { baseUrl?: string }) {
    this.baseUrl = (options?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const model = request.model ?? 'llama3';

    const messages: OllamaChatMessage[] = request.messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...('tool_call_id' in m ? { tool_call_id: m.tool_call_id } : {}),
      ...('name' in m && typeof m.name === 'string' ? { name: m.name } : {}),
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

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Ollama API error (${res.status}): ${errorBody}`);
    }

    const data = (await res.json()) as OllamaResponse;
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

  /** Ollama can pull any model on-demand, so accept everything. */
  listModels(): string[] {
    return ['*'];
  }

  /** Returns true for any model — Ollama handles pulling as needed. */
  supportsModel(_model: string): boolean {
    return true;
  }

  // -------------------------------------------------------------------------
  // Ollama-specific helpers
  // -------------------------------------------------------------------------

  /** List models currently available on the local Ollama instance. */
  async listLocalModels(): Promise<OllamaModel[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`);

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Ollama API error (${res.status}): ${errorBody}`);
    }

    const data = (await res.json()) as OllamaTagsResponse;
    return data.models;
  }
}
