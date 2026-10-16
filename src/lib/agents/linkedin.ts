/** Agent 6 - LinkedIn Profile Architect: profile copy from the approved positioning and evidence. */
import { LinkedInOutputSchema, type LinkedInOutput, type Statement } from "../schemas/agents";
import type { EvidenceStatus, Strength } from "../schemas/common";
import { asUntrusted } from "../analysis/injection";
import { GENERIC_PHRASES } from "../analysis/claimSafety";
import { termGrounded } from "../analysis/taxonomy";
import { json, type AgentDefinition } from "./base";

export interface LinkedInInput {
  positioning: { name: string; statement: string; headlineDirection: string; doNotClaim: string[]; targetJobFamilies: string[] };
  goals: { currentRole: string; targetRole: string; seniority: string; market: string };
  claims: { id: string; text: string; strength: Strength; status: EvidenceStatus; experienceId: string | null }[];
  experiences: { id: string; title: string; employer: string; start: string | null; end: string | null }[];
  skills: { name: string; classification: string | null; evidenceClaimIds: string[]; jdCount: number }[];
  projects: { name: string; description: string }[];
  domains: string[];
  existingLinkedinText: string;
  /** QA feedback for a single revision cycle. */
  revise: { ref: string; issue: string }[];
}

const RANK: Record<Strength, number> = { impact: 3, outcome: 2, output: 1, activity: 0 };
const st = (id: string, text: string, ids: string[], explanation: string): Statement => ({
  id,
  text,
  evidenceClaimIds: ids,
  status: ids.length ? "supported" : "needs_confirmation",
  explanation,
});
const sentence = (s: string) => {
  const t = s.trim().replace(/[.;,]+$/, "");
  return t.charAt(0).toUpperCase() + t.slice(1) + ".";
};

export function linkedinRuleBased(i: LinkedInInput): LinkedInOutput {
  const usable = i.claims.filter((c) => c.status !== "unsupported").sort((a, b) => RANK[b.strength] - RANK[a.strength]);
  const ranked = [...i.skills]
    .filter((s) => s.classification === "demonstrated" || s.classification === "partially_demonstrated" || s.evidenceClaimIds.length > 0)
    .sort((a, b) => (a.classification === "demonstrated" ? -1 : 0) - (b.classification === "demonstrated" ? -1 : 0) || b.jdCount - a.jdCount);
  const top = ranked.slice(0, 3);
  const topNames = top.map((s) => s.name);
  const topIds = [...new Set(top.flatMap((s) => s.evidenceClaimIds))].slice(0, 4);
  const current = i.goals.currentRole || "Professional";
  const target = i.goals.targetRole;
  const domain = i.domains[0];

  const headlineOptions: Statement[] = [
    st("h-1", `${current}${target ? ` moving into ${target}` : ""} | ${topNames.join(" · ") || "Evidence-backed delivery"}`, topIds, "States current role honestly and signals the target direction."),
    st("h-2", `${current} | ${topNames.join(", ")}${domain ? ` | ${domain}` : ""}`, topIds, "Lower-risk option built on demonstrated skills only."),
    st("h-3", `${topNames.slice(0, 2).join(" & ") || "Analysis"} for ${target || "business"} teams | ${current}`, topIds, "Leads with the value you bring rather than a title."),
  ];

  const proofIds = usable.slice(0, 3).map((c) => c.id);
  const statement = i.positioning.statement;
  const about: Statement[] = [
    st("a-1", sentence(statement), proofIds, "Opens with the approved positioning statement."),
    ...usable.slice(0, 3).map((c, n) => {
      const exp = i.experiences.find((e) => e.id === c.experienceId);
      return st(`a-${n + 2}`, `${exp ? `At ${exp.employer}: ` : ""}${sentence(c.text)}`, [c.id], "Uses your own achievement wording, unchanged.");
    }),
  ];
  // Summarise only skills not already named in the opening statement, to avoid repetition.
  const fresh = topNames.filter((n) => !termGrounded(statement, n));
  if (fresh.length)
    about.push(st(`a-${about.length + 1}`, `I also work with ${fresh.join(", ")}.`, topIds, "Summarises demonstrated skills."));
  if (target)
    about.push({
      id: `a-${about.length + 1}`,
      text: `I am now focused on ${target} opportunities where I can apply this experience.`,
      evidenceClaimIds: [],
      status: "needs_confirmation",
      explanation: "Statement of intent - confirm it reflects what you want to say publicly.",
    });

  const experience = i.experiences.map((e) => ({
    experienceId: e.id,
    bullets: usable
      .filter((c) => c.experienceId === e.id)
      .slice(0, 5)
      .map((c, n) => st(`b-${e.id}-${n + 1}`, sentence(c.text), [c.id], c.strength === "impact" ? "Leads with a measured result." : "Your wording; add a result in the evidence interview to strengthen it.")),
  }));

  const skills = ranked.slice(0, 15).map((s) => ({ name: s.name, evidenceClaimIds: s.evidenceClaimIds }));
  const featured = [
    ...i.projects.slice(0, 3).map((p) => ({ title: p.name, rationale: `Show the project: ${p.description.slice(0, 140)}`, evidenceClaimIds: [] as string[] })),
    ...usable.filter((c) => c.strength === "impact").slice(0, 2).map((c) => ({ title: "Case study", rationale: `Write up: ${c.text.slice(0, 140)}`, evidenceClaimIds: [c.id] })),
  ].slice(0, 5);

  const out: LinkedInOutput = {
    headlineOptions,
    about,
    experience,
    skills,
    featured,
    checklist: [
      "Pick one headline option and paste it into LinkedIn.",
      "Replace your About section, then confirm every statement marked 'Needs confirmation'.",
      "Update experience bullets role by role; keep job titles exactly as held.",
      "Reorder Skills so the first entries match the list above.",
      "Add 1-3 Featured items that show real work (no confidential material).",
      ...i.positioning.doNotClaim.map((d) => `Check: ${d}`),
    ],
    editNotes: [
      "Headline now states your direction instead of a list of duties.",
      "About opens with your chosen positioning and backs it with your own achievements.",
      i.existingLinkedinText ? "Compare with your current LinkedIn text in the Before/After view." : "Paste your current LinkedIn text in Import to see a Before/After comparison.",
    ],
    bannerBrief: `Simple banner: "${topNames.slice(0, 2).join(" · ") || current}" on a plain background; no logos you do not own.`,
  };

  // Revision cycle: remove generic phrasing from statements the QA agent flagged.
  if (i.revise.length) {
    const refs = new Set(i.revise.map((r) => r.ref));
    const clean = (s: Statement) => {
      if (!refs.has(s.id)) return s;
      let t = s.text;
      for (const g of GENERIC_PHRASES) t = t.replace(new RegExp(g, "ig"), "").replace(/\s{2,}/g, " ");
      return { ...s, text: t.trim(), explanation: `${s.explanation} Revised after QA review.` };
    };
    out.headlineOptions = out.headlineOptions.map(clean);
    out.about = out.about.map(clean);
    out.experience = out.experience.map((e) => ({ ...e, bullets: e.bullets.map(clean) }));
  }
  // Skills are only listed with their evidence; never add skills absent from the input.
  out.skills = out.skills.filter((s) => i.skills.some((k) => termGrounded(k.name, s.name)));
  return out;
}

export const linkedinAgent: AgentDefinition<LinkedInInput, typeof LinkedInOutputSchema> = {
  id: "linkedin",
  title: "LinkedIn Profile Architect Agent",
  responsibility:
    "Write headline options, About, Experience bullets, Skills order, Featured recommendations, a banner brief and a checklist that express the user-approved positioning using only evidenced facts.",
  outputSchema: LinkedInOutputSchema,
  system: `Every statement must cite the claim ids it relies on in evidenceClaimIds. If a statement cannot be supported, set status "needs_confirmation" and explain why.
Never use a job title the user has not held as their title. Never add numbers that are not in the cited claims. Avoid keyword stuffing and clichés.
Keep the headline concise (LinkedIn's limit is commonly cited as 220 characters; do not claim an exact limit).
Use ids "h-1".. for headlines, "a-1".. for About paragraphs, "b-<experienceId>-<n>" for bullets.
If "revise" is non-empty, fix exactly those issues and keep everything else stable.`,
  buildPrompt: (i) =>
    `Approved positioning and evidence: ${json({ ...i, existingLinkedinText: undefined })}
${i.existingLinkedinText ? asUntrusted("current_linkedin_text", i.existingLinkedinText) : ""}
Draft the LinkedIn profile.`,
  ruleBased: linkedinRuleBased,
};
