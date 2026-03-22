/**
 * Copilot CLI LLM provider — routes requests through the standalone
 * GitHub Copilot CLI agent (`copilot -p "..." -s --no-ask-user`).
 *
 * This leverages a Copilot Pro+ subscription without needing the
 * GitHub Models API. The CLI handles its own auth (OAuth keychain,
 * COPILOT_GITHUB_TOKEN, GH_TOKEN, or GITHUB_TOKEN).
 *
 * Trade-offs vs the Models API provider (copilot.ts):
 *   + Uses Pro+ subscription directly (no separate API quota)
 *   + Access to all Copilot-supported models via --model flag
 *   + Built-in tool use, context, and safety features
 *   - Higher latency (~5-10s overhead per call for CLI startup)
 *   - No streaming, no token usage stats
 *   - No structured output (response_format: json is best-effort)
 *   - Output is plain text (may include markdown formatting)
 */

import { exec, execFile, type ExecFileException } from 'node:child_process';
import { existsSync } from 'node:fs';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import type { LLMProvider, ChatRequest, ChatResponse } from '../gateway.js';

// ---------------------------------------------------------------------------
// Supported models — the Copilot CLI supports any model the user's plan
// allows. This list reflects common models available via `copilot --model`.
// ---------------------------------------------------------------------------

const CLI_MODELS = [
  // Claude family
  'claude-sonnet-4.6',
  'claude-sonnet-4.5',
  'claude-sonnet-4',
  'claude-haiku-4.5',
  'claude-opus-4.6',
  'claude-opus-4.5',
  // GPT family
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
  // Gemini
  'gemini-3-pro-preview',
] as const;

// ---------------------------------------------------------------------------
// Model aliases — maps canonical/API-style names to CLI equivalents so the
// pipeline can use provider-agnostic model names in models.json and switch
// between Copilot CLI ↔ API ↔ LMStudio without config changes.
// ---------------------------------------------------------------------------

const CLI_MODEL_ALIASES: Record<string, string> = {
  // GPT-5 family: API uses unversioned names, CLI needs versioned
  'gpt-5':            'gpt-5.4',
  'gpt-5-chat':       'gpt-5.4',
  'gpt-5-nano':       'gpt-5.4-mini',   // nano doesn't exist on CLI → use mini
  // GPT-4 family
  'gpt-4o':           'gpt-4.1',
  'gpt-4o-mini':      'gpt-4.1',
  'gpt-4.1-mini':     'gpt-4.1',        // CLI only has gpt-4.1
  'gpt-4.1-nano':     'gpt-4.1',
  // Reasoning models → nearest CLI equivalents
  'o4-mini':          'gpt-5.4-mini',
  'o3':               'gpt-5.4',
  'o3-mini':          'gpt-5.4-mini',
  'o1':               'gpt-5.4',
  'o1-mini':          'gpt-5.4-mini',
};

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CopilotCLIProviderOptions {
  /** Path to the copilot executable (default: 'copilot' on PATH). */
  copilotPath?: string;
  /** Default model when none specified in the request. */
  defaultModel?: string;
  /** Timeout in ms for a single CLI invocation (default: 120_000). */
  timeoutMs?: number;
  /** Extra CLI flags appended to every invocation. */
  extraFlags?: string[];
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT = 300_000; // 5 minutes — Opus with long context needs room
const DEFAULT_MODEL = 'claude-sonnet-4';

// Node's execFile on Windows uses CreateProcessW (32K char limit), not cmd.exe
// (8K limit). We only fall back to file-based approach for truly huge prompts.
const EXEC_FILE_CHAR_LIMIT = 30_000;

export class CopilotCLIProvider implements LLMProvider {
  readonly id = 'copilot-cli';
  readonly name = 'GitHub Copilot CLI';

  private readonly copilotPath: string;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;
  private readonly extraFlags: string[];

  constructor(options?: CopilotCLIProviderOptions) {
    this.copilotPath = options?.copilotPath ?? 'copilot';
    this.defaultModel = options?.defaultModel ?? DEFAULT_MODEL;
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT;
    this.extraFlags = options?.extraFlags ?? [];
  }

  // -- Preflight -----------------------------------------------------------

  /**
   * Verify the copilot CLI is installed and responsive.
   * Throws if the binary isn't found or returns a non-zero exit code.
   */
  async verify(): Promise<string> {
    const version = await this.exec(['--version']);
    return version.trim();
  }

  // -- LLMProvider interface -----------------------------------------------

  listModels(): string[] {
    return [...CLI_MODELS, ...Object.keys(CLI_MODEL_ALIASES)];
  }

  supportsModel(model: string): boolean {
    return (
      CLI_MODELS.includes(model as (typeof CLI_MODELS)[number]) ||
      model in CLI_MODEL_ALIASES ||
      model.startsWith('claude-') ||
      model.startsWith('gpt-') ||
      model.startsWith('gemini-')
    );
  }

  /** Translate canonical/API model names to CLI-compatible names. */
  private resolveModel(model: string): string {
    return CLI_MODEL_ALIASES[model] ?? model;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const model = this.resolveModel(request.model ?? this.defaultModel);

    // ── Build the prompt string ──────────────────────────────────────────
    // The CLI takes a single prompt (-p) or stdin. We combine the
    // system prompt and user messages into one coherent prompt string.
    const prompt = this.buildPrompt(request);

    // ── Decide delivery method ───────────────────────────────────────────
    // Node's execFile uses CreateProcessW on Windows (~32K char limit),
    // NOT cmd.exe (~8K limit). Use -p flag for most prompts. Only fall
    // back to file-based approach for truly massive prompts.
    const useFile = prompt.length > EXEC_FILE_CHAR_LIMIT;

    let output: string;
    if (useFile) {
      output = await this.execViaFile(prompt, model);
    } else {
      output = await this.execViaFlag(prompt, model);
    }

    // ── Parse response ───────────────────────────────────────────────────
    const content = output.trim();

    if (!content) {
      throw new Error('Copilot CLI returned empty response');
    }

    return {
      content,
      model,
      provider: this.id,
      // CLI doesn't expose token usage
      usage: undefined,
      finishReason: 'stop',
    };
  }

  // -- Prompt composition --------------------------------------------------

  /**
   * Compose a single prompt string from ChatRequest messages.
   *
   * Strategy: if there's a system message, place it first as instructions.
   * Then append user/assistant messages in order. This mirrors how the
   * CLI would process a conversation.
   */
  private buildPrompt(request: ChatRequest): string {
    const parts: string[] = [];

    const systemMsgs = request.messages.filter((m) => m.role === 'system');
    const conversationMsgs = request.messages.filter((m) => m.role !== 'system');

    // System prompt becomes "Instructions" block
    if (systemMsgs.length > 0) {
      const systemContent = systemMsgs.map((m) => m.content).join('\n\n');
      parts.push(`<instructions>\n${systemContent}\n</instructions>`);
    }

    // Add JSON format hint if requested
    if (request.responseFormat === 'json') {
      parts.push(
        '<output_format>Respond with valid JSON only. No markdown fences, no explanation outside the JSON.</output_format>',
      );
    }

    // Conversation messages
    for (const msg of conversationMsgs) {
      if (msg.role === 'user') {
        parts.push(msg.content);
      } else if (msg.role === 'assistant') {
        parts.push(`[Previous assistant response]\n${msg.content}`);
      }
    }

    return parts.join('\n\n');
  }

  // -- Execution helpers ---------------------------------------------------

  /** Run copilot with prompt via -p flag (for shorter prompts). */
  private async execViaFlag(prompt: string, model: string): Promise<string> {
    const args = ['-p', prompt, '-s', '--no-ask-user', '--model', model, ...this.extraFlags];
    return this.exec(args);
  }

  /** Run copilot with prompt via temp file (for very long prompts). */
  private async execViaFile(prompt: string, model: string): Promise<string> {
    const tmpDir = join(tmpdir(), 'nfl-lab-copilot');
    if (!existsSync(tmpDir)) {
      await mkdir(tmpDir, { recursive: true });
    }
    const tmpFile = join(tmpDir, `prompt-${randomBytes(8).toString('hex')}.txt`);

    try {
      await writeFile(tmpFile, prompt, 'utf-8');

      // Use shell to read the file into -p: copilot -p @file or via
      // Get-Content pipe. The safest cross-platform approach is to use
      // the shell to pass the file contents.
      return await this.execShell(
        `"${this.copilotPath}" -s --no-ask-user --model "${model}" ${this.extraFlags.map(f => `"${f}"`).join(' ')} < "${tmpFile}"`,
      );
    } finally {
      try {
        await unlink(tmpFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /** Execute copilot CLI and return stdout. */
  private exec(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        this.copilotPath,
        args,
        {
          timeout: this.timeoutMs,
          maxBuffer: 10 * 1024 * 1024, // 10MB
          encoding: 'utf-8',
          env: {
            ...process.env,
            // Don't let the CLI try to auto-update during our calls
            COPILOT_AUTO_UPDATE: 'false',
          },
        },
        (error: ExecFileException | null, stdout: string, stderr: string) => {
          if (error) {
            const msg = stderr?.trim() || error.message;
            if (error.killed) {
              reject(new Error(`Copilot CLI timed out after ${this.timeoutMs}ms`));
            } else {
              reject(new Error(`Copilot CLI error (exit ${error.code}): ${msg}`));
            }
            return;
          }
          resolve(stdout);
        },
      );
    });
  }

  /** Execute a shell command string (for file-based stdin redirection). */
  private execShell(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(
        command,
        {
          timeout: this.timeoutMs,
          maxBuffer: 10 * 1024 * 1024,
          encoding: 'utf-8',
          env: {
            ...process.env,
            COPILOT_AUTO_UPDATE: 'false',
          },
        },
        (error: ExecFileException | null, stdout: string, stderr: string) => {
          if (error) {
            const msg = stderr?.trim() || error.message;
            if (error.killed) {
              reject(new Error(`Copilot CLI timed out after ${this.timeoutMs}ms`));
            } else {
              reject(new Error(`Copilot CLI error (exit ${error.code}): ${msg}`));
            }
            return;
          }
          resolve(stdout);
        },
      );
    });
  }
}
