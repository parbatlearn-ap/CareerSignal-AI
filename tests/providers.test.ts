import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { GeminiProvider } from "@/lib/providers/gemini";
import { GroqProvider } from "@/lib/providers/groq";
import { MockProvider } from "@/lib/providers/mock";
import { createProvider, publicProviderStatus, readProviderConfig } from "@/lib/providers";
import { extractJson, generateStructuredOutput } from "@/lib/providers/structured";
import { ProviderError } from "@/lib/providers/types";

const res = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });
const req = { agentId: "discovery" as const, system: "s", prompt: "p", model: "m", json: true, timeoutMs: 1000 };

describe("provider configuration", () => {
  it("defaults to mock and never exposes keys", () => {
    expect(readProviderConfig({}).provider).toBe("mock");
    const s = publicProviderStatus({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: "secret-key-123" });
    expect(JSON.stringify(s)).not.toContain("secret-key-123");
    expect(s).toMatchObject({ provider: "gemini", keyConfigured: true, isMock: false });
  });

  it("falls back to mock (no data sent) with a warning on unknown providers", () => {
    const c = readProviderConfig({ LLM_PROVIDER: "openai" });
    expect(c.provider).toBe("mock");
    expect(c.warning).toMatch(/Unknown/);
  });

  it("supports per-agent model overrides and env model ids", () => {
    const c = readProviderConfig({ LLM_PROVIDER: "groq", GROQ_MODEL: "my-model", LLM_MODEL_CRITIC: "big-model" });
    expect(c.model).toBe("my-model");
    const p = createProvider({ LLM_PROVIDER: "groq", GROQ_API_KEY: "k", GROQ_MODEL: "my-model", LLM_MODEL_CRITIC: "big-model" });
    expect(p.modelFor("critic")).toBe("big-model");
    expect(p.modelFor("brand")).toBe("my-model");
  });
});

describe("Gemini adapter (mocked HTTP)", () => {
  it("sends the key in a header, requests JSON and reads usage", async () => {
    const f = vi.fn(async (_u: string, _init?: RequestInit) =>
      res(200, { candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 } }),
    );
    const p = new GeminiProvider("KEY", "gemini-test", {}, f as unknown as typeof fetch);
    const out = await p.generateText(req);
    expect(out.text).toBe('{"a":1}');
    expect(out.usage).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });
    const [url, init] = f.mock.calls[0];
    expect(url).toContain("/models/m:generateContent");
    expect(url).not.toContain("KEY");
    expect((init!.headers as Record<string, string>)["x-goog-api-key"]).toBe("KEY");
    expect(JSON.parse(init!.body as string).generationConfig.responseMimeType).toBe("application/json");
  });

  it.each([
    [400, { error: { message: "API key not valid." } }, "INVALID_API_KEY"],
    [429, { error: { status: "RESOURCE_EXHAUSTED", message: "Quota exceeded" } }, "QUOTA_EXHAUSTED"],
    [429, { error: { message: "Too many requests" } }, "RATE_LIMITED"],
    [404, { error: { message: "models/x is not found" } }, "MODEL_UNAVAILABLE"],
    [500, "oops", "PROVIDER_ERROR"],
  ])("maps HTTP %i to %s", async (status, body, code) => {
    const p = new GeminiProvider("KEY", "m", {}, (async () => res(status, body)) as unknown as typeof fetch);
    await expect(p.generateText(req)).rejects.toMatchObject({ code });
  });

  it("reports missing key and safety blocks", async () => {
    await expect(new GeminiProvider(undefined, "m").generateText(req)).rejects.toMatchObject({ code: "NO_API_KEY" });
    const p = new GeminiProvider("K", "m", {}, (async () => res(200, { promptFeedback: { blockReason: "SAFETY" } })) as unknown as typeof fetch);
    await expect(p.generateText(req)).rejects.toMatchObject({ code: "SAFETY_BLOCKED" });
    expect((await new GeminiProvider(undefined, "m").checkHealth()).configured).toBe(false);
  });

  it("turns aborts into TIMEOUT", async () => {
    const slow = ((_u: string, init: RequestInit) =>
      new Promise((_r, rej) => init.signal!.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))))) as unknown as typeof fetch;
    const p = new GeminiProvider("K", "m", {}, slow);
    await expect(p.generateText({ ...req, timeoutMs: 20 })).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});

describe("Groq adapter (mocked HTTP)", () => {
  it("uses bearer auth and json_object mode", async () => {
    const f = vi.fn(async (_u: string, _init?: RequestInit) => res(200, { model: "m", choices: [{ message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 } }));
    const p = new GroqProvider("GK", "m", {}, f as unknown as typeof fetch);
    const out = await p.generateText(req);
    expect(out.usage?.totalTokens).toBe(5);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer GK");
    expect(JSON.parse(init!.body as string).response_format).toEqual({ type: "json_object" });
  });

  it("maps 401 and 429 with retry-after", async () => {
    await expect(new GroqProvider("K", "m", {}, (async () => res(401, { error: {} })) as unknown as typeof fetch).generateText(req)).rejects.toMatchObject({ code: "INVALID_API_KEY" });
    const e = await new GroqProvider("K", "m", {}, (async () => res(429, { error: { message: "Rate limit reached" } }, { "retry-after": "7" })) as unknown as typeof fetch)
      .generateText(req)
      .catch((x) => x);
    expect(e).toBeInstanceOf(ProviderError);
    expect(e.code).toBe("RATE_LIMITED");
    expect(e.retryAfterSeconds).toBe(7);
  });
});

describe("structured output", () => {
  const schema = z.object({ name: z.string(), n: z.number() });

  it("extracts JSON from fenced or chatty output", () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here: {"a":2} thanks')).toEqual({ a: 2 });
    expect(() => extractJson("no json")).toThrow();
  });

  it("retries exactly once with a repair instruction", async () => {
    const prompts: string[] = [];
    const replies = ['{"name":"x"}', '{"name":"x","n":1}'];
    const provider = Object.assign(new MockProvider(), {
      generateText: async (r: { prompt: string }) => {
        prompts.push(r.prompt);
        return { text: replies.shift()!, usage: { totalTokens: 1 }, model: "m" };
      },
    });
    const out = await generateStructuredOutput(provider, { agentId: "discovery", schema, system: "s", prompt: "p", input: null, timeoutMs: 100 });
    expect(out).toMatchObject({ data: { name: "x", n: 1 }, attempts: 2, usage: { totalTokens: 2 } });
    expect(prompts[1]).toMatch(/previous response was invalid/i);
    expect(prompts[1]).toMatch(/n:/);
  });

  it("gives up after the repair attempt with INVALID_OUTPUT", async () => {
    let calls = 0;
    const provider = Object.assign(new MockProvider(), { generateText: async () => (calls++, { text: "{}", usage: null, model: "m" }) });
    await expect(generateStructuredOutput(provider, { agentId: "discovery", schema, system: "s", prompt: "p", input: null, timeoutMs: 100 })).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    expect(calls).toBe(2);
  });
});
