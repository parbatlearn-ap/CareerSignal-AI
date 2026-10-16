"use client";

import { useEffect, useState } from "react";
import type { PublicProviderStatus } from "@/lib/providers";
import type { HealthStatus } from "@/lib/providers/types";

export default function Settings() {
  const [status, setStatus] = useState<(PublicProviderStatus & { health: HealthStatus | null }) | null>(null);
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health", { cache: "no-store" }).then((r) => r.json()).then(setStatus);
  }, []);

  const deep = async () => {
    setChecking(true);
    setStatus(await (await fetch("/api/health?deep=1", { cache: "no-store" })).json());
    setChecking(false);
  };
  const deleteAll = async () => {
    if (!confirm("Permanently delete ALL analyses stored for this browser? This cannot be undone.")) return;
    const d = await (await fetch("/api/data", { method: "DELETE" })).json();
    setMsg(`Deleted ${d.deleted} analysis/analyses.`);
  };

  return (
    <div className="container narrow">
      <h1>Settings &amp; privacy</h1>
      <div className="card">
        <h2>AI provider</h2>
        {!status ? <p>Loading…</p> : (
          <>
            <table>
              <tbody>
                <tr><th>Provider</th><td>{status.isMock ? "Mock / demo mode (rule-based, no external AI)" : status.provider}</td></tr>
                <tr><th>Model</th><td className="mono">{status.model}</td></tr>
                <tr><th>API key</th><td>{status.isMock ? "Not needed" : status.keyConfigured ? "Configured (server-side only, never sent to the browser)" : "MISSING"}</td></tr>
                <tr><th>Per-agent models</th><td className="mono">{Object.keys(status.perAgentModels).length ? JSON.stringify(status.perAgentModels) : "none"}</td></tr>
                <tr><th>Timeout</th><td>{status.timeoutMs} ms per call</td></tr>
              </tbody>
            </table>
            {status.warning && <p className="alert warn">{status.warning}</p>}
            <div className="row" style={{ marginTop: "0.75rem" }}>
              <button className="btn" onClick={deep} disabled={checking}>{checking ? "Checking…" : "Check provider health"}</button>
              {status.health && <span className={`badge ${status.health.ok ? "ok" : "bad"}`}>{status.health.ok ? "Reachable" : "Problem"}: {status.health.message}</span>}
            </div>
            <p className="hint">The provider is chosen server-side with <code>LLM_PROVIDER</code> (mock, gemini, groq) in <code>.env.local</code>. The app never switches providers automatically. Free-tier quotas are limited and change; quota errors are shown with a retry option.</p>
          </>
        )}
      </div>
      <div className="card">
        <h2>Your data</h2>
        <ul>
          <li>Stored as local files on this server (<code>DATA_DIR</code>), bound to a private, httpOnly cookie in this browser.</li>
          <li>Uploaded documents are parsed in memory and not kept; only text you save is stored.</li>
          <li>Agent run logs keep provider, model, timing and status - never prompts or API keys.</li>
          <li>Each analysis has its own consent setting for sending data to an external AI provider (see the analysis&apos;s Privacy page).</li>
        </ul>
        <div className="row">
          <a className="btn" href="/api/data">Export all my data (JSON)</a>
          <button className="btn btn-danger" onClick={deleteAll}>Delete all my data</button>
        </div>
        {msg && <p className="alert ok" role="status" style={{ marginTop: "0.75rem" }}>{msg}</p>}
      </div>
      <div className="card">
        <h2>What this tool will never do</h2>
        <ul>
          <li>Scrape LinkedIn, log in on your behalf or bypass access controls.</li>
          <li>Publish posts, apply for jobs or contact recruiters.</li>
          <li>Use protected attributes (age, gender, religion, health, ethnicity…) in recommendations.</li>
          <li>Present scores as hiring probabilities or compare you with an invented benchmark.</li>
        </ul>
      </div>
    </div>
  );
}
