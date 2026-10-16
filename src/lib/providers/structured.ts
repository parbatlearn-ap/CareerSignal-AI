/**
 * Structured output: request JSON, parse it, validate it with Zod, and if
 * validation fails retry exactly once with a repair instruction.
 */
import { z } from "zod";
import type { AgentId } from "../schemas/common";
import { ProviderError, type LLMProvider, type Usage } from "./types";

export interface StructuredResult<T> {
  data: T;
  attempts: number;
  usage: Usage | null;
  model: string;
}

/** Extract a JSON object from model text (tolerates code fences / prose around it). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error("No JSON object found in model output.");
  }
}

function addUsage(a: Usage | null, b: Usage | null): Usage | null {
  if (!a) return b;
  if (!b) return a;
  const s = (x?: number, y?: number) => (x === undefined && y === undefined ? undefined : (x ?? 0) + (y ?? 0));
  return { inputTokens: s(a.inputTokens, b.inputTokens), outputTokens: s(a.outputTokens, b.outputTokens), totalTokens: s(a.totalTokens, b.totalTokens) };
}

export async function generateStructuredOutput<S extends z.ZodType>(
  provider: LLMProvider,
  opts: {
    agentId: AgentId;
    schema: S;
    system: string;
    prompt: string;
    input: unknown;
    timeoutMs: number;
  },
): Promise<StructuredResult<z.infer<S>>> {
  const jsonSchema = JSON.stringify(z.toJSONSchema(opts.schema, { unrepresentable: "any" }));
  const prompt = `${opts.prompt}\n\nReturn ONLY one JSON object that matches this JSON Schema exactly (no prose, no markdown):\n${jsonSchema}`;
  const model = provider.modelFor(opts.agentId);
  let usage: Usage | null = null;
  let lastError = "";
  let lastText = "";

  for (let attempt = 1; attempt <= 2; attempt++) {
    const p =
      attempt === 1
        ? prompt
        : `${prompt}\n\nYour previous response was invalid.\nValidation errors:\n${lastError}\nPrevious response (truncated):\n${lastText.slice(0, 2000)}\nReturn a corrected JSON object only. Do not add facts that are not in the input.`;
    const res = await provider.generateText({
      agentId: opts.agentId,
      system: opts.system,
      prompt: p,
      model,
      json: true,
      timeoutMs: opts.timeoutMs,
      input: opts.input,
    });
    usage = addUsage(usage, res.usage);
    lastText = res.text;
    let parsed: unknown;
    try {
      parsed = extractJson(res.text);
    } catch (e) {
      lastError = (e as Error).message;
      continue;
    }
    const v = opts.schema.safeParse(parsed);
    if (v.success) return { data: v.data, attempts: attempt, usage, model: res.model };
    lastError = v.error.issues
      .slice(0, 15)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
  }
  throw new ProviderError("INVALID_OUTPUT", `Output failed schema validation after repair: ${lastError.slice(0, 300)}`);
}
