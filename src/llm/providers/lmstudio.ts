/**
 * LM Studio LLM provider — routes requests through a local LM Studio
 * instance running an OpenAI-compatible API.
 *
 * Auth: none (local server).
 * Default endpoint: http://localhost:1234/v1/chat/completions
 */

import type { LLMProvider, ChatRequest, ChatResponse } from '../gateway.js';

// ---------------------------------------------------------------------------
// Response types (OpenAI-compatible)
// ---------------------------------------------------------------------------

interface LMStudioChoice {
  index: number;
  message: { role: string; content: string | null };
  finish_reason: string | null;
}

interface LMStudioResponse {
  id: string;
  object: string;
  model: string;
  choices: LMStudioChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface LMStudioModelEntry {
  id: string;
  object: string;
}

interface LMStudioModelsResponse {
  data: LMStudioModelEntry[];
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface LMStudioProviderOptions {
  /** Base URL for the LM Studio API (default: http://localhost:1234/v1). */
  baseUrl?: string;
  /** Default model name when none specified in the request. */
  defaultModel?: string;
}

const DEFAULT_BASE_URL = 'http://localhost:1234/v1';
const DEFAULT_MODEL = 'qwen-35';

export class LMStudioProvider implements LLMProvider {
  readonly id = 'lmstudio';
  readonly name = 'LM Studio (Local)';

  readonly baseUrl: string;
  readonly defaultModel: string;

  /** Cached model list, populated by fetchModels(). */
  private cachedModels: string[];

  constructor(options?: LMStudioProviderOptions) {
    this.baseUrl = (options?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.defaultModel = options?.defaultModel ?? DEFAULT_MODEL;
    this.cachedModels = [this.defaultModel];
  }

  // -- Model helpers -------------------------------------------------------

  /**
   * Returns cached model list. Call fetchModels() first to populate from the
   * running LM Studio instance.
   */
  listModels(): string[] {
    return [...this.cachedModels];
  }

  /**
   * Fetch available models from the LM Studio /models endpoint and update
   * the internal cache. Returns the model ids. If LM Studio is not running,
   * returns an empty array.
   */
  async fetchModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/models`);
      if (!res.ok) return [];
      const data = (await res.json()) as LMStudioModelsResponse;
      const ids = (data.data ?? []).map((m) => m.id);
      this.cachedModels = ids.length > 0 ? ids : [this.defaultModel];
      return ids;
    } catch {
      this.cachedModels = [];
      return [];
    }
  }

  /** LM Studio can load any model — accept all model names. */
  supportsModel(_model: string): boolean {
    return true;
  }

  // -- Chat ----------------------------------------------------------------

  async chat(request: ChatRequest): Promise<ChatResponse> {
    // Always use the default local model — pipeline model names (gpt-4.1, etc.)
    // are meaningless for LM Studio. Use whatever model the user has loaded.
    const model = this.defaultModel;

    const messages = request.messages.map((m) => ({
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

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`LM Studio not running at ${this.baseUrl} — ${msg}`);
    }

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`LM Studio API error (${res.status}): ${errorBody}`);
    }

    const data = (await res.json()) as LMStudioResponse;
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
}
