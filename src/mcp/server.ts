/**
 * MCP Server — v2 pipeline tools over Model Context Protocol.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type {
  CallToolRequest,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import type { Repository } from '../db/repository.js';
import type { PipelineEngine } from '../pipeline/engine.js';
import type { AppConfig } from '../config/index.js';
import type { ActionContext } from '../pipeline/actions.js';
import { getPipelineToolDefinitions } from '../tools/pipeline-tools.js';
import { normalizeToolExecutionResult } from '../tools/catalog-types.js';

function toMcpTool(tool: ReturnType<typeof getPipelineToolDefinitions>[number]): Tool {
  return {
    name: tool.manifest.name,
    description: tool.manifest.description,
    inputSchema: tool.manifest.parameters as Tool['inputSchema'],
  };
}

function toMcpResult(result: unknown) {
  const normalized = normalizeToolExecutionResult(result);
  const response = {
    content: [{ type: 'text' as const, text: normalized.text }],
  };
  if (normalized.isError === true) {
    return { ...response, isError: true };
  }
  return response;
}

export function createMCPServer(options: {
  repo: Repository;
  engine: PipelineEngine;
  config: AppConfig;
  actionContext?: ActionContext;
}): Server {
  const { repo, engine, config, actionContext } = options;
  const tools = getPipelineToolDefinitions();
  const toolMap = new Map(tools.map((tool) => [tool.manifest.name, tool]));

  const server = new Server(
    { name: 'nfl-eval-pipeline', version: '2.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((tool) => toMcpTool(tool)),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const { name, arguments: args = {} } = request.params;
    const tool = toolMap.get(name);
    if (!tool) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
        isError: true,
      };
    }

    try {
      const result = await tool.handler(args as Record<string, unknown>, {
        repo,
        engine,
        config,
        actionContext,
      });
      return toMcpResult(result);
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
        }],
        isError: true,
      };
    }
  });

  return server;
}

export async function startMCPServer(options: {
  repo: Repository;
  engine: PipelineEngine;
  config: AppConfig;
  actionContext?: ActionContext;
}): Promise<void> {
  const server = createMCPServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
