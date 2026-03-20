/**
 * LLM Gateway — multi-provider abstraction layer.
 *
 * Routes LLM calls through pluggable providers, using ModelPolicy to resolve
 * which model (and therefore which provider) handles each request.
 */

import { type ZodType } from 'zod';
import { type ModelPolicy, type ResolvedModel } from './model-policy.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stageKey?: string;
  depthLevel?: number;
  taskFamily?: string;
  responseFormat?: 'text' | 'json';
}

export interface ChatResponse {
  content: string;
  model: string;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export interface LLMProvider {
  id: string;
  name: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
  listModels(): string[];
  supportsModel(model: string): boolean;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class GatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GatewayError';
  }
}

export class NoProviderError extends GatewayError {
  constructor(model: string) {
    super(`No provider available for model: ${model}`);
    this.name = 'NoProviderError';
  }
}

export class StructuredOutputError extends GatewayError {
  constructor(message: string, public readonly raw: string) {
    super(message);
    this.name = 'StructuredOutputError';
  }
}

// ---------------------------------------------------------------------------
// Gateway
// ---------------------------------------------------------------------------

export interface GatewayOptions {
  modelPolicy: ModelPolicy;
  providers?: LLMProvider[];
}

export class LLMGateway {
  private readonly modelPolicy: ModelPolicy;
  private readonly providers = new Map<string, LLMProvider>();

  constructor(options: GatewayOptions) {
    this.modelPolicy = options.modelPolicy;
    for (const p of options.providers ?? []) {
      this.providers.set(p.id, p);
    }
  }

  // -- Provider management -------------------------------------------------

  registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
  }

  removeProvider(id: string): void {
    this.providers.delete(id);
  }

  getProvider(id: string): LLMProvider | undefined {
    return this.providers.get(id);
  }

  // -- Chat ----------------------------------------------------------------

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const candidates = this.resolveCandidates(request);

    let lastError: Error | undefined;
    for (const model of candidates) {
      const provider = this.findProviderForModel(model);
      if (!provider) continue;

      try {
        const enriched: ChatRequest = { ...request, model };
        return await provider.chat(enriched);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    if (lastError) {
      throw lastError;
    }
    throw new NoProviderError(candidates[0] ?? request.model ?? 'unknown');
  }

  // -- Structured output ---------------------------------------------------

  async chatStructured<T>(request: ChatRequest, schema: ZodType<T>): Promise<T> {
    const response = await this.chat({ ...request, responseFormat: 'json' });
    const raw = response.content;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new StructuredOutputError(
        `LLM response is not valid JSON: ${raw.slice(0, 200)}`,
        raw,
      );
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new StructuredOutputError(
        `LLM response does not match schema: ${result.error.message}`,
        raw,
      );
    }

    return result.data;
  }

  // -- Private helpers -----------------------------------------------------

  private resolveCandidates(request: ChatRequest): string[] {
    // Explicit model — use it directly (no policy resolution)
    if (request.model) {
      return [request.model];
    }

    // Use model policy if stage/task context provided
    const hasContext = request.stageKey || request.taskFamily;
    if (!hasContext) {
      throw new GatewayError(
        'ChatRequest must specify either "model" or a policy context (stageKey / taskFamily).',
      );
    }

    const resolved: ResolvedModel = this.modelPolicy.resolve({
      stageKey: request.stageKey,
      depthLevel: request.depthLevel,
      taskFamily: request.taskFamily,
    });

    return resolved.candidates;
  }

  private findProviderForModel(model: string): LLMProvider | undefined {
    for (const provider of this.providers.values()) {
      if (provider.supportsModel(model)) {
        return provider;
      }
    }
    return undefined;
  }
}
