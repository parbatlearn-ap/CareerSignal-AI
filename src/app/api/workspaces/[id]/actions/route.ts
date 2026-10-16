import { getRepository } from "@/lib/repo";
import { ActionSchema, applyAction } from "@/lib/orchestrator/actions";
import { createProvider } from "@/lib/providers";
import { loadOwned, withLock } from "@/lib/server/session";
import { workspaceView } from "@/lib/server/view";
import { errorResponse, json, notFound } from "@/lib/server/http";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const action = ActionSchema.parse(await req.json());
    return await withLock(id, async () => {
      const ws = await loadOwned(id);
      if (!ws) return notFound();
      applyAction(ws, action, createProvider().getModelMetadata().label);
      await getRepository().save(ws);
      return json(workspaceView(ws));
    });
  } catch (e) {
    return errorResponse(e);
  }
}
