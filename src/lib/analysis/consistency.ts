/**
 * Resume / profile consistency checks: impossible or inverted dates and
 * mismatches between the resume and the user's pasted LinkedIn text.
 */
import type { Experience } from "../schemas/workspace";
import { containsTerm, lines } from "./text";

export interface ConsistencyFlag {
  severity: "major" | "minor";
  message: string;
  experienceId: string | null;
}

function year(s: string | null): number | null {
  if (!s) return null;
  if (/present|current|now|till date|to date/i.test(s)) return new Date().getFullYear();
  const m = s.match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}

export function checkConsistency(experiences: Experience[], existingLinkedinText: string): ConsistencyFlag[] {
  const flags: ConsistencyFlag[] = [];
  const thisYear = new Date().getFullYear();

  for (const e of experiences) {
    const s = year(e.start);
    const en = year(e.end);
    if (s && en && en < s)
      flags.push({ severity: "major", experienceId: e.id, message: `${e.title} at ${e.employer}: end date (${e.end}) is before start date (${e.start}).` });
    if (s && s > thisYear)
      flags.push({ severity: "major", experienceId: e.id, message: `${e.title} at ${e.employer}: start date ${e.start} is in the future.` });
  }

  if (existingLinkedinText.trim()) {
    const li = lines(existingLinkedinText);
    for (const e of experiences) {
      if (!e.employer || e.employer.length < 3) continue;
      const idx = li.findIndex((l) => containsTerm(l, e.employer));
      if (idx === -1) {
        flags.push({ severity: "minor", experienceId: e.id, message: `"${e.employer}" appears in your resume but not in the LinkedIn text you pasted.` });
        continue;
      }
      const window = li.slice(Math.max(0, idx - 2), idx + 3).join(" ");
      if (e.title && !containsTerm(window, e.title))
        flags.push({ severity: "minor", experienceId: e.id, message: `Title "${e.title}" at ${e.employer} differs between resume and LinkedIn text.` });
      const yrs = [...window.matchAll(/(19|20)\d{2}/g)].map((m) => Number(m[0]));
      const s = year(e.start);
      if (s && yrs.length > 0 && !yrs.includes(s))
        flags.push({ severity: "major", experienceId: e.id, message: `Start year for ${e.employer} differs: resume says ${s}, LinkedIn text shows ${yrs.join("/")}.` });
    }
  }
  return flags;
}
