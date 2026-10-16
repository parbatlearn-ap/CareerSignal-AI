/**
 * Deterministic workflow state machine. Pure functions over a Workspace:
 * prerequisites, staleness, user-approval gates and the next step to run.
 */
import { AGENT_IDS, type AgentId } from "../schemas/common";
import type { EditKey, Workspace } from "../schemas/workspace";

export const AGENT_ORDER: AgentId[] = [...AGENT_IDS];

const DEPS: Record<AgentId, { agents: AgentId[]; edits: EditKey[] }> = {
  discovery: { agents: [], edits: ["inputs", "goals"] },
  evidence: { agents: ["discovery"], edits: ["profile"] },
  market: { agents: [], edits: ["jds", "goals"] },
  gap: { agents: ["evidence", "market"], edits: ["claims"] },
  positioning: { agents: ["gap"], edits: ["goals"] },
  linkedin: { agents: ["positioning"], edits: ["positioning", "claims"] },
  brand: { agents: ["positioning"], edits: ["positioning", "claims"] },
  critic: { agents: ["linkedin", "brand"], edits: ["linkedin", "brand"] },
  planner: { agents: ["critic"], edits: [] },
};

/** Returns a blocker message, or null when the agent may run. */
export function prerequisite(ws: Workspace, agent: AgentId): string | null {
  switch (agent) {
    case "discovery":
      if (!ws.goals) return "Complete Goals first.";
      if (ws.inputs.resumeText.trim().length < 80) return "Add your resume or profile text (at least a few lines) in Import.";
      return null;
    case "evidence":
      if (!ws.profile) return "Run Career Discovery first.";
      if (!ws.profile.confirmed) return "Review and confirm your extracted profile.";
      return null;
    case "market":
      if (ws.inputs.jobDescriptions.length === 0) return "Add at least one target job description in Import.";
      return null;
    case "gap":
      if (!ws.market) return "Run Market Intelligence first.";
      if (!ws.stepSeq.evidence) return "Run Evidence Mining first.";
      return null;
    case "positioning":
      return ws.gaps ? null : "Run the gap analysis first.";
    case "linkedin":
    case "brand":
      return ws.positioning?.selectedOptionId ? null : "Choose a positioning option first.";
    case "critic":
      if (!ws.linkedin) return "Generate the LinkedIn draft first.";
      if (!ws.brand) return "Generate the brand strategy first.";
      return null;
    case "planner":
      if (!ws.qa) return "Run the QA review first.";
      if (ws.qa.verdict === "blocked") return "Resolve critical QA flags first.";
      return null;
  }
}

export function isStale(ws: Workspace, agent: AgentId, seen = new Set<AgentId>()): boolean {
  const mine = ws.stepSeq[agent];
  if (!mine) return false;
  if (seen.has(agent)) return false;
  seen.add(agent);
  const d = DEPS[agent];
  for (const a of d.agents) {
    const s = ws.stepSeq[a];
    if ((s && s > mine) || isStale(ws, a, seen)) return true;
  }
  for (const e of d.edits) {
    const s = ws.editSeq[e];
    if (s && s > mine) return true;
  }
  return false;
}

export type NextStep =
  | { type: "run"; agentId: AgentId }
  | { type: "needs_input"; agentId: AgentId; message: string }
  | { type: "complete" };

/** User-approval gates that the pipeline never passes automatically. */
function gate(ws: Workspace, agent: AgentId): string | null {
  if (agent === "evidence" && ws.profile && !ws.profile.confirmed) return "Review and confirm your extracted profile.";
  if ((agent === "linkedin" || agent === "brand") && ws.positioning && !ws.positioning.selectedOptionId)
    return "Choose one positioning option.";
  if (agent === "planner" && ws.qa?.verdict === "blocked") return "Resolve critical QA flags before planning.";
  return null;
}

export function nextStep(ws: Workspace): NextStep {
  for (const a of AGENT_ORDER) {
    const done = Boolean(ws.stepSeq[a]) && !isStale(ws, a);
    if (done) continue;
    const g = gate(ws, a);
    if (g) return { type: "needs_input", agentId: a, message: g };
    const p = prerequisite(ws, a);
    if (p) return { type: "needs_input", agentId: a, message: p };
    return { type: "run", agentId: a };
  }
  return { type: "complete" };
}

export type StepStatus = "locked" | "ready" | "done" | "stale" | "failed" | "needs_input";
export interface StepView {
  id: string;
  label: string;
  href: string;
  agentId: AgentId | null;
  status: StepStatus;
  note: string | null;
}

function agentStatus(ws: Workspace, a: AgentId): { status: StepStatus; note: string | null } {
  const last = [...ws.agentRuns].reverse().find((r) => r.agentId === a);
  if (last?.status === "failed" && (!ws.stepSeq[a] || last.startedAt > (ws.agentRuns.find((r) => r.agentId === a && r.status === "succeeded")?.startedAt ?? "")))
    return { status: "failed", note: last.error?.message ?? "Failed" };
  if (ws.stepSeq[a]) return isStale(ws, a) ? { status: "stale", note: "Inputs changed - re-run to update." } : { status: "done", note: last?.summary ?? null };
  const p = prerequisite(ws, a);
  return p ? { status: "locked", note: p } : { status: "ready", note: null };
}

export function stepViews(ws: Workspace): StepView[] {
  const base = `/w/${ws.id}`;
  const s = (a: AgentId) => agentStatus(ws, a);
  const views: StepView[] = [
    { id: "goals", label: "Goals", href: `${base}/goals`, agentId: null, ...(ws.goals ? { status: "done", note: null } : { status: "ready", note: null }) },
    { id: "import", label: "Import", href: `${base}/import`, agentId: null, ...(ws.inputs.resumeText.trim() ? { status: "done", note: `${ws.inputs.jobDescriptions.length} job description(s)` } : { status: "ready", note: null }) },
    { id: "profile", label: "Career Profile", href: `${base}/profile`, agentId: "discovery", ...s("discovery") },
    { id: "interview", label: "Evidence Interview", href: `${base}/interview`, agentId: "evidence", ...s("evidence") },
    { id: "market", label: "Market Signals", href: `${base}/market`, agentId: "market", ...s("market") },
    { id: "gaps", label: "Skills & Gaps", href: `${base}/gaps`, agentId: "gap", ...s("gap") },
    { id: "positioning", label: "Positioning", href: `${base}/positioning`, agentId: "positioning", ...s("positioning") },
    { id: "linkedin", label: "LinkedIn Builder", href: `${base}/linkedin`, agentId: "linkedin", ...s("linkedin") },
    { id: "brand", label: "Brand Studio", href: `${base}/brand`, agentId: "brand", ...s("brand") },
    { id: "qa", label: "QA Review", href: `${base}/qa`, agentId: "critic", ...s("critic") },
    { id: "plan", label: "Action Plan", href: `${base}/plan`, agentId: "planner", ...s("planner") },
    { id: "report", label: "Report & Export", href: `${base}/report`, agentId: null, status: ws.plan ? "done" : ws.qa ? "ready" : "locked", note: null },
  ];
  // Approval gates show as needs_input.
  for (const v of views) {
    if (v.id === "profile" && ws.profile && !ws.profile.confirmed && v.status !== "failed") Object.assign(v, { status: "needs_input", note: "Review and confirm the extracted profile." });
    if (v.id === "interview" && ws.stepSeq.evidence && v.status === "done" && ws.questions.some((q) => q.state === "open"))
      Object.assign(v, { status: "needs_input", note: `${ws.questions.filter((q) => q.state === "open").length} optional question(s) open.` });
    if (v.id === "positioning" && ws.positioning && !ws.positioning.selectedOptionId && v.status === "done")
      Object.assign(v, { status: "needs_input", note: "Choose one option." });
    if (v.id === "qa" && ws.qa?.verdict === "blocked" && v.status === "done")
      Object.assign(v, { status: "needs_input", note: "Critical flags need your decision." });
  }
  return views;
}
