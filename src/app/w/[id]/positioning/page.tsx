"use client";

import { useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/components/workspace-context";
import { AgentPanel, Badge, Empty, FeedbackWidget, PageHeader } from "@/components/ui";

export default function PositioningPage() {
  const { view, act } = useWorkspace();
  const [edited, setEdited] = useState<string | null>(null);
  if (!view) return null;
  const { ws } = view;
  const p = ws.positioning;
  const claim = (id: string) => ws.claims.find((c) => c.id === id);
  const selected = p?.options.find((o) => o.id === p.selectedOptionId);
  return (
    <>
      <PageHeader title="Positioning" subtitle="Market positioning hypotheses built from your evidence and the supplied job descriptions. You choose." />
      <AgentPanel agentId="positioning" runLabel="Generate options" dataUsed={["gap matrix", "evidence claims", "domains", "goals"]} />
      {!p ? <Empty>Run the gap analysis first.</Empty> : (
        <>
          <p className="muted"><strong>Recommendation:</strong> {p.options.find((o) => o.id === p.recommendedOptionId)?.name} - {p.recommendationReason}</p>
          <div className={`grid grid-${p.options.length === 3 ? 3 : 2}`}>
            {p.options.map((o) => (
              <div key={o.id} className="card" style={{ margin: 0, borderColor: o.id === p.selectedOptionId ? "var(--brand)" : undefined, borderWidth: o.id === p.selectedOptionId ? 2 : 1 }}>
                <div className="row">
                  {o.id === p.recommendedOptionId && <Badge tone="brand">Recommended</Badge>}
                  {o.id === p.selectedOptionId && <Badge tone="ok">Selected</Badge>}
                  {o.stretch && <Badge tone="warn">Stretch</Badge>}
                  <Badge>confidence: {o.confidence}</Badge>
                </div>
                <h3 style={{ marginTop: "0.5rem" }}>{o.name}</h3>
                <p>{o.statement}</p>
                <p className="hint">{o.confidenceReason}</p>
                <h4>Audience</h4><p className="hint">{o.audience}</p>
                <h4>Proof points</h4>
                <ul className="evidence-list">{o.proofPointClaimIds.map((id) => <li key={id}>“{claim(id)?.text}”</li>)}{o.proofPointClaimIds.length === 0 && <li>None - weak option.</li>}</ul>
                <h4>Strengths</h4><ul className="evidence-list">{o.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                <h4>Risks</h4><ul className="evidence-list">{o.risks.map((s, i) => <li key={i}>{s}</li>)}</ul>
                <h4>Trade-offs</h4><ul className="evidence-list">{o.tradeOffs.map((s, i) => <li key={i}>{s}</li>)}</ul>
                <h4>Do not claim</h4><ul className="evidence-list">{o.doNotClaim.map((s, i) => <li key={i}>{s}</li>)}</ul>
                <p className="hint">Headline direction: {o.headlineDirection}</p>
                <button className={`btn ${o.id === p.selectedOptionId ? "" : "btn-primary"}`} onClick={() => { setEdited(null); act({ type: "choose_positioning", optionId: o.id, editedStatement: null }); }}>
                  {o.id === p.selectedOptionId ? "Selected" : "Choose this positioning"}
                </button>
              </div>
            ))}
          </div>
          {selected && (
            <div className="card" style={{ marginTop: "1rem" }}>
              <h3>Your positioning statement</h3>
              <p className="muted">Edit it into your own words. Your version is treated as approved and used by the LinkedIn and Brand agents.</p>
              <label htmlFor="stmt" className="sr-only">Positioning statement</label>
              <textarea id="stmt" value={edited ?? p.editedStatement ?? selected.statement} onChange={(e) => setEdited(e.target.value)} />
              <div className="row" style={{ marginTop: "0.5rem" }}>
                <button className="btn btn-primary" disabled={edited === null} onClick={async () => { if (await act({ type: "choose_positioning", optionId: selected.id, editedStatement: edited })) setEdited(null); }}>Save my statement</button>
                <Link className="btn" href={`/w/${ws.id}/linkedin`}>Continue to LinkedIn Builder</Link>
              </div>
            </div>
          )}
          <FeedbackWidget section="positioning" />
        </>
      )}
    </>
  );
}
