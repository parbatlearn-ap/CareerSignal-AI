/**
 * Recruiter Lens - a SIMULATION of whether the profile communicates target
 * role, level, domain and supplied-JD keywords. It is not a prediction of
 * LinkedIn search ranking or recruiter behaviour.
 */
import type { Workspace } from "../schemas/workspace";
import { keyRequirements } from "./market";
import { termGrounded } from "./taxonomy";
import { containsTerm } from "./text";
import { selectedHeadline, profileText } from "./profileText";

export interface LensSignal {
  id: "role" | "level" | "domain" | "keywords";
  label: string;
  result: "clear" | "partial" | "missing" | "insufficient_data";
  detail: string;
}

export function recruiterLens(ws: Workspace): LensSignal[] {
  const headline = selectedHeadline(ws) ?? "";
  const full = profileText(ws);
  const out: LensSignal[] = [];
  const target = ws.goals?.targetRole?.trim() ?? "";

  if (!ws.linkedin) {
    return [
      { id: "role", label: "Target role", result: "insufficient_data", detail: "Generate a LinkedIn draft first." },
    ];
  }

  // Role: target role words appear in the headline (strongest signal) or About.
  const roleWords = target.split(/[\s/,&-]+/).filter((w) => w.length > 2);
  const inHeadline = roleWords.filter((w) => containsTerm(headline, w)).length;
  out.push({
    id: "role",
    label: "Target role is clear",
    result: !target ? "insufficient_data" : inHeadline >= Math.ceil(roleWords.length / 2) ? "clear" : containsTerm(full, target) ? "partial" : "missing",
    detail: target ? `Looks for "${target}" in the headline and About.` : "No target role set in Goals.",
  });

  // Level: the stated seniority is communicated without overstating it.
  const seniority = ws.goals?.seniority?.trim() ?? "";
  out.push({
    id: "level",
    label: "Level is communicated",
    result: !seniority ? "insufficient_data" : containsTerm(full, seniority) || (ws.goals?.yearsExperience && /\d+\+?\s*years/i.test(full)) ? "clear" : "partial",
    detail: seniority ? `Stated seniority: "${seniority}".` : "No seniority set in Goals.",
  });

  // Domain: at least one evidenced domain appears.
  const domains = ws.profile?.domains ?? [];
  const hit = domains.filter((d) => termGrounded(full, d));
  out.push({
    id: "domain",
    label: "Domain is visible",
    result: domains.length === 0 ? "insufficient_data" : hit.length > 0 ? "clear" : "missing",
    detail: domains.length ? `Domains found in your material: ${domains.join(", ")}. Visible in profile: ${hit.join(", ") || "none"}.` : "No domains identified.",
  });

  // Keywords from supplied JDs.
  if (!ws.market || ws.market.sampleSize === 0) {
    out.push({ id: "keywords", label: "Supplied-JD terms", result: "insufficient_data", detail: "No job descriptions analysed." });
  } else {
    const keys = keyRequirements(ws.market, 12);
    const present = keys.filter((k) => termGrounded(full, k.term));
    const missing = keys.filter((k) => !termGrounded(full, k.term));
    const ratio = keys.length ? present.length / keys.length : 0;
    out.push({
      id: "keywords",
      label: "Supplied-JD terms",
      result: ratio >= 0.6 ? "clear" : ratio >= 0.3 ? "partial" : "missing",
      detail: `${present.length} of ${keys.length} key terms present. Missing: ${missing.map((m) => m.term).join(", ") || "none"}. Only add missing terms you can evidence.`,
    });
  }
  return out;
}
