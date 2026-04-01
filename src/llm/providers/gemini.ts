/**
 * Google Gemini LLM provider — routes requests to the Gemini REST API.
 *
 * Supports native function calling (functionDeclarations / functionCall) so
 * the pipeline tool-loop works correctly with Gemini models.
 *
 * Uses native fetch (Node 18+). Requires GEMINI_API_KEY env var.
 */

import type {
  LLMProvider,
  ChatRequest,
  ChatResponse,
  ChatMessage,
  ChatToolDefinition,
  ProviderMetadata,
} from '../gateway.js';

const GEMINI_MODELS = [
  'gemini-3.1-pro-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
] as const;

const DEFAULT_MODEL = 'gemini-3.1-pro-preview';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// ---------------------------------------------------------------------------
// Gemini API types
// ---------------------------------------------------------------------------

interface GeminiFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

interface GeminiFunctionResponse {
  name: string;
  response: Record<string, unknown>;
}

interface GeminiPart {
  text?: string;
  functionCall?: GeminiFunctionCall;
  functionResponse?: GeminiFunctionResponse;
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
  };
}

interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
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

    // Separate system instruction from conversation messages
    const systemMsg = request.messages.find((m) => m.role === 'system');
    const contents = this.mapMessages(
      request.messages.filter((m) => m.role !== 'system'),
    );

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

    // Pass tools as native Gemini functionDeclarations
    if (request.tools && request.tools.length > 0) {
      body['tools'] = [{
        functionDeclarations: request.tools.map((t) =>
          this.toFunctionDeclaration(t),
        ),
      }];
    }

    if (request.responseFormat === 'json' && (!request.tools || request.tools.length === 0)) {
      (body['generationConfig'] as Record<string, unknown>)['responseMimeType'] =
        'application/json';
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
    const parts = candidate?.content?.parts ?? [];

    // Check for native function call in the response
    const fnCallPart = parts.find((p) => p.functionCall);
    let content: string;
    if (fnCallPart?.functionCall) {
      content = this.serializeFunctionCall(
        fnCallPart.functionCall,
        fnCallPart.thoughtSignature,
      );
    } else {
      content = parts
        .filter((p) => p.text !== undefined)
        .map((p) => p.text)
        .join('');
    }

    return {
      content,
      model,
      provider: this.id,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount,
            completionTokens: data.usageMetadata.candidatesTokenCount,
            totalTokens: data.usageMetadata.totalTokenCount,
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

  /** Convert internal ChatToolDefinition → Gemini functionDeclaration. */
  private toFunctionDeclaration(tool: ChatToolDefinition): GeminiFunctionDeclaration {
    const decl: GeminiFunctionDeclaration = {
      name: tool.function.name,
      description: tool.function.description,
    };
    if (tool.function.parameters && Object.keys(tool.function.parameters).length > 0) {
      decl.parameters = tool.function.parameters;
    }
    return decl;
  }

  /**
   * Serialize a Gemini native functionCall into the text-based tool_call
   * envelope that the agent runner expects.
   * Embeds thoughtSignature so it survives the text round-trip and can be
   * reconstructed in mapMessages on the next turn.
   */
  private serializeFunctionCall(
    fc: GeminiFunctionCall,
    thoughtSignature?: string,
  ): string {
    const envelope: Record<string, unknown> = {
      type: 'tool_call',
      toolName: fc.name,
      args: fc.args ?? {},
    };
    if (thoughtSignature) {
      envelope['thoughtSignature'] = thoughtSignature;
    }
    return JSON.stringify(envelope);
  }

  /**
   * Map ChatMessage[] → Gemini contents format.
   *
   * The text-based tool loop sends tool calls as assistant text messages
   * (serialized JSON) and tool results as user text messages. We detect
   * these patterns and reconstruct native functionCall / functionResponse
   * parts so Gemini's thought_signature chain stays intact.
   */
  private mapMessages(messages: ChatMessage[]): GeminiContent[] {
    const contents: GeminiContent[] = [];

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];

      if (m.role === 'tool') {
        // OpenAI-style tool result → Gemini functionResponse
        let resultObj: Record<string, unknown>;
        try {
          resultObj = JSON.parse(m.content);
          if (typeof resultObj !== 'object' || resultObj === null || Array.isArray(resultObj)) {
            resultObj = { result: m.content };
          }
        } catch {
          resultObj = { result: m.content };
        }
        contents.push({
          role: 'user',
          parts: [{
            functionResponse: {
              name: m.name ?? m.tool_call_id ?? 'unknown',
              response: resultObj,
            },
          }],
        });
      } else if (m.role === 'assistant') {
        // Check for OpenAI-style tool_calls first
        const toolCalls = 'tool_calls' in m ? m.tool_calls : undefined;
        if (toolCalls && toolCalls.length > 0) {
          const tc = toolCalls[0];
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.function.arguments); } catch { /* keep empty */ }
          const part: GeminiPart = {
            functionCall: { name: tc.function.name, args },
          };
          contents.push({ role: 'model', parts: [part] });
        } else {
          // Check if the text content is a serialized tool_call with thoughtSignature
          const parsed = this.tryParseToolCallEnvelope(m.content);
          if (parsed) {
            const part: GeminiPart = {
              functionCall: { name: parsed.toolName, args: parsed.args },
            };
            if (parsed.thoughtSignature) {
              part.thoughtSignature = parsed.thoughtSignature;
            }
            contents.push({ role: 'model', parts: [part] });

            // Check if the next message is a text-based tool result from the runner
            // Pattern: "Tool result for <name>:\n<result>\n..."
            const next = messages[i + 1];
            if (next && next.role === 'user') {
              const toolResult = this.tryParseTextToolResult(next.content);
              if (toolResult) {
                contents.push({
                  role: 'user',
                  parts: [{
                    functionResponse: {
                      name: parsed.toolName,
                      response: { result: toolResult },
                    },
                  }],
                });
                i++; // skip the next message since we consumed it
                continue;
              }
            }
          } else {
            contents.push({
              role: 'model',
              parts: [{ text: m.content }],
            });
          }
        }
      } else {
        // user messages
        contents.push({
          role: 'user',
          parts: [{ text: m.content }],
        });
      }
    }

    return contents;
  }

  /**
   * Try to parse an assistant message as a serialized tool_call envelope
   * that we produced in serializeFunctionCall.
   */
  private tryParseToolCallEnvelope(
    text: string,
  ): { toolName: string; args: Record<string, unknown>; thoughtSignature?: string } | null {
    try {
      const obj = JSON.parse(text);
      if (
        obj &&
        typeof obj === 'object' &&
        (obj.type === 'tool_call' || obj.type === 'function_call' || obj.type === 'tool_use') &&
        typeof obj.toolName === 'string'
      ) {
        return {
          toolName: obj.toolName,
          args: obj.args && typeof obj.args === 'object' ? obj.args : {},
          thoughtSignature: typeof obj.thoughtSignature === 'string'
            ? obj.thoughtSignature
            : undefined,
        };
      }
    } catch { /* not JSON */ }
    return null;
  }

  /**
   * Detect the runner's text-based tool result format:
   *   "Tool result for <name>:\n<result>\n\nIf you need another tool..."
   * Returns the result text, or null if not a tool result.
   */
  private tryParseTextToolResult(text: string): string | null {
    const match = text.match(/^Tool result for [^\n:]+:\n([\s\S]*?)(?:\n\nIf you need another tool|$)/);
    return match ? match[1].trim() : null;
  }
}
