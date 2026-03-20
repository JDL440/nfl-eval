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
// Last verified: 2025-03-20
// ---------------------------------------------------------------------------

const MODEL_MAP: Record<string, string> = {
  // GPT-4 family (verified working)
  'gpt-4o':                   'gpt-4o',
  'gpt-4o-mini':              'gpt-4o-mini',
  'gpt-4.1':                  'gpt-4.1',
  'gpt-4.1-mini':             'gpt-4.1-mini',
  'gpt-4.1-nano':             'gpt-4.1-nano',
  // Reasoning models (verified — need max_completion_tokens, not max_tokens)
  'o4-mini':                  'o4-mini',
  'o3':                       'o3',
  'o3-mini':                  'o3-mini',
  'o1':                       'o1',
  // Open-source models (verified working)
  'DeepSeek-R1':              'DeepSeek-R1',
  'cohere-command-a':         'cohere-command-a',
  'Phi-4':                    'Phi-4',
} as const;

// Reasoning models require max_completion_tokens instead of max_tokens
const REASONING_MODELS = new Set(['o4-mini', 'o3', 'o3-mini', 'o1', 'DeepSeek-R1']);

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
  }
}
