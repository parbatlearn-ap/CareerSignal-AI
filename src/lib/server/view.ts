/** Shape of the workspace payload sent to the browser. No secrets, no prompts. */
import { AGENT_INFO } from "../agents";
import { checkConsistency } from "../analysis/consistency";
import { recruiterLens } from "../analysis/recruiterLens";
import { publicProviderStatus } from "../providers";
import { nextStep, stepViews } from "../orchestrator/steps";
import type { Workspace } from "../schemas/workspace";

export function workspaceView(ws: Workspace) {
  const { ownerId: _owner, ...safe } = ws;
  void _owner;
  return {
    ws: safe,
    steps: stepViews(ws),
    next: nextStep(ws),
    provider: publicProviderStatus(),
    agents: AGENT_INFO,
    lens: recruiterLens(ws),
    consistency: checkConsistency(ws.profile?.experiences ?? [], ws.inputs.existingLinkedinText),
  };
}
export type WorkspaceView = ReturnType<typeof workspaceView>;
