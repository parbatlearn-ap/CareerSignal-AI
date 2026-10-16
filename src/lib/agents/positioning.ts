/** Agent 5 - Competitive Positioning Strategist: 2-3 credible, differentiated positioning options. */
import { PositioningOutputSchema, type MatchClass, type PositioningOutput, type PositioningOption } from "../schemas/agents";
import type { Confidence, EvidenceStatus, Strength } from "../schemas/common";
import { json, type AgentDefinition } from "./base";

export interface PositioningInput {
  currentRole: string;
  targetRole: string;
  market: string;
  objective: string;
  domains: string[];
  claims: { id: string; text: string; strength: Strength; status: EvidenceStatus }[];
  gaps: { requirement: string; classification: MatchClass; count: number; total: number; evidenceClaimIds: string[] }[];
}

const RANK: Record<Strength, number> = { impact: 3, outcome: 2, output: 1, activity: 0 };

export function positioningRuleBased(i: PositioningInput): PositioningOutput {
  const byFreq = [...i.gaps].sort((a, b) => b.count - a.count);
  const demonstrated = byFreq.filter((g) => g.classification === "demonstrated");
  const notEvidenced = byFreq.filter((g) => g.classification === "not_evidenced" || g.classification === "claimed_but_unsupported");
  // Frequency-weighted coverage (same weights as the alignment score).
  const W: Record<MatchClass, number | null> = { demonstrated: 1, partially_demonstrated: 0.5, claimed_but_unsupported: 0.25, not_evidenced: 0, not_applicable: null };
  let num = 0;
  let den = 0;
  for (const g of i.gaps) {
    const w = W[g.classification];
    if (w === null || !g.total) continue;
    num += (g.count / g.total) * w;
    den += g.count / g.total;
  }
  const share = den ? num / den : 0;
  const conf: Confidence = share >= 0.6 ? "high" : share >= 0.3 ? "medium" : "low";
  const usable = i.claims.filter((c) => c.status !== "unsupported").sort((a, b) => RANK[b.strength] - RANK[a.strength]);
  const proofFor = (reqs: typeof demonstrated) => {
    const ids = new Set<string>();
    reqs.forEach((r) => r.evidenceClaimIds.forEach((id) => ids.add(id)));
    const ranked = usable.filter((c) => ids.has(c.id));
    return (ranked.length ? ranked : usable).slice(0, 4).map((c) => c.id);
  };
  const top = demonstrated.slice(0, 3).map((g) => g.requirement);
  const strengthsList = top.length ? top.join(", ") : "your documented experience";
  const domain = i.domains[0];
  const current = i.currentRole || "Professional";
  const target = i.targetRole || "your target role";
  const risksFor = (n: number) =>
    notEvidenced.slice(0, n).map((g) => `${g.requirement} is in ${g.count} of ${g.total} supplied JDs but not evidenced in your material.`);
  const stretch = share < 0.5;

  const options: PositioningOption[] = [
    {
      id: "opt-bridge",
      name: `Bridge: ${current} → ${target}`,
      statement: `${current} moving into ${target} work, bringing hands-on ${strengthsList}${domain ? ` in ${domain}` : ""}.`,
      audience: `Hiring managers for ${target} roles${i.market ? ` in ${i.market}` : ""} who value practical delivery experience.`,
      targetJobFamilies: [target],
      proofPointClaimIds: proofFor(demonstrated),
      strengths: top.map((t) => `Evidence of ${t} in your own work.`),
      risks: [...risksFor(3), ...(stretch ? [`Frequency-weighted coverage of supplied requirements is ${Math.round(share * 100)}% - this is a stretch move.`] : [])],
      tradeOffs: ["Signals ambition clearly, but some recruiters may screen for prior experience in the exact title."],
      headlineDirection: `${target} focus + your strongest evidenced skills${domain ? ` + ${domain}` : ""}`,
      doNotClaim: [`Do not use the title "${target}" as a current or past job title unless you held it.`, ...notEvidenced.slice(0, 2).map((g) => `Do not claim ${g.requirement} expertise without an example.`)],
      stretch,
      confidence: stretch ? (conf === "high" ? "medium" : "low") : conf,
      confidenceReason: `${demonstrated.length} of ${i.gaps.length} supplied requirements demonstrated; frequency-weighted coverage ${Math.round(share * 100)}%.`,
    },
    {
      id: "opt-deepen",
      name: `Specialist: ${current} with a sharper edge`,
      statement: `${current} known for ${strengthsList}, applying them to the problems ${target} teams care about.`,
      audience: `Teams hiring for ${current} and adjacent roles where your current evidence is strongest.`,
      targetJobFamilies: [current, `${target} (adjacent)`],
      proofPointClaimIds: proofFor(demonstrated),
      strengths: ["Lowest credibility risk: built on what you have already done.", ...top.slice(0, 2).map((t) => `${t} is directly evidenced.`)],
      risks: ["May under-signal your move toward the target role.", ...risksFor(1)],
      tradeOffs: ["Safer and more credible today; slower route to the target title."],
      headlineDirection: `${current} + 2-3 evidenced specialities`,
      doNotClaim: ["Do not inflate your current level or scope."],
      stretch: false,
      confidence: conf === "low" ? "medium" : "high",
      confidenceReason: "Relies mainly on your existing, evidenced work.",
    },
  ];
  if (domain) {
    options.push({
      id: "opt-domain",
      name: `Domain-led: ${domain} + ${target}`,
      statement: `${domain} specialist who combines domain knowledge with ${strengthsList} to support ${target} work.`,
      audience: `${domain} organisations hiring for ${target} or adjacent roles.`,
      targetJobFamilies: [`${target} (${domain})`],
      proofPointClaimIds: proofFor(demonstrated),
      strengths: [`Domain knowledge in ${domain} is visible in your material.`, "Narrower but more distinctive niche."],
      risks: ["Narrows the set of target employers.", ...risksFor(1)],
      tradeOffs: ["Higher differentiation inside the domain; less portable across industries."],
      headlineDirection: `${domain} + ${target} focus`,
      doNotClaim: [`Do not claim expertise in other industries beyond ${i.domains.join(", ")}.`],
      stretch,
      confidence: conf,
      confidenceReason: `Domain evidence present; ${demonstrated.length} of ${i.gaps.length} requirements demonstrated.`,
    });
  }
  const transition = ["transition_role", "explore_directions", "understand_gaps"].includes(i.objective);
  const recommended = transition && share >= 0.35 ? "opt-bridge" : domain && share >= 0.35 ? "opt-domain" : "opt-deepen";
  return {
    options,
    recommendedOptionId: recommended,
    recommendationReason:
      recommended === "opt-bridge"
        ? "Your evidence covers enough of the supplied requirements to make the move credible."
        : recommended === "opt-domain"
          ? "Your domain evidence is the most distinctive angle available."
          : "Your evidence does not yet cover enough target requirements; build on proven strengths first.",
  };
}

export const positioningAgent: AgentDefinition<PositioningInput, typeof PositioningOutputSchema> = {
  id: "positioning",
  title: "Competitive Positioning Strategist Agent",
  responsibility:
    "Propose 2-3 differentiated positioning options at the intersection of proven experience, credible ambition and supplied-JD demand, each with proof points, trade-offs, risk flags and what not to claim; recommend one.",
  outputSchema: PositioningOutputSchema,
  system: `proofPointClaimIds must be ids from the supplied claims. Do not claim knowledge of competitors or of what "all candidates" do; frame comparisons as market positioning hypotheses.
Mark stretch=true when the target role is a stretch given the evidence. Do not force a career transition if evidence is insufficient.
Use option ids "opt-1", "opt-2", "opt-3".`,
  buildPrompt: (i) => `Input: ${json(i)}\nPropose positioning options.`,
  ruleBased: positioningRuleBased,
};
