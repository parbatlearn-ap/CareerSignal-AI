/** Agent 4 - Skills & Gap Analyst: compare evidenced capability with supplied-JD requirements. */
import { GapOutputSchema, type GapOutput, type MatchClass } from "../schemas/agents";
import type { EvidenceStatus, Strength } from "../schemas/common";
import { kindOf, termGrounded } from "../analysis/taxonomy";
import { VAGUE } from "./evidence";
import { json, type AgentDefinition } from "./base";

export interface GapInput {
  requirements: { term: string; kind: string; count: number; total: number }[];
  claims: { id: string; text: string; strength: Strength; status: EvidenceStatus; experienceId: string | null }[];
  listedSkills: string[];
  experiences: { id: string; title: string; employer: string }[];
}

export function gapRuleBased(input: GapInput): GapOutput {
  return {
    rows: input.requirements.map((r) => {
      const isDomain = r.kind === "domain" || kindOf(r.term) === "domain";
      // Domain knowledge can be evidenced by where you worked, not only by what a bullet says.
      const domainExps = isDomain ? input.experiences.filter((e) => termGrounded(`${e.employer} ${e.title}`, r.term)) : [];
      const hits = input.claims.filter(
        (c) => c.status !== "unsupported" && (termGrounded(c.text, r.term) || (c.experienceId !== null && domainExps.some((e) => e.id === c.experienceId))),
      );
      const strong = hits.filter((c) => c.strength !== "activity" && !VAGUE.test(c.text));
      const listed = input.listedSkills.some((s) => termGrounded(s, r.term) || termGrounded(r.term, s));
      let classification: MatchClass;
      let rationale: string;
      let nextAction: string;
      if (strong.length > 0) {
        classification = "demonstrated";
        rationale = domainExps.length
          ? `Worked in ${r.term} at ${domainExps.map((e) => e.employer).join(", ")}, with ${strong.length} supporting claim(s).`
          : `${strong.length} claim(s) show output or results using ${r.term}.`;
        nextAction = `Feature the strongest ${r.term} example in your headline or About.`;
      } else if (hits.length > 0) {
        classification = "partially_demonstrated";
        rationale = `Mentioned in ${hits.length} claim(s), but only as an activity or with vague wording, without a clear result.`;
        nextAction = `Add the result of your ${r.term} work in the evidence interview.`;
      } else if (listed) {
        classification = "claimed_but_unsupported";
        rationale = `Listed as a skill, but no achievement in your material shows it in use.`;
        nextAction = `Add one concrete example of using ${r.term}, or drop it from the skills list.`;
      } else {
        classification = "not_evidenced";
        rationale = `Not evidenced in the supplied material. This does not mean you lack it.`;
        nextAction = `If you have ${r.term} experience, add an example; otherwise consider a small learning project.`;
      }
      return {
        requirement: r.term,
        classification,
        evidenceClaimIds: (strong.length ? strong : hits).slice(0, 5).map((c) => c.id),
        rationale,
        confidence: strong.length >= 2 ? "high" : hits.length > 0 || listed ? "medium" : "low",
        nextAction,
      };
    }),
  };
}

export const gapAgent: AgentDefinition<GapInput, typeof GapOutputSchema> = {
  id: "gap",
  title: "Skills & Gap Analyst Agent",
  responsibility:
    "Classify each supplied-JD requirement against the user's evidence as demonstrated, partially demonstrated, claimed but unsupported, not evidenced, or not applicable, with the supporting claim ids and a next action. Do not write profile copy.",
  outputSchema: GapOutputSchema,
  system: `"demonstrated" requires at least one cited claim id showing the requirement in use with an output or result.
Missing evidence is NOT proof the user lacks the skill: use "not_evidenced" and say "not evidenced in supplied material".
Return exactly one row per requirement, using the requirement text unchanged. Only cite claim ids from the input.`,
  buildPrompt: (i) =>
    `Requirements (with how many supplied JDs mention each): ${json(i.requirements)}
Evidence claims: ${json(i.claims)}
Skills the user listed: ${json(i.listedSkills)}
Roles held (domain evidence): ${json(i.experiences)}
Produce the requirement-by-requirement matrix.`,
  ruleBased: gapRuleBased,
};
