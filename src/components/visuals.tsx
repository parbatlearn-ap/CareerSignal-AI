"use client";

import type { ScoreReport, Workspace } from "@/lib/schemas/workspace";
import { termGrounded } from "@/lib/analysis/taxonomy";
import { Badge, Bar } from "./ui";

/** Score breakdown with formulas; "insufficient data" instead of guessing. */
export function ScoreBreakdown({ scores }: { scores: ScoreReport }) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Heuristic assessment</h2>
          <p className="muted" style={{ margin: 0 }}>
            A diagnostic of your material - not a probability of interviews, offers or recruiter views.
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="stat-value">{scores.overall ?? "—"}</div>
          <div className="stat-label">{scores.overall === null ? "Insufficient data" : "out of 100"} · {scores.version}</div>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Component</th><th>Weight</th><th style={{ width: "30%" }}>Score</th><th>How it is calculated</th></tr>
          </thead>
          <tbody>
            {scores.components.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.label}</strong><br /><Badge>rule-based</Badge></td>
                <td>{Math.round(c.weight * 100)}%</td>
                <td>
                  {c.score === null ? (
                    <Badge tone="warn">Insufficient data</Badge>
                  ) : (
                    <>
                      <div className="spread"><span>{c.score}</span></div>
                      <Bar value={c.score} tone={c.score >= 70 ? "ok" : c.score >= 40 ? "" : "warn"} />
                    </>
                  )}
                  <details><summary>Details</summary><ul className="evidence-list">{c.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul></details>
                </td>
                <td className="hint">{c.formula}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="evidence-list">{scores.caveats.map((c, i) => <li key={i}>{c}</li>)}</ul>
    </div>
  );
}

/**
 * Career DNA Map: a radial map of evidenced skills grouped around domains
 * and outcomes. Node size = number of supporting claims (real counts only).
 */
export function DnaMap({ ws }: { ws: Omit<Workspace, "ownerId"> }) {
  const p = ws.profile;
  if (!p) return null;
  const nodes = p.skills
    .map((s) => ({ name: s.name, cat: s.category, n: ws.claims.filter((c) => termGrounded(c.text, s.name)).length }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 16);
  const domains = p.domains.slice(0, 4);
  const outcomes = ws.claims.filter((c) => c.strength === "impact" || c.strength === "outcome").length;
  const W = 640, H = 380, cx = W / 2, cy = H / 2;
  const color: Record<string, string> = { tool: "var(--brand)", method: "var(--ok)", domain: "var(--warn)", soft: "var(--info)", other: "var(--muted)" };
  return (
    <figure className="card" style={{ margin: "0 0 1rem" }}>
      <h3>Career DNA Map</h3>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Map of ${nodes.length} evidenced skills around ${domains.length} domains`}>
        <circle cx={cx} cy={cy} r={58} fill="var(--brand-soft)" stroke="var(--brand)" />
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--text)">{ws.goals?.currentRole || "You"}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="11" fill="var(--muted)">{outcomes} outcome-level claims</text>
        {domains.map((d, i) => {
          const a = (i / Math.max(1, domains.length)) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(a) * 95, y = cy + Math.sin(a) * 95;
          return <g key={d}><rect x={x - 60} y={y - 12} width={120} height={24} rx={12} fill="var(--warn-soft)" stroke="var(--warn)" /><text x={x} y={y + 4} textAnchor="middle" fontSize="11" fill="var(--text)">{d.length > 20 ? d.slice(0, 19) + "…" : d}</text></g>;
        })}
        {nodes.map((s, i) => {
          const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2 + 0.2;
          const r = 165;
          const x = cx + Math.cos(a) * r * 1.3, y = cy + Math.sin(a) * r * 0.95;
          const size = 6 + Math.min(10, s.n * 3);
          return (
            <g key={s.name}>
              <line x1={cx + Math.cos(a) * 60} y1={cy + Math.sin(a) * 60} x2={x} y2={y} stroke="var(--border)" />
              <circle cx={x} cy={y} r={size} fill={color[s.cat] ?? "var(--muted)"} opacity={s.n ? 0.9 : 0.35} />
              <text x={x} y={y + size + 12} textAnchor="middle" fontSize="10.5" fill="var(--text)">{s.name.length > 18 ? s.name.slice(0, 17) + "…" : s.name}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="hint">
        Dot size = number of your claims mentioning the skill (faded = listed but not yet evidenced). Colours: tools, methods, domains, soft skills. Built only from your material.
      </figcaption>
    </figure>
  );
}

/** Current vs target positioning, based on real gap counts. */
export function CurrentVsTarget({ ws }: { ws: Omit<Workspace, "ownerId"> }) {
  const g = ws.gaps ?? [];
  const opt = ws.positioning?.options.find((o) => o.id === ws.positioning?.selectedOptionId);
  const counts = {
    demonstrated: g.filter((r) => r.classification === "demonstrated").length,
    partial: g.filter((r) => r.classification === "partially_demonstrated").length,
    unsupported: g.filter((r) => r.classification === "claimed_but_unsupported").length,
    missing: g.filter((r) => r.classification === "not_evidenced").length,
  };
  const total = g.length || 1;
  const seg = (n: number, c: string, label: string) =>
    n > 0 && <span key={label} title={`${label}: ${n}`} style={{ width: `${(n / total) * 100}%`, background: c, display: "block", height: "100%" }} />;
  return (
    <div className="card">
      <h3>Current vs target positioning</h3>
      <div className="grid grid-2">
        <div>
          <div className="stat-label">Current story (from your material)</div>
          <p style={{ margin: "0.25rem 0" }}><strong>{ws.goals?.currentRole || "—"}</strong>{ws.profile?.domains.length ? ` · ${ws.profile.domains.join(", ")}` : ""}</p>
          <p className="hint">{ws.inputs.existingLinkedinText ? "Your pasted LinkedIn text is used as the 'before'." : "Paste your current LinkedIn text in Import for a fuller comparison."}</p>
        </div>
        <div>
          <div className="stat-label">Target story {opt ? "(selected positioning)" : ""}</div>
          <p style={{ margin: "0.25rem 0" }}><strong>{ws.goals?.targetRole || "—"}</strong></p>
          <p className="hint">{ws.positioning?.editedStatement ?? opt?.statement ?? "Choose a positioning option to define the target story."}</p>
        </div>
      </div>
      {g.length > 0 && (
        <>
          <div style={{ display: "flex", height: 14, borderRadius: 99, overflow: "hidden", background: "var(--surface-2)", marginTop: "0.5rem" }} role="img" aria-label={`${counts.demonstrated} demonstrated, ${counts.partial} partial, ${counts.unsupported} claimed but unsupported, ${counts.missing} not evidenced, of ${g.length} requirements`}>
            {seg(counts.demonstrated, "var(--ok)", "Demonstrated")}
            {seg(counts.partial, "var(--brand)", "Partial")}
            {seg(counts.unsupported, "var(--warn)", "Claimed, unsupported")}
            {seg(counts.missing, "var(--border)", "Not evidenced")}
          </div>
          <p className="hint">
            Of {g.length} key requirements from your {ws.market?.sampleSize ?? 0} supplied job description(s): {counts.demonstrated} demonstrated, {counts.partial} partial, {counts.unsupported} claimed but unsupported, {counts.missing} not evidenced in your material.
          </p>
        </>
      )}
    </div>
  );
}
