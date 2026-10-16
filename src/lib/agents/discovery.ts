/** Agent 1 - Career Discovery: structure raw career information without inventing facts. */
import { DiscoveryOutputSchema, type DiscoveryOutput } from "../schemas/agents";
import { asUntrusted } from "../analysis/injection";
import { findTerms } from "../analysis/taxonomy";
import { lines, stripBullet, uniqueBy } from "../analysis/text";
import { json, type AgentDefinition } from "./base";

export interface DiscoveryInput {
  resumeText: string;
  existingLinkedinText: string;
  currentRole: string;
  targetRole: string;
}

const VAGUE = /\b(helped|assisted|worked on|responsible for|involved in|various|supported|participated|handled|exposure to)\b/i;
const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const DATE = `(?:${MONTH}\\s*)?(?:19|20)\\d{2}`;
const RANGE = new RegExp(`(${DATE})\\s*(?:-|–|—|to|until)\\s*(${DATE}|present|current|now|till date)`, "i");
const SECTION =
  /^(professional |work )?(experience|employment( history)?|career history|skills|technical skills|key skills|core skills|projects|key projects|education|certifications?|licenses|summary|profile|professional summary|achievements|tools)\s*:?$/i;

type Section = "experience" | "skills" | "projects" | "education" | "certifications" | "summary" | "other";
function sectionOf(l: string): Section | null {
  const m = l.match(SECTION);
  if (!m) return null;
  const s = l.toLowerCase();
  if (/experience|employment|career history/.test(s)) return "experience";
  if (/skill|tools/.test(s)) return "skills";
  if (/project/.test(s)) return "projects";
  if (/education/.test(s)) return "education";
  if (/certif|licen/.test(s)) return "certifications";
  if (/summary|profile/.test(s)) return "summary";
  return "other";
}

/** Split "Title - Employer | 2019 - Present" style headers. */
function parseHeader(header: string, prev: string | null): { title: string; employer: string } {
  const noDates = header.replace(RANGE, "").replace(/[|()[\],]+\s*$/g, "").replace(/\s*[|·]\s*$/, "").trim();
  const parts = noDates.split(/\s+(?:\||—|–|-|@|at)\s+|,\s+/i).map((p) => p.replace(/\|/g, "").trim()).filter(Boolean);
  if (parts.length >= 2) return { title: parts[0], employer: parts[1] };
  if (parts.length === 1 && prev) return { title: parts[0], employer: prev.replace(/[|]/g, "").trim() };
  return { title: parts[0] ?? "", employer: prev ?? "" };
}

export function discoveryRuleBased(input: DiscoveryInput): DiscoveryOutput {
  const text = input.resumeText;
  const ls = lines(text);
  const out: DiscoveryOutput = {
    experiences: [],
    skills: [],
    projects: [],
    certifications: [],
    education: [],
    domains: [],
    achievementCandidates: [],
    ambiguities: [],
    unknowns: [],
  };

  let section: Section = "other";
  let current: DiscoveryOutput["experiences"][number] | null = null;
  const skillsLines: string[] = [];

  for (let i = 0; i < ls.length; i++) {
    const l = ls[i];
    const sec = sectionOf(l);
    if (sec) {
      section = sec;
      current = null;
      continue;
    }
    const range = l.match(RANGE);
    if (range && (section === "experience" || section === "other")) {
      const prev = i > 0 && !sectionOf(ls[i - 1]) && !RANGE.test(ls[i - 1]) && !/^[-*•]/.test(ls[i - 1]) ? ls[i - 1] : null;
      const { title, employer } = parseHeader(l, prev);
      current = { title, employer, start: range[1], end: range[2], bullets: [], sourceQuote: l };
      out.experiences.push(current);
      section = "experience";
      continue;
    }
    if (section === "experience" && current) {
      if (/^[-*•·▪◦‣]|^\d+[.)]\s/.test(l) || l.length > 40) current.bullets.push(stripBullet(l));
      continue;
    }
    if (section === "skills") skillsLines.push(l);
    if (section === "projects") {
      const [name, ...rest] = stripBullet(l).split(/\s*[:–—-]\s+/);
      if (name) out.projects.push({ name: name.slice(0, 120), description: rest.join(" - ") || name, sourceQuote: l });
    }
    if (section === "education") out.education.push({ text: stripBullet(l) });
    if (section === "certifications") out.certifications.push({ name: stripBullet(l), sourceQuote: l });
  }

  // Skills: grounded taxonomy terms anywhere, plus explicit items from the skills section.
  for (const t of findTerms(text)) {
    if (t.kind === "credential") continue;
    out.skills.push({
      name: t.canonical,
      category: t.kind === "leadership" ? "soft" : t.kind,
      sourceQuote: ls.find((l) => [t.canonical, ...t.aliases].some((a) => l.toLowerCase().includes(a.toLowerCase()))) ?? "",
    });
  }
  for (const l of skillsLines) {
    for (const item of l.replace(/^[^:]{0,30}:\s*/, "").split(/[,;|•]/).map((s) => stripBullet(s).trim())) {
      if (item.length >= 2 && item.length <= 40 && findTerms(item).length === 0)
        out.skills.push({ name: item, category: "other", sourceQuote: l });
    }
  }
  out.skills = uniqueBy(out.skills, (s) => s.name.toLowerCase());

  for (const c of findTerms(text, ["credential"])) {
    if (!out.certifications.some((x) => x.name.toLowerCase().includes(c.canonical.toLowerCase())))
      out.certifications.push({ name: c.canonical, sourceQuote: ls.find((l) => l.includes(c.canonical)) ?? c.canonical });
  }
  out.domains = findTerms(text, ["domain"]).map((t) => t.canonical);

  out.experiences.forEach((e, idx) =>
    e.bullets.forEach((b) => {
      out.achievementCandidates.push({ text: b, sourceQuote: b, experienceIndex: idx });
      if (VAGUE.test(b)) out.ambiguities.push(`Vague wording: "${b.slice(0, 120)}"`);
    }),
  );

  if (out.experiences.length === 0) out.unknowns.push("No dated roles detected - add roles with start/end dates.");
  if (out.experiences.some((e) => !e.employer)) out.unknowns.push("Some roles have no employer name.");
  if (out.education.length === 0) out.unknowns.push("Education not found in the supplied material.");
  if (!/\d/.test(out.experiences.flatMap((e) => e.bullets).join(" ")))
    out.unknowns.push("No measurable outcomes found - the evidence interview will ask about results.");
  if (!input.targetRole) out.unknowns.push("Target role not set.");
  return out;
}

export const discoveryAgent: AgentDefinition<DiscoveryInput, typeof DiscoveryOutputSchema> = {
  id: "discovery",
  title: "Career Discovery Agent",
  responsibility:
    "Structure the user's raw career material into roles, skills, projects, credentials, domains, achievement candidates, ambiguities and unknowns. Do not write LinkedIn copy or judge fit.",
  outputSchema: DiscoveryOutputSchema,
  system: `Preserve original wording in sourceQuote (copy verbatim from the resume). Keep dates exactly as written.
Mark vague statements in "ambiguities" and missing information in "unknowns". experienceIndex refers to the position in your experiences array (0-based).`,
  buildPrompt: (i) =>
    `Context (user-entered): ${json({ currentRole: i.currentRole, targetRole: i.targetRole })}
${asUntrusted("resume", i.resumeText)}
${i.existingLinkedinText ? asUntrusted("current_linkedin_text", i.existingLinkedinText) : ""}
Structure this career material.`,
  ruleBased: discoveryRuleBased,
};
