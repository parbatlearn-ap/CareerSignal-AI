"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/workspace-context";
import { AgentPanel, Badge, Empty, EvidenceBadge, PageHeader } from "@/components/ui";
import type { EvidenceStatus } from "@/lib/schemas/common";

const STRENGTH_HELP = { activity: "Activity - what you did", output: "Output - what you produced", outcome: "Outcome - what changed", impact: "Impact - measured result" };

export default function InterviewPage() {
  const { view, act } = useWorkspace();
  const [answer, setAnswer] = useState("");
  const [rewrite, setRewrite] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [claim, setClaim] = useState("");
  if (!view) return null;
  const { ws } = view;
  const open = ws.questions.filter((q) => q.state === "open");
  const done = ws.questions.filter((q) => q.state !== "open").length;
  const q = open[0];
  const qClaim = q?.claimId ? ws.claims.find((c) => c.id === q.claimId) : null;
  return (
    <>
      <PageHeader title="Evidence Interview" subtitle="One question at a time. Your answers are saved immediately - leave and resume whenever you like." />
      <AgentPanel agentId="evidence" runLabel="Mine evidence" dataUsed={["achievement statements from your confirmed profile", "your role titles and employers"]} />
      {ws.stepSeq.evidence && (
        <div className="card">
          <div className="spread">
            <h2>Question {Math.min(done + 1, ws.questions.length)} of {ws.questions.length}</h2>
            <Badge tone="info">{done} answered or skipped</Badge>
          </div>
          <div className="bar" style={{ margin: "0.5rem 0 1rem" }}><span style={{ width: `${ws.questions.length ? (done / ws.questions.length) * 100 : 100}%` }} /></div>
          {!q ? <p>All questions handled. You can re-run the analysis to use your answers.</p> : (
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (await act({ type: "answer_question", questionId: q.id, answer, confirmed, rewrite: rewrite || undefined })) { setAnswer(""); setRewrite(""); setConfirmed(false); }
            }}>
              <p style={{ fontSize: "1.05rem" }}><strong>{q.question}</strong></p>
              <p className="hint">Why we ask: {q.reason}</p>
              <div className="field">
                <label htmlFor="ans">Your answer</label>
                <textarea id="ans" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Be specific. If you don't know a number, say so - never estimate one you can't support." required />
              </div>
              {qClaim && (
                <div className="field">
                  <label htmlFor="rw">Optional: rewrite the claim in your own words</label>
                  <input id="rw" type="text" value={rewrite} onChange={(e) => setRewrite(e.target.value)} placeholder={qClaim.text} />
                </div>
              )}
              <label className="check"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> I confirm this is accurate and I could explain it in an interview.</label>
              <div className="row" style={{ marginTop: "0.75rem" }}>
                <button className="btn btn-primary" type="submit" disabled={!answer.trim()}>Save answer</button>
                <button className="btn" type="button" onClick={() => act({ type: "skip_question", questionId: q.id })}>Skip</button>
              </div>
            </form>
          )}
        </div>
      )}
      {ws.claims.length === 0 ? <Empty>No evidence claims yet.</Empty> : (
        <div className="card">
          <h2>Evidence ledger ({ws.claims.length})</h2>
          <p className="muted">Every claim keeps its source text. Only numbers that appear in your own words are recorded as metrics.</p>
          <div className="table-wrap"><table>
            <thead><tr><th>Claim</th><th>Strength</th><th>Metrics</th><th>Status</th></tr></thead>
            <tbody>{ws.claims.map((c) => (
              <tr key={c.id}>
                <td>{c.text}<details><summary>Source</summary><p className="hint pre">{c.sourceText}</p></details></td>
                <td><Badge title={STRENGTH_HELP[c.strength]}>{c.strength}</Badge></td>
                <td className="mono">{c.metrics.join(", ") || "—"}</td>
                <td>
                  <EvidenceBadge status={c.status} />
                  <label className="sr-only" htmlFor={`st-${c.id}`}>Change status</label>
                  <select id={`st-${c.id}`} value={c.status} onChange={(e) => act({ type: "set_claim_status", claimId: c.id, status: e.target.value as EvidenceStatus })} style={{ marginTop: 4 }}>
                    <option value="verified_by_user">Verified by me</option>
                    <option value="user_provided">From my material</option>
                    <option value="inferred_needs_confirmation">Needs confirmation</option>
                    <option value="unsupported">Unsupported - don&apos;t use</option>
                  </select>
                </td>
              </tr>))}
            </tbody>
          </table></div>
          <hr />
          <form className="row" onSubmit={async (e) => { e.preventDefault(); if (await act({ type: "add_claim", text: claim, experienceId: null })) setClaim(""); }}>
            <label htmlFor="newclaim" className="sr-only">Add an achievement</label>
            <input id="newclaim" type="text" value={claim} onChange={(e) => setClaim(e.target.value)} placeholder="Add an achievement in your own words…" style={{ flex: 1 }} />
            <button className="btn" type="submit" disabled={claim.trim().length < 5}>Add claim</button>
          </form>
          {ws.evidenceNotes.length > 0 && <ul className="evidence-list">{ws.evidenceNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
        </div>
      )}
    </>
  );
}
