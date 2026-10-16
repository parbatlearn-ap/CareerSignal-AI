import "@/lib/agents"; // registers mock handlers
import { MockProvider } from "@/lib/providers/mock";
import type { LLMProvider } from "@/lib/providers/types";
import { applyAction, newWorkspace } from "@/lib/orchestrator/actions";
import { runStep, runNext } from "@/lib/orchestrator";
import type { Workspace } from "@/lib/schemas/workspace";

export const mockDeps = (provider: LLMProvider = new MockProvider()) => ({ provider, timeoutMs: 5000 });

export function demoWorkspace(): Workspace {
  const ws = newWorkspace("owner-test");
  applyAction(ws, { type: "load_demo" });
  return ws;
}

/** Run the pipeline through every gate, approving as a user would. */
export async function runFullPipeline(ws: Workspace, provider: LLMProvider = new MockProvider()) {
  const deps = mockDeps(provider);
  for (let i = 0; i < 30; i++) {
    const { next, runs } = await runNext(ws, deps);
    if (runs.some((r) => r.status === "failed")) return { ws, failed: runs.find((r) => r.status === "failed") };
    if (next.type === "complete") return { ws, failed: null };
    if (next.type === "needs_input") {
      if (next.agentId === "evidence") applyAction(ws, { type: "confirm_profile" });
      else if (next.agentId === "linkedin" || next.agentId === "brand")
        applyAction(ws, { type: "choose_positioning", optionId: ws.positioning!.recommendedOptionId, editedStatement: null });
      else if (next.agentId === "planner") {
        for (const f of ws.qa!.flags.filter((f) => f.resolution === "open" && f.severity === "critical"))
          applyAction(ws, { type: "resolve_flag", flagId: f.id, resolution: "excluded" });
      } else throw new Error(`Unexpected gate: ${next.agentId} ${next.message}`);
    }
  }
  throw new Error("Pipeline did not complete");
}

export { runStep };
