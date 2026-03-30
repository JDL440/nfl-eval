/**
 * pricing.ts — Token cost estimation for LLM models.
 *
 * Hardcoded pricing table for supported models. Prices are per million tokens.
 * Update this table when model pricing changes.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelPricing {
  /** Cost per million input (prompt) tokens in USD. */
  inputPerMillion: number;
  /** Cost per million output (completion) tokens in USD. */
  outputPerMillion: number;
}

// ---------------------------------------------------------------------------
// Pricing table — USD per 1M tokens
// ---------------------------------------------------------------------------

const PRICING: Record<string, ModelPricing> = {
  // Claude family
  'claude-opus-4.6':    { inputPerMillion: 15.00, outputPerMillion: 75.00 },
  'claude-opus-4.5':    { inputPerMillion: 15.00, outputPerMillion: 75.00 },
  'claude-sonnet-4.6':  { inputPerMillion: 3.00,  outputPerMillion: 15.00 },
  'claude-sonnet-4.5':  { inputPerMillion: 3.00,  outputPerMillion: 15.00 },
  'claude-sonnet-4':    { inputPerMillion: 3.00,  outputPerMillion: 15.00 },
  'claude-haiku-4.5':   { inputPerMillion: 0.80,  outputPerMillion: 4.00 },

  // GPT family
  'gpt-5.4':            { inputPerMillion: 2.50,  outputPerMillion: 10.00 },
  'gpt-5.4-mini':       { inputPerMillion: 0.40,  outputPerMillion: 1.60 },
  'gpt-5.3-codex':      { inputPerMillion: 2.50,  outputPerMillion: 10.00 },
  'gpt-5.2-codex':      { inputPerMillion: 2.50,  outputPerMillion: 10.00 },
  'gpt-5.2':            { inputPerMillion: 2.50,  outputPerMillion: 10.00 },
  'gpt-5.1-codex-max':  { inputPerMillion: 2.50,  outputPerMillion: 10.00 },
  'gpt-5.1-codex':      { inputPerMillion: 2.50,  outputPerMillion: 10.00 },
  'gpt-5.1-codex-mini': { inputPerMillion: 0.40,  outputPerMillion: 1.60 },
  'gpt-5.1':            { inputPerMillion: 2.50,  outputPerMillion: 10.00 },
  'gpt-5-mini':         { inputPerMillion: 0.40,  outputPerMillion: 1.60 },
  'gpt-4.1':            { inputPerMillion: 2.00,  outputPerMillion: 8.00 },
  'gpt-4.1-mini':       { inputPerMillion: 0.40,  outputPerMillion: 1.60 },
  'gpt-4.1-nano':       { inputPerMillion: 0.10,  outputPerMillion: 0.40 },
  'gpt-4o':             { inputPerMillion: 2.50,  outputPerMillion: 10.00 },
  'gpt-4o-mini':        { inputPerMillion: 0.15,  outputPerMillion: 0.60 },
  'o4-mini':            { inputPerMillion: 1.10,  outputPerMillion: 4.40 },
  'o3':                 { inputPerMillion: 2.00,  outputPerMillion: 8.00 },
  'o3-mini':            { inputPerMillion: 1.10,  outputPerMillion: 4.40 },
  'o1':                 { inputPerMillion: 15.00, outputPerMillion: 60.00 },
  'o1-mini':            { inputPerMillion: 1.10,  outputPerMillion: 4.40 },

  // Gemini family
  'gemini-3-pro-preview':       { inputPerMillion: 1.25, outputPerMillion: 10.00 },
  'gemini-3-pro-image-preview': { inputPerMillion: 1.25, outputPerMillion: 10.00 },
  'gemini-2.5-pro':             { inputPerMillion: 1.25, outputPerMillion: 10.00 },
  'gemini-2.5-flash':           { inputPerMillion: 0.15, outputPerMillion: 0.60 },
  'gemini-2.0-flash':           { inputPerMillion: 0.10, outputPerMillion: 0.40 },
};

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * Look up pricing for a model. Returns undefined if the model isn't in the table.
 */
export function getModelPricing(model: string): ModelPricing | undefined {
  return PRICING[model];
}

/**
 * Calculate estimated cost in USD for a given model and token counts.
 * Returns 0 if the model isn't in the pricing table.
 */
export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = PRICING[model];
  if (!pricing) return 0;

  const inputCost = (promptTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPerMillion;
  return inputCost + outputCost;
}

/**
 * List all models that have pricing data.
 */
export function listPricedModels(): string[] {
  return Object.keys(PRICING);
}

/**
 * Estimate cost for Gemini image generation based on token usage.
 * Image generation outputs are billed as completion tokens by the API.
 */
export function estimateImageCost(promptTokens: number, completionTokens: number): number {
  return estimateCost('gemini-3-pro-image-preview', promptTokens, completionTokens);
}
