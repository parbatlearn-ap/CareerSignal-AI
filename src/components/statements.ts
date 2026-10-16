import type { EditableStatement, Workspace } from "@/lib/schemas/workspace";

/** Browser-side list of generated statements (mirrors orchestrator/apply allStatements). */
export function allStatementsView(ws: Omit<Workspace, "ownerId">) {
  const out: { ref: string; section: string; statement: EditableStatement }[] = [];
  const li = ws.linkedin;
  if (li) {
    li.headlineOptions.forEach((s) => out.push({ ref: s.id, section: "Headline", statement: s }));
    li.about.forEach((s) => out.push({ ref: s.id, section: "About", statement: s }));
    li.experience.forEach((e) => e.bullets.forEach((s) => out.push({ ref: s.id, section: "Experience", statement: s })));
  }
  if (ws.brand) out.push({ ref: ws.brand.brandStatement.id, section: "Brand statement", statement: ws.brand.brandStatement });
  return out;
}
