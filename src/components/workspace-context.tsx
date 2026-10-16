"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { WorkspaceView } from "@/lib/server/view";
import type { AgentId } from "@/lib/schemas/common";
import type { Action } from "@/lib/orchestrator/actions";

interface Ctx {
  view: WorkspaceView | null;
  loading: boolean;
  error: string | null;
  /** Agent currently running, for real (not simulated) progress. */
  running: AgentId | null;
  clearError(): void;
  act(action: Action): Promise<boolean>;
  run(agentId: AgentId | "next"): Promise<boolean>;
  /** Run steps one by one until a user-approval gate, a failure, or completion. */
  runUntilGate(): Promise<void>;
  reload(): Promise<void>;
}

const WorkspaceCtx = createContext<Ctx | null>(null);

export function useWorkspace(): Ctx {
  const c = useContext(WorkspaceCtx);
  if (!c) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return c;
}

async function readJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function WorkspaceProvider({ id, children }: { id: string; children: React.ReactNode }) {
  const [view, setView] = useState<WorkspaceView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<AgentId | null>(null);

  const reload = useCallback(async () => {
    try {
      setView(await readJson(await fetch(`/api/workspaces/${id}`, { cache: "no-store" })));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/workspaces/${id}`, { cache: "no-store" })
      .then(readJson)
      .then((d) => alive && setView(d))
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  const act = useCallback(
    async (action: Action) => {
      setError(null);
      try {
        const res = await fetch(`/api/workspaces/${id}/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        setView(await readJson(res));
        return true;
      } catch (e) {
        setError((e as Error).message);
        return false;
      }
    },
    [id],
  );

  const runOnce = useCallback(
    async (agentId: AgentId | "next", label: AgentId | null) => {
      setError(null);
      setRunning(label);
      try {
        const res = await fetch(`/api/workspaces/${id}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId }),
        });
        const data = await readJson(res);
        setView(data);
        const failed = (data.runs as { status: string; error?: { message: string } }[]).find((r) => r.status === "failed");
        if (failed) {
          setError(failed.error?.message ?? "An agent step failed.");
          return { ok: false, data };
        }
        return { ok: true, data };
      } catch (e) {
        setError((e as Error).message);
        return { ok: false, data: null };
      } finally {
        setRunning(null);
      }
    },
    [id],
  );

  const run = useCallback(async (agentId: AgentId | "next") => (await runOnce(agentId, agentId === "next" ? null : agentId)).ok, [runOnce]);

  const runUntilGate = useCallback(async () => {
    let current = view;
    for (let i = 0; i < 15; i++) {
      const next = current?.next;
      if (!next || next.type !== "run") return;
      const r = await runOnce(next.agentId, next.agentId);
      if (!r.ok || !r.data) return;
      current = r.data;
    }
  }, [view, runOnce]);

  return (
    <WorkspaceCtx.Provider value={{ view, loading, error, running, clearError: () => setError(null), act, run, runUntilGate, reload }}>
      {children}
    </WorkspaceCtx.Provider>
  );
}
