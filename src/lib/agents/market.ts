/** Agent 3 - Market Intelligence: extract requirements from supplied job descriptions only. */
import { MarketExtractionSchema, type MarketExtraction } from "../schemas/agents";
import { asUntrusted } from "../analysis/injection";
import { findTerms } from "../analysis/taxonomy";
import { lines, stripBullet } from "../analysis/text";
import { json, type AgentDefinition } from "./base";

export interface MarketInput {
  targetRole: string;
  market: string;
  jds: { id: string; title: string; text: string }[];
}

const PREFERRED_HDR = /^(preferred|nice to have|good to have|bonus|desirable|plus)\b/i;
const REQUIRED_HDR = /^(requirements?|must have|required|qualifications|what you('ll)? (need|bring)|who you are|skills)\b/i;
const RESP_HDR = /^(responsibilities|what you('ll)? do|the role|key responsibilities|role overview|you will)\b/i;

export function marketRuleBased(input: MarketInput): MarketExtraction {
  return {
    perJd: input.jds.map((jd) => {
      const ls = lines(jd.text);
      let mode: "req" | "pref" | "resp" | "none" = "none";
      const req: string[] = [];
      const pref: string[] = [];
      const resp: string[] = [];
      for (const l of ls) {
        const h = l.replace(/[:\s]+$/, "");
        if (PREFERRED_HDR.test(h) && h.length < 40) { mode = "pref"; continue; }
        if (REQUIRED_HDR.test(h) && h.length < 40) { mode = "req"; continue; }
        if (RESP_HDR.test(h) && h.length < 40) { mode = "resp"; continue; }
        if (mode === "req") req.push(l);
        else if (mode === "pref") pref.push(l);
        else if (mode === "resp") resp.push(stripBullet(l));
      }
      const reqText = req.join("\n") || jd.text;
      const prefText = pref.join("\n");
      const required = findTerms(reqText).filter((t) => t.kind !== "credential").map((t) => t.canonical);
      const preferred = findTerms(prefText)
        .filter((t) => t.kind !== "credential" && !required.includes(t.canonical))
        .map((t) => t.canonical);
      const lower = jd.text.toLowerCase();
      const seniority = /\b(principal|head of|director)\b/.test(lower)
        ? "lead"
        : /\b(senior|sr\.?|lead)\b/.test(lower)
          ? "senior"
          : /\b(junior|entry|graduate|intern|associate)\b/.test(lower)
            ? "entry"
            : /\b\d+\+?\s*(?:-\s*\d+\s*)?years\b/.test(lower)
              ? "mid"
              : "unspecified";
      const exp = jd.text.match(/\b\d+\+?\s*(?:-|to)?\s*\d*\s*years?[^.\n]{0,60}/i);
      return {
        jdId: jd.id,
        titleNormalized: jd.title || input.targetRole,
        seniority,
        required,
        preferred,
        tools: findTerms(jd.text, ["tool"]).map((t) => t.canonical),
        responsibilities: resp.slice(0, 10),
        domainKnowledge: findTerms(jd.text, ["domain"]).map((t) => t.canonical),
        leadershipSignals: ls.filter((l) => findTerms(l, ["leadership"]).length > 0).slice(0, 6).map(stripBullet),
        experienceRequirement: exp ? exp[0].trim() : null,
        credentialRequirements: findTerms(jd.text, ["credential"]).map((t) => t.canonical),
      };
    }),
  };
}

export const marketAgent: AgentDefinition<MarketInput, typeof MarketExtractionSchema> = {
  id: "market",
  title: "Market Intelligence Agent",
  responsibility:
    "Extract normalised requirements (required vs preferred skills, tools, responsibilities, domain knowledge, leadership signals, experience and credential requirements, seniority) from each supplied job description. Do not judge the user's fit, compute statistics, or write profile copy.",
  outputSchema: MarketExtractionSchema,
  system: `Extract per job description. Use short canonical skill names (e.g. "SQL", "Stakeholder Management").
Every term you list must literally appear in that job description; terms that do not appear will be discarded.
Do not compute percentages - the application computes frequencies from your extraction. Return one perJd entry per supplied jdId.`,
  buildPrompt: (i) =>
    `Target role: ${json(i.targetRole)}; market: ${json(i.market)}
${i.jds.map((j) => asUntrusted(`job_description id=${j.id} title=${j.title}`, j.text)).join("\n")}
Extract requirements for each job description.`,
  ruleBased: marketRuleBased,
};
