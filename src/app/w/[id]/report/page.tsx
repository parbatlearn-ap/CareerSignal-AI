"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/components/workspace-context";
import { CopyButton, FeedbackWidget, PageHeader } from "@/components/ui";
import { CurrentVsTarget, ScoreBreakdown } from "@/components/visuals";

export default function ReportPage() {
  const { view } = useWorkspace();
  const [md, setMd] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const id = view?.ws.id;
  const updated = view?.ws.updatedAt;
  useEffect(() => {
    if (!id) return;
    fetch(`/api/workspaces/${id}/export?format=md`, { cache: "no-store" }).then(async (r) => {
      if (r.ok) { setMd(await r.text()); setErr(null); } else { setMd(null); setErr((await r.json()).error); }
    });
  }, [id, updated]);
  if (!view) return null;
  const { ws } = view;
  const sections = md ? md.split(/\n(?=## )/) : [];
  return (
    <>
      <PageHeader title="Career Positioning Report" subtitle="Executive summary first; expand sections for detail.">
        <a className={`btn btn-primary ${err ? "disabled" : ""}`} href={`/api/workspaces/${ws.id}/export?format=md`} aria-disabled={Boolean(err)}>Download Markdown</a>
        <a className="btn" href={`/api/workspaces/${ws.id}/export?format=html`} target="_blank" rel="noreferrer">Print-friendly HTML</a>
        <a className="btn" href={`/api/workspaces/${ws.id}/export?format=json`}>Export data (JSON)</a>
      </PageHeader>
      {err && <div className="alert bad">{err} <Link href={`/w/${ws.id}/qa`}>Go to QA Review</Link></div>}
      {!ws.plan && !err && <div className="alert info">The report fills in as agents complete. Some sections are still empty.</div>}
      {ws.gaps && <CurrentVsTarget ws={ws} />}
      {ws.scores && ws.profile && <ScoreBreakdown scores={ws.scores} />}
      {sections.map((s, i) => {
        const title = s.split("\n")[0].replace(/^#+\s*/, "");
        return (
          <details key={i} className="card" open={i <= 1}>
            <summary style={{ fontSize: "1rem" }}>{title}</summary>
            <div className="row" style={{ justifyContent: "flex-end" }}><CopyButton text={s} label="Copy section" /></div>
            <pre className="pre" style={{ fontFamily: "var(--font)", fontSize: "0.9rem", margin: 0 }}>{s}</pre>
          </details>
        );
      })}
      <FeedbackWidget section="report" />
    </>
  );
}
