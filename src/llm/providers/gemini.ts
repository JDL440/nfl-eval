/**
 * Google Gemini LLM provider — routes requests to the Gemini REST API.
 *
 * Uses native fetch (Node 18+). Requires GEMINI_API_KEY env var.
 */

import type {
  LLMProvider,
  ChatRequest,
  ChatResponse,
  ChatMessage,
  ProviderMetadata,
} from '../gateway.js';

const GEMINI_MODELS = [
  'gemini-3.1-pro-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite-preview-06-17',
] as const;

const DEFAULT_MODEL = 'gemini-3.1-pro-preview';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// ---------------------------------------------------------------------------
// Gemini API types
// ---------------------------------------------------------------------------

interface GeminiPart {
  text?: string;
  functionCall?: {
    name: string;
    args: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: {
      result: unknown;
    };
  };
  thoughtSignature?: string;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiCandidate {
  content: { role: string; parts: GeminiPart[] };
  finishReason?: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
    cachedContentTokenCount?: number;
  };
}

interface GeminiProviderState {
  contents: GeminiContent[];
}

function parseToolArguments(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function serializeNativeToolCall(part: NonNullable<GeminiPart['functionCall']>): string {
  return JSON.stringify({
    type: 'tool_call',
    toolName: part.name,
    args: part.args ?? {},
  });
}

function serializeFinalContent(content: string): string {
  return JSON.stringify({
    type: 'final',
    content,
  });
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class GeminiProvider implements LLMProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';

  private readonly _apiKey: string | undefined;

  constructor(apiKey?: string) {
    this._apiKey = apiKey;
  }

  private get apiKey(): string {
    const key = this._apiKey ?? process.env['GEMINI_API_KEY'];
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is not set.');
    }
    return key;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const apiKey = this.apiKey;
    const model = request.model ?? DEFAULT_MODEL;
    const hasNativeTools = Boolean(request.tools?.length);

    const systemMsg = request.messages.find((m) => m.role === 'system');
    const geminiState = this.getProviderState(request.providerState);
    const contents = geminiState?.contents && hasNativeTools
      ? [
          ...geminiState.contents,
          ...this.mapTrailingToolMessages(request.messages),
        ]
      : this.mapMessages(request.messages.filter((m) => m.role !== 'system'));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 4096,
      },
    };

    if (systemMsg) {
      body['systemInstruction'] = {
        parts: [{ text: systemMsg.content }],
      };
    }

    if (hasNativeTools) {
      body['tools'] = [{
        functionDeclarations: request.tools!.map((tool) => ({
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
        })),
      }];
      body['toolConfig'] = {
        functionCallingConfig: {
          mode: 'AUTO',
        },
      };
    }

    const url = `${API_BASE}/models/${model}:generateContent?key=${apiKey}`;

    const providerMetadata: ProviderMetadata = {
      requestEnvelope: { endpoint: url, body },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errorBody}`);
    }

    const data = (await res.json()) as GeminiResponse;
    const candidate = data.candidates?.[0];
    const candidateContent = candidate?.content
      ? {
          role: candidate.content.role === 'user' ? 'user' : 'model',
          parts: candidate.content.parts ?? [],
        } satisfies GeminiContent
      : undefined;
    const toolCall = candidateContent?.parts.find((part) => part.functionCall)?.functionCall;
    const text = candidateContent?.parts
      .map((part) => part.text ?? '')
      .join('') ?? '';
    const allContents = candidateContent ? [...contents, candidateContent] : [...contents];

    return {
      content: hasNativeTools
        ? (toolCall ? serializeNativeToolCall(toolCall) : serializeFinalContent(text))
        : text,
      model,
      provider: this.id,
      providerState: { contents: allContents },
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount,
            completionTokens: data.usageMetadata.candidatesTokenCount,
            totalTokens: data.usageMetadata.totalTokenCount,
            cachedTokens: data.usageMetadata.cachedContentTokenCount ?? undefined,
          }
        : undefined,
      finishReason: candidate?.finishReason ?? undefined,
      providerMetadata,
    };
  }

  listModels(): string[] {
    return [...GEMINI_MODELS];
  }

  supportsModel(model: string): boolean {
    return (
      GEMINI_MODELS.includes(model as (typeof GEMINI_MODELS)[number]) ||
      model.startsWith('gemini-')
    );
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private mapMessages(messages: ChatMessage[]): GeminiContent[] {
    return messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'user',
          parts: [{
            functionResponse: {
              name: m.name ?? m.tool_call_id,
              response: {
                result: safeJsonParse(m.content),
              },
            },
          }],
        };
      }

      if (m.role === 'assistant') {
        const parts: GeminiPart[] = [];
        if (m.content) {
          parts.push({ text: m.content });
        }
        if (m.tool_calls?.length) {
          parts.push(...m.tool_calls.map((toolCall) => ({
            functionCall: {
              name: toolCall.function.name,
              args: parseToolArguments(toolCall.function.arguments),
            },
          })));
        }
        return {
          role: 'model',
          parts,
        };
      }

      return {
        role: 'user',
        parts: [{ text: m.content }],
      };
    });
  }

  private mapTrailingToolMessages(messages: ChatMessage[]): GeminiContent[] {
    const trailingToolMessages: Extract<ChatMessage, { role: 'tool' }>[] = [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role !== 'tool') {
        break;
      } else {
        trailingToolMessages.unshift(message);
      }
    }

    return this.mapMessages(trailingToolMessages);
  }

  private getProviderState(providerState: unknown): GeminiProviderState | undefined {
    if (!providerState || typeof providerState !== 'object') {
      return undefined;
    }

    const contents = (providerState as { contents?: unknown }).contents;
    if (!Array.isArray(contents)) {
      return undefined;
    }

    return {
      contents: contents as GeminiContent[],
    };
  }
}
