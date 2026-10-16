"use client";

import Link from "next/link";
import { useWorkspace } from "@/components/workspace-context";
import { Badge, PageHeader } from "@/components/ui";
import { CurrentVsTarget, ScoreBreakdown } from "@/components/visuals";

export default function Overview() {
  const { view, runUntilGate, running } = useWorkspace();
  if (!view) return null;
  const { ws, steps, next, agents } = view;
  const nextStepView = next.type !== "complete" ? steps.find((s) => s.agentId === next.agentId) : null;
  const firstTodo = steps.find((s) => s.status !== "done");
  return (
    <>
      <PageHeader title="Overview" subtitle="Your workflow, what each agent has done, and what needs you next." />
      <div className="card">
        <h2>Next step</h2>
        {!ws.goals ? (
          <p>Start by setting your goals. <Link className="btn btn-primary btn-sm" href={`/w/${ws.id}/goals`}>Set goals</Link></p>
        ) : next.type === "run" ? (
          <div className="spread">
            <p style={{ margin: 0 }}>Ready to run <strong>{agents.find((a) => a.id === next.agentId)?.title}</strong>. Steps run one at a time and stop whenever your decision is needed.</p>
            <button className="btn btn-primary" onClick={runUntilGate} disabled={Boolean(running)}>{running ? "Running…" : "Run next steps"}</button>
          </div>
        ) : next.type === "needs_input" ? (
          <div className="spread">
            <p style={{ margin: 0 }}>{next.message}</p>
            {nextStepView && <Link className="btn btn-primary" href={nextStepView.href}>Go to {nextStepView.label}</Link>}
            {!nextStepView && firstTodo && <Link className="btn btn-primary" href={firstTodo.href}>Go to {firstTodo.label}</Link>}
          </div>
        ) : (
          <div className="spread">
            <p style={{ margin: 0 }}>Analysis complete. Review and export your report.</p>
            <Link className="btn btn-primary" href={`/w/${ws.id}/report`}>Open report</Link>
          </div>
        )}
      </div>
      {ws.gaps && <CurrentVsTarget ws={ws} />}
      {ws.scores && ws.profile && <ScoreBreakdown scores={ws.scores} />}
      <div className="card">
        <h2>Agents</h2>
        <p className="muted">Each agent has one job, its own prompt and output schema, and only sees the data it needs.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Agent</th><th>Responsibility</th><th>Status</th><th>Last result</th></tr></thead>
            <tbody>
              {agents.map((a) => {
                const s = steps.find((x) => x.agentId === a.id);
                const last = [...ws.agentRuns].reverse().find((r) => r.agentId === a.id);
                const tone = { done: "ok", stale: "warn", failed: "bad", needs_input: "warn", ready: "info", locked: "" }[s?.status ?? "locked"];
                return (
                  <tr key={a.id}>
                    <td><strong>{s ? <Link href={s.href}>{a.title}</Link> : a.title}</strong></td>
                    <td className="hint">{a.responsibility}</td>
                    <td><Badge tone={tone}>{(s?.status ?? "locked").replace("_", " ")}</Badge></td>
                    <td className="hint">{last ? (last.error?.message ?? last.summary) : s?.note ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
