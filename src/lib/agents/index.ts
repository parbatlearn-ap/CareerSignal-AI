import type { AgentId } from "../schemas/common";
import { registerMockHandler } from "../providers/mock";
import { discoveryAgent } from "./discovery";
import { evidenceAgent } from "./evidence";
import { marketAgent } from "./market";
import { gapAgent } from "./gap";
import { positioningAgent } from "./positioning";
import { linkedinAgent } from "./linkedin";
import { brandAgent } from "./brand";
import { criticAgent } from "./critic";
import { plannerAgent } from "./planner";

export const AGENTS = {
  discovery: discoveryAgent,
  evidence: evidenceAgent,
  market: marketAgent,
  gap: gapAgent,
  positioning: positioningAgent,
  linkedin: linkedinAgent,
  brand: brandAgent,
  critic: criticAgent,
  planner: plannerAgent,
} as const;

// Mock mode runs each agent's deterministic rule-based implementation.
for (const [id, def] of Object.entries(AGENTS)) {
  registerMockHandler(id as AgentId, (input) => (def.ruleBased as (i: unknown) => unknown)(input));
}

/** Browser-safe agent descriptions (no prompts). */
export const AGENT_INFO: { id: AgentId; title: string; responsibility: string }[] = Object.values(AGENTS).map((a) => ({
  id: a.id,
  title: a.title,
  responsibility: a.responsibility,
}));
