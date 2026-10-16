import { z } from "zod";
import "@/lib/agents";
import { AgentId } from "@/lib/schemas/common";
import { getRepository } from "@/lib/repo";
import { createProvider, readProviderConfig } from "@/lib/providers";
import { runNext, runStep } from "@/lib/orchestrator";
import { loadOwned, withLock } from "@/lib/server/session";
import { workspaceView } from "@/lib/server/view";
import { errorResponse, json, notFound } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ agentId: z.union([AgentId, z.literal("next")]) });

/** Run ONE agent step (or the next runnable step). The browser calls this repeatedly to show real progress. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const { agentId } = Body.parse(await req.json());
    return await withLock(id, async () => {
      const ws = await loadOwned(id);
      if (!ws) return notFound();
      const deps = { provider: createProvider(), timeoutMs: readProviderConfig().timeoutMs };
      const runs = agentId === "next" ? (await runNext(ws, deps)).runs : await runStep(ws, agentId, deps);
      await getRepository().save(ws);
      return json({ ...workspaceView(ws), runs });
    });
  } catch (e) {
    return errorResponse(e);
  }
}
