import { encoding_for_model } from 'js-tiktoken';

// Token pricing for models (per 1M tokens)
const PRICING = {
  'claude-3-5-haiku': {
    input: 0.80,      // $0.80 per 1M input tokens
    output: 4.00,     // $4.00 per 1M output tokens
  },
  'claude-3-5-opus': {
    input: 3.00,      // $3.00 per 1M input tokens
    output: 15.00,    // $15.00 per 1M output tokens
  },
};

// Tokenizer cache
let tokenizer = null;

function getTokenizer() {
  if (!tokenizer) {
    try {
      tokenizer = encoding_for_model('gpt-3.5-turbo');
    } catch (err) {
      console.warn('Tokenizer initialization warning:', err.message);
      // Fallback to cl100k_base encoding
      tokenizer = encoding_for_model('gpt-3.5-turbo');
    }
  }
  return tokenizer;
}

export function countTokens(text) {
  if (!text) return 0;
  try {
    const enc = getTokenizer();
    return enc.encode(text).length;
  } catch (err) {
    console.warn('Token counting fallback (estimate):', err.message);
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
}

export function calculateCost(model, inputTokens, outputTokens) {
  const pricing = PRICING[model];
  if (!pricing) {
    throw new Error(`Unknown model: ${model}`);
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

export function getModelCostEstimate(model, estimatedInputChars, estimatedOutputChars) {
  const inputTokens = Math.ceil(estimatedInputChars / 4);
  const outputTokens = Math.ceil(estimatedOutputChars / 4);
  return calculateCost(model, inputTokens, outputTokens);
}

export function extractTokenUsageFromResponse(response) {
  // Try to extract usage from Anthropic API response
  if (response.usage) {
    return {
      input_tokens: response.usage.input_tokens || 0,
      output_tokens: response.usage.output_tokens || 0,
    };
  }
  return { input_tokens: 0, output_tokens: 0 };
}

export default {
  countTokens,
  calculateCost,
  getModelCostEstimate,
  extractTokenUsageFromResponse,
  PRICING,
};
