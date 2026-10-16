/**
 * Transparent heuristic scoring (PRD section 9). Every component is a pure,
 * reproducible rule over workspace data. Components return null
 * ("insufficient data") rather than guessing.
 *
 * These are diagnostic heuristics - NOT probabilities of recruiter views,
 * interviews, offers or jobs, and NOT compared with any population benchmark.
 */
import { MIN_COVERED_WEIGHT, SCORE_WEIGHTS, SCORING_VERSION, type ScoreKey } from "../config";
import type { MatchClass } from "../schemas/agents";
import type { ScoreComponent, ScoreReport, Workspace } from "../schemas/workspace";
import { checkConsistency } from "./consistency";
import { keyRequirements } from "./market";
import { aboutText, profileText, proseText, selectedHeadline } from "./profileText";
import { keywordStuffing } from "./claimSafety";
import { termGrounded } from "./taxonomy";
import { containsTerm } from "./text";

export const STRENGTH_WEIGHT = { activity: 0.25, output: 0.5, outcome: 0.75, impact: 1 } as const;
export const STATUS_WEIGHT = {
  verified_by_user: 1,
  user_provided: 0.85,
  inferred_needs_confirmation: 0.4,
  unsupported: 0,
} as const;
export const MATCH_WEIGHT: Record<MatchClass, number | null> = {
  demonstrated: 1,
  partially_demonstrated: 0.5,
  claimed_but_unsupported: 0.25,
  not_evidenced: 0,
  not_applicable: null,
};

const LABELS: Record<ScoreKey, string> = {
  completeness: "Profile completeness",
  alignment: "Target-role alignment",
  evidence: "Evidence strength",
  searchTerms: "Search-term coverage",
  coherence: "Career narrative coherence",
  differentiation: "Differentiation",
  brand: "Personal-brand readiness",
};

type Result = { score: number | null; reasons: string[]; formula: string };

const round = (n: number) => Math.round(Math.max(0, Math.min(100, n)));

export function scoreCompleteness(ws: Workspace): Result {
  const formula = "checks passed / checks total x 100";
  if (!ws.profile) return { score: null, reasons: ["No career profile yet."], formula };
  const p = ws.profile;
  const checks: [string, boolean][] = [
    ["Target role set", Boolean(ws.goals?.targetRole)],
    ["At least one role with dates", p.experiences.some((e) => e.start)],
    ["At least 5 skills", p.skills.length >= 5],
    ["At least 3 evidence claims", ws.claims.length >= 3],
    ["Education listed", p.education.length > 0],
    ["Projects or certifications listed", p.projects.length + p.certifications.length > 0],
    ["At least one job description", ws.inputs.jobDescriptions.length > 0],
    ["LinkedIn draft generated", Boolean(ws.linkedin)],
  ];
  const passed = checks.filter(([, ok]) => ok).length;
  return {
    score: round((passed / checks.length) * 100),
    reasons: checks.map(([l, ok]) => `${ok ? "✓" : "✗"} ${l}`),
    formula,
  };
}

export function scoreAlignment(ws: Workspace): Result {
  const formula =
    "Σ(JD frequency × match weight) / Σ(JD frequency); weights: demonstrated 1, partial 0.5, claimed-but-unsupported 0.25, not evidenced 0";
  if (!ws.market || ws.market.sampleSize === 0) return { score: null, reasons: ["No job descriptions analysed."], formula };
  if (!ws.gaps || ws.gaps.length === 0) return { score: null, reasons: ["Gap analysis not run yet."], formula };
  let num = 0;
  let den = 0;
  const tally: Record<string, number> = {};
  for (const r of ws.gaps) {
    const w = MATCH_WEIGHT[r.classification];
    tally[r.classification] = (tally[r.classification] ?? 0) + 1;
    if (w === null) continue;
    const f = r.total ? r.count / r.total : 0;
    num += f * w;
    den += f;
  }
  if (den === 0) return { score: null, reasons: ["No applicable requirements."], formula };
  return {
    score: round((num / den) * 100),
    reasons: [
      `${ws.market.sampleSize} job description(s) analysed.`,
      ...Object.entries(tally).map(([k, v]) => `${v} requirement(s) ${k.replace(/_/g, " ")}`),
    ],
    formula,
  };
}

export function scoreEvidence(ws: Workspace): Result {
  const formula =
    "mean(strength weight × status weight) over claims; strength: activity .25, output .5, outcome .75, impact 1; status: verified 1, user-provided .85, inferred .4, unsupported 0";
  if (ws.claims.length < 3) return { score: null, reasons: [`Only ${ws.claims.length} claim(s); need at least 3.`], formula };
  const vals = ws.claims.map((c) => STRENGTH_WEIGHT[c.strength] * STATUS_WEIGHT[c.status]);
  const withMetric = ws.claims.filter((c) => c.metrics.length > 0).length;
  return {
    score: round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100),
    reasons: [
      `${ws.claims.length} claims; ${withMetric} include a user-supplied measure.`,
      `${ws.claims.filter((c) => c.status === "verified_by_user").length} verified by you.`,
    ],
    formula,
  };
}

export function scoreSearchTerms(ws: Workspace): Result {
  const formula = "key supplied-JD terms present in draft / key terms × 100; × 0.7 if keyword stuffing detected";
  if (!ws.market || ws.market.sampleSize === 0) return { score: null, reasons: ["No job descriptions analysed."], formula };
  if (!ws.linkedin) return { score: null, reasons: ["No LinkedIn draft yet."], formula };
  const keys = keyRequirements(ws.market);
  if (keys.length === 0) return { score: null, reasons: ["No recurring terms found."], formula };
  const text = profileText(ws);
  const present = keys.filter((k) => termGrounded(text, k.term));
  const stuffing = keywordStuffing(proseText(ws));
  let s = (present.length / keys.length) * 100;
  if (stuffing.stuffed) s *= 0.7;
  return {
    score: round(s),
    reasons: [
      `${present.length} of ${keys.length} key terms present.`,
      stuffing.stuffed ? `Keyword stuffing penalty applied (${stuffing.repeated.join(", ") || "high density"}).` : "No keyword stuffing detected.",
      "Coverage does not predict recruiter discovery.",
    ],
    formula,
  };
}

export function scoreCoherence(ws: Workspace): Result {
  const formula =
    "100 − 20 (headline lacks target role) − 15 (About lacks target role) − 10 per major / 5 per minor consistency flag (max −40)";
  if (!ws.linkedin || !ws.positioning?.selectedOptionId)
    return { score: null, reasons: ["Needs a selected positioning and a LinkedIn draft."], formula };
  const target = ws.goals?.targetRole ?? "";
  const words = target.split(/[\s/,&-]+/).filter((w) => w.length > 2);
  const headline = selectedHeadline(ws) ?? "";
  const about = aboutText(ws);
  const reasons: string[] = [];
  let s = 100;
  if (words.length && !words.some((w) => containsTerm(headline, w))) {
    s -= 20;
    reasons.push("Headline does not mention the target role.");
  }
  if (words.length && !words.some((w) => containsTerm(about, w))) {
    s -= 15;
    reasons.push("About section does not mention the target role.");
  }
  const flags = checkConsistency(ws.profile?.experiences ?? [], ws.inputs.existingLinkedinText);
  const pen = Math.min(40, flags.reduce((a, f) => a + (f.severity === "major" ? 10 : 5), 0));
  if (pen) reasons.push(`${flags.length} consistency flag(s): −${pen}.`);
  s -= pen;
  if (reasons.length === 0) reasons.push("Headline, About and history tell a consistent story.");
  return { score: round(s), reasons, formula };
}

export function scoreDifferentiation(ws: Workspace): Result {
  const formula =
    "70 × min(1, strong proof points / 3) + 15 if 'what not to claim' is defined + 15 if statement combines ≥2 evidenced themes";
  const pos = ws.positioning;
  const opt = pos?.options.find((o) => o.id === pos.selectedOptionId);
  if (!opt) return { score: null, reasons: ["No positioning selected."], formula };
  const strong = opt.proofPointClaimIds
    .map((id) => ws.claims.find((c) => c.id === id))
    .filter((c) => c && (c.strength === "outcome" || c.strength === "impact") && c.status !== "unsupported").length;
  let s = 70 * Math.min(1, strong / 3);
  if (opt.doNotClaim.length > 0) s += 15;
  const statement = pos?.editedStatement ?? opt.statement;
  const themes = [...(ws.profile?.domains ?? []), ...(ws.profile?.skills ?? []).map((k) => k.name)].filter((t) =>
    termGrounded(statement, t),
  );
  if (new Set(themes).size >= 2) s += 15;
  return {
    score: round(s),
    reasons: [`${strong} outcome/impact-level proof point(s).`, `Themes combined in statement: ${[...new Set(themes)].join(", ") || "none"}.`],
    formula,
  };
}

export function scoreBrand(ws: Workspace): Result {
  const formula = "checks passed / 7 × 100";
  const b = ws.brand;
  if (!b) return { score: null, reasons: ["No brand strategy yet."], formula };
  const checks: [string, boolean][] = [
    ["Audience defined", b.audience.trim().length > 0],
    ["Brand statement", b.brandStatement.text.trim().length > 0 && b.brandStatement.status !== "excluded"],
    ["3-4 content pillars", b.pillars.length >= 3 && b.pillars.length <= 4],
    ["Pillars have a point of view", b.pillars.every((p) => p.pointOfView.trim().length > 0)],
    ["10 post ideas", b.postIdeas.length === 10],
    ["30-day calendar", b.calendar.length === 30],
    ["At least 5 ideas grounded in evidence", b.postIdeas.filter((p) => p.evidenceClaimIds.length > 0).length >= 5],
  ];
  return {
    score: round((checks.filter(([, ok]) => ok).length / checks.length) * 100),
    reasons: checks.map(([l, ok]) => `${ok ? "✓" : "✗"} ${l}`),
    formula,
  };
}

const SCORERS: Record<ScoreKey, (ws: Workspace) => Result> = {
  completeness: scoreCompleteness,
  alignment: scoreAlignment,
  evidence: scoreEvidence,
  searchTerms: scoreSearchTerms,
  coherence: scoreCoherence,
  differentiation: scoreDifferentiation,
  brand: scoreBrand,
};

export function computeScores(ws: Workspace, now = new Date()): ScoreReport {
  const components: ScoreComponent[] = (Object.keys(SCORE_WEIGHTS) as ScoreKey[]).map((k) => {
    const r = SCORERS[k](ws);
    return { id: k, label: LABELS[k], weight: SCORE_WEIGHTS[k], basis: "rule", ...r };
  });
  const covered = components.filter((c) => c.score !== null);
  const coveredWeight = covered.reduce((a, c) => a + c.weight, 0);
  const overall =
    coveredWeight >= MIN_COVERED_WEIGHT
      ? Math.round(covered.reduce((a, c) => a + c.weight * (c.score as number), 0) / coveredWeight)
      : null;
  const jdCount = ws.market?.sampleSize ?? 0;
  const caveats = [
    "Heuristic assessment: a diagnostic of your material, not a probability of interviews, offers or recruiter views.",
    `Based on ${jdCount} job description(s) you supplied; no population benchmark is used.`,
    "Weights are initial hypotheses (version " + SCORING_VERSION + ") and may change after user testing.",
  ];
  if (overall === null)
    caveats.push(`Overall score withheld: only ${Math.round(coveredWeight * 100)}% of component weight has enough data.`);
  else if (coveredWeight < 1)
    caveats.push(`Overall score covers ${Math.round(coveredWeight * 100)}% of component weight; missing components are excluded, not zeroed.`);
  if (ws.market?.syntheticCount) caveats.push("Includes SYNTHETIC demo job descriptions - not real market data.");
  return { version: SCORING_VERSION, components, overall, coveredWeight, jdCount, caveats, computedAt: now.toISOString() };
}
