/** Agent 2 - Evidence Mining: turn vague experience into defensible, sourced claims. */
import { EvidenceOutputSchema, type EvidenceOutput } from "../schemas/agents";
import type { Strength } from "../schemas/common";
import { asUntrusted } from "../analysis/injection";
import { extractMetrics, truncate } from "../analysis/text";
import { json, type AgentDefinition } from "./base";

export interface EvidenceInput {
  candidates: { id: string; text: string; sourceQuote: string; experienceId: string | null }[];
  experiences: { id: string; title: string; employer: string }[];
}

const OUTCOME = /\b(increas|reduc|decreas|saved|saving|improv|grew|growing|cut|cutting|accelerat|eliminat|raised|boost|lowered|lowering|shorten|achiev|won|enabl)\w*/i;
const ADOPTION = /\b(used by|adopted by|rolled out to|relied on by)\b/i;
const OUTPUT = /\b(built|created|developed|designed|launched|delivered|implemented|automated|wrote|introduced|established|redesigned|migrated|dashboard|report|model|framework|playbook)\b/i;
export const VAGUE = /\b(helped|assisted|worked on|responsible for|involved in|various|supported|participated|handled)\b/i;

/** Metrics with a unit (%, time, money, volume). Bare numbers usually describe scope, not results. */
const unitMetrics = (text: string) => extractMetrics(text).filter((m) => !/^\d+(?:[.,]\d+)?$/.test(m));

export function classifyStrength(text: string): Strength {
  const metrics = unitMetrics(text);
  const outcome = OUTCOME.test(text);
  if (outcome && metrics.length > 0) return "impact";
  if (outcome || ADOPTION.test(text) || (metrics.length > 0 && OUTPUT.test(text))) return "outcome";
  if (OUTPUT.test(text)) return "output";
  return "activity";
}

export function evidenceRuleBased(input: EvidenceInput): EvidenceOutput {
  const out: EvidenceOutput = { claims: [], followUps: [], unsupportedNotes: [] };
  input.candidates.forEach((c, idx) => {
    const strength = classifyStrength(c.text);
    const metrics = extractMetrics(c.sourceQuote);
    out.claims.push({
      text: c.text,
      sourceText: c.sourceQuote,
      experienceId: c.experienceId,
      strength,
      metrics,
      status: "user_provided",
    });
    const short = truncate(c.text, 90);
    if (OUTCOME.test(c.text) && metrics.length === 0)
      out.followUps.push({ claimIndex: idx, priority: 5, question: `"${short}" - can you quantify the change (before vs after), or describe how it was measured?`, reason: "An outcome is stated without a measure." });
    else if (VAGUE.test(c.text))
      out.followUps.push({ claimIndex: idx, priority: 4, question: `"${short}" - what exactly did you do, and what changed because of your work?`, reason: "Wording describes involvement, not your contribution or result." });
    else if (strength === "output")
      out.followUps.push({ claimIndex: idx, priority: 3, question: `"${short}" - who used this, how often, and what decision or process did it change?`, reason: "A deliverable is described without its outcome." });
    else if (strength === "activity")
      out.followUps.push({ claimIndex: idx, priority: 2, question: `"${short}" - what was the result of this work? If it can't be quantified, what qualitative evidence exists (feedback, adoption, sign-off)?`, reason: "Describes an activity only." });
  });
  if (input.candidates.length === 0) out.unsupportedNotes.push("No achievement statements were found in the supplied material.");
  out.followUps.sort((a, b) => b.priority - a.priority);
  return out;
}

export const evidenceAgent: AgentDefinition<EvidenceInput, typeof EvidenceOutputSchema> = {
  id: "evidence",
  title: "Evidence Mining Agent",
  responsibility:
    "Turn achievement candidates into evidence-backed claims, classify each as activity, output, outcome or impact, and write targeted follow-up questions where impact is unclear. Do no market benchmarking or positioning.",
  outputSchema: EvidenceOutputSchema,
  system: `sourceText MUST be copied verbatim from the candidate's sourceQuote.
metrics may contain ONLY numbers/measures that literally appear in sourceText. Never estimate or round.
strength "impact" requires a measured result in the source. If no measure is stated, ask a follow-up instead.
status is "user_provided" for statements taken from the user's material; use "inferred_needs_confirmation" if you rephrased meaningfully; "unsupported" if the claim cannot be grounded.
claimIndex refers to the position in your claims array. priority 5 = highest value for positioning.`,
  buildPrompt: (i) =>
    `Roles: ${json(i.experiences)}
${asUntrusted("achievement_candidates", json(i.candidates))}
Produce evidence claims and the most valuable follow-up questions (max 12).`,
  ruleBased: evidenceRuleBased,
};
