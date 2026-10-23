/**
 * Provider-neutral LLM interface. Agents depend only on this file, so adding
 * OpenAI or Anthropic later means writing one adapter - no agent changes.
 */
import type { AgentId } from "../schemas/common";

export type ProviderId = "mock" | "gemini" | "groq";

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface TextRequest {
  agentId: AgentId;
  system: string;
  prompt: string;
  model: string;
  /** Ask for a JSON object response where the provider supports it. */
  json: boolean;
  /** JSON Schema of the expected output, for providers that can enforce it natively. */
  jsonSchema?: Record<string, unknown>;
  temperature?: number;
  timeoutMs: number;
  /**
   * The typed agent input. Only the mock provider reads it (to run the
   * deterministic rule-based implementation). Real providers use `prompt`.
   */
  input?: unknown;
}

export interface TextResponse {
  text: string;
  usage: Usage | null;
  model: string;
}

export interface ModelMetadata {
  provider: ProviderId;
  model: string;
  label: string;
  isMock: boolean;
}

export interface HealthStatus {
  ok: boolean;
  provider: ProviderId;
  model: string;
  configured: boolean;
  message: string;
  checkedAt: string;
}

export interface LLMProvider {
  readonly id: ProviderId;
  generateText(req: TextRequest): Promise<TextResponse>;
  checkHealth(): Promise<HealthStatus>;
  getModelMetadata(agentId?: AgentId): ModelMetadata;
  modelFor(agentId: AgentId): string;
}

export type ProviderErrorCode =
  | "NO_API_KEY"
  | "INVALID_API_KEY"
  | "RATE_LIMITED"
  | "QUOTA_EXHAUSTED"
  | "TIMEOUT"
  | "MODEL_UNAVAILABLE"
  | "PROVIDER_ERROR"
  | "INVALID_OUTPUT"
  | "CONSENT_REQUIRED"
  | "SAFETY_BLOCKED";

export class ProviderError extends Error {
  constructor(
    public code: ProviderErrorCode,
    message: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export const USER_MESSAGES: Record<ProviderErrorCode, string> = {
  NO_API_KEY: "No API key is configured for the selected provider. Add it to .env.local or switch LLM_PROVIDER to mock.",
  INVALID_API_KEY: "The provider rejected the API key. Check the key in .env.local.",
  RATE_LIMITED: "The provider rate limit was reached. Wait a moment and retry this step.",
  QUOTA_EXHAUSTED: "The provider's quota (for example a free-tier daily limit) is exhausted. Retry later or switch provider.",
  TIMEOUT: "The provider did not respond in time. Retry this step.",
  MODEL_UNAVAILABLE: "The configured model is unavailable. Check the model id in .env.local.",
  PROVIDER_ERROR: "The provider returned an error. Retry this step.",
  INVALID_OUTPUT: "The model returned output that failed validation, even after one repair attempt. Retry this step.",
  CONSENT_REQUIRED: "You have not allowed sending your data to the configured external AI provider. Enable it in Settings, or use mock mode.",
  SAFETY_BLOCKED: "The provider blocked the response for safety reasons.",
};
