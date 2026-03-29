import type { Repository } from '../db/repository.js';
import type { PipelineEngine } from '../pipeline/engine.js';
import type { AppConfig } from '../config/index.js';
import type { ActionContext } from '../pipeline/actions.js';

export type ToolSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';

export interface ToolSchemaProperty {
  type: ToolSchemaType;
  description?: string;
  enum?: string[];
  items?: ToolSchemaProperty;
  properties?: Record<string, ToolSchemaProperty>;
  required?: string[];
  minimum?: number;
  maximum?: number;
}

export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, ToolSchemaProperty>;
  required?: string[];
}

export interface ToolManifest {
  name: string;
  description: string;
  parameters: ToolInputSchema;
}

export interface ToolSafetyPolicy {
  readOnly: boolean;
  writesState: boolean;
  externalSideEffects: boolean;
  defaultTarget?: string | null;
  allowedSurfaces?: string[];
  allowedAgents?: string[];
}

export interface ToolExecutionContext {
  repo?: Repository;
  engine?: PipelineEngine;
  config?: AppConfig;
  actionContext?: ActionContext;
  articleId?: string | null;
  stage?: number | null;
  surface?: string | null;
  agentName?: string | null;
}

export interface ToolExecutionResult {
  text: string;
  isError?: boolean;
  raw?: unknown;
}

export interface ToolDefinition {
  manifest: ToolManifest;
  handler: (args: Record<string, unknown>, context: ToolExecutionContext) => Promise<unknown>;
  source: 'pipeline' | 'local-extension';
  aliases?: string[];
  safety: ToolSafetyPolicy;
}

export function normalizeToolExecutionResult(result: unknown): ToolExecutionResult {
  if (typeof result === 'string') {
    return { text: result, raw: result };
  }

  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>;
    if (typeof record['text'] === 'string') {
      return {
        text: record['text'],
        isError: record['isError'] === true,
        raw: result,
      };
    }
    if (typeof record['textResultForLlm'] === 'string') {
      return {
        text: record['textResultForLlm'],
        isError: record['resultType'] === 'failure',
        raw: result,
      };
    }
    if (Array.isArray(record['content'])) {
      const content = record['content'] as Array<Record<string, unknown>>;
      const text = content
        .map((item) => (typeof item['text'] === 'string' ? item['text'] : ''))
        .filter(Boolean)
        .join('\n\n');
      return {
        text,
        isError: record['isError'] === true,
        raw: result,
      };
    }
  }

  return {
    text: JSON.stringify(result, null, 2),
    raw: result,
  };
}
