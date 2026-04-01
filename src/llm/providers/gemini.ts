/**
 * Google Gemini LLM provider — routes requests to the Gemini REST API.
 *
 * Tool calling uses the text-based protocol (the system prompt instructs the
 * model to output {"type":"tool_call",...} JSON) rather than native
 * functionDeclarations.  This avoids Gemini 3.x's strict thought_signature
 * requirements which are incompatible with the runner's text-based tool loop.
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

    // Do NOT pass tools as native functionDeclarations — Gemini 3.x requires
    // thought_signature round-tripping which is incompatible with the runner's
    // text-based tool loop. The system prompt already instructs the model to
    // output {"type":"tool_call","toolName":"...","args":{}} JSON.

    // Do NOT set responseMimeType for Gemini — the system prompt instructs
    // JSON format when needed. Gemini's strict JSON mode can cause it to
    // wrap responses in arrays or use its own schema, breaking the expected
    // {"type":"final"/"tool_call",...} envelope.

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
    const text =
      candidate?.content?.parts?.map((p) => p.text).join('') ?? '';

    return {
      content: text,
      model,
      provider: this.id,
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

  /** Map ChatMessage[] → Gemini contents format (text-only, no native tools). */
  private mapMessages(messages: ChatMessage[]): GeminiContent[] {
    return messages.map((m) => {
      let text: string;
      if (m.role === 'tool') {
        text = `Tool result for ${m.name ?? m.tool_call_id}:\n${m.content}`;
      } else if (m.role === 'assistant') {
        // The structured tool path sends assistant messages with empty content
        // and tool_calls. Reconstruct readable text so Gemini sees a non-empty
        // model turn.
        if ((!m.content || m.content.trim().length === 0) && 'tool_calls' in m && m.tool_calls?.length) {
          const tc = m.tool_calls[0];
          text = JSON.stringify({
            type: 'tool_call',
            toolName: tc.function.name,
            args: JSON.parse(tc.function.arguments || '{}'),
          });
        } else {
          text = m.content;
        }
      } else {
        text = m.content;
      }
      return {
        role: (m.role === 'assistant' ? 'model' : 'user') as 'model' | 'user',
        parts: [{ text }],
      };
    });
  }
}
