import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repo";
import { getOwnerId } from "@/lib/server/session";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Export every workspace owned by this browser session. */
export async function GET() {
  const owner = await getOwnerId(false);
  if (!owner) return json({ workspaces: [] });
  const repo = getRepository();
  const list = await repo.listByOwner(owner);
  const all = [];
  for (const w of list) {
    const ws = await repo.get(w.id);
    if (ws) {
      const { ownerId: _o, ...data } = ws;
      void _o;
      all.push(data);
    }
  }
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), workspaces: all }, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="careersignal-all-data.json"', "Cache-Control": "no-store" },
  });
}

/** Delete every workspace owned by this browser session. */
export async function DELETE() {
  const owner = await getOwnerId(false);
  if (!owner) return json({ deleted: 0 });
  return json({ deleted: await getRepository().deleteByOwner(owner) });
}
