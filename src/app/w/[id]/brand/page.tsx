"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/workspace-context";
import { AgentPanel, Badge, Empty, FeedbackWidget, PageHeader } from "@/components/ui";
import { StatementCard } from "@/components/statement-card";

function DayCell({ day }: { day: number }) {
  const { view, act } = useWorkspace();
  const c = view!.ws.brand!.calendar.find((x) => x.day === day)!;
  const [edit, setEdit] = useState(false);
  const [note, setNote] = useState(c.note);
  return (
    <div className={`cal-day ${c.activity === "post" ? "post" : ""} ${c.done ? "done" : ""}`}>
      <div className="spread"><strong>Day {day}</strong>
        <label className="check" style={{ fontSize: "0.72rem" }}><input type="checkbox" checked={c.done} onChange={(e) => act({ type: "edit_calendar", day, done: e.target.checked })} aria-label={`Mark day ${day} done`} />done</label>
      </div>
      <div className="hint" style={{ textTransform: "capitalize" }}>{c.activity}</div>
      {edit ? (
        <>
          <label className="sr-only" htmlFor={`d${day}`}>Note for day {day}</label>
          <textarea id={`d${day}`} value={note} onChange={(e) => setNote(e.target.value)} style={{ minHeight: 60, fontSize: "0.78rem" }} />
          <button className="btn btn-sm" onClick={async () => { if (await act({ type: "edit_calendar", day, note })) setEdit(false); }}>Save</button>
        </>
      ) : (
        <button onClick={() => setEdit(true)} style={{ all: "unset", cursor: "pointer", display: "block" }} title="Click to edit">{c.note || "—"}</button>
      )}
    </div>
  );
}

export default function BrandPage() {
  const { view } = useWorkspace();
  if (!view) return null;
  const b = view.ws.brand;
  return (
    <>
      <PageHeader title="Personal Brand Studio" subtitle="Grounded in your real work. Nothing is published - you decide what to post." />
      <AgentPanel agentId="brand" runLabel="Create brand plan" dataUsed={["approved positioning", "evidence claims", "demonstrated skills and domains", "tone preference"]} />
      {!b ? <Empty>Choose a positioning option, then run the Personal Brand Strategist.</Empty> : (
        <>
          <div className="card"><h2>Brand statement</h2><StatementCard s={b.brandStatement} /><p className="hint" style={{ marginTop: "0.5rem" }}>Audience: {b.audience}</p></div>
          <div className="grid grid-2">
            {b.pillars.map((p) => (
              <div className="card" key={p.id} style={{ margin: 0 }}>
                <h3>{p.name}</h3><p>{p.pointOfView}</p>
                <p className="hint">{p.evidenceClaimIds.length ? `Grounded in ${p.evidenceClaimIds.length} of your claims.` : "No direct evidence yet - write as a learner."}</p>
              </div>
            ))}
          </div>
          <div className="card" style={{ marginTop: "1rem" }}>
            <h2>10 post ideas</h2>
            <ol>{b.postIdeas.map((p) => (
              <li key={p.id} style={{ marginBottom: "0.5rem" }}>
                <strong>{p.title}</strong> <Badge>{p.format.replace("_", " ")}</Badge> <Badge tone="brand">{b.pillars.find((x) => x.id === p.pillarId)?.name}</Badge>
                {p.isHypotheticalExample && <Badge tone="warn">Example only - replace with a real experience</Badge>}
                <div className="hint">{p.hook}</div>
              </li>))}
            </ol>
          </div>
          <div className="card">
            <h2>30-day starter calendar</h2>
            <p className="hint">Click a note to edit it. Tick days off as you go.</p>
            <div className="calendar">{b.calendar.map((c) => <DayCell key={c.day} day={c.day} />)}</div>
          </div>
          <div className="grid grid-3">
            <div className="card" style={{ margin: 0 }}><h3>Tone guide</h3><ul>{b.toneGuide.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
            <div className="card" style={{ margin: 0 }}><h3>Avoid</h3><ul>{b.avoid.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
            <div className="card" style={{ margin: 0 }}><h3>Engagement routine</h3><ul>{b.engagementRoutine.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
          </div>
          <FeedbackWidget section="brand" />
        </>
      )}
    </>
  );
}
