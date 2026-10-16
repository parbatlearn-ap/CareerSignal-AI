import { NextResponse } from "next/server";
import { buildReportHtml, buildReportMarkdown } from "@/lib/export/markdown";
import { loadOwned } from "@/lib/server/session";
import { json, notFound } from "@/lib/server/http";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ws = await loadOwned(id);
  if (!ws) return notFound();
  const format = new URL(req.url).searchParams.get("format") ?? "md";
  const slug = ws.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "report";
  if (format === "json") {
    // Full data export of this workspace (the user's own data).
    const { ownerId: _o, ...data } = ws;
    void _o;
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${slug}-data.json"`, "Cache-Control": "no-store" },
    });
  }
  if (ws.qa?.verdict === "blocked" && format !== "json")
    return json({ error: "The QA review found critical unresolved issues. Resolve them on the QA page before exporting the report." }, 409);
  if (format === "html")
    return new NextResponse(buildReportHtml(ws), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  return new NextResponse(buildReportMarkdown(ws), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}-report.md"`, "Cache-Control": "no-store" },
  });
}
