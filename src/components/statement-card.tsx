"use client";

import { useState } from "react";
import type { EditableStatement } from "@/lib/schemas/workspace";
import { Badge, CopyButton, EvidenceBadge, StatementBadge } from "./ui";
import { useWorkspace } from "./workspace-context";

/**
 * Evidence Traceability: every generated sentence shows its status and, on
 * expand, the exact user-supplied evidence behind it. Users can edit,
 * confirm, exclude or restore each statement.
 */
export function StatementCard({ s, limit, label }: { s: EditableStatement; limit?: number; label?: string }) {
  const { view, act } = useWorkspace();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(s.text);
  if (!view) return null;
  const claims = s.evidenceClaimIds.map((id) => view.ws.claims.find((c) => c.id === id)).filter(Boolean);
  const safety = s.explanation.split(" | Safety: ")[1];
  return (
    <div className={`statement ${s.status}`}>
      <div className="spread">
        <div className="row">
          {label && <strong>{label}</strong>}
          <StatementBadge status={s.status} approved={s.userApproved} />
          {s.userEdited && <Badge tone="brand">Edited by you</Badge>}
          {limit && (
            <span className={`hint ${s.text.length > limit ? "" : ""}`} style={{ color: s.text.length > limit ? "var(--bad)" : undefined }}>
              {s.text.length} chars (commonly cited limit {limit}; verify in LinkedIn)
            </span>
          )}
        </div>
        <div className="row no-print">
          <CopyButton text={s.text} />
          <button className="btn btn-sm" onClick={() => { setText(s.text); setEditing(!editing); }}>{editing ? "Cancel" : "Edit"}</button>
          {s.status === "needs_confirmation" && !s.userApproved && (
            <button className="btn btn-sm" onClick={() => act({ type: "set_statement", ref: s.id, action: "approve" })} title="I can support this statement">
              Confirm
            </button>
          )}
          {s.status !== "excluded" ? (
            <button className="btn btn-sm" onClick={() => act({ type: "set_statement", ref: s.id, action: "exclude" })}>Exclude</button>
          ) : (
            <button className="btn btn-sm" onClick={() => act({ type: "set_statement", ref: s.id, action: "restore" })}>Restore</button>
          )}
        </div>
      </div>
      {editing ? (
        <div style={{ marginTop: "0.5rem" }}>
          <label className="sr-only" htmlFor={`edit-${s.id}`}>Edit statement</label>
          <textarea id={`edit-${s.id}`} value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 80 }} />
          <div className="row" style={{ marginTop: "0.4rem" }}>
            <button className="btn btn-primary btn-sm" onClick={async () => { if (await act({ type: "edit_statement", ref: s.id, text })) setEditing(false); }}>
              Save edit
            </button>
            <span className="hint">Edits are re-checked for unsupported numbers, credentials and titles.</span>
          </div>
        </div>
      ) : (
        <p className="statement-text" style={{ margin: "0.45rem 0 0" }}>{s.text}</p>
      )}
      {safety && <p className="hint" style={{ color: "var(--warn)" }}>⚠ {safety}</p>}
      <details>
        <summary>Why / evidence ({claims.length})</summary>
        <ul className="evidence-list">
          <li>{s.explanation.split(" | Safety: ")[0]}</li>
          {claims.length === 0 && <li>No supporting evidence linked - confirm only if you can stand behind it.</li>}
          {claims.map((c) => (
            <li key={c!.id}>
              <EvidenceBadge status={c!.status} /> “{c!.sourceText}”
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
