"use client";

import { useWorkspace } from "@/components/workspace-context";
import { AgentPanel, Badge, Empty, PageHeader } from "@/components/ui";
import { StatementCard } from "@/components/statement-card";
import { allStatementsView } from "@/components/statements";

const SEV = { critical: "bad", major: "warn", minor: "" } as const;
const RES: Record<string, string> = { open: "Open", revised: "Fixed by revision", user_approved: "Confirmed by you", excluded: "Excluded", dismissed: "Dismissed" };

export default function QaPage() {
  const { view, act } = useWorkspace();
  if (!view) return null;
  const { ws } = view;
  const qa = ws.qa;
  const stmts = allStatementsView(ws);
  return (
    <>
      <PageHeader title="QA Review" subtitle="An independent check of every claim before you use it. Critical issues block the report until you decide." />
      <AgentPanel agentId="critic" runLabel="Run QA review" dataUsed={["every generated statement and its cited evidence", "selected positioning", "market sample size", "your full source material (for rule checks)"]} />
      {!qa ? <Empty>Generate the LinkedIn draft and brand plan, then run QA.</Empty> : (
        <>
          <div className={`alert ${qa.verdict === "blocked" ? "bad" : qa.verdict === "pass" ? "ok" : "warn"}`}>
            <strong>Verdict: {qa.verdict === "blocked" ? "Blocked" : qa.verdict === "pass" ? "Pass" : "Pass with warnings"}.</strong>{" "}
            {qa.verdict === "blocked" ? "Resolve critical flags: confirm you can support the claim, edit it, or exclude it." : "No critical issues are open."}{" "}
            Automatic revision cycles used: {qa.revisionCycles} of 1. {qa.llmSummary}
          </div>
          <div className="card">
            <h2>Checks</h2>
            <ul>{qa.checks.map((c) => <li key={c.id}><Badge tone={c.status === "pass" ? "ok" : c.status === "warn" ? "warn" : "bad"}>{c.status}</Badge> <strong>{c.label}</strong> - <span className="hint">{c.detail}</span></li>)}</ul>
          </div>
          <div className="card">
            <h2>Flags ({qa.flags.length})</h2>
            {qa.flags.length === 0 && <p className="muted">No flags.</p>}
            {qa.flags.map((f) => {
              const s = f.targetRef ? stmts.find((x) => x.ref === f.targetRef) : null;
              return (
                <div key={f.id} className={`statement ${f.resolution === "open" ? (f.severity === "critical" ? "excluded" : "needs_confirmation") : "supported"}`} style={{ opacity: 1 }}>
                  <div className="spread">
                    <div className="row">
                      <Badge tone={SEV[f.severity]}>{f.severity}</Badge>
                      <Badge>{f.category.replace(/_/g, " ")}</Badge>
                      <Badge tone="info">{f.source === "rule" ? "rule check" : "QA agent"}</Badge>
                      <Badge tone={f.resolution === "open" ? "warn" : "ok"}>{RES[f.resolution]}</Badge>
                    </div>
                    {f.resolution === "open" ? (
                      <div className="row no-print">
                        {s && <button className="btn btn-sm" onClick={() => act({ type: "resolve_flag", flagId: f.id, resolution: "user_approved" })} title="I can support this claim">I can support this</button>}
                        {s && <button className="btn btn-sm" onClick={() => act({ type: "resolve_flag", flagId: f.id, resolution: "excluded" })}>Exclude statement</button>}
                        {f.severity !== "critical" && <button className="btn btn-sm" onClick={() => act({ type: "resolve_flag", flagId: f.id, resolution: "dismissed" })}>Dismiss</button>}
                      </div>
                    ) : (
                      f.resolution !== "revised" && <button className="btn btn-sm no-print" onClick={() => act({ type: "resolve_flag", flagId: f.id, resolution: "open" })}>Reopen</button>
                    )}
                  </div>
                  <p style={{ margin: "0.4rem 0" }}>{f.message}</p>
                  {s && <details><summary>Show statement ({s.section})</summary><StatementCard s={s.statement} /></details>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
