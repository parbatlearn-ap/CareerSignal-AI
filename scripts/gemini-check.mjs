#!/usr/bin/env node
/**
 * Gemini self-check: verifies your key and model before you run a real analysis.
 *   npm run gemini:check
 * Reads GEMINI_API_KEY / GEMINI_MODEL from the environment, .env.local or .env.
 * Sends ONE tiny synthetic request (no personal data). Never prints your key.
 */
import { existsSync, readFileSync } from "node:fs";

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-flash-latest";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

const key = process.env.GEMINI_API_KEY?.trim();
const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
const ok = (s) => console.log(`  ✅ ${s}`);
const bad = (s) => console.log(`  ❌ ${s}`);
const info = (s) => console.log(`  • ${s}`);

function explain(status, body) {
  const b = body.toLowerCase();
  if (status === 400 && b.includes("api key")) return "Google says the API key is not valid. Copy it again from https://aistudio.google.com/apikey into .env.local.";
  if (status === 403) return "Permission denied. The key may be restricted, or the Generative Language API is not enabled for its project.";
  if (status === 404) return `Model "${model}" was not found for your key. Pick one from the list above and set GEMINI_MODEL in .env.local.`;
  if (status === 429) return "Rate limit or free-tier quota reached. Wait a few minutes (or until tomorrow for daily limits) and try again.";
  return `HTTP ${status}: ${body.slice(0, 300)}`;
}

async function get(url) {
  const res = await fetch(url, { headers: { "x-goog-api-key": key } });
  return { res, body: await res.text() };
}

console.log("\nCareerSignal AI - Gemini check\n");
console.log(`LLM_PROVIDER = ${process.env.LLM_PROVIDER ?? "(not set → mock)"}`);
if ((process.env.LLM_PROVIDER ?? "mock").toLowerCase() !== "gemini")
  info('The app will NOT use Gemini until you set LLM_PROVIDER=gemini in .env.local (this check still runs).');
if (!key) {
  bad("GEMINI_API_KEY is not set. Create one at https://aistudio.google.com/apikey and add it to .env.local.");
  process.exit(1);
}
ok(`GEMINI_API_KEY is set (${key.length} characters, not shown).`);
info(`GEMINI_MODEL = ${model}${process.env.GEMINI_MODEL ? "" : " (default)"}`);

// 1. Which models can this key use?
console.log("\n1) Models available to your key (text generation, Flash family):");
try {
  const { res, body } = await get(`${BASE}/models?pageSize=200`);
  if (!res.ok) {
    bad(explain(res.status, body));
    process.exit(1);
  }
  const models = (JSON.parse(body).models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""))
    .filter((n) => n.includes("flash"));
  if (models.length) models.forEach((n) => info(n));
  else info("No Flash models listed for this key.");
} catch (e) {
  bad(`Could not reach Google (${e.message}). Check your internet connection or proxy.`);
  process.exit(1);
}

// 2. Is the configured model reachable?
console.log(`\n2) Configured model "${model}":`);
{
  const { res, body } = await get(`${BASE}/models/${encodeURIComponent(model)}`);
  if (!res.ok) {
    bad(explain(res.status, body));
    process.exit(1);
  }
  ok("Model found.");
}

// 3. One tiny structured-output call (synthetic, no personal data).
console.log("\n3) Test call with JSON structured output:");
const schema = { type: "object", properties: { ok: { type: "boolean" }, word: { type: "string" } }, required: ["ok", "word"] };
for (const native of [true, false]) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: 'Return {"ok": true, "word": "hello"} as JSON.' }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json", ...(native ? { responseJsonSchema: schema } : {}) },
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    if (native && res.status === 400) {
      info("Native JSON schema was rejected; the app falls back to plain JSON mode automatically. Retrying that way…");
      continue;
    }
    bad(explain(res.status, body));
    process.exit(1);
  }
  const data = JSON.parse(body);
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  try {
    const parsed = JSON.parse(text);
    if (parsed.ok !== true) throw new Error("unexpected content");
    ok(`Valid JSON returned in ${Date.now() - t0} ms using ${native ? "native schema" : "plain JSON mode"}.`);
  } catch {
    bad(`The model replied, but not with the expected JSON: ${text.slice(0, 200)}`);
    process.exit(1);
  }
  const u = data.usageMetadata;
  if (u) info(`Tokens used: ${u.totalTokenCount ?? "?"} (input ${u.promptTokenCount ?? "?"}, output ${u.candidatesTokenCount ?? "?"})`);
  if (data.modelVersion) info(`Google served model version: ${data.modelVersion}`);
  break;
}

console.log("\nAll checks passed. Next: set LLM_PROVIDER=gemini, restart `npm run dev`, and allow provider use on the analysis's Privacy page.\n");
