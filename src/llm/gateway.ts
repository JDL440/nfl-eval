/**
 * LLM Gateway — multi-provider abstraction layer.
 *
 * Routes LLM calls through pluggable providers, using ModelPolicy to resolve
 * which model (and therefore which provider) handles each request.
 */

import { z, type ZodType } from 'zod';
import { type ModelPolicy, type ResolvedModel } from './model-policy.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export type ChatMessage =
  | {
      role: 'system' | 'user';
      content: string;
    }
  | {
      role: 'assistant';
      content: string;
      tool_calls?: ChatToolCall[];
    }
  | {
      role: 'tool';
      content: string;
      tool_call_id: string;
      name?: string;
    };

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
  tools?: ChatToolDefinition[];
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stageKey?: string;
  depthLevel?: number;
  taskFamily?: string;
  responseFormat?: 'text' | 'json';
  responseSchema?: Record<string, unknown>;
  disallowedProviderIds?: string[];
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

function stripStructuredJsonDecorators(raw: string): string {
  let normalized = raw.trim().replace(/^\uFEFF/, '').trim();
  normalized = normalized.replace(/<(think|thinking|reasoning)>([\s\S]*?)<\/\1>/gi, '').trim();

  const orphanedThinkClose = normalized.indexOf('</think>');
  if (orphanedThinkClose >= 0) {
    normalized = normalized.slice(orphanedThinkClose + '</think>'.length).trim();
  }

  const fenced = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    return fenced[1].trim();
  }

  return normalized;
}

function extractBalancedJsonCandidate(text: string): string | null {
  const start = text.search(/[\[{]/);
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{' || char === '[') {
      depth += 1;
      continue;
    }

    if (char === '}' || char === ']') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

export function parseStructuredJson(raw: string): unknown {
  const candidates: string[] = [];
  const addCandidate = (candidate: string | null | undefined): void => {
    const value = candidate?.trim();
    if (value && !candidates.includes(value)) {
      candidates.push(value);
    }
  };

  const stripped = stripStructuredJsonDecorators(raw);
  addCandidate(raw);
  addCandidate(stripped);
  addCandidate(extractBalancedJsonCandidate(stripped));
  addCandidate(extractBalancedJsonCandidate(raw));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try next candidate
    }
  }

  throw new StructuredOutputError(
    `LLM response is not valid JSON: ${raw.slice(0, 200)}`,
    raw,
  );
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
      const provider = this.findProviderForModel(model, request.disallowedProviderIds);
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
    const result = await this.chatStructuredWithResponse(request, schema);
    return result.data;
  }

  async chatStructuredWithResponse<T>(
    request: ChatRequest,
    schema: ZodType<T>,
  ): Promise<{ data: T; response: ChatResponse }> {
    const response = await this.chat({
      ...request,
      responseFormat: 'json',
      responseSchema: z.toJSONSchema(schema) as Record<string, unknown>,
    });
    const raw = response.content;
    const parsed = parseStructuredJson(raw);

    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new StructuredOutputError(
        `LLM response does not match schema: ${result.error.message}`,
        raw,
      );
    }

    return { data: result.data, response };
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

  private findProviderForModel(model: string, disallowedProviderIds?: string[]): LLMProvider | undefined {
    const disallowed = new Set(disallowedProviderIds ?? []);
    for (const provider of this.providers.values()) {
      if (disallowed.has(provider.id)) {
        continue;
      }
      if (provider.supportsModel(model)) {
        return provider;
      }
    }
    return undefined;
  }
}
