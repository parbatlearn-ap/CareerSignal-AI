/**
 * Orchestrator: deterministic workflow control. It validates prerequisites,
 * passes minimal inputs to one agent at a time, validates + grounds outputs,
 * records every agent run, and applies results to a COPY of the workspace so
 * a failed step never corrupts saved or user-approved data.
 */
import { randomUUID } from "node:crypto";
import { AGENTS } from "../agents";
import type { z } from "zod";
import { runAgent, type AgentDefinition } from "../agents/base";
import type { AgentId } from "../schemas/common";
import type { AgentRun, Workspace } from "../schemas/workspace";
import { ProviderError, USER_MESSAGES, type LLMProvider } from "../providers/types";
import { computeScores } from "../analysis/scoring";
import * as A from "./apply";
import { carryResolutions, criticInput, mergeLlmFlags, revisionTargets, ruleChecks, verdictOf } from "./qa";
import { nextStep, prerequisite } from "./steps";
import { snapshotVersion } from "./versions";

export interface OrchestratorDeps {
  provider: LLMProvider;
  timeoutMs: number;
}

export class OrchestratorError extends Error {
  constructor(public code: "PREREQUISITE" | "NOT_FOUND" | "INVALID_ACTION", message: string) {
    super(message);
  }
}

function bump(ws: Workspace): number {
  ws.seq += 1;
  return ws.seq;
}

/** Run a single agent and apply its output. Returns the run record. */
async function execute(ws: Workspace, agentId: AgentId, deps: OrchestratorDeps, revise: { ref: string; issue: string }[] = []) {
  const meta = deps.provider.getModelMetadata(agentId);
  const run: AgentRun = {
    id: randomUUID(),
    agentId,
    status: "running",
    provider: meta.provider,
    model: meta.model,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    latencyMs: null,
    attempts: 0,
    usage: null,
    error: null,
    summary: "",
    correlationId: randomUUID().slice(0, 8),
  };
  const t0 = Date.now();
  const finish = (patch: Partial<AgentRun>) => {
    Object.assign(run, patch, { finishedAt: new Date().toISOString(), latencyMs: Date.now() - t0 });
    ws.agentRuns.push(run);
    if (ws.agentRuns.length > 200) ws.agentRuns.splice(0, ws.agentRuns.length - 200);
    if (!ws.consent.retainRunLogs) {
      // Keep only the latest run per agent when the user opts out of run history.
      const latest = new Map<string, AgentRun>();
      ws.agentRuns.forEach((r) => latest.set(r.agentId, r));
      ws.agentRuns = [...latest.values()];
    }
    if (process.env.NODE_ENV !== "test")
      console.info(JSON.stringify({ evt: "agent_run", cid: run.correlationId, agent: agentId, status: run.status, provider: run.provider, model: run.model, ms: run.latencyMs, attempts: run.attempts, err: run.error?.code }));
  };

  if (deps.provider.id !== "mock" && !ws.consent.sendToProvider) {
    finish({ status: "failed", error: { code: "CONSENT_REQUIRED", message: USER_MESSAGES.CONSENT_REQUIRED } });
    return run;
  }

  const draft = structuredClone(ws);
  try {
    let summary = "";
    const go = async <I, S extends z.ZodType>(def: AgentDefinition<I, S>, input: I): Promise<z.infer<S>> => {
      const r = await runAgent(def, input, deps.provider, deps.timeoutMs);
      run.attempts += r.attempts;
      run.usage = r.usage;
      run.model = r.model;
      return r.data;
    };
    switch (agentId) {
      case "discovery":
        summary = A.applyDiscovery(draft, await go(AGENTS.discovery, A.discoveryInput(draft)));
        break;
      case "evidence":
        summary = A.applyEvidence(draft, await go(AGENTS.evidence, A.evidenceInput(draft)));
        break;
      case "market":
        summary = A.applyMarket(draft, await go(AGENTS.market, A.marketInput(draft)));
        break;
      case "gap":
        summary = A.applyGap(draft, await go(AGENTS.gap, A.gapInput(draft)));
        break;
      case "positioning":
        summary = A.applyPositioning(draft, await go(AGENTS.positioning, A.positioningInput(draft)));
        break;
      case "linkedin":
        summary = A.applyLinkedIn(draft, await go(AGENTS.linkedin, A.linkedinInput(draft, revise)));
        break;
      case "brand":
        summary = A.applyBrand(draft, await go(AGENTS.brand, A.brandInput(draft, revise)));
        break;
      case "critic": {
        draft.scores = computeScores(draft);
        const out = await go(AGENTS.critic, criticInput(draft));
        const rules = ruleChecks(draft);
        const flags = carryResolutions(draft.qa?.flags ?? [], [...rules.flags, ...mergeLlmFlags(draft, out)]);
        draft.qa = {
          checks: rules.checks,
          flags,
          verdict: verdictOf(flags),
          revisionCycles: draft.qa?.revisionCycles ?? 0,
          llmSummary: out.summary,
          ranAt: new Date().toISOString(),
        };
        summary = `Verdict: ${draft.qa.verdict}. ${flags.filter((f) => f.resolution === "open").length} open flag(s).`;
        break;
      }
      case "planner":
        summary = A.applyPlan(draft, await go(AGENTS.planner, A.plannerInput(draft)));
        break;
    }
    draft.stepSeq[agentId] = bump(draft);
    draft.scores = computeScores(draft);
    draft.updatedAt = new Date().toISOString();
    Object.assign(ws, draft, { agentRuns: ws.agentRuns });
    finish({ status: "succeeded", summary });
  } catch (e) {
    const err =
      e instanceof ProviderError
        ? { code: e.code, message: `${USER_MESSAGES[e.code]}${e.retryAfterSeconds ? ` (retry after ~${e.retryAfterSeconds}s)` : ""}` }
        : { code: "INTERNAL", message: `Unexpected error: ${(e as Error).message}` };
    finish({ status: "failed", error: err });
  }
  return run;
}

/**
 * Public entry point: run one agent (with prerequisite checks). The QA agent
 * may trigger ONE revision cycle of the LinkedIn/Brand agents and re-check.
 */
export async function runStep(ws: Workspace, agentId: AgentId, deps: OrchestratorDeps): Promise<AgentRun[]> {
  const blocker = prerequisite(ws, agentId);
  if (blocker) throw new OrchestratorError("PREREQUISITE", blocker);
  const runs: AgentRun[] = [];
  const first = await execute(ws, agentId, deps);
  runs.push(first);

  if (agentId === "critic" && first.status === "succeeded" && ws.qa && ws.qa.revisionCycles === 0) {
    const targets = revisionTargets(ws, ws.qa.flags);
    if (targets.length) {
      ws.qa.revisionCycles = 1;
      const li = targets.filter((t) => t.area === "linkedin");
      const br = targets.filter((t) => t.area === "brand");
      if (li.length) runs.push(await execute(ws, "linkedin", deps, li));
      if (br.length) runs.push(await execute(ws, "brand", deps, br));
      runs.push(await execute(ws, "critic", deps));
    }
  }
  if (agentId === "planner" && first.status === "succeeded") {
    snapshotVersion(ws, deps.provider.getModelMetadata().label);
  }
  return runs;
}

/** Run the next runnable step, if any. Never passes a user-approval gate. */
export async function runNext(ws: Workspace, deps: OrchestratorDeps) {
  const n = nextStep(ws);
  if (n.type !== "run") return { next: n, runs: [] as AgentRun[] };
  const runs = await runStep(ws, n.agentId, deps);
  return { next: n, runs };
}

export { nextStep, stepViews } from "./steps";
