import { getRepository } from "@/lib/repo";
import { loadOwned, withLock } from "@/lib/server/session";
import { workspaceView } from "@/lib/server/view";
import { json, notFound } from "@/lib/server/http";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const ws = await loadOwned(id);
  return ws ? json(workspaceView(ws)) : notFound();
}

/** Permanently delete this workspace and everything in it. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return withLock(id, async () => {
    const ws = await loadOwned(id);
    if (!ws) return notFound();
    await getRepository().delete(id);
    return json({ deleted: true });
  });
}
