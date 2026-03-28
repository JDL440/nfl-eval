/**
 * Copilot CLI LLM provider — routes requests through the standalone
 * GitHub Copilot CLI agent (`copilot -p "..." -s --no-ask-user`).
 *
 * Safe by default:
 * - tool access is fully disabled unless explicitly enabled
 * - repo MCP access is limited to the checked-in allowlist config
 * - session reuse is opt-in and falls back to one-shot execution on failure
 */

import { execFile, spawn, type ExecFileException } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type {
  ChatRequest,
  ChatResponse,
  LLMProvider,
  ProviderMetadata,
} from '../gateway.js';

const CLI_MODELS = [
  'claude-sonnet-4.6',
  'claude-sonnet-4.5',
  'claude-sonnet-4',
  'claude-haiku-4.5',
  'claude-opus-4.6',
  'claude-opus-4.5',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.3-codex',
  'gpt-5.2-codex',
  'gpt-5.2',
  'gpt-5.1-codex-max',
  'gpt-5.1-codex',
  'gpt-5.1-codex-mini',
  'gpt-5.1',
  'gpt-5-mini',
  'gpt-4.1',
  'gemini-3-pro-preview',
] as const;

const CLI_MODEL_ALIASES: Record<string, string> = {
  'gpt-5': 'gpt-5.4',
  'gpt-5-chat': 'gpt-5.4',
  'gpt-5-nano': 'gpt-5.4-mini',
  'gpt-4o': 'gpt-4.1',
  'gpt-4o-mini': 'gpt-4.1',
  'gpt-4.1-mini': 'gpt-4.1',
  'gpt-4.1-nano': 'gpt-4.1',
  'o4-mini': 'gpt-5.4-mini',
  'o3': 'gpt-5.4',
  'o3-mini': 'gpt-5.4-mini',
  'o1': 'gpt-5.4',
  'o1-mini': 'gpt-5.4-mini',
};

const DEFAULT_TIMEOUT = 600_000;
const DEFAULT_MODEL = 'claude-sonnet-4';
const EXEC_FILE_CHAR_LIMIT = 30_000;
const STDOUT_LIMIT_BYTES = 10 * 1024 * 1024;
const ARTICLE_STAGE_REUSE = new Set([4, 5, 6, 7]);
const APPROVED_MCP_SERVERS = ['nfl-eval-pipeline', 'nfl-eval-local'] as const;

type ToolAccessMode = 'none' | 'article-tools';

interface SessionRecord {
  sessionId: string;
  lastUsedAt: number;
}

interface RuntimeFlags {
  webSearchEnabled: boolean;
  repoMcpEnabled: boolean;
  mcpServerNames: string[];
  allowedTools: string[];
}

interface ExecutionPlan {
  args: string[];
  cwd: string;
  mode: 'one-shot' | 'resumed';
  sessionId: string | null;
  requestEnvelope: Record<string, unknown>;
}

export interface CopilotCLIProviderOptions {
  copilotPath?: string;
  defaultModel?: string;
  timeoutMs?: number;
  extraFlags?: string[];
  repoRoot?: string;
  workingDirectory?: string;
  toolAccessMode?: ToolAccessMode;
  enableTools?: boolean;
  enableWebFetch?: boolean;
  enableRepoMcp?: boolean;
  mcpConfigPath?: string;
  enableSessionReuse?: boolean;
}

export class CopilotCLIProvider implements LLMProvider {
  readonly id = 'copilot-cli';
  readonly name = 'GitHub Copilot CLI';

  private readonly copilotPath: string;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;
  private readonly extraFlags: string[];
  private readonly repoRoot?: string;
  private readonly workingDirectory?: string;
  private readonly toolAccessMode: ToolAccessMode;
  private readonly enableWebFetch: boolean;
  private readonly enableRepoMcp: boolean;
  private readonly enableSessionReuse: boolean;
  private readonly mcpConfigPath?: string;
  private readonly sandboxDir: string;
  private readonly sessions = new Map<string, SessionRecord>();

  constructor(options?: CopilotCLIProviderOptions) {
    this.copilotPath = options?.copilotPath ?? 'copilot';
    this.defaultModel = options?.defaultModel ?? DEFAULT_MODEL;
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT;
    this.extraFlags = options?.extraFlags ?? [];
    this.repoRoot = options?.repoRoot;
    this.workingDirectory = options?.workingDirectory ?? options?.repoRoot;
    this.toolAccessMode =
      options?.toolAccessMode
      ?? (options?.enableTools ? 'article-tools' : 'none');
    this.enableWebFetch = options?.enableWebFetch ?? false;
    this.enableRepoMcp = options?.enableRepoMcp ?? false;
    this.enableSessionReuse = options?.enableSessionReuse ?? false;
    this.mcpConfigPath =
      options?.mcpConfigPath
      ?? (this.repoRoot ? join(this.repoRoot, '.copilot', 'mcp-config.json') : undefined);

    this.sandboxDir = join(this.repoRoot ?? process.cwd(), '.copilot', 'cli-sandbox');
    if (!existsSync(this.sandboxDir)) {
      mkdirSync(this.sandboxDir, { recursive: true });
    }
  }

  get configuredDefaultModel(): string {
    return this.defaultModel;
  }

  async verify(): Promise<string> {
    const version = await this.execFileArgs(['--version'], this.sandboxDir);
    return version.trim();
  }

  listModels(): string[] {
    return [...CLI_MODELS, ...Object.keys(CLI_MODEL_ALIASES)];
  }

  supportsModel(model: string): boolean {
    return (
      CLI_MODELS.includes(model as (typeof CLI_MODELS)[number])
      || model in CLI_MODEL_ALIASES
      || model.startsWith('claude-')
      || model.startsWith('gpt-')
      || model.startsWith('gemini-')
    );
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const model = this.resolveModel(request.model ?? this.defaultModel);
    const flags = this.resolveRuntimeFlags();
    const prompt = this.buildPrompt(request, flags);
    const initialPlan = this.buildExecutionPlan(request, model, flags, false);

    try {
      return await this.executePlan(initialPlan, prompt, model);
    } catch (error) {
      if (!this.shouldFallbackToOneShot(initialPlan, error)) {
        throw this.attachProviderMetadata(error, this.buildErrorMetadata(initialPlan, prompt));
      }

      const fallbackPlan = this.buildExecutionPlan(request, model, flags, true);
      try {
        return await this.executePlan(
          fallbackPlan,
          prompt,
          model,
          {
            fallbackFromResumedSession: true,
            resumedSessionId: initialPlan.sessionId,
            resumedSessionError:
              error instanceof Error
                ? error.message
                : String(error),
          },
        );
      } catch (fallbackError) {
        throw this.attachProviderMetadata(
          fallbackError,
          this.buildErrorMetadata(
            fallbackPlan,
            prompt,
            {
              fallbackFromResumedSession: true,
              resumedSessionId: initialPlan.sessionId,
            },
          ),
        );
      }
    }
  }

  private resolveModel(model: string): string {
    return CLI_MODEL_ALIASES[model] ?? model;
  }

  private resolveRuntimeFlags(): RuntimeFlags {
    const webSearchEnabled = this.toolAccessMode === 'article-tools' && this.enableWebFetch;
    const mcpConfigPath = this.mcpConfigPath;
    const repoMcpConfigured =
      this.toolAccessMode === 'article-tools'
      && this.enableRepoMcp
      && typeof mcpConfigPath === 'string'
      && existsSync(mcpConfigPath);

    const mcpServerNames = repoMcpConfigured ? [...APPROVED_MCP_SERVERS] : [];
    const allowedTools = [
      ...(webSearchEnabled ? ['url'] : []),
      ...mcpServerNames,
    ];

    return {
      webSearchEnabled,
      repoMcpEnabled: repoMcpConfigured,
      mcpServerNames,
      allowedTools,
    };
  }

  private buildPrompt(request: ChatRequest, flags: RuntimeFlags): string {
    const parts: string[] = [];

    if (this.toolAccessMode === 'article-tools') {
      const allowances: string[] = [];
      if (flags.webSearchEnabled) allowances.push('web fetch via the url tool');
      if (flags.repoMcpEnabled) allowances.push(`approved MCP servers only (${flags.mcpServerNames.join(', ')})`);
      const allowanceText = allowances.length > 0 ? allowances.join('; ') : 'no tools';
      parts.push(
        '<tool_policy>Use tools only when necessary. Stay within the explicitly allowed tool list. '
        + `Allowed capabilities: ${allowanceText}. Prefer answering directly when tools are unnecessary.</tool_policy>`,
      );
    } else {
      parts.push(
        '<constraint>Output the requested content directly as text. '
        + 'Do NOT read files, create files, run commands, or use any tools.</constraint>',
      );
    }

    const systemMessages = request.messages.filter((message) => message.role === 'system');
    if (systemMessages.length > 0) {
      parts.push(
        `<instructions>\n${systemMessages.map((message) => message.content).join('\n\n')}\n</instructions>`,
      );
    }

    if (request.responseFormat === 'json') {
      parts.push(
        '<output_format>Respond with valid JSON only. No markdown fences and no explanation outside the JSON.</output_format>',
      );
    }

    for (const message of request.messages) {
      if (message.role === 'system') continue;
      if (message.role === 'user') {
        parts.push(message.content);
      } else {
        parts.push(`[Previous assistant response]\n${message.content}`);
      }
    }

    return parts.join('\n\n');
  }

  private buildExecutionPlan(
    request: ChatRequest,
    model: string,
    flags: RuntimeFlags,
    forceOneShot: boolean,
  ): ExecutionPlan {
    const cwd = this.resolveExecutionCwd();
    const sessionReuseRequested = this.enableSessionReuse && this.toolAccessMode === 'article-tools';
    const sessionReuseBaseEligible =
      sessionReuseRequested
      && Boolean(request.providerContext?.articleId)
      && ARTICLE_STAGE_REUSE.has(request.providerContext?.stage ?? -1);
    const shouldResumeSession = sessionReuseBaseEligible && !forceOneShot;
    const sessionReuseEligible = sessionReuseBaseEligible && !forceOneShot;
    const sessionId =
      shouldResumeSession && request.providerContext?.articleId
        ? this.getOrCreateSessionId(request.providerContext.articleId, cwd)
        : null;

    const args = [
      '-p',
      '',
      '-s',
      '--no-ask-user',
      '--no-custom-instructions',
      '--no-auto-update',
      '--disallow-temp-dir',
      '--model',
      model,
      ...(sessionId ? [`--resume=${sessionId}`] : []),
      ...(flags.webSearchEnabled ? ['--allow-tool=url', '--allow-all-urls'] : []),
      ...(this.toolAccessMode === 'article-tools' && this.enableRepoMcp ? ['--disable-builtin-mcps'] : []),
      ...(flags.repoMcpEnabled && this.mcpConfigPath ? [`--additional-mcp-config=@${this.mcpConfigPath}`] : []),
      ...flags.mcpServerNames.map((name) => `--allow-tool=${name}`),
      ...this.extraFlags,
    ];

    return {
      args,
      cwd,
      mode: sessionId ? 'resumed' : 'one-shot',
      sessionId,
      requestEnvelope: {
        provider: this.id,
        model,
        toolAccessMode: this.toolAccessMode,
        toolAccessConfigured: this.toolAccessMode === 'article-tools',
        toolsEnabled: flags.allowedTools.length > 0,
        allowedTools: flags.allowedTools,
        webSearchEnabled: flags.webSearchEnabled,
        repoMcpEnabled: flags.repoMcpEnabled,
        mcpServerNames: flags.mcpServerNames,
        mcpConfigPath: flags.repoMcpEnabled ? this.mcpConfigPath ?? null : null,
        sessionReuseRequested,
        sessionReuseEligible,
        sessionReuseFallback: forceOneShot,
        stage: request.providerContext?.stage ?? null,
        surface: request.providerContext?.surface ?? null,
        articleId: request.providerContext?.articleId ?? null,
        traceId: request.providerContext?.traceId ?? null,
      },
    };
  }

  private async executePlan(
    plan: ExecutionPlan,
    prompt: string,
    model: string,
    responseExtras?: Record<string, unknown>,
  ): Promise<ChatResponse> {
    const args = [...plan.args];
    args[1] = prompt;

    const output =
      prompt.length > EXEC_FILE_CHAR_LIMIT
        ? await this.execViaStdin(args.slice(2), prompt, plan.cwd)
        : await this.execFileArgs(args, plan.cwd);

    const content = output.trim();
    if (!content) {
      throw this.attachProviderMetadata(
        new Error('Copilot CLI returned empty response'),
        this.buildMetadata(plan, prompt, {
          stdout: output,
          fallbackFromResumedSession: responseExtras?.['fallbackFromResumedSession'] ?? false,
          ...responseExtras,
        }),
      );
    }

    return {
      content,
      model,
      provider: this.id,
      usage: {
        promptTokens: Math.ceil(prompt.length / 4),
        completionTokens: Math.ceil(content.length / 4),
        totalTokens: Math.ceil(prompt.length / 4) + Math.ceil(content.length / 4),
      },
      finishReason: 'stop',
      providerMetadata: this.buildMetadata(plan, prompt, {
        stdout: content,
        fallbackFromResumedSession: responseExtras?.['fallbackFromResumedSession'] ?? false,
        ...responseExtras,
      }),
    };
  }

  private buildMetadata(
    plan: ExecutionPlan,
    prompt: string,
    responseEnvelope?: Record<string, unknown>,
  ): ProviderMetadata {
    return {
      providerMode: plan.mode,
      providerSessionId: plan.sessionId,
      workingDirectory: this.workingDirectory ?? plan.cwd,
      incrementalPrompt: prompt,
      requestEnvelope: {
        ...plan.requestEnvelope,
        args: this.sanitizeArgs(plan.args),
      },
      responseEnvelope: responseEnvelope ?? null,
    };
  }

  private buildErrorMetadata(
    plan: ExecutionPlan,
    prompt: string,
    responseEnvelope?: Record<string, unknown>,
  ): ProviderMetadata {
    return this.buildMetadata(plan, prompt, {
      stdout: null,
      ...responseEnvelope,
    });
  }

  private resolveExecutionCwd(): string {
    if (this.toolAccessMode === 'article-tools') {
      return this.workingDirectory ?? this.repoRoot ?? process.cwd();
    }
    return this.sandboxDir;
  }

  private getOrCreateSessionId(articleId: string, cwd: string): string {
    this.cleanupSessions();
    const key = `${cwd}:${articleId}`;
    const existing = this.sessions.get(key);
    if (existing) {
      existing.lastUsedAt = Date.now();
      return existing.sessionId;
    }

    const created: SessionRecord = {
      sessionId: `copilot-session-${randomUUID()}`,
      lastUsedAt: Date.now(),
    };
    this.sessions.set(key, created);
    return created.sessionId;
  }

  private cleanupSessions(): void {
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const [key, record] of this.sessions.entries()) {
      if (record.lastUsedAt < cutoff) {
        this.sessions.delete(key);
      }
    }
  }

  private shouldFallbackToOneShot(plan: ExecutionPlan, error: unknown): boolean {
    return plan.mode === 'resumed' && error instanceof Error;
  }

  private sanitizeArgs(args: string[]): string[] {
    const copy = [...args];
    const promptIndex = copy.indexOf('-p');
    if (promptIndex >= 0 && copy[promptIndex + 1] !== undefined) {
      copy[promptIndex + 1] = '[prompt omitted]';
    }
    return copy;
  }

  private execFileArgs(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        this.copilotPath,
        args,
        {
          cwd,
          timeout: this.timeoutMs,
          maxBuffer: STDOUT_LIMIT_BYTES,
          encoding: 'utf-8',
          env: {
            ...process.env,
            COPILOT_AUTO_UPDATE: 'false',
          },
        },
        (error: ExecFileException | null, stdout: string, stderr: string) => {
          if (error) {
            if (error.killed) {
              reject(new Error(`Copilot CLI timed out after ${this.timeoutMs}ms`));
              return;
            }

            const message = stderr?.trim() || error.message;
            reject(new Error(`Copilot CLI error (exit ${error.code}): ${message}`));
            return;
          }

          resolve(stdout);
        },
      );
    });
  }

  private execViaStdin(args: string[], prompt: string, cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.copilotPath, args, {
        cwd,
        env: {
          ...process.env,
          COPILOT_AUTO_UPDATE: 'false',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let settled = false;

      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, this.timeoutMs);

      child.stdout.setEncoding('utf-8');
      child.stderr.setEncoding('utf-8');

      child.stdout.on('data', (chunk: string) => {
        if (settled) return;
        stdout += chunk;
        if (stdout.length > STDOUT_LIMIT_BYTES) {
          settled = true;
          clearTimeout(timeout);
          child.kill();
          reject(new Error('Copilot CLI output exceeded buffer limit'));
        }
      });

      child.stderr.on('data', (chunk: string) => {
        if (settled) return;
        stderr += chunk;
      });

      child.on('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      });

      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (timedOut) {
          reject(new Error(`Copilot CLI timed out after ${this.timeoutMs}ms`));
          return;
        }
        if (code !== 0) {
          reject(new Error(`Copilot CLI error (exit ${code}): ${stderr.trim() || 'unknown error'}`));
          return;
        }
        resolve(stdout);
      });

      child.stdin.end(prompt);
    });
  }

  private attachProviderMetadata(error: unknown, providerMetadata: ProviderMetadata): Error {
    const wrapped = error instanceof Error ? error : new Error(String(error));
    (wrapped as Error & { providerMetadata?: ProviderMetadata }).providerMetadata = providerMetadata;
    return wrapped;
  }
}
