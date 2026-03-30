import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult as StructuredToolExecutionResult,
  ToolInputSchema,
  ToolSchemaProperty,
} from '../tools/catalog-types.js';
import { normalizeToolExecutionResult } from '../tools/catalog-types.js';
import { getPipelineToolDefinitions } from '../tools/pipeline-tools.js';

export interface ToolCatalogEntry {
  name: string;
  description: string;
  category: string;
  sideEffects: string;
  readOnlyHint: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  inputSchema: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
  examples?: Array<Record<string, unknown>>;
}

interface LocalRegistryToolEntry extends ToolCatalogEntry {
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface ToolExecutionResult {
  tool: ToolCatalogEntry;
  args: Record<string, unknown>;
  output: string;
  isError: boolean;
  source: 'local' | 'web';
}

interface RegistryModule {
  SAFE_READ_ONLY_TOOL_NAMES: readonly string[];
  getLocalToolEntries(): LocalRegistryToolEntry[];
  renderToolResultText(result: unknown): { text: string; isError: boolean };
}

export interface ToolCallingConfig {
  enabled?: boolean;
  includeLocalExtensions?: boolean;
  includePipelineTools?: boolean;
  includeWebSearch?: boolean;
  allowWriteTools?: boolean;
  requestedTools?: string[];
  maxToolCalls?: number;
  context?: ToolExecutionContext;
}

interface ValidationFailure {
  path: string;
  message: string;
}

const WEB_SEARCH_TOOL_NAME = 'web_search';

let registryModulePromise: Promise<RegistryModule> | null = null;
let localExtensionToolCache: Promise<ToolDefinition[]> | null = null;

const WebSearchArgsSchema = z.object({
  query: z.string().min(1),
  max_results: z.number().int().min(1).max(8).optional(),
});

function registryModulePath(): string {
  return pathToFileURL(join(__dirname, '..', '..', 'mcp', 'tool-registry.mjs')).href;
}

async function loadRegistryModule(): Promise<RegistryModule> {
  if (!registryModulePromise) {
    registryModulePromise = import(registryModulePath()) as Promise<RegistryModule>;
  }
  return registryModulePromise;
}

async function loadLocalExtensionTools(): Promise<ToolDefinition[]> {
  if (!localExtensionToolCache) {
    const modulePath = pathToFileURL(join(__dirname, '..', '..', 'mcp', 'local-tool-registry.mjs')).href;
    localExtensionToolCache = import(modulePath)
      .then((mod) => mod.localTools as ToolDefinition[]);
  }
  return localExtensionToolCache;
}

function buildLiteralUnion(values: unknown[]): z.ZodTypeAny {
  const literalValues = values.filter(
    (value): value is string | number | boolean | null =>
      typeof value === 'string'
      || typeof value === 'number'
      || typeof value === 'boolean'
      || value === null,
  );
  if (literalValues.length === 0) return z.any();
  if (literalValues.length === 1) return z.literal(literalValues[0]);
  const [first, second, ...rest] = literalValues;
  return z.union([
    z.literal(first),
    z.literal(second),
    ...rest.map((value) => z.literal(value)),
  ] as [z.ZodLiteral<any>, z.ZodLiteral<any>, ...Array<z.ZodLiteral<any>>]);
}

function schemaToZod(schema: unknown): z.ZodTypeAny {
  if (!schema || typeof schema !== 'object') {
    return z.any();
  }

  const typed = schema as {
    type?: string | string[];
    enum?: unknown[];
    properties?: Record<string, unknown>;
    items?: unknown;
    required?: string[];
  };

  if (Array.isArray(typed.enum) && typed.enum.length > 0) {
    return buildLiteralUnion(typed.enum);
  }

  if (Array.isArray(typed.type)) {
    const nonNull = typed.type.filter((value): value is string => typeof value === 'string' && value !== 'null');
    if (nonNull.length === 1) {
      return schemaToZod({ ...typed, type: nonNull[0] }).nullable();
    }
    return z.any();
  }

  switch (typed.type) {
    case 'string':
      return z.string();
    case 'integer':
      return z.number().int();
    case 'number':
      return z.number();
    case 'boolean':
      return z.boolean();
    case 'array':
      return z.array(schemaToZod(typed.items));
    case 'object': {
      const properties = typed.properties ?? {};
      const required = new Set(typed.required ?? []);
      const shape: Record<string, z.ZodTypeAny> = {};
      for (const [key, value] of Object.entries(properties)) {
        const child = schemaToZod(value);
        shape[key] = required.has(key) ? child : child.optional();
      }
      return z.object(shape);
    }
    default:
      return z.any();
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
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

function isAllowedBySafety(
  tool: ToolDefinition,
  context: ToolExecutionContext | undefined,
  allowWriteTools: boolean,
): boolean {
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

function isToolDefinition(value: string | ToolDefinition): value is ToolDefinition {
  return typeof value !== 'string';
}

function stripTags(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function summarizeWebResults(html: string, maxResults: number): string {
  const results: Array<{ title: string; url: string; snippet?: string }> = [];
  const blockRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<a[^>]*class="result__a"|$)/gi;

  for (const match of html.matchAll(blockRegex)) {
    const [, url, rawTitle, trailing] = match;
    const title = stripTags(rawTitle);
    const snippetMatch = trailing.match(/result__snippet[^>]*>([\s\S]*?)<\/a>|result__snippet[^>]*>([\s\S]*?)<\/div>/i);
    const snippet = stripTags(snippetMatch?.[1] ?? snippetMatch?.[2] ?? '');
    if (!title || !url) continue;
    results.push({ title, url, snippet });
    if (results.length >= maxResults) break;
  }

  if (results.length === 0) {
    return 'No web results were parsed from the search response.';
  }

  return [
    '# Web Search Results',
    '',
    ...results.map((result, index) => [
      `${index + 1}. ${result.title}`,
      `   URL: ${result.url}`,
      result.snippet ? `   Snippet: ${result.snippet}` : null,
    ].filter(Boolean).join('\n')),
  ].join('\n\n');
}

async function runWebSearch(args: Record<string, unknown>): Promise<ToolExecutionResult> {
  const parsed = WebSearchArgsSchema.parse(args);
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('Web search is unavailable because fetch is not defined.');
  }

  const maxResults = parsed.max_results ?? 5;
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(parsed.query)}`;
  const response = await globalThis.fetch(url, {
    headers: {
      'User-Agent': 'nfl-eval/1.0 (+https://github.com/JDL440/nfl-eval)',
    },
  });

  if (!response.ok) {
    throw new Error(`Web search failed with HTTP ${response.status}`);
  }

  const html = await response.text();
  return {
    tool: {
      name: WEB_SEARCH_TOOL_NAME,
      description: 'Search the public web and return a short list of results with URLs and snippets.',
      category: 'web',
      sideEffects: 'none (read-only public web search)',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          max_results: { type: 'integer' },
        },
        required: ['query'],
      },
      examples: [{ query: 'Seahawks latest reporting', max_results: 5 }],
    },
    args: parsed,
    output: summarizeWebResults(html, maxResults),
    isError: false,
    source: 'web',
  };
}

function buildWebSearchToolDefinition(): ToolDefinition {
  return {
    manifest: {
      name: WEB_SEARCH_TOOL_NAME,
      description: 'Search the public web and return a short list of results with URLs and snippets.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Natural-language search query' },
          max_results: { type: 'integer', description: 'Maximum number of results to return (1-8)' },
        },
        required: ['query'],
      },
    },
    handler: async (args) => {
      const result = await runWebSearch(args);
      return { text: result.output };
    },
    source: 'local-extension',
    aliases: ['web', 'search'],
    safety: {
      readOnly: true,
      writesState: false,
      externalSideEffects: false,
    },
  };
}

export async function getSafeLocalToolCatalog(options?: { includeWebSearch?: boolean }): Promise<ToolCatalogEntry[]> {
  const registry = await loadRegistryModule();
  const safeNames = new Set(registry.SAFE_READ_ONLY_TOOL_NAMES);
  const tools = registry.getLocalToolEntries()
    .filter((entry) => safeNames.has(entry.name) && entry.readOnlyHint)
    .map<ToolCatalogEntry>((entry) => ({
      name: entry.name,
      description: entry.description,
      category: entry.category,
      sideEffects: entry.sideEffects,
      readOnlyHint: entry.readOnlyHint,
      destructiveHint: entry.destructiveHint,
      idempotentHint: entry.idempotentHint,
      openWorldHint: entry.openWorldHint,
      inputSchema: entry.inputSchema,
      examples: entry.examples,
    }));

  if (options?.includeWebSearch) {
    const tool = buildWebSearchToolDefinition();
    tools.push({
      name: tool.manifest.name,
      description: tool.manifest.description,
      category: 'web',
      sideEffects: 'none (read-only public web search)',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
      inputSchema: tool.manifest.parameters,
      examples: [{ query: 'latest Seahawks cap update', max_results: 5 }],
    });
  }

  return tools;
}

export function stableToolCallKey(toolName: string, args: Record<string, unknown>): string {
  return `${toolName}:${stableJson(args)}`;
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
  if (config.includeWebSearch) {
    toolSets.push([buildWebSearchToolDefinition()]);
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

function describeSchemaProperty(schema: ToolSchemaProperty): string {
  const bits: string[] = [schema.type];
  if (schema.enum && schema.enum.length > 0) {
    bits.push(`enum=${schema.enum.join('|')}`);
  }
  if (typeof schema.minimum === 'number') {
    bits.push(`min=${schema.minimum}`);
  }
  if (typeof schema.maximum === 'number') {
    bits.push(`max=${schema.maximum}`);
  }
  if (schema.description) {
    bits.push(schema.description);
  }
  return bits.join(', ');
}

function summarizeToolArgs(parameters: ToolInputSchema): string {
  const required = new Set(parameters.required ?? []);
  const props = Object.entries(parameters.properties).map(([key, schema]) => {
    const suffix = required.has(key) ? 'required' : 'optional';
    return `${key}: ${describeSchemaProperty(schema)} (${suffix})`;
  });
  return props.join('; ');
}

function buildValidationHint(tool: ToolDefinition): string {
  const required = new Set(tool.manifest.parameters.required ?? []);
  const exampleShape = Object.entries(tool.manifest.parameters.properties)
    .filter(([key]) => required.has(key))
    .map(([key, schema]) => {
      let exampleValue = '<value>';
      switch (schema.type) {
        case 'string':
          exampleValue = schema.description?.match(/\b[A-Z]{2,4}\b|\b[A-Z][a-z]{2,}\b/)?.[0]
            ? `"${schema.description.match(/\b[A-Z]{2,4}\b|\b[A-Z][a-z]{2,}\b/)![0]}"`
            : '"value"';
          break;
        case 'integer':
          exampleValue = String(schema.minimum ?? 2025);
          break;
        case 'number':
          exampleValue = String(schema.minimum ?? 0);
          break;
        case 'boolean':
          exampleValue = 'true';
          break;
        case 'array':
          exampleValue = '[]';
          break;
        case 'object':
          exampleValue = '{}';
          break;
      }
      return `"${key}": ${exampleValue}`;
    });
  return `Arguments must be like { ${exampleShape.join(', ')} }`;
}

export function buildToolCatalogPrompt(tools: ToolDefinition[]): string {
  if (tools.length === 0) return '';
  const lines = tools.map((tool) => {
    const required = tool.manifest.parameters.required ?? [];
    return [
      `- ${tool.manifest.name}: ${tool.manifest.description}`,
      `  args: ${summarizeToolArgs(tool.manifest.parameters)}`,
      `  required: [${required.join(', ')}]`,
    ].join('\n');
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
): Promise<StructuredToolExecutionResult>;
export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  options?: { includeWebSearch?: boolean },
): Promise<ToolExecutionResult>;
export async function executeToolCall(
  toolOrName: string | ToolDefinition,
  args: Record<string, unknown>,
  optionsOrContext?: { includeWebSearch?: boolean } | ToolExecutionContext,
): Promise<ToolExecutionResult | StructuredToolExecutionResult> {
  if (isToolDefinition(toolOrName)) {
    const failures = validateArgs(toolOrName.manifest.parameters, args);
    if (failures.length > 0) {
      return {
        text: JSON.stringify({
          error: 'validation',
          tool: toolOrName.manifest.name,
          issues: failures,
          hint: buildValidationHint(toolOrName),
          expectedArgs: summarizeToolArgs(toolOrName.manifest.parameters),
          required: toolOrName.manifest.parameters.required ?? [],
        }, null, 2),
        isError: true,
      };
    }
    try {
      const raw = await toolOrName.handler(args, (optionsOrContext as ToolExecutionContext | undefined) ?? {});
      return normalizeToolExecutionResult(raw);
    } catch (error) {
      return {
        text: JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          tool: toolOrName.manifest.name,
        }, null, 2),
        isError: true,
        raw: error,
      };
    }
  }

  const toolName = toolOrName;
  const options = optionsOrContext as { includeWebSearch?: boolean } | undefined;
  if (toolName === WEB_SEARCH_TOOL_NAME) {
    if (!options?.includeWebSearch) {
      throw new Error(`Tool not allowed: ${toolName}`);
    }
    return runWebSearch(args);
  }

  const registry = await loadRegistryModule();
  const safeNames = new Set(registry.SAFE_READ_ONLY_TOOL_NAMES);
  if (!safeNames.has(toolName)) {
    throw new Error(`Tool not allowed: ${toolName}`);
  }

  const entry = registry.getLocalToolEntries().find((candidate) => candidate.name === toolName);
  if (!entry || !entry.readOnlyHint) {
    throw new Error(`Tool not allowed: ${toolName}`);
  }

  const parsedArgs = schemaToZod(entry.inputSchema).parse(args ?? {}) as Record<string, unknown>;
  const rawResult = await entry.handler(parsedArgs);
  const normalized = registry.renderToolResultText(rawResult);

  return {
    tool: {
      name: entry.name,
      description: entry.description,
      category: entry.category,
      sideEffects: entry.sideEffects,
      readOnlyHint: entry.readOnlyHint,
      destructiveHint: entry.destructiveHint,
      idempotentHint: entry.idempotentHint,
      openWorldHint: entry.openWorldHint,
      inputSchema: entry.inputSchema,
      examples: entry.examples,
    },
    args: parsedArgs,
    output: normalized.text,
    isError: normalized.isError,
    source: 'local',
  };
}
