/** Agent 9 - Career Action Planner: a realistic, prioritised 30-day plan. */
import { PlanOutputSchema, type MatchClass, type PlanOutput } from "../schemas/agents";
import { json, type AgentDefinition } from "./base";

export interface PlannerInput {
  targetRole: string;
  hoursPerWeek: number | null;
  gaps: { requirement: string; classification: MatchClass; count: number; total: number }[];
  openQuestions: number;
  statementsNeedingConfirmation: number;
  qaOpenFlags: number;
  brandPostsPlanned: number;
  directionalMarket: boolean;
}

export function plannerRuleBased(i: PlannerInput): PlanOutput {
  const hours = i.hoursPerWeek ?? 4;
  const actions: PlanOutput["actions"] = [];
  const add = (a: Omit<PlanOutput["actions"][number], "id">) => actions.push({ id: `act-${actions.length + 1}`, ...a });

  add({ week: 1, title: "Resolve QA flags and confirm draft statements", category: "profile_edit", effortHours: 1, dependsOn: [], completionCriteria: `${i.qaOpenFlags} open flag(s) and ${i.statementsNeedingConfirmation} statement(s) needing confirmation resolved.`, linkedRequirement: null });
  add({ week: 1, title: "Publish the new headline, About and Skills order", category: "profile_edit", effortHours: 1, dependsOn: ["act-1"], completionCriteria: "LinkedIn profile updated by you, manually.", linkedRequirement: null });
  if (i.openQuestions > 0)
    add({ week: 1, title: `Answer ${Math.min(i.openQuestions, 5)} remaining evidence questions`, category: "gather_evidence", effortHours: 1, dependsOn: [], completionCriteria: "Answers saved; re-run analysis to update claims.", linkedRequirement: null });

  const ranked = [...i.gaps].sort((a, b) => b.count - a.count);
  const partial = ranked.filter((g) => g.classification === "partially_demonstrated" || g.classification === "claimed_but_unsupported").slice(0, 2);
  const missing = ranked.filter((g) => g.classification === "not_evidenced").slice(0, 2);
  partial.forEach((g) =>
    add({ week: 2, title: `Document a concrete ${g.requirement} example (result + how measured)`, category: "gather_evidence", effortHours: 1.5, dependsOn: [], completionCriteria: `One evidence claim for ${g.requirement} with a stated result.`, linkedRequirement: g.requirement }),
  );
  missing.forEach((g, n) =>
    add({ week: n === 0 ? 2 : 3, title: `Check whether you have ${g.requirement} experience; if not, start a small learning task`, category: "develop_skill", effortHours: Math.min(4, Math.max(2, hours / 2)), dependsOn: [], completionCriteria: `Either an evidence claim added, or a learning task completed with notes.`, linkedRequirement: g.requirement }),
  );
  if (missing[0])
    add({ week: 4, title: `Build a small demonstrable project using ${missing[0].requirement}`, category: "demonstrate_project", effortHours: Math.min(6, hours), dependsOn: [], completionCriteria: "Project write-up you can link in Featured (no confidential data).", linkedRequirement: missing[0].requirement });
  if (i.brandPostsPlanned > 0)
    add({ week: 2, title: "Publish the first two planned posts", category: "brand_content", effortHours: 1.5, dependsOn: ["act-2"], completionCriteria: "Two posts published by you, based on real examples.", linkedRequirement: null });
  add({ week: 3, title: `Collect 3-5 more ${i.targetRole || "target-role"} job descriptions and re-run the analysis`, category: "validate_assumption", effortHours: 1, dependsOn: [], completionCriteria: "New version created; compare in Versions.", linkedRequirement: null });
  add({ week: 4, title: "Ask two people in the target role whether the positioning reads credibly", category: "validate_assumption", effortHours: 1.5, dependsOn: ["act-2"], completionCriteria: "Feedback noted; positioning adjusted if needed.", linkedRequirement: null });

  const weekly = [1, 2, 3, 4].map((w) => actions.filter((a) => a.week === w).reduce((s, a) => s + a.effortHours, 0));
  const over = weekly.some((h) => h > hours);
  return {
    actions,
    assumptionsToValidate: [
      i.directionalMarket ? "The supplied job descriptions are too few (or synthetic) to represent the market - collect more." : "The supplied job descriptions represent the roles you will actually apply for.",
      "The chosen positioning reads as credible to people already in the target role.",
      "Requirements marked 'not evidenced' are genuine gaps rather than missing information.",
    ],
    capacityNote: `Planned effort per week: ${weekly.map((h, n) => `W${n + 1} ${h}h`).join(", ")} against ${hours}h available${i.hoursPerWeek === null ? " (assumed - set your hours in Goals)" : ""}.${over ? " Some weeks exceed your stated time; drop lower-priority items." : ""}`,
  };
}

export const plannerAgent: AgentDefinition<PlannerInput, typeof PlanOutputSchema> = {
  id: "planner",
  title: "Career Action Planner Agent",
  responsibility:
    "Convert the approved report into a prioritised 4-week plan that separates profile edits, evidence gathering, skill development, demonstrable projects and market assumptions to validate, within the user's available time.",
  outputSchema: PlanOutputSchema,
  system: `Respect the user's hours per week. Every action needs measurable completion criteria. Use ids "act-1".. and only reference existing ids in dependsOn.
Never schedule automatic posting, applications or outreach - the user performs every external action.`,
  buildPrompt: (i) => `Input: ${json(i)}\nCreate the 30-day action plan.`,
  ruleBased: plannerRuleBased,
};
