"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/workspace-context";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { diffVersions } from "@/lib/analysis/versionDiff";

const arrow = (a: number | null, b: number | null) => (a === null || b === null ? `${a ?? "n/a"} → ${b ?? "n/a"}` : `${a} → ${b} (${b - a >= 0 ? "+" : ""}${b - a})`);

export default function VersionsPage() {
  const { view, act } = useWorkspace();
  const [label, setLabel] = useState("");
  const vs = view?.ws.versions ?? [];
  const [a, setA] = useState<string>(vs.at(-2)?.id ?? "");
  const [b, setB] = useState<string>(vs.at(-1)?.id ?? "");
  if (!view) return null;
  const va = vs.find((v) => v.id === a);
  const vb = vs.find((v) => v.id === b);
  const d = va && vb ? diffVersions(va, vb) : null;
  return (
    <>
      <PageHeader title="Versions" subtitle="Snapshots of your analysis. Re-analyse after changing inputs, then compare." />
      <div className="card">
        <p className="muted">A version is saved automatically when the Action Plan completes. You can also save one now. To re-analyse: update Import or Goals, then use “Run next steps” - stale steps re-run and your edits are kept.</p>
        <form className="row" onSubmit={async (e) => { e.preventDefault(); if (await act({ type: "snapshot", label: label || undefined })) setLabel(""); }}>
          <label htmlFor="vl" className="sr-only">Version label</label>
          <input id="vl" type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" style={{ maxWidth: 260 }} />
          <button className="btn" type="submit">Save snapshot</button>
        </form>
      </div>
      {vs.length === 0 ? <Empty>No versions yet.</Empty> : (
        <>
          <div className="card">
            <h2>History</h2>
            <ul>{vs.map((v) => <li key={v.id}><strong>{v.label}</strong> · {new Date(v.createdAt).toLocaleString()} · overall {v.scores?.overall ?? "n/a"} · {v.jdCount} JD(s) · {v.provider}</li>)}</ul>
          </div>
          {vs.length >= 2 && (
            <div className="card">
              <h2>Compare</h2>
              <div className="row">
                <label htmlFor="va">From</label>
                <select id="va" value={a} onChange={(e) => setA(e.target.value)} style={{ maxWidth: 240 }}>{vs.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select>
                <label htmlFor="vb">To</label>
                <select id="vb" value={b} onChange={(e) => setB(e.target.value)} style={{ maxWidth: 240 }}>{vs.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select>
              </div>
              {d && va && vb && (
                <div className="stack" style={{ marginTop: "1rem" }}>
                  <p><strong>Overall heuristic score:</strong> {arrow(d.overall.from, d.overall.to)} <span className="hint">- a change in this diagnostic does not predict hiring outcomes.</span></p>
                  <p><strong>Job descriptions analysed:</strong> {d.jd.from} → {d.jd.to}</p>
                  <table><thead><tr><th>Component</th><th>Change</th></tr></thead><tbody>{d.scoreChanges.map((c) => <tr key={c.label}><td>{c.label}</td><td>{arrow(c.from, c.to)}</td></tr>)}</tbody></table>
                  <p><strong>Evidence:</strong> {d.claimChanges.map((c) => `${c.status.replace(/_/g, " ")} ${c.from}→${c.to}`).join(" · ") || "no claims"}</p>
                  <p><strong>Gaps:</strong> {d.gapChanges.map((c) => `${c.classification.replace(/_/g, " ")} ${c.from}→${c.to}`).join(" · ") || "none"}</p>
                  <p><strong>Positioning:</strong> {d.positioningChanged ? <>{va.positioningName} → {vb.positioningName}</> : <Badge>unchanged</Badge>}</p>
                  <div className="grid grid-2">
                    <div><h3>Headline - {va.label}</h3><p className="pre">{va.headline ?? "—"}</p><h3>About</h3><p className="pre hint">{va.about || "—"}</p></div>
                    <div><h3>Headline - {vb.label} {d.headlineChanged && <Badge tone="info">changed</Badge>}</h3><p className="pre">{vb.headline ?? "—"}</p><h3>About {d.aboutChanged && <Badge tone="info">changed</Badge>}</h3><p className="pre hint">{vb.about || "—"}</p></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
