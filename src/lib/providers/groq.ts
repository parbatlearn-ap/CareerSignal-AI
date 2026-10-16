/**
 * Groq adapter (OpenAI-compatible Chat Completions endpoint).
 * Docs: https://console.groq.com/docs/api-reference
 * Tested against mocked HTTP responses only; see docs/KNOWN_LIMITATIONS.md.
 */
import type { AgentId } from "../schemas/common";
import { fetchWithTimeout, mapHttpError } from "./http";
import { ProviderError, type HealthStatus, type LLMProvider, type ModelMetadata, type TextRequest, type TextResponse } from "./types";

const BASE = "https://api.groq.com/openai/v1";

export class GroqProvider implements LLMProvider {
  readonly id = "groq" as const;
  constructor(
    private apiKey: string | undefined,
    private defaultModel: string,
    private perAgent: Partial<Record<AgentId, string>> = {},
    private fetchImpl: typeof fetch = fetch,
  ) {}

  modelFor(agentId: AgentId): string {
    return this.perAgent[agentId] ?? this.defaultModel;
  }

  getModelMetadata(agentId?: AgentId): ModelMetadata {
    const model = agentId ? this.modelFor(agentId) : this.defaultModel;
    return { provider: "groq", model, label: `Groq · ${model}`, isMock: false };
  }

  async generateText(req: TextRequest): Promise<TextResponse> {
    if (!this.apiKey) throw new ProviderError("NO_API_KEY", "GROQ_API_KEY is not set.");
    const body = {
      model: req.model,
      temperature: req.temperature ?? 0.2,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.prompt },
      ],
      ...(req.json ? { response_format: { type: "json_object" } } : {}),
    };
    const res = await fetchWithTimeout(
      `${BASE}/chat/completions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(body),
      },
      req.timeoutMs,
      this.fetchImpl,
    );
    const raw = await res.text();
    if (!res.ok) throw mapHttpError(res.status, raw, res.headers);
    let data: GroqResponse;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new ProviderError("PROVIDER_ERROR", "Groq returned a non-JSON HTTP body.");
    }
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text) throw new ProviderError("PROVIDER_ERROR", "Groq returned an empty response.");
    const u = data.usage;
    return {
      text,
      model: data.model ?? req.model,
      usage: u ? { inputTokens: u.prompt_tokens, outputTokens: u.completion_tokens, totalTokens: u.total_tokens } : null,
    };
  }

  async checkHealth(): Promise<HealthStatus> {
    const base = { provider: "groq" as const, model: this.defaultModel, checkedAt: new Date().toISOString() };
    if (!this.apiKey) return { ...base, ok: false, configured: false, message: "GROQ_API_KEY is not set." };
    try {
      const res = await fetchWithTimeout(
        `${BASE}/models/${encodeURIComponent(this.defaultModel)}`,
        { headers: { Authorization: `Bearer ${this.apiKey}` } },
        10000,
        this.fetchImpl,
      );
      if (!res.ok) {
        const err = mapHttpError(res.status, await res.text(), res.headers);
        return { ...base, ok: false, configured: true, message: `${err.code}: ${err.message}` };
      }
      return { ...base, ok: true, configured: true, message: "Model reachable. Rate limits are not checked." };
    } catch (e) {
      const err = e as ProviderError;
      return { ...base, ok: false, configured: true, message: `${err.code ?? "ERROR"}: ${err.message}` };
    }
  }
}

interface GroqResponse {
  model?: string;
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}
