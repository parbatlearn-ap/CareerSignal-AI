import type { Workspace } from "../schemas/workspace";

export function selectedHeadline(ws: Workspace): string | null {
  const li = ws.linkedin;
  if (!li) return null;
  const h =
    li.headlineOptions.find((o) => o.id === li.selectedHeadlineId && o.status !== "excluded") ??
    li.headlineOptions.find((o) => o.status !== "excluded");
  return h?.text ?? null;
}

export function aboutText(ws: Workspace): string {
  return (ws.linkedin?.about ?? [])
    .filter((s) => s.status !== "excluded")
    .map((s) => s.text)
    .join("\n\n");
}

/** Concatenated, non-excluded generated LinkedIn text. */
export function profileText(ws: Workspace): string {
  const li = ws.linkedin;
  if (!li) return "";
  return [
    selectedHeadline(ws) ?? "",
    aboutText(ws),
    ...li.experience.flatMap((e) => e.bullets.filter((b) => b.status !== "excluded").map((b) => b.text)),
    li.skills.filter((s) => s.status !== "excluded").map((s) => s.name).join(", "),
  ].join("\n");
}

/** Prose a reader sees first (headline + About) - used for keyword-stuffing checks. */
export function proseText(ws: Workspace): string {
  let t = [selectedHeadline(ws) ?? "", aboutText(ws)].join("\n");
  // Employer names are facts, not keywords: "At Northwind Lending:" must not count as "lending" stuffing.
  for (const e of ws.profile?.experiences ?? [])
    if (e.employer.trim().length > 2) t = t.split(e.employer).join(" ");
  return t;
}

/** Phrases the user stated as goals; mentioning them expresses intent, not a claim. */
export function intentPhrases(ws: Workspace): string[] {
  return [ws.goals?.targetRole ?? "", ...(ws.goals?.targetCompanies ?? [])].filter(Boolean);
}

/** Everything the user supplied about themselves - the evidence corpus. */
export function evidenceCorpus(ws: Workspace): string {
  return [
    ws.inputs.resumeText,
    ws.inputs.existingLinkedinText,
    ws.goals?.currentRole ?? "",
    ws.goals?.seniority ?? "",
    ...ws.questions.filter((q) => q.answer).map((q) => q.answer as string),
    ...ws.claims.filter((c) => c.origin === "user").map((c) => `${c.text} ${c.sourceText}`),
  ].join("\n");
}
