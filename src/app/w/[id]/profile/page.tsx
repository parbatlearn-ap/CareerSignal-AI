"use client";

import { useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/components/workspace-context";
import { AgentPanel, Badge, Empty, PageHeader } from "@/components/ui";
import { DnaMap } from "@/components/visuals";
import type { Experience } from "@/lib/schemas/workspace";

function ExperienceRow({ e }: { e: Experience }) {
  const { act } = useWorkspace();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ title: e.title, employer: e.employer, start: e.start ?? "", end: e.end ?? "" });
  if (edit)
    return (
      <tr>
        <td colSpan={4}>
          <div className="grid grid-4">
            {(["title", "employer", "start", "end"] as const).map((k) => (
              <div className="field" key={k}><label htmlFor={`${e.id}-${k}`}>{k}</label><input id={`${e.id}-${k}`} type="text" value={f[k]} onChange={(x) => setF({ ...f, [k]: x.target.value })} /></div>
            ))}
          </div>
          <div className="row">
            <button className="btn btn-primary btn-sm" onClick={async () => { if (await act({ type: "edit_experience", id: e.id, title: f.title, employer: f.employer, start: f.start || null, end: f.end || null })) setEdit(false); }}>Save</button>
            <button className="btn btn-sm" onClick={() => setEdit(false)}>Cancel</button>
          </div>
        </td>
      </tr>
    );
  return (
    <tr>
      <td><strong>{e.title || "—"}</strong> {e.locked && <Badge tone="brand">Edited by you</Badge>}</td>
      <td>{e.employer || <Badge tone="warn">missing</Badge>}</td>
      <td>{e.start ?? "?"} – {e.end ?? "?"}</td>
      <td className="row">
        <button className="btn btn-sm" onClick={() => setEdit(true)}>Edit</button>
        <button className="btn btn-sm btn-danger" onClick={() => act({ type: "remove_profile_item", kind: "experience", id: e.id })}>Remove</button>
      </td>
    </tr>
  );
}

function AddItem({ kind, label }: { kind: "skill" | "certification" | "project"; label: string }) {
  const { act } = useWorkspace();
  const [v, setV] = useState("");
  return (
    <form className="row" onSubmit={async (e) => { e.preventDefault(); if (v.trim() && (await act({ type: "add_profile_item", kind, name: v.trim() }))) setV(""); }}>
      <label className="sr-only" htmlFor={`add-${kind}`}>{label}</label>
      <input id={`add-${kind}`} type="text" value={v} onChange={(e) => setV(e.target.value)} placeholder={label} style={{ maxWidth: 280 }} />
      <button className="btn btn-sm" type="submit">Add</button>
    </form>
  );
}

export default function ProfilePage() {
  const { view, act } = useWorkspace();
  if (!view) return null;
  const { ws, consistency } = view;
  const p = ws.profile;
  return (
    <>
      <PageHeader title="Career Profile" subtitle="Check what was extracted. Correct anything wrong - your edits are locked and never overwritten by agents." />
      <AgentPanel agentId="discovery" runLabel="Extract profile" dataUsed={["your resume/profile text", "your pasted LinkedIn text", "current and target role from Goals"]} />
      {!p ? <Empty>Run the Career Discovery Agent to extract your profile.</Empty> : (
        <>
          {!p.confirmed ? (
            <div className="alert warn spread">
              <span><strong>Review needed.</strong> Confirm this profile is accurate before evidence mining starts.</span>
              <button className="btn btn-primary" onClick={() => act({ type: "confirm_profile" })}>Confirm profile is accurate</button>
            </div>
          ) : (
            <div className="alert ok spread"><span>Profile confirmed.</span><Link className="btn btn-sm" href={`/w/${ws.id}/interview`}>Continue to Evidence Interview</Link></div>
          )}
          {(p.ambiguities.length > 0 || p.unknowns.length > 0 || consistency.length > 0) && (
            <div className="card">
              <h3>Ambiguities, unknowns and inconsistencies</h3>
              <ul>
                {p.unknowns.map((u, i) => <li key={`u${i}`}><Badge tone="info">Unknown</Badge> {u}</li>)}
                {p.ambiguities.map((u, i) => <li key={`a${i}`}><Badge tone="warn">Ambiguous</Badge> {u}</li>)}
                {consistency.map((c, i) => <li key={`c${i}`}><Badge tone={c.severity === "major" ? "bad" : "warn"}>Consistency</Badge> {c.message}</li>)}
              </ul>
            </div>
          )}
          <div className="card">
            <h3>Roles ({p.experiences.length})</h3>
            <div className="table-wrap"><table>
              <thead><tr><th>Title</th><th>Employer</th><th>Dates</th><th></th></tr></thead>
              <tbody>{p.experiences.map((e) => <ExperienceRow key={e.id} e={e} />)}</tbody>
            </table></div>
          </div>
          <div className="grid grid-2">
            <div className="card">
              <h3>Skills ({p.skills.length})</h3>
              <div className="row" style={{ marginBottom: "0.6rem" }}>
                {p.skills.map((s) => (
                  <span key={s.id} className="badge" title={s.sourceQuote}>
                    {s.name}
                    <button aria-label={`Remove ${s.name}`} onClick={() => act({ type: "remove_profile_item", kind: "skill", id: s.id })} style={{ border: 0, background: "none", cursor: "pointer", color: "inherit" }}>×</button>
                  </span>
                ))}
              </div>
              <AddItem kind="skill" label="Add a skill you can evidence" />
            </div>
            <div className="card">
              <h3>Domains</h3>
              <p>{p.domains.length ? p.domains.join(", ") : <span className="muted">None detected.</span>}</p>
              <h3>Education</h3>
              <ul>{p.education.map((e) => <li key={e.id}>{e.text}</li>)}{p.education.length === 0 && <li className="muted">Not found</li>}</ul>
            </div>
            <div className="card">
              <h3>Projects</h3>
              <ul>{p.projects.map((x) => <li key={x.id}><strong>{x.name}</strong> - {x.description} <button className="btn btn-sm" onClick={() => act({ type: "remove_profile_item", kind: "project", id: x.id })}>Remove</button></li>)}</ul>
              <AddItem kind="project" label="Add a project" />
            </div>
            <div className="card">
              <h3>Certifications</h3>
              <ul>{p.certifications.map((x) => <li key={x.id}>{x.name} {x.origin === "user" && <Badge tone="brand">Added by you</Badge>} <button className="btn btn-sm" onClick={() => act({ type: "remove_profile_item", kind: "certification", id: x.id })}>Remove</button></li>)}
                {p.certifications.length === 0 && <li className="muted">None found in your material.</li>}</ul>
              <AddItem kind="certification" label="Add a certification you hold" />
            </div>
          </div>
          <DnaMap ws={ws} />
        </>
      )}
    </>
  );
}
