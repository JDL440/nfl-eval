/**
 * Google Gemini LLM provider — routes requests to the Gemini REST API.
 *
 * Uses native fetch (Node 18+). Requires GEMINI_API_KEY env var.
 */

import type { LLMProvider, ChatRequest, ChatResponse, ChatMessage } from '../gateway.js';

const GEMINI_MODELS = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
] as const;

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// ---------------------------------------------------------------------------
// Gemini API types
// ---------------------------------------------------------------------------

interface GeminiPart {
  text: string;
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
    const model = request.model ?? 'gemini-2.5-flash';

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

    if (request.responseFormat === 'json') {
      (body['generationConfig'] as Record<string, unknown>)['responseMimeType'] =
        'application/json';
    }

    const url = `${API_BASE}/models/${model}:generateContent?key=${apiKey}`;

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
          }
        : undefined,
      finishReason: candidate?.finishReason ?? undefined,
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

  /** Map ChatMessage[] → Gemini contents format. */
  private mapMessages(messages: ChatMessage[]): GeminiContent[] {
    return messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{
        text: m.role === 'tool'
          ? `Tool result for ${m.name ?? m.tool_call_id}:\n${m.content}`
          : m.content,
      }],
    }));
  }
}
