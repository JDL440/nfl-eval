/**
 * GitHub Copilot Pro+ LLM provider — routes requests through the GitHub
 * Models API (OpenAI-compatible chat completions).
 *
 * Auth: GITHUB_TOKEN env var, or falls back to `gh auth token`.
 * Endpoint: https://models.github.ai/inference/chat/completions
 */

import { execSync } from 'node:child_process';
import type { LLMProvider, ChatRequest, ChatResponse } from '../gateway.js';

// ---------------------------------------------------------------------------
// Model catalogue — maps short model ids to GitHub Models qualified names.
//
// IMPORTANT: Only include models verified to work on the GitHub Models API
// (models.github.ai). This is NOT the same as the Copilot IDE model catalog.
// When adding models, test with a real API call first.
//
// Last verified: 2026-03-21
// ---------------------------------------------------------------------------

const MODEL_MAP: Record<string, string> = {
  // GPT-5 family (verified working — all require max_completion_tokens)
  'gpt-5':                    'gpt-5',
  'gpt-5-chat':               'gpt-5-chat',
  'gpt-5-mini':               'gpt-5-mini',
  'gpt-5-nano':               'gpt-5-nano',
  // GPT-4 family (verified working — kept for backward compatibility)
  'gpt-4o':                   'gpt-4o',
  'gpt-4o-mini':              'gpt-4o-mini',
  'gpt-4.1':                  'gpt-4.1',
  'gpt-4.1-mini':             'gpt-4.1-mini',
  'gpt-4.1-nano':             'gpt-4.1-nano',
  // Reasoning models (verified — need max_completion_tokens, not max_tokens)
  'o4-mini':                  'o4-mini',
  'o3':                       'o3',        // NOTE: 4K input token limit — not suitable for content pipelines
  'o3-mini':                  'o3-mini',
  'o1':                       'o1',
  'o1-mini':                  'o1-mini',
  // DeepSeek (verified working)
  'deepseek-r1':              'deepseek/deepseek-r1',
  'deepseek-r1-0528':         'deepseek/deepseek-r1-0528',
  'deepseek-v3-0324':         'deepseek/deepseek-v3-0324',
  'DeepSeek-R1':              'deepseek/deepseek-r1',        // legacy alias
  // Meta Llama 4 (verified working)
  'llama-4-maverick':         'meta/llama-4-maverick-17b-128e-instruct-fp8',
  'llama-4-scout':            'meta/llama-4-scout-17b-16e-instruct',
  // xAI Grok (verified working)
  'grok-3':                   'xai/grok-3',
  'grok-3-mini':              'xai/grok-3-mini',
  // Microsoft Phi (verified working)
  'phi-4':                    'microsoft/phi-4',
  'phi-4-mini':               'microsoft/phi-4-mini-instruct',
  'phi-4-reasoning':          'microsoft/phi-4-reasoning',
  'Phi-4':                    'microsoft/phi-4',              // legacy alias
  // Mistral (verified working)
  'codestral-2501':           'mistral-ai/codestral-2501',
  'mistral-medium-2505':      'mistral-ai/mistral-medium-2505',
} as const;

// Models that require max_completion_tokens instead of max_tokens and no temperature
const REASONING_MODELS = new Set([
  'gpt-5', 'gpt-5-chat', 'gpt-5-mini', 'gpt-5-nano',
  'o4-mini', 'o3', 'o3-mini', 'o1', 'o1-mini',
  'deepseek-r1', 'deepseek-r1-0528', 'DeepSeek-R1',
]);

const COPILOT_MODELS = Object.keys(MODEL_MAP);

const API_BASE = 'https://models.github.ai/inference';

// ---------------------------------------------------------------------------
// Response types (OpenAI-compatible)
// ---------------------------------------------------------------------------

interface GHModelsChoice {
  index: number;
  message: { role: string; content: string | null };
  finish_reason: string | null;
}

interface GHModelsResponse {
  id: string;
  object: string;
  model: string;
  choices: GHModelsChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface CopilotProviderOptions {
  /** Explicit GitHub token (overrides env/gh CLI). */
  token?: string;
}

export class CopilotProvider implements LLMProvider {
  readonly id = 'copilot';
  readonly name = 'GitHub Copilot Pro+';
  private readonly explicitToken: string | undefined;

  constructor(options?: CopilotProviderOptions) {
    this.explicitToken = options?.token;
  }

  // -- Auth ----------------------------------------------------------------

  /** Resolve a GitHub token from explicit option → env → gh CLI. */
  resolveToken(): string {
    if (this.explicitToken) return this.explicitToken;

    const envToken = process.env['GITHUB_TOKEN'];
    if (envToken) return envToken;

    try {
      const ghToken = execSync('gh auth token', {
        encoding: 'utf-8',
        timeout: 5_000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      if (ghToken) return ghToken;
    } catch {
      // gh CLI not available or not authenticated — fall through
    }

    throw new Error(
      'GitHub token not found. Set GITHUB_TOKEN env var or authenticate with `gh auth login`.',
    );
  }

  // -- Model helpers -------------------------------------------------------

  /** Map a short model id to the qualified GitHub Models id. */
  private qualifiedModel(model: string): string {
    return MODEL_MAP[model] ?? model;
  }

  listModels(): string[] {
    return [...COPILOT_MODELS];
  }

  supportsModel(model: string): boolean {
    return COPILOT_MODELS.includes(model) || model in MODEL_MAP;
  }

  // -- Chat ----------------------------------------------------------------

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const token = this.resolveToken();
    const model = request.model ?? 'gpt-4o';
    const qualifiedModel = this.qualifiedModel(model);

    const messages = request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const isReasoning = REASONING_MODELS.has(model);

    const body: Record<string, unknown> = {
      model: qualifiedModel,
      messages,
    };

    // Reasoning models don't support temperature
    if (!isReasoning) {
      body['temperature'] = request.temperature ?? 0.7;
    }

    // Reasoning models need max_completion_tokens instead of max_tokens
    if (request.maxTokens) {
      body[isReasoning ? 'max_completion_tokens' : 'max_tokens'] = request.maxTokens;
    }

    if (request.responseFormat === 'json') {
      body['response_format'] = { type: 'json_object' };
    }

    // Retry with exponential backoff for transient errors (EOF, 500, 502, 503, 429)
    const maxRetries = 3;
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(`${API_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errorBody = await res.text();
          const retryable = [429, 500, 502, 503].includes(res.status) || errorBody.includes('unexpected EOF');
          if (retryable && attempt < maxRetries) {
            const delay = Math.min(1000 * 2 ** attempt, 8000);
            console.warn(`[copilot] Retrying (${attempt + 1}/${maxRetries}) after ${res.status}: ${errorBody.slice(0, 120)}`);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          throw new Error(`GitHub Models API error (${res.status}): ${errorBody}`);
        }

        const data = (await res.json()) as GHModelsResponse;
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
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const isNetworkError = lastError.message.includes('EOF') || lastError.message.includes('ECONNRESET') || lastError.message.includes('fetch failed');
        if (isNetworkError && attempt < maxRetries) {
          const delay = Math.min(1000 * 2 ** attempt, 8000);
          console.warn(`[copilot] Retrying (${attempt + 1}/${maxRetries}) after network error: ${lastError.message.slice(0, 120)}`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw lastError;
      }
    }
    throw lastError ?? new Error('GitHub Models API: max retries exceeded');
  }
}
