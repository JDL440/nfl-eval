/**
 * Executable model selection policy for the article pipeline.
 *
 * TypeScript port of content/model_policy.py — loads models.json and resolves
 * which LLM model to use based on stage, depth level, and task family.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelPolicyConfig {
  version: string;
  models: Record<string, string>;
  max_output_tokens: Record<string, number>;
  panel_size_limits: Record<string, { min: number; max: number }>;
  depth_level_map: Record<string, string>;
  supported_models: Record<string, string[]>;
  task_families: Record<string, { tier: string; precedence: string[] }>;
  stage_task_families: Record<string, string>;
  override_policy: {
    allow_model_override: boolean;
    prefer_stage_default_before_tier_precedence: boolean;
  };
}

export interface ResolvedModel {
  selectedModel: string;
  candidates: string[];
  tier: string | null;
  precedenceRank: number | null;
  taskFamily: string | null;
  stageKey: string | null;
  stageModelKey: string | null;
  outputBudgetTokens: number | null;
  overrideApplied: boolean;
}

export interface ResolveParams {
  stageKey?: string;
  depthLevel?: number;
  taskFamily?: string;
  overrideModel?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PANEL_MODEL_KEYS: Record<number, string> = {
  1: 'panel_casual',
  2: 'panel_beat',
  3: 'panel_deep_dive',
};

const STAGE_MODEL_KEY_ALIASES: Record<string, string> = {
  'lead_discussion_prompt': 'lead',
  'lead_synthesis': 'lead',
  'publisher_metadata': 'lightweight',
};

const STAGE_BUDGET_KEY_ALIASES: Record<string, string> = {
  'panel': 'panel_agent',
};

// ---------------------------------------------------------------------------
// Default config path
// ---------------------------------------------------------------------------

function defaultConfigPath(): string {
  const dataDir = process.env['DATA_DIR'];
  if (dataDir) {
    return join(dataDir, 'config', 'models.json');
  }
  // Fallback: repo-relative .squad/config/models.json
  return join(process.cwd(), '.squad', 'config', 'models.json');
}

// ---------------------------------------------------------------------------
// ModelPolicy
// ---------------------------------------------------------------------------

export class ModelPolicy {
  readonly config: ModelPolicyConfig;

  constructor(configPath?: string) {
    const path = configPath ?? defaultConfigPath();
    const raw = readFileSync(path, 'utf-8');
    this.config = JSON.parse(raw) as ModelPolicyConfig;
  }

  // -- Public accessors ---------------------------------------------------

  private get models(): Record<string, string> {
    return this.config.models;
  }

  private get maxOutputTokens(): Record<string, number> {
    return this.config.max_output_tokens;
  }

  private get supportedModels(): Record<string, string[]> {
    return this.config.supported_models;
  }

  private get taskFamilies(): Record<string, { tier: string; precedence: string[] }> {
    return this.config.task_families;
  }

  private get stageTaskFamilies(): Record<string, string> {
    return this.config.stage_task_families ?? {};
  }

  private get overridePolicy(): ModelPolicyConfig['override_policy'] {
    return this.config.override_policy ?? {
      allow_model_override: false,
      prefer_stage_default_before_tier_precedence: true,
    };
  }

  // -- Public methods -----------------------------------------------------

  allSupportedModels(): string[] {
    const ordered: string[] = [];
    for (const key of ['low', 'medium', 'high', 'agentic_code']) {
      for (const model of this.supportedModels[key] ?? []) {
        if (!ordered.includes(model)) {
          ordered.push(model);
        }
      }
    }
    return ordered;
  }

  tierForModel(model: string): [string | null, number | null] {
    for (const [tierName, models] of Object.entries(this.supportedModels)) {
      const idx = models.indexOf(model);
      if (idx !== -1) {
        return [tierName, idx + 1];
      }
    }
    return [null, null];
  }

  /**
   * Get panel size limits for a given depth level.
   */
  getPanelSizeLimits(depthLevel: number): { min: number; max: number } {
    const depthName = this.config.depth_level_map[String(depthLevel)];
    if (!depthName) throw new Error(`Unknown depth level: ${depthLevel}`);
    const limits = this.config.panel_size_limits[depthName];
    if (!limits) throw new Error(`No panel size limits for depth: ${depthName}`);
    return limits;
  }

  resolve(params: ResolveParams = {}): ResolvedModel {
    const { stageKey, depthLevel, taskFamily, overrideModel } = params;

    const stageModelKey = this._resolveStageModelKey(stageKey, depthLevel);
    const resolvedTaskFamily = this._resolveTaskFamily(stageKey, taskFamily);
    const candidates = this._buildCandidates(stageKey, stageModelKey, resolvedTaskFamily);

    let overrideApplied = false;
    let selectedModel: string | undefined = candidates[0];

    if (overrideModel) {
      if (!this.overridePolicy.allow_model_override) {
        throw new Error('Model overrides are disabled by policy.');
      }
      if (!this.allSupportedModels().includes(overrideModel)) {
        throw new Error(`Unsupported override model: ${overrideModel}`);
      }
      selectedModel = overrideModel;
      overrideApplied = true;
      if (!candidates.includes(overrideModel)) {
        candidates.unshift(overrideModel);
      }
    }

    if (!selectedModel) {
      throw new Error('Unable to resolve a model from the current policy.');
    }

    const [tier, precedenceRank] = this.tierForModel(selectedModel);
    const budgetKey = this._budgetKeyForStage(stageKey);
    const outputBudgetTokens = budgetKey ? (this.maxOutputTokens[budgetKey] ?? null) : null;

    return {
      selectedModel,
      candidates,
      tier,
      precedenceRank,
      taskFamily: resolvedTaskFamily ?? null,
      stageKey: stageKey ?? null,
      stageModelKey: stageModelKey ?? null,
      outputBudgetTokens,
      overrideApplied,
    };
  }

  // -- Private helpers ----------------------------------------------------

  private _resolveStageModelKey(
    stageKey: string | undefined,
    depthLevel: number | undefined,
  ): string | null {
    if (!stageKey) return null;
    if (stageKey === 'panel') {
      if (depthLevel == null) {
        throw new Error("depth_level is required when stage_key='panel'");
      }
      const key = PANEL_MODEL_KEYS[depthLevel];
      if (!key) {
        throw new Error(`Unsupported panel depth level: ${depthLevel}. Use 1, 2, or 3.`);
      }
      return key;
    }
    return STAGE_MODEL_KEY_ALIASES[stageKey] ?? stageKey;
  }

  private _resolveTaskFamily(
    stageKey: string | undefined,
    taskFamily: string | undefined,
  ): string | null {
    if (taskFamily) return taskFamily;
    if (stageKey) return this.stageTaskFamilies[stageKey] ?? null;
    return null;
  }

  private _budgetKeyForStage(stageKey: string | undefined): string | null {
    if (!stageKey) return null;
    if (stageKey in this.maxOutputTokens) return stageKey;
    return STAGE_BUDGET_KEY_ALIASES[stageKey] ?? null;
  }

  private _familyPrecedence(taskFamily: string | null): string[] {
    if (!taskFamily) return [];
    const family = this.taskFamilies[taskFamily];
    if (!family) {
      throw new Error(`Unknown task family: ${taskFamily}`);
    }
    return [...(family.precedence ?? [])];
  }

  private _buildCandidates(
    stageKey: string | undefined,
    stageModelKey: string | null,
    taskFamily: string | null,
  ): string[] {
    const candidates: string[] = [];
    const preferStageDefault =
      this.overridePolicy.prefer_stage_default_before_tier_precedence ?? true;

    // If stage has a default model and policy prefers it first, prepend it
    if (stageModelKey && stageModelKey in this.models && preferStageDefault) {
      candidates.push(this.models[stageModelKey]);
    }

    // Add task-family precedence models
    for (const model of this._familyPrecedence(taskFamily)) {
      if (!candidates.includes(model)) {
        candidates.push(model);
      }
    }

    // If NOT preferring stage default, insert at front after precedence
    if (stageModelKey && stageModelKey in this.models && !preferStageDefault) {
      const model = this.models[stageModelKey];
      if (!candidates.includes(model)) {
        candidates.unshift(model);
      }
    }

    // Fallback: if still empty but stage has a model, use it
    if (candidates.length === 0 && stageModelKey && stageModelKey in this.models) {
      candidates.push(this.models[stageModelKey]);
    }

    // Agentic code gets medium-tier models as fallback
    if (taskFamily === 'agentic_code') {
      for (const model of this.supportedModels['medium'] ?? []) {
        if (!candidates.includes(model)) {
          candidates.push(model);
        }
      }
    }

    return candidates;
  }
}
