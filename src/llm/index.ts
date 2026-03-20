/**
 * LLM module public API.
 */

// Core gateway
export {
  LLMGateway,
  GatewayError,
  NoProviderError,
  StructuredOutputError,
  type GatewayOptions,
  type ChatMessage,
  type ChatRequest,
  type ChatResponse,
  type LLMProvider,
} from './gateway.js';

// Model policy
export {
  ModelPolicy,
  type ModelPolicyConfig,
  type ResolvedModel,
  type ResolveParams,
} from './model-policy.js';

// Providers
export { StubProvider } from './providers/stub.js';
export { AnthropicProvider } from './providers/anthropic.js';
export { OpenAIProvider } from './providers/openai.js';
export { GeminiProvider } from './providers/gemini.js';
export { LocalProvider } from './providers/local.js';
