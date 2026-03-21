/**
 * validation.ts — Startup validation for pipeline configuration consistency.
 *
 * Verifies that TRANSITION_MAP, STAGE_ACTION_MAP, and CONTEXT_CONFIG
 * are all consistent. Catches configuration drift early before it causes
 * runtime failures.
 */

import { TRANSITION_MAP } from './engine.js';
import { STAGE_ACTIONS } from './actions.js';
import { CONTEXT_CONFIG } from './context-config.js';

export interface ValidationError {
  level: 'error' | 'warning';
  message: string;
}

/**
 * Validate that all pipeline configuration maps are consistent.
 * Returns an array of issues found (empty = everything is consistent).
 *
 * Checks:
 * 1. Every TRANSITION_MAP action has a corresponding STAGE_ACTIONS entry
 * 2. Every TRANSITION_MAP action (except 'publish') has a CONTEXT_CONFIG entry
 * 3. Every CONTEXT_CONFIG key maps to a known action
 * 4. No duplicate 'from' stages in TRANSITION_MAP
 * 5. Transition chain is contiguous (no gaps)
 */
export function validatePipelineConfig(): ValidationError[] {
  const errors: ValidationError[] = [];

  const transitionActions = new Set(TRANSITION_MAP.map(t => t.action));
  const registeredActions = new Set(Object.keys(STAGE_ACTIONS));
  const configuredActions = new Set(Object.keys(CONTEXT_CONFIG));

  // 1. Every transition action must have a registered implementation
  for (const t of TRANSITION_MAP) {
    if (!registeredActions.has(t.action)) {
      errors.push({
        level: 'error',
        message: `TRANSITION_MAP action '${t.action}' (stage ${t.from}→${t.to}) has no entry in STAGE_ACTIONS`,
      });
    }
  }

  // 2. Every transition action (except 'publish') should have context config
  for (const t of TRANSITION_MAP) {
    if (t.action === 'publish') continue; // publish doesn't use agent context
    if (!configuredActions.has(t.action)) {
      errors.push({
        level: 'warning',
        message: `TRANSITION_MAP action '${t.action}' (stage ${t.from}→${t.to}) has no CONTEXT_CONFIG entry — agent will receive no upstream artifacts`,
      });
    }
  }

  // 3. Every CONTEXT_CONFIG key should map to a known transition action
  for (const key of configuredActions) {
    if (!transitionActions.has(key)) {
      errors.push({
        level: 'warning',
        message: `CONTEXT_CONFIG key '${key}' does not match any TRANSITION_MAP action — orphaned config`,
      });
    }
  }

  // 4. No duplicate 'from' stages in TRANSITION_MAP
  const fromStages = new Map<number, string>();
  for (const t of TRANSITION_MAP) {
    if (fromStages.has(t.from)) {
      errors.push({
        level: 'error',
        message: `Duplicate 'from' stage ${t.from} in TRANSITION_MAP: '${fromStages.get(t.from)}' and '${t.action}'`,
      });
    }
    fromStages.set(t.from, t.action);
  }

  // 5. Transition chain contiguity: from→to should form a connected chain
  const sorted = [...TRANSITION_MAP].sort((a, b) => a.from - b.from);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].from !== sorted[i - 1].to) {
      errors.push({
        level: 'error',
        message: `Transition chain gap: stage ${sorted[i - 1].to} has no outgoing transition (previous ends at ${sorted[i - 1].to}, next starts at ${sorted[i].from})`,
      });
    }
  }

  return errors;
}

/**
 * Run validation and log results. Throws on errors, warns on warnings.
 * Call during application startup.
 */
export function assertPipelineConfigValid(): void {
  const issues = validatePipelineConfig();
  const errors = issues.filter(i => i.level === 'error');
  const warnings = issues.filter(i => i.level === 'warning');

  for (const w of warnings) {
    console.warn(`[pipeline-config] ⚠️  ${w.message}`);
  }

  if (errors.length > 0) {
    const msg = errors.map(e => `  - ${e.message}`).join('\n');
    throw new Error(`Pipeline configuration is inconsistent:\n${msg}`);
  }
}
