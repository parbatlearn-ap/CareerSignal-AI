"use client";

import { useState } from "react";
import type { AgentId, EvidenceStatus, StatementStatus } from "@/lib/schemas/common";
import { useWorkspace } from "./workspace-context";

export function Badge({ tone = "", children, title }: { tone?: string; children: React.ReactNode; title?: string }) {
  return (
    <span className={`badge ${tone}`} title={title}>
      {children}
    </span>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // Fallback for browsers without clipboard permission.
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      aria-live="polite"
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

const ST: Record<StatementStatus, [string, string]> = {
  supported: ["ok", "Supported by evidence"],
  needs_confirmation: ["warn", "Needs your confirmation"],
  excluded: ["bad", "Excluded"],
};
export function StatementBadge({ status, approved }: { status: StatementStatus; approved?: boolean }) {
  const [tone, label] = ST[status];
  return <Badge tone={tone}>{approved ? "Confirmed by you" : label}</Badge>;
}

const EV: Record<EvidenceStatus, [string, string]> = {
  verified_by_user: ["ok", "Verified by you"],
  user_provided: ["info", "From your material"],
  inferred_needs_confirmation: ["warn", "Inferred - confirm"],
  unsupported: ["bad", "Unsupported - do not use"],
};
export function EvidenceBadge({ status }: { status: EvidenceStatus }) {
  const [tone, label] = EV[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function Bar({ value, tone = "" }: { value: number; tone?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={`bar ${tone}`} role="img" aria-label={`${Math.round(v)} out of 100`}>
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

export function ErrorBanner() {
  const { error, clearError } = useWorkspace();
  if (!error) return null;
  return (
    <div className="alert bad spread" role="alert">
      <span>{error}</span>
      <button className="btn btn-sm" onClick={clearError}>
        Dismiss
      </button>
    </div>
  );
}

/**
 * Shows one agent's responsibility, status, last run metadata and a run
 * button. "How this was produced" shows inputs used - never prompts or
 * hidden reasoning.
 */
export function AgentPanel({ agentId, dataUsed, runLabel = "Run" }: { agentId: AgentId; dataUsed: string[]; runLabel?: string }) {
  const { view, run, running } = useWorkspace();
  if (!view) return null;
  const info = view.agents.find((a) => a.id === agentId)!;
  const step = view.steps.find((s) => s.agentId === agentId);
  const last = [...view.ws.agentRuns].reverse().find((r) => r.agentId === agentId);
  const status = step?.status ?? "locked";
  const blocked = status === "locked";
  const isRunning = running === agentId;
  const tone = { done: "ok", stale: "warn", failed: "bad", needs_input: "warn", ready: "info", locked: "" }[status];
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3>{info.title}</h3>
          <p className="muted" style={{ margin: 0, maxWidth: 680 }}>
            {info.responsibility}
          </p>
        </div>
        <div className="row">
          <Badge tone={tone}>{isRunning ? "Running…" : status.replace("_", " ")}</Badge>
          <button className="btn btn-primary btn-sm" disabled={blocked || Boolean(running)} onClick={() => run(agentId)}>
            {isRunning ? "Running…" : last?.status === "succeeded" ? "Re-run" : runLabel}
          </button>
        </div>
      </div>
      {blocked && step?.note && <p className="hint">Waiting for: {step.note}</p>}
      {status === "stale" && <p className="hint">Your inputs changed since this ran. Re-run to update - your own edits are kept.</p>}
      <details>
        <summary>How this insight was produced</summary>
        <ul className="evidence-list">
          <li>Data used: {dataUsed.join("; ")}</li>
          {last && (
            <li>
              Last run: {last.status} · {view.provider.isMock ? "Demo mode (rule-based)" : `${last.provider} / ${last.model}`} ·{" "}
              {last.latencyMs ?? "?"} ms · {last.attempts} attempt(s)
              {last.usage?.totalTokens ? ` · ${last.usage.totalTokens} tokens` : ""} · ref {last.correlationId}
            </li>
          )}
          {last?.summary && <li>Result: {last.summary}</li>}
          {last?.error && <li>Error: {last.error.message}</li>}
          <li>All outputs are schema-validated and checked against your material before being shown.</li>
        </ul>
      </details>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
      <p className="muted" style={{ margin: 0 }}>
        {children}
      </p>
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="spread" style={{ marginBottom: "1rem" }}>
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted" style={{ margin: 0 }}>{subtitle}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}

export function FeedbackWidget({ section }: { section: string }) {
  const { act } = useWorkspace();
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [inaccurate, setInaccurate] = useState(false);
  const [sent, setSent] = useState(false);
  if (sent) return <p className="hint">Thanks - feedback saved to this analysis version.</p>;
  return (
    <details className="no-print">
      <summary>Rate this section / flag inaccurate output</summary>
      <div className="row" style={{ marginTop: "0.5rem" }} role="group" aria-label="Usefulness rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" className={`btn btn-sm ${rating === n ? "btn-primary" : ""}`} onClick={() => setRating(n)} aria-pressed={rating === n}>
            {n}
          </button>
        ))}
        <span className="hint">1 = not useful, 5 = very useful</span>
      </div>
      <label className="check" style={{ marginTop: "0.5rem" }}>
        <input type="checkbox" checked={inaccurate} onChange={(e) => setInaccurate(e.target.checked)} /> Something here is inaccurate
      </label>
      <div className="field">
        <label htmlFor={`fb-${section}`}>Comment (optional)</label>
        <input id={`fb-${section}`} type="text" value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      <button
        className="btn btn-sm"
        disabled={rating === null && !inaccurate && !comment}
        onClick={async () => {
          if (await act({ type: "feedback", section, rating, flaggedInaccurate: inaccurate, comment })) setSent(true);
        }}
      >
        Save feedback
      </button>
    </details>
  );
}
