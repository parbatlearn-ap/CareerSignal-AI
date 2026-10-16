import { z } from "zod";
import { getRepository } from "@/lib/repo";
import { applyAction, newWorkspace } from "@/lib/orchestrator/actions";
import { getOwnerId } from "@/lib/server/session";
import { errorResponse, json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const owner = await getOwnerId(false);
  if (!owner) return json({ workspaces: [] });
  return json({ workspaces: await getRepository().listByOwner(owner) });
}

const Body = z.object({ demo: z.boolean().optional(), title: z.string().max(120).optional() });

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json().catch(() => ({})));
    const owner = (await getOwnerId(true))!;
    const ws = newWorkspace(owner, body.title || "My career analysis");
    if (body.demo) applyAction(ws, { type: "load_demo" });
    await getRepository().create(ws);
    return json({ id: ws.id }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
