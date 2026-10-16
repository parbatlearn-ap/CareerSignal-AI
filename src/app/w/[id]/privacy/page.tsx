"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/workspace-context";
import { PageHeader } from "@/components/ui";

export default function PrivacyPage() {
  const { view, act } = useWorkspace();
  const router = useRouter();
  const [title, setTitle] = useState(view?.ws.title ?? "");
  if (!view) return null;
  const { ws, provider } = view;
  return (
    <>
      <PageHeader title="Privacy & data" subtitle="Consent, export and deletion for this analysis." />
      <div className="card">
        <h2>AI provider consent</h2>
        <p>Configured provider: <strong>{provider.isMock ? "none (demo mode - rule-based, nothing leaves this server)" : `${provider.provider} · ${provider.model}`}</strong></p>
        <label className="check">
          <input type="checkbox" checked={ws.consent.sendToProvider} onChange={(e) => act({ type: "set_consent", sendToProvider: e.target.checked })} />
          <span>Allow sending this analysis&apos;s resume, profile and job-description text to the configured external AI provider for processing.
            <span className="hint" style={{ display: "block" }}>Required for non-demo providers. Check the provider&apos;s own data-use terms (free tiers may use data differently from paid tiers).</span></span>
        </label>
        <label className="check" style={{ marginTop: "0.5rem" }}>
          <input type="checkbox" checked={ws.consent.retainRunLogs} onChange={(e) => act({ type: "set_consent", retainRunLogs: e.target.checked })} />
          <span>Keep full agent run history (provider, model, timing, status - never prompts). If off, only the latest run per agent is kept.</span>
        </label>
        {ws.consent.acceptedAt && <p className="hint">Last changed {new Date(ws.consent.acceptedAt).toLocaleString()}.</p>}
      </div>
      <div className="card">
        <h2>Name</h2>
        <form className="row" onSubmit={(e) => { e.preventDefault(); if (title.trim()) act({ type: "rename", title: title.trim() }); }}>
          <label htmlFor="t" className="sr-only">Analysis name</label>
          <input id="t" type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={{ maxWidth: 360 }} />
          <button className="btn" type="submit">Rename</button>
        </form>
      </div>
      <div className="card">
        <h2>Export or delete</h2>
        <p className="muted">The JSON export contains everything stored for this analysis. Deletion is permanent.</p>
        <div className="row">
          <a className="btn" href={`/api/workspaces/${ws.id}/export?format=json`}>Export this analysis (JSON)</a>
          <button className="btn btn-danger" onClick={async () => {
            if (!confirm("Permanently delete this analysis and all its data?")) return;
            const r = await fetch(`/api/workspaces/${ws.id}`, { method: "DELETE" });
            if (r.ok) router.push("/workspaces");
          }}>Delete this analysis</button>
        </div>
        <p className="hint" style={{ marginTop: "0.75rem" }}>Feedback entries saved: {ws.feedback.length}. Agent runs recorded: {ws.agentRuns.length}.</p>
      </div>
    </>
  );
}
