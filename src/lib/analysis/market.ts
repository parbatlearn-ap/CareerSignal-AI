/**
 * Deterministic job-description aggregation. Frequencies are computed only
 * from the supplied JDs; every count carries its denominator.
 */
import type { JobDescription } from "../schemas/inputs";
import type { MarketExtraction } from "../schemas/agents";
import type { MarketAnalysis, MarketRequirement } from "../schemas/workspace";
import { MIN_JDS_FOR_MARKET_VIEW, MIN_JDS_FOR_PERCENT } from "../config";
import { canonicalize, findTerms, kindOf, termGrounded } from "./taxonomy";

type Kind = MarketRequirement["kind"];

export function aggregateMarket(
  jds: JobDescription[],
  extraction: MarketExtraction,
): MarketAnalysis {
  const byId = new Map(jds.map((j) => [j.id, j]));
  const dropped = new Set<string>();
  const counts = new Map<string, { jdIds: Set<string>; kinds: Map<Kind, number> }>();

  const perJd = extraction.perJd.filter((p) => byId.has(p.jdId));
  const add = (term: string, kind: Kind, jdId: string, jdText: string) => {
    const t = canonicalize(term);
    if (!t) return;
    if (!termGrounded(jdText, t) && !termGrounded(jdText, term)) {
      dropped.add(term);
      return;
    }
    const e = counts.get(t) ?? { jdIds: new Set<string>(), kinds: new Map<Kind, number>() };
    e.jdIds.add(jdId);
    e.kinds.set(kind, (e.kinds.get(kind) ?? 0) + 1);
    counts.set(t, e);
  };

  for (const p of perJd) {
    const text = byId.get(p.jdId)!.text;
    p.required.forEach((t) => add(t, "required", p.jdId, text));
    p.preferred.forEach((t) => add(t, "preferred", p.jdId, text));
    p.tools.forEach((t) => add(t, "tool", p.jdId, text));
    p.domainKnowledge.forEach((t) => add(t, "domain", p.jdId, text));
    p.credentialRequirements.forEach((t) => {
      // Credential lines may be sentences; keep only taxonomy credentials that are grounded.
      findTerms(t, ["credential"]).forEach((c) => add(c.canonical, "credential", p.jdId, text));
    });
    // Deterministic, grounded taxonomy pass so repeated terminology is never missed.
    for (const term of findTerms(text)) {
      const k: Kind =
        term.kind === "tool"
          ? "tool"
          : term.kind === "domain"
            ? "domain"
            : term.kind === "leadership"
              ? "leadership"
              : term.kind === "credential"
                ? "credential"
                : "preferred";
      const existing = counts.get(term.canonical);
      if (!existing || !existing.jdIds.has(p.jdId)) add(term.canonical, k, p.jdId, text);
    }
  }

  const total = perJd.length;
  const requirements: MarketRequirement[] = [...counts.entries()]
    .map(([term, e]) => ({
      term,
      kind: pickKind(term, e.kinds),
      count: e.jdIds.size,
      total,
      jdIds: [...e.jdIds],
    }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));

  const seniorityCounts: Record<string, number> = {};
  perJd.forEach((p) => (seniorityCounts[p.seniority] = (seniorityCounts[p.seniority] ?? 0) + 1));

  const syntheticCount = perJd.filter((p) => byId.get(p.jdId)!.synthetic).length;
  const limitations: string[] = [
    `Based only on ${total} job description${total === 1 ? "" : "s"} you supplied - not a market-wide sample.`,
  ];
  if (total < MIN_JDS_FOR_MARKET_VIEW)
    limitations.push(`Fewer than ${MIN_JDS_FOR_MARKET_VIEW} job descriptions: treat all findings as directional.`);
  if (total < MIN_JDS_FOR_PERCENT)
    limitations.push(`Percentages are hidden below ${MIN_JDS_FOR_PERCENT} job descriptions; counts are shown as "n of N".`);
  if (syntheticCount > 0)
    limitations.push(`${syntheticCount} of ${total} job descriptions are SYNTHETIC demo data and are not real market evidence.`);
  if (dropped.size > 0)
    limitations.push(`${dropped.size} extracted term(s) were dropped because they do not appear in the job-description text.`);

  return {
    perJd,
    requirements,
    seniorityCounts,
    sampleSize: total,
    directional: total < MIN_JDS_FOR_MARKET_VIEW || syntheticCount > 0,
    syntheticCount,
    droppedUngroundedTerms: [...dropped],
    limitations,
    sources: perJd.map((p) => {
      const j = byId.get(p.jdId)!;
      return {
        jdId: j.id,
        title: j.title,
        company: j.company,
        source: j.source,
        providedAt: j.providedAt,
        synthetic: j.synthetic,
      };
    }),
  };
}

function pickKind(term: string, kinds: Map<Kind, number>): Kind {
  if (kinds.has("credential")) return "credential";
  if (kinds.has("required")) return "required";
  const tk = kindOf(term);
  if (tk === "tool") return "tool";
  if (tk === "domain") return "domain";
  if (tk === "leadership") return "leadership";
  let best: Kind = "preferred";
  let n = 0;
  kinds.forEach((v, k) => {
    if (v > n) {
      n = v;
      best = k;
    }
  });
  return best;
}

/** Format a frequency honestly: percentage only when the sample is large enough. */
export function formatFrequency(count: number, total: number): string {
  if (total === 0) return "no data";
  if (total >= MIN_JDS_FOR_PERCENT) return `${count} of ${total} (${Math.round((count / total) * 100)}%)`;
  return `${count} of ${total}`;
}

/** The requirements most worth matching: recurring ones first, capped. */
export function keyRequirements(market: MarketAnalysis, limit = 15): MarketRequirement[] {
  const recurring = market.requirements.filter((r) => r.count >= 2 || market.sampleSize === 1);
  return (recurring.length >= 5 ? recurring : market.requirements).slice(0, limit);
}
