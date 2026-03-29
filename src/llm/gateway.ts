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

export interface ProviderContext {
  articleId?: string | null;
  runId?: string | null;
  stageRunId?: string | null;
  stage?: number | null;
  surface?: string | null;
  traceId?: string | null;
}

export interface ProviderMetadata {
  providerMode?: string | null;
  providerSessionId?: string | null;
  workingDirectory?: string | null;
  incrementalPrompt?: string | null;
  requestEnvelope?: unknown;
  responseEnvelope?: unknown;
}

export interface ChatRequest {
  messages: ChatMessage[];
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stageKey?: string;
  depthLevel?: number;
  taskFamily?: string;
  responseFormat?: 'text' | 'json';
  providerContext?: ProviderContext;
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
  providerMetadata?: ProviderMetadata;
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

export interface GatewayRoutePreview {
  providerId: string;
  model: string;
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

  listProviders(): Array<{ id: string; name: string }> {
    return [...this.providers.values()].map((provider) => ({
      id: provider.id,
      name: provider.name,
    }));
  }

  previewRoute(request: ChatRequest): GatewayRoutePreview {
    if (request.provider) {
      const provider = this.getProvider(request.provider);
      if (!provider) {
        throw new GatewayError(`Requested provider not available: ${request.provider}`);
      }
      return {
        providerId: provider.id,
        model: request.model ?? provider.listModels()[0] ?? 'unknown',
      };
    }

    const candidates = this.resolveCandidates(request);
    for (const model of candidates) {
      const provider = this.findProviderForModel(model);
      if (!provider) continue;
      return {
        providerId: provider.id,
        model,
      };
    }

    throw new NoProviderError(candidates[0] ?? request.model ?? 'unknown');
  }

  // -- Chat ----------------------------------------------------------------

  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (request.provider) {
      const provider = this.getProvider(request.provider);
      if (!provider) {
        throw new GatewayError(`Requested provider not available: ${request.provider}`);
      }
      return provider.chat(request);
    }

    const candidates = this.resolveCandidates(request);

    const errors: { model: string; error: Error }[] = [];
    for (const model of candidates) {
      const provider = this.findProviderForModel(model);
      if (!provider) continue;

      try {
        const enriched: ChatRequest = { ...request, model };
        return await provider.chat(enriched);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        errors.push({ model, error });
        console.warn(`[gateway] Model "${model}" failed: ${error.message.slice(0, 200)}`);

        // Don't cascade to next candidate on timeout — same provider will timeout again
        if (/timed?\s*out/i.test(error.message)) {
          break;
        }
      }
    }

    if (errors.length > 0) {
      // Throw the first error with context about all failures
      const summary = errors.map(e => `${e.model}: ${e.error.message.slice(0, 100)}`).join(' | ');
      const combined = new Error(`All ${errors.length} model candidate(s) failed: ${summary}`);
      (combined as any).cause = errors[0].error;
      (combined as Error & { providerMetadata?: ProviderMetadata }).providerMetadata =
        (errors[0].error as Error & { providerMetadata?: ProviderMetadata }).providerMetadata;
      throw combined;
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
