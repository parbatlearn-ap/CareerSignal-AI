/** Agent 7 - Personal Brand Strategist: a credible content strategy grounded in real work. */
import { BrandOutputSchema, type BrandOutput } from "../schemas/agents";
import type { EvidenceStatus, Strength } from "../schemas/common";
import { termGrounded } from "../analysis/taxonomy";
import { truncate } from "../analysis/text";
import { json, type AgentDefinition } from "./base";

export interface BrandInput {
  positioning: { name: string; statement: string; audience: string };
  targetRole: string;
  currentRole: string;
  tone: string;
  themes: string[];
  claims: { id: string; text: string; strength: Strength; status: EvidenceStatus }[];
  projects: { name: string; description: string }[];
  revise: { ref: string; issue: string }[];
}

const FORMATS = ["text", "carousel", "case_study", "text", "short_video", "text", "poll", "case_study", "carousel", "text"] as const;

export function brandRuleBased(i: BrandInput): BrandOutput {
  const themes = [...new Set(i.themes)].slice(0, 3);
  while (themes.length < 3) themes.push(["Lessons from real projects", "Learning in public", "How the work gets done"][themes.length]);
  const pillarNames = [...themes, ...(i.targetRole ? [`Moving toward ${i.targetRole}`] : [])].slice(0, 4);
  const RANK = { impact: 3, outcome: 2, output: 1, activity: 0 } as const;
  const usable = i.claims.filter((c) => c.status !== "unsupported").sort((a, b) => RANK[b.strength] - RANK[a.strength]);
  const pillars = pillarNames.map((name, n) => {
    const ids = usable.filter((c) => termGrounded(c.text, name)).slice(0, 3).map((c) => c.id);
    return {
      id: `p-${n + 1}`,
      name,
      pointOfView:
        n === 3
          ? `Share what you are learning about ${i.targetRole} honestly - as a learner, not an expert.`
          : `What practical experience teaches about ${name} that generic advice misses.`,
      evidenceClaimIds: ids,
    };
  });
  const ideas: BrandOutput["postIdeas"] = [];
  for (let n = 0; n < 10; n++) {
    const p = pillars[n % pillars.length];
    const c = usable[n] && usable[n].strength !== "activity" ? usable[n] : null;
    ideas.push({
      id: `idea-${n + 1}`,
      pillarId: p.id,
      format: FORMATS[n],
      title: c ? `What I learned from: ${truncate(c.text, 80)}` : `Example prompt: a question you get asked about ${p.name}`,
      hook: c ? "Describe the problem, what you did, and what changed - only what you can stand behind." : "EXAMPLE ONLY - replace with a real experience before posting.",
      evidenceClaimIds: c ? [c.id] : [],
      isHypotheticalExample: !c,
    });
  }
  const calendar: BrandOutput["calendar"] = Array.from({ length: 30 }, (_, k) => {
    const day = k + 1;
    const postDays = [2, 5, 9, 12, 16, 19, 23, 26, 28, 30];
    const pi = postDays.indexOf(day);
    if (pi >= 0) return { day, activity: "post" as const, postIdeaId: ideas[pi].id, note: `Publish: ${truncate(ideas[pi].title, 70)}` };
    if (day % 7 === 0) return { day, activity: "review" as const, postIdeaId: null, note: "Review what resonated; adjust next week's topics." };
    if (day % 7 === 1 || day % 7 === 4) return { day, activity: "prepare" as const, postIdeaId: null, note: "Draft the next post from a real example." };
    if (day % 7 === 6) return { day, activity: "rest" as const, postIdeaId: null, note: "No activity planned." };
    return { day, activity: "engage" as const, postIdeaId: null, note: "Leave 2-3 thoughtful comments on posts from your target audience." };
  });
  const statementText = `I share practical lessons on ${themes.slice(0, 2).join(" and ")} from real ${i.currentRole ? i.currentRole.toLowerCase() : "project"} work${i.targetRole ? `, for people building toward ${i.targetRole} work` : ""}.`;
  return {
    brandStatement: {
      id: "brand-statement",
      text: statementText,
      evidenceClaimIds: pillars.flatMap((p) => p.evidenceClaimIds).slice(0, 3),
      status: "needs_confirmation",
      explanation: "Public positioning statement - confirm before using.",
    },
    audience: i.positioning.audience,
    pillars,
    postIdeas: ideas,
    calendar,
    toneGuide: [
      i.tone ? `Preferred tone: ${i.tone}.` : "Tone: clear, practical, first-person.",
      "Share specifics from real work; never invent stories or results.",
      "Write as a practitioner and learner, not as an authority you have not yet become.",
      "One idea per post; plain language over jargon.",
    ],
    avoid: [
      "Confidential employer or client details.",
      "Claims of expertise in areas not evidenced in your profile.",
      "Engagement bait, fake polls or automated comments.",
      "Manufactured personal stories.",
    ],
    engagementRoutine: [
      "10 minutes on posting days: reply to every genuine comment.",
      "Twice a week: comment thoughtfully on 2-3 posts from people in your target audience.",
      "Weekly: note one real lesson from your work as a future post.",
    ],
  };
}

export const brandAgent: AgentDefinition<BrandInput, typeof BrandOutputSchema> = {
  id: "brand",
  title: "Personal Brand Strategist Agent",
  responsibility:
    "Turn the approved positioning into a brand statement, audience definition, 3-4 content pillars with a point of view, exactly 10 post ideas, a 30-day calendar, a tone guide, topics to avoid and an engagement routine - grounded in the user's real work.",
  outputSchema: BrandOutputSchema,
  system: `Ground post ideas in the supplied claims and cite them. Any idea not based on a supplied claim must have isHypotheticalExample=true and say it is an example.
Never fabricate first-person stories or results. No spam tactics or engagement manipulation.
calendar must contain days 1..30 exactly once. Use ids "p-1".. for pillars and "idea-1".."idea-10".`,
  buildPrompt: (i) => `Input: ${json(i)}\nCreate the personal-brand strategy.`,
  ruleBased: brandRuleBased,
};
