"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/components/workspace-context";
import { Badge, PageHeader } from "@/components/ui";

async function parseFile(file: File): Promise<{ text: string; warnings: string[] }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/parse", { method: "POST", body: fd });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error || "Could not read the file.");
  return d;
}

function UploadButton({ onText, label }: { onText: (t: string, w: string[]) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span>
      <input ref={ref} type="file" accept=".pdf,.docx,.txt" className="sr-only" aria-label={label}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true); setErr(null);
          try { const r = await parseFile(f); onText(r.text, r.warnings); } catch (x) { setErr((x as Error).message); }
          setBusy(false);
          e.target.value = "";
        }} />
      <button type="button" className="btn btn-sm" onClick={() => ref.current?.click()} disabled={busy}>{busy ? "Reading…" : label}</button>
      {err && <span className="badge bad" role="alert" style={{ marginLeft: 8 }}>{err}</span>}
    </span>
  );
}

export default function ImportPage() {
  const { view, act } = useWorkspace();
  const ws = view?.ws;
  const [resume, setResume] = useState(ws?.inputs.resumeText ?? "");
  const [source, setSource] = useState(ws?.inputs.resumeSource || "Pasted by user");
  const [url, setUrl] = useState(ws?.inputs.linkedinUrl ?? "");
  const [li, setLi] = useState(ws?.inputs.existingLinkedinText ?? "");
  const [warn, setWarn] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [jd, setJd] = useState({ title: "", company: "", text: "", source: "" });
  if (!view || !ws) return null;
  const dirty = resume !== ws.inputs.resumeText || url !== ws.inputs.linkedinUrl || li !== ws.inputs.existingLinkedinText;
  return (
    <>
      <PageHeader title="Import" subtitle="Paste or upload your material. Nothing is analysed until you save and run the next step." />
      <div className="card">
        <div className="card-head">
          <h2>Resume or profile text</h2>
          <UploadButton label="Upload PDF / DOCX / TXT" onText={(t, w) => { setResume(t); setWarn(w); setSource("Uploaded file (text extracted, file not stored)"); }} />
        </div>
        {warn.map((w, i) => <p key={i} className="hint">⚠ {w}</p>)}
        <label htmlFor="resume" className="sr-only">Resume text</label>
        <textarea id="resume" className="tall" value={resume} onChange={(e) => setResume(e.target.value)} placeholder="Paste your resume, or your LinkedIn Experience / About sections…" />
        <div className="hint">{resume.length.toLocaleString()} characters · Review extracted text and fix any errors before saving.</div>
        <hr />
        <div className="grid grid-2">
          <div className="field">
            <label htmlFor="url">LinkedIn profile URL (optional, reference only)</label>
            <input id="url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.linkedin.com/in/…" />
            <div className="hint">We do not visit or extract anything from this URL. To use your LinkedIn content, paste it below or upload LinkedIn&apos;s “Save to PDF” export.</div>
          </div>
          <div className="field">
            <label htmlFor="li">Current LinkedIn text (optional)</label>
            <textarea id="li" value={li} onChange={(e) => setLi(e.target.value)} placeholder="Paste your current headline, About and Experience to get a Before/After comparison and consistency checks." />
          </div>
        </div>
        <div className="row">
          <button className="btn btn-primary" disabled={!dirty}
            onClick={async () => { if (await act({ type: "set_inputs", resumeText: resume, resumeSource: source, linkedinUrl: url, existingLinkedinText: li })) setSaved(true); }}>
            Save profile text
          </button>
          {saved && !dirty && <Badge tone="ok">Saved</Badge>}
          {dirty && <Badge tone="warn">Unsaved changes</Badge>}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Target job descriptions <Badge>{ws.inputs.jobDescriptions.length}</Badge></h2>
            <p className="muted" style={{ margin: 0 }}>These are the market evidence. Aim for 3-10 real postings for roles you want; fewer are treated as directional.</p>
          </div>
        </div>
        {ws.inputs.jobDescriptions.map((j) => (
          <div key={j.id} className="statement spread">
            <div>
              <strong>{j.title}</strong>{j.company && ` · ${j.company}`} {j.synthetic && <Badge tone="warn">Synthetic demo</Badge>}
              <div className="hint">{j.source} · {j.providedAt} · {j.text.length.toLocaleString()} chars</div>
            </div>
            <button className="btn btn-sm btn-danger" onClick={() => act({ type: "remove_jd", id: j.id })}>Remove</button>
          </div>
        ))}
        <hr />
        <h3>Add a job description</h3>
        <div className="grid grid-2">
          <div className="field"><label htmlFor="jdt">Job title</label><input id="jdt" type="text" value={jd.title} onChange={(e) => setJd({ ...jd, title: e.target.value })} /></div>
          <div className="field"><label htmlFor="jdc">Company (optional)</label><input id="jdc" type="text" value={jd.company} onChange={(e) => setJd({ ...jd, company: e.target.value })} /></div>
        </div>
        <div className="field">
          <div className="spread"><label htmlFor="jdx">Full job description text</label><UploadButton label="Upload file" onText={(t) => setJd({ ...jd, text: t, source: "Uploaded file (text extracted)" })} /></div>
          <textarea id="jdx" value={jd.text} onChange={(e) => setJd({ ...jd, text: e.target.value })} />
        </div>
        <button className="btn btn-primary" disabled={jd.text.trim().length < 30}
          onClick={async () => { if (await act({ type: "add_jd", title: jd.title, company: jd.company, text: jd.text, source: jd.source || undefined })) setJd({ title: "", company: "", text: "", source: "" }); }}>
          Add job description
        </button>
      </div>

      {ws.injectionWarnings.length > 0 && (
        <div className="alert warn">
          <strong>Instruction-like text detected.</strong> These passages look like instructions to an AI. They are treated strictly as data and will not change how the agents behave:
          <ul>{ws.injectionWarnings.map((w, i) => <li key={i}>{w.source}: “{w.snippet}”</li>)}</ul>
        </div>
      )}
      <div className="row">
        <Link className="btn btn-primary" href={`/w/${ws.id}/profile`}>Continue to Career Profile</Link>
      </div>
    </>
  );
}
