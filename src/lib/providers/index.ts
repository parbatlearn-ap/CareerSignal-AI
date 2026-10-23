/**
 * Server-side provider selection. Reads environment variables only on the
 * server; never import this module from client components.
 */
import { AGENT_IDS, type AgentId } from "../schemas/common";
import { GeminiProvider } from "./gemini";
import { GroqProvider } from "./groq";
import { MockProvider } from "./mock";
import type { LLMProvider, ProviderId } from "./types";

/**
 * Single place for default model ids. They go stale - override via env.
 * Gemini uses Google's moving "latest" alias: pinned 2.x ids are restricted or
 * shut down for new projects (as of Oct 2026). Pin GEMINI_MODEL for stability.
 */
export const DEFAULT_MODELS: Record<Exclude<ProviderId, "mock">, string> = {
  gemini: "gemini-flash-latest",
  groq: "llama-3.3-70b-versatile",
};

export interface ProviderConfig {
  provider: ProviderId;
  model: string;
  hasKey: boolean;
  perAgentModels: Partial<Record<AgentId, string>>;
  timeoutMs: number;
  warning: string | null;
}

type Env = Record<string, string | undefined>;

export function readProviderConfig(env: Env = process.env): ProviderConfig {
  const requested = (env.LLM_PROVIDER ?? "mock").toLowerCase();
  const provider: ProviderId = requested === "gemini" || requested === "groq" ? requested : "mock";
  const warning =
    requested !== provider ? `Unknown LLM_PROVIDER "${requested}" - falling back to mock (no data sent anywhere).` : null;
  const perAgentModels: Partial<Record<AgentId, string>> = {};
  for (const a of AGENT_IDS) {
    const v = env[`LLM_MODEL_${a.toUpperCase()}`];
    if (v) perAgentModels[a] = v;
  }
  const model =
    provider === "gemini"
      ? env.GEMINI_MODEL || DEFAULT_MODELS.gemini
      : provider === "groq"
        ? env.GROQ_MODEL || DEFAULT_MODELS.groq
        : "rule-based-v1";
  const hasKey = provider === "gemini" ? Boolean(env.GEMINI_API_KEY) : provider === "groq" ? Boolean(env.GROQ_API_KEY) : true;
  const timeoutMs = Number(env.LLM_TIMEOUT_MS) > 0 ? Number(env.LLM_TIMEOUT_MS) : 60000;
  return { provider, model, hasKey, perAgentModels, timeoutMs, warning };
}

export function createProvider(env: Env = process.env, fetchImpl?: typeof fetch): LLMProvider {
  const cfg = readProviderConfig(env);
  if (cfg.provider === "gemini") return new GeminiProvider(env.GEMINI_API_KEY, cfg.model, cfg.perAgentModels, fetchImpl);
  if (cfg.provider === "groq") return new GroqProvider(env.GROQ_API_KEY, cfg.model, cfg.perAgentModels, fetchImpl);
  return new MockProvider();
}

/** Public (browser-safe) description of the configuration. Never includes keys. */
export function publicProviderStatus(env: Env = process.env) {
  const cfg = readProviderConfig(env);
  return {
    provider: cfg.provider,
    model: cfg.model,
    isMock: cfg.provider === "mock",
    keyConfigured: cfg.hasKey,
    perAgentModels: cfg.perAgentModels,
    timeoutMs: cfg.timeoutMs,
    warning: cfg.warning,
  };
}
export type PublicProviderStatus = ReturnType<typeof publicProviderStatus>;
