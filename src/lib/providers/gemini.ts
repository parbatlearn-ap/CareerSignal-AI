/**
 * Google Gemini adapter (Generative Language REST API, v1beta generateContent).
 * Docs: https://ai.google.dev/api/generate-content
 * Tested against mocked HTTP responses only; see docs/KNOWN_LIMITATIONS.md.
 */
import type { AgentId } from "../schemas/common";
import { fetchWithTimeout, mapHttpError } from "./http";
import { ProviderError, type HealthStatus, type LLMProvider, type ModelMetadata, type TextRequest, type TextResponse } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export class GeminiProvider implements LLMProvider {
  readonly id = "gemini" as const;
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
    return { provider: "gemini", model, label: `Google Gemini · ${model}`, isMock: false };
  }

  async generateText(req: TextRequest): Promise<TextResponse> {
    if (!this.apiKey) throw new ProviderError("NO_API_KEY", "GEMINI_API_KEY is not set.");
    const url = `${BASE}/models/${encodeURIComponent(req.model)}:generateContent`;
    const body = {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: "user", parts: [{ text: req.prompt }] }],
      generationConfig: {
        temperature: req.temperature ?? 0.2,
        ...(req.json ? { responseMimeType: "application/json" } : {}),
      },
    };
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(body),
      },
      req.timeoutMs,
      this.fetchImpl,
    );
    const raw = await res.text();
    if (!res.ok) throw mapHttpError(res.status, raw, res.headers);
    let data: GeminiResponse;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new ProviderError("PROVIDER_ERROR", "Gemini returned a non-JSON HTTP body.");
    }
    if (data.promptFeedback?.blockReason)
      throw new ProviderError("SAFETY_BLOCKED", `Blocked: ${data.promptFeedback.blockReason}`);
    const cand = data.candidates?.[0];
    if (cand?.finishReason === "SAFETY") throw new ProviderError("SAFETY_BLOCKED", "Response blocked for safety.");
    const text = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    if (!text) throw new ProviderError("PROVIDER_ERROR", "Gemini returned an empty response.");
    const u = data.usageMetadata;
    return {
      text,
      model: data.modelVersion ?? req.model,
      usage: u ? { inputTokens: u.promptTokenCount, outputTokens: u.candidatesTokenCount, totalTokens: u.totalTokenCount } : null,
    };
  }

  async checkHealth(): Promise<HealthStatus> {
    const base = { provider: "gemini" as const, model: this.defaultModel, checkedAt: new Date().toISOString() };
    if (!this.apiKey) return { ...base, ok: false, configured: false, message: "GEMINI_API_KEY is not set." };
    try {
      const res = await fetchWithTimeout(
        `${BASE}/models/${encodeURIComponent(this.defaultModel)}`,
        { headers: { "x-goog-api-key": this.apiKey } },
        10000,
        this.fetchImpl,
      );
      if (!res.ok) {
        const err = mapHttpError(res.status, await res.text(), res.headers);
        return { ...base, ok: false, configured: true, message: `${err.code}: ${err.message}` };
      }
      return { ...base, ok: true, configured: true, message: "Model reachable. Quotas are not checked." };
    } catch (e) {
      const err = e as ProviderError;
      return { ...base, ok: false, configured: true, message: `${err.code ?? "ERROR"}: ${err.message}` };
    }
  }
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  modelVersion?: string;
}
