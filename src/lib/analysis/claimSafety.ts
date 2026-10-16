/**
 * Claim Safety Check - deterministic detection of unsupported metrics,
 * credentials, seniority/expertise claims, generic language and keyword
 * stuffing in generated text. Applied to every generated statement in every
 * provider mode, so an LLM cannot slip an invented number past the UI.
 */
import type { EvidenceClaim } from "../schemas/workspace";
import type { StatementStatus } from "../schemas/common";
import { findTerms } from "./taxonomy";
import { containsTerm, normalize, unsupportedNumbers } from "./text";

export interface SafetyIssue {
  category: "invented_metric" | "credential" | "seniority" | "generic_language" | "keyword_stuffing" | "unsupported_claim";
  severity: "critical" | "major" | "minor";
  message: string;
}

const SENIORITY_TERMS = [
  "senior",
  "lead",
  "principal",
  "head of",
  "director",
  "vice president",
  "vp",
  "chief",
  "manager",
  "expert",
  "thought leader",
  "veteran",
  "guru",
  "world-class",
  "award-winning",
];

export const GENERIC_PHRASES = [
  "results-driven",
  "results driven",
  "passionate about",
  "dynamic professional",
  "detail-oriented",
  "team player",
  "go-getter",
  "synergy",
  "think outside the box",
  "hard-working",
  "self-starter",
  "proven track record",
  "best-in-class",
  "rockstar",
  "ninja",
  "visionary",
];

/**
 * Check one generated statement against the evidence it cites and the
 * user's full source corpus (resume + interview answers + pasted profile).
 */
export function checkStatement(
  text: string,
  cited: EvidenceClaim[],
  corpus: string,
  /** User-stated phrases (e.g. their target role) that express intent, not a claim. */
  intentPhrases: string[] = [],
): SafetyIssue[] {
  const issues: SafetyIssue[] = [];
  const citedText = cited.map((c) => `${c.text} ${c.sourceText}`).join(" \n ");
  const evidence = cited.length > 0 ? citedText : corpus;

  const badNums = unsupportedNumbers(text, evidence);
  if (badNums.length > 0) {
    issues.push({
      category: "invented_metric",
      severity: "critical",
      message: `Number(s) not found in the cited evidence: ${badNums.join(", ")}`,
    });
  }

  for (const cred of findTerms(text, ["credential"])) {
    if (![cred.canonical, ...cred.aliases].some((a) => containsTerm(corpus, a))) {
      issues.push({
        category: "credential",
        severity: "critical",
        message: `Credential "${cred.canonical}" does not appear in your material.`,
      });
    }
  }

  let seniorityText = text;
  for (const ph of intentPhrases.filter((x) => x.trim().length > 2))
    seniorityText = seniorityText.replace(new RegExp(ph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
  for (const s of SENIORITY_TERMS) {
    if (containsTerm(seniorityText, s) && !containsTerm(corpus, s)) {
      issues.push({
        category: "seniority",
        severity: "major",
        message: `"${s}" implies a level or expertise not stated in your material.`,
      });
    }
  }

  for (const g of GENERIC_PHRASES) {
    if (normalize(text).includes(g)) {
      issues.push({ category: "generic_language", severity: "minor", message: `Generic phrase: "${g}".` });
    }
  }
  return issues;
}

/**
 * Deterministic statement status:
 * - excluded stays excluded;
 * - user-approved is supported (the user vouched for it);
 * - any critical/major safety issue -> needs_confirmation;
 * - no valid evidence -> needs_confirmation;
 * - cited evidence that is itself unsupported -> needs_confirmation.
 */
export function deriveStatus(
  current: { status: StatementStatus; userApproved?: boolean },
  cited: EvidenceClaim[],
  issues: SafetyIssue[],
): StatementStatus {
  if (current.status === "excluded") return "excluded";
  if (current.userApproved) return "supported";
  if (issues.some((i) => i.severity !== "minor")) return "needs_confirmation";
  if (cited.length === 0) return "needs_confirmation";
  if (cited.some((c) => c.status === "unsupported" || c.status === "inferred_needs_confirmation"))
    return "needs_confirmation";
  return "supported";
}

/** Keyword stuffing: share of words that are taxonomy terms, and per-term repetition. */
export function keywordStuffing(text: string): { density: number; repeated: string[]; stuffed: boolean } {
  const words = normalize(text).split(/\s+/).filter(Boolean).length || 1;
  const terms = findTerms(text);
  const repeated: string[] = [];
  let hits = 0;
  for (const t of terms) {
    let n = 0;
    for (const a of [t.canonical, ...t.aliases]) {
      const re = new RegExp(`(?<![a-z0-9])${a.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`, "gi");
      n += (normalize(text).match(re) ?? []).length;
    }
    hits += n;
    if (n > 4) repeated.push(t.canonical);
  }
  const density = hits / words;
  return { density, repeated, stuffed: (words >= 40 && density > 0.3) || repeated.length > 0 };
}
