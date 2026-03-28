import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolInputSchema,
  ToolSchemaProperty,
} from '../tools/catalog-types.js';
import { getPipelineToolDefinitions } from '../tools/pipeline-tools.js';
import { normalizeToolExecutionResult } from '../tools/catalog-types.js';

export interface ToolCallingConfig {
  enabled?: boolean;
  includeLocalExtensions?: boolean;
  includePipelineTools?: boolean;
  allowWriteTools?: boolean;
  requestedTools?: string[];
  maxToolCalls?: number;
  context?: ToolExecutionContext;
}

interface ValidationFailure {
  path: string;
  message: string;
}

let localExtensionToolCache: Promise<ToolDefinition[]> | null = null;

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

async function loadLocalExtensionTools(): Promise<ToolDefinition[]> {
  if (!localExtensionToolCache) {
    const modulePath = '../../mcp/local-tool-registry.mjs';
    localExtensionToolCache = import(modulePath).then((mod) => mod.localTools as ToolDefinition[]);
  }
  return localExtensionToolCache;
}

function validateScalarType(value: unknown, schema: ToolSchemaProperty): boolean {
  switch (schema.type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    default:
      return false;
  }
}

function validateProperty(path: string, value: unknown, schema: ToolSchemaProperty): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  if (value == null) {
    return failures;
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      failures.push({ path, message: 'must be an array' });
      return failures;
    }
    if (schema.items) {
      value.forEach((item, index) => {
        failures.push(...validateProperty(`${path}[${index}]`, item, schema.items!));
      });
    }
    return failures;
  }
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      failures.push({ path, message: 'must be an object' });
      return failures;
    }
    const record = value as Record<string, unknown>;
    const required = new Set(schema.required ?? []);
    for (const key of required) {
      if (!(key in record)) {
        failures.push({ path: `${path}.${key}`, message: 'is required' });
      }
    }
    for (const [key, nested] of Object.entries(schema.properties ?? {})) {
      if (key in record) {
        failures.push(...validateProperty(`${path}.${key}`, record[key], nested));
      }
    }
    return failures;
  }
  if (!validateScalarType(value, schema)) {
    failures.push({ path, message: `must be of type ${schema.type}` });
    return failures;
  }
  if (schema.enum && !schema.enum.includes(String(value))) {
    failures.push({ path, message: `must be one of ${schema.enum.join(', ')}` });
  }
  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      failures.push({ path, message: `must be >= ${schema.minimum}` });
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      failures.push({ path, message: `must be <= ${schema.maximum}` });
    }
  }
  return failures;
}

function validateArgs(schema: ToolInputSchema, args: Record<string, unknown>): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  const required = new Set(schema.required ?? []);
  for (const key of required) {
    if (!(key in args)) {
      failures.push({ path: key, message: 'is required' });
    }
  }
  for (const key of Object.keys(args)) {
    const propertySchema = schema.properties[key];
    if (!propertySchema) {
      failures.push({ path: key, message: 'is not allowed' });
      continue;
    }
    failures.push(...validateProperty(key, args[key], propertySchema));
  }
  return failures;
}

function requestedToolSet(requestedTools?: string[]): Set<string> {
  return new Set((requestedTools ?? []).map((item) => normalizeName(item)).filter(Boolean));
}

function matchesRequestedTools(tool: ToolDefinition, requested: Set<string>): boolean {
  if (requested.size === 0) return false;
  const names = [tool.manifest.name, ...(tool.aliases ?? [])].map((item) => normalizeName(item));
  return names.some((name) => requested.has(name));
}

function isAllowedBySafety(tool: ToolDefinition, context: ToolExecutionContext | undefined, allowWriteTools: boolean): boolean {
  if (!allowWriteTools && !tool.safety.readOnly) {
    return false;
  }
  const surface = normalizeName(context?.surface ?? '');
  if (surface && tool.safety.allowedSurfaces && tool.safety.allowedSurfaces.length > 0) {
    const allowed = new Set(tool.safety.allowedSurfaces.map((item) => normalizeName(item)));
    if (!allowed.has(surface)) return false;
  }
  const agent = normalizeName(context?.agentName ?? '');
  if (agent && tool.safety.allowedAgents && tool.safety.allowedAgents.length > 0) {
    const allowed = new Set(tool.safety.allowedAgents.map((item) => normalizeName(item)));
    if (!allowed.has(agent)) return false;
  }
  return true;
}

export async function listAvailableTools(config: ToolCallingConfig): Promise<ToolDefinition[]> {
  if (!config.enabled) return [];
  const requested = requestedToolSet(config.requestedTools);
  if (requested.size === 0) return [];

  const toolSets: ToolDefinition[][] = [];
  if (config.includeLocalExtensions) {
    toolSets.push(await loadLocalExtensionTools());
  }
  if (config.includePipelineTools) {
    toolSets.push(getPipelineToolDefinitions());
  }

  const allowWriteTools = config.allowWriteTools === true;
  const deduped = new Map<string, ToolDefinition>();
  for (const tool of toolSets.flat()) {
    if (!matchesRequestedTools(tool, requested)) continue;
    if (!isAllowedBySafety(tool, config.context, allowWriteTools)) continue;
    deduped.set(tool.manifest.name, tool);
  }
  return Array.from(deduped.values()).sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));
}

export function buildToolCatalogPrompt(tools: ToolDefinition[]): string {
  if (tools.length === 0) return '';
  const lines = tools.map((tool) => {
    const required = tool.manifest.parameters.required ?? [];
    const props = Object.entries(tool.manifest.parameters.properties).map(([key, schema]) => {
      const bits: string[] = [schema.type];
      if (schema.enum && schema.enum.length > 0) {
        bits.push(`enum=${schema.enum.join('|')}`);
      }
      return `${key}:${bits.join(',')}`;
    });
    return `- ${tool.manifest.name}: ${tool.manifest.description} | args={${props.join('; ')}} | required=[${required.join(', ')}]`;
  });
  return [
    'Available tools:',
    ...lines,
    'When a tool is needed, respond with JSON only using:',
    '{"type":"tool_call","toolName":"<tool>","args":{...}}',
    'When you are done, respond with JSON only using:',
    '{"type":"final","content":"<final answer>"}',
    'Call at most one tool per turn.',
  ].join('\n');
}

export async function executeToolCall(
  tool: ToolDefinition,
  args: Record<string, unknown>,
  context?: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const failures = validateArgs(tool.manifest.parameters, args);
  if (failures.length > 0) {
    return {
      text: JSON.stringify({
        error: 'Tool arguments failed validation',
        tool: tool.manifest.name,
        issues: failures,
      }, null, 2),
      isError: true,
    };
  }
  try {
    const raw = await tool.handler(args, context ?? {});
    return normalizeToolExecutionResult(raw);
  } catch (error) {
    return {
      text: JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        tool: tool.manifest.name,
      }, null, 2),
      isError: true,
      raw: error,
    };
  }
}
