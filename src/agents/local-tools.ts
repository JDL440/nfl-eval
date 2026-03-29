import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

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

const WEB_SEARCH_TOOL_NAME = 'web_search';

let registryModulePromise: Promise<RegistryModule> | null = null;

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
    tools.push({
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
      examples: [{ query: 'latest Seahawks cap update', max_results: 5 }],
    });
  }

  return tools;
}

export function stableToolCallKey(toolName: string, args: Record<string, unknown>): string {
  return `${toolName}:${stableJson(args)}`;
}

export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  options?: { includeWebSearch?: boolean },
): Promise<ToolExecutionResult> {
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
