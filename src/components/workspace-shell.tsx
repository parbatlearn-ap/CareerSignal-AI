"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkspace } from "./workspace-context";
import { ErrorBanner } from "./ui";

const ICON: Record<string, string> = { done: "✓", ready: "•", stale: "!", failed: "×", needs_input: "?", locked: "" };

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { view, loading, running, runUntilGate } = useWorkspace();
  const path = usePathname();
  if (loading) return <div className="container"><p>Loading…</p></div>;
  if (!view)
    return (
      <div className="container narrow">
        <h1>Analysis not found</h1>
        <p>It may have been deleted, or it belongs to a different browser session.</p>
        <Link className="btn" href="/workspaces">My analyses</Link>
      </div>
    );
  const { ws, steps, next, provider } = view;
  const runningInfo = running ? view.agents.find((a) => a.id === running) : null;
  return (
    <div className="container">
      <div className="spread" style={{ marginBottom: "1rem" }}>
        <div className="row">
          <Link href={`/w/${ws.id}`} style={{ fontWeight: 700, color: "var(--text)", textDecoration: "none" }}>{ws.title}</Link>
          {ws.isDemo && <span className="badge warn">Synthetic demo data</span>}
          <span className={`badge ${provider.isMock ? "info" : "brand"}`} title="Configured server-side">
            {provider.isMock ? "Demo mode · rule-based agents" : `${provider.provider} · ${provider.model}`}
          </span>
        </div>
        <div className="row no-print">
          {next.type === "run" && (
            <button className="btn btn-primary" onClick={runUntilGate} disabled={Boolean(running)}>
              {runningInfo ? `Running ${runningInfo.title}…` : "Run next steps"}
            </button>
          )}
          {next.type === "needs_input" && <span className="badge warn" role="status">Your input needed: {next.message}</span>}
          {next.type === "complete" && <span className="badge ok">Analysis complete</span>}
        </div>
      </div>
      {!provider.isMock && !ws.consent.sendToProvider && (
        <div className="alert warn">
          An external AI provider ({provider.provider}) is configured. Nothing is sent until you allow it on the <Link href={`/w/${ws.id}/privacy`}>Privacy</Link> page.
        </div>
      )}
      <ErrorBanner />
      <div className="ws-shell">
        <nav className="stepper" aria-label="Workflow steps">
          <ol>
            <li>
              <Link href={`/w/${ws.id}`} aria-current={path === `/w/${ws.id}` ? "page" : undefined}>
                <span className="dot ready" aria-hidden>◎</span> Overview
              </Link>
            </li>
            {steps.map((s, i) => (
              <li key={s.id}>
                <Link href={s.href} aria-current={path === s.href ? "page" : undefined} title={s.note ?? undefined}>
                  <span className={`dot ${s.status}`} aria-hidden>{ICON[s.status] || i + 1}</span>
                  <span>{s.label}<span className="sr-only"> - {s.status.replace("_", " ")}</span></span>
                </Link>
              </li>
            ))}
            <li><Link href={`/w/${ws.id}/versions`} aria-current={path.endsWith("/versions") ? "page" : undefined}><span className="dot" aria-hidden>⇄</span> Versions</Link></li>
            <li><Link href={`/w/${ws.id}/privacy`} aria-current={path.endsWith("/privacy") ? "page" : undefined}><span className="dot" aria-hidden>🔒</span> Privacy</Link></li>
          </ol>
        </nav>
        <div>{children}</div>
      </div>
    </div>
  );
}
