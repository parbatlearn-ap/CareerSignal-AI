"use client";

import { useWorkspace } from "@/components/workspace-context";
import { AgentPanel, Badge, Bar, Empty, FeedbackWidget, PageHeader } from "@/components/ui";
import { formatFrequency } from "@/lib/analysis/market";

export default function MarketPage() {
  const { view } = useWorkspace();
  if (!view) return null;
  const m = view.ws.market;
  return (
    <>
      <PageHeader title="Market Signals" subtitle="Requirements counted from the job descriptions you supplied - nothing else." />
      <AgentPanel agentId="market" runLabel="Analyse job descriptions" dataUsed={["your supplied job descriptions", "target role and market from Goals"]} />
      {!m ? <Empty>Add job descriptions in Import, then run the Market Intelligence Agent.</Empty> : (
        <>
          <div className={`alert ${m.directional ? "warn" : "info"}`}>
            <strong>Sample: {m.sampleSize} job description{m.sampleSize === 1 ? "" : "s"}.</strong>{m.directional && " Findings are directional."}
            <ul style={{ margin: "0.4rem 0 0" }}>{m.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </div>
          <div className="grid grid-3">
            {m.requirements.slice(0, 12).map((r) => (
              <div className="card" key={r.term} style={{ margin: 0 }}>
                <div className="spread"><strong>{r.term}</strong><Badge>{r.kind}</Badge></div>
                <div className="stat-value" style={{ fontSize: "1.3rem", marginTop: 6 }}>{formatFrequency(r.count, r.total)}</div>
                <div className="stat-label">job descriptions mention it</div>
                <Bar value={(r.count / r.total) * 100} />
              </div>
            ))}
          </div>
          <div className="card" style={{ marginTop: "1rem" }}>
            <h2>All requirements ({m.requirements.length})</h2>
            <div className="table-wrap"><table>
              <thead><tr><th>Term</th><th>Type</th><th>Frequency</th><th>Found in</th></tr></thead>
              <tbody>{m.requirements.map((r) => (
                <tr key={r.term}><td>{r.term}</td><td>{r.kind}</td><td>{formatFrequency(r.count, r.total)}</td>
                  <td className="hint">{r.jdIds.map((id) => view.ws.inputs.jobDescriptions.find((j) => j.id === id)?.title ?? id).join("; ")}</td></tr>))}
              </tbody>
            </table></div>
            {m.droppedUngroundedTerms.length > 0 && <p className="hint">Dropped (not found in JD text): {m.droppedUngroundedTerms.join(", ")}</p>}
          </div>
          <div className="card">
            <h2>Per job description</h2>
            <div className="table-wrap"><table>
              <thead><tr><th>Role</th><th>Seniority signal</th><th>Experience</th><th>Responsibilities (sample)</th></tr></thead>
              <tbody>{m.perJd.map((p) => {
                const src = m.sources.find((s) => s.jdId === p.jdId);
                return (<tr key={p.jdId}><td><strong>{src?.title}</strong>{src?.company && <div className="hint">{src.company}</div>}{src?.synthetic && <Badge tone="warn">Synthetic</Badge>}</td>
                  <td>{p.seniority}</td><td>{p.experienceRequirement ?? "—"}</td><td className="hint">{p.responsibilities.slice(0, 3).join(" · ") || "—"}</td></tr>);
              })}</tbody>
            </table></div>
            <p className="hint">Sources: {m.sources.map((s) => `${s.source} (${s.providedAt})`).filter((v, i, a) => a.indexOf(v) === i).join("; ")}</p>
          </div>
          <FeedbackWidget section="market" />
        </>
      )}
    </>
  );
}
