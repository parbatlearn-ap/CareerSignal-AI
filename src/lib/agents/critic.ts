/**
 * Agent 8 - Critic / Evidence / QA. This module is the model-assisted part of
 * QA (judgement checks such as overconfidence and contradictions). The
 * orchestrator combines it with deterministic rule checks (see orchestrator/qa.ts),
 * which run in every provider mode and cannot be overridden by the model.
 */
import { CriticOutputSchema, type CriticOutput } from "../schemas/agents";
import { json, type AgentDefinition } from "./base";

export interface CriticInput {
  statements: { ref: string; area: "linkedin" | "brand"; text: string; status: string; citedEvidence: string[] }[];
  positioning: { name: string; statement: string; stretch: boolean; doNotClaim: string[] } | null;
  market: { sampleSize: number; syntheticCount: number } | null;
  targetRole: string;
  heldTitles: string[];
}

const OVERCONFIDENT = /\b(guarantee[sd]?|always deliver|best in the industry|top 1%|#1|number one|unmatched|world'?s best|leading expert)\b/i;

export function criticRuleBased(i: CriticInput): CriticOutput {
  const flags: CriticOutput["flags"] = [];
  for (const s of i.statements) {
    if (OVERCONFIDENT.test(s.text))
      flags.push({ area: s.area, targetRef: s.ref, severity: "major", category: "overconfidence", message: "Overconfident wording that the evidence cannot back." });
    if (
      i.targetRole &&
      !i.heldTitles.some((t) => t.toLowerCase() === i.targetRole.toLowerCase()) &&
      new RegExp(`\\b(as an?|I am an?|currently an?)\\s+${i.targetRole.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(s.text)
    )
      flags.push({ area: s.area, targetRef: s.ref, severity: "critical", category: "seniority", message: `Implies you currently hold the title "${i.targetRole}", which is not in your history.` });
  }
  if (i.market && i.market.syntheticCount > 0)
    flags.push({ area: "market", targetRef: null, severity: "minor", category: "missing_caveat", message: "Market findings include synthetic demo job descriptions; keep the synthetic label on any export." });
  if (i.positioning?.stretch)
    flags.push({ area: "positioning", targetRef: null, severity: "minor", category: "missing_caveat", message: "Selected positioning is a stretch; keep the risk notes visible and avoid implying the move is complete." });
  return {
    flags,
    summary: flags.length ? `${flags.length} judgement issue(s) found by the QA review.` : "No additional judgement issues found.",
  };
}

export const criticAgent: AgentDefinition<CriticInput, typeof CriticOutputSchema> = {
  id: "critic",
  title: "Critic / Evidence / QA Agent",
  responsibility:
    "Independently audit generated statements for unsupported claims, invented metrics, implied titles or credentials, contradictions, generic language, keyword stuffing, overconfidence and missing caveats. Report issues; do not rewrite content.",
  outputSchema: CriticOutputSchema,
  system: `Be strict and specific. targetRef must be a statement ref from the input (or null for report-level issues).
"critical" = would mislead an employer (invented metric, title, credential, employer, project). "major" = overstated or unsupported. "minor" = style or caveat.
Do not flag statements merely for being "needs_confirmation" - that status already informs the user.`,
  buildPrompt: (i) => `Audit this draft: ${json(i)}`,
  ruleBased: criticRuleBased,
};
