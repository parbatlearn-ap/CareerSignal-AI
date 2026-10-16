"use client";

import { useWorkspace } from "@/components/workspace-context";
import { AgentPanel, Badge, CopyButton, Empty, FeedbackWidget, PageHeader } from "@/components/ui";
import { StatementCard } from "@/components/statement-card";
import { LINKEDIN_LIMITS } from "@/lib/config";

const LENS_TONE = { clear: "ok", partial: "warn", missing: "bad", insufficient_data: "" } as const;

export default function LinkedInPage() {
  const { view, act } = useWorkspace();
  if (!view) return null;
  const { ws, lens } = view;
  const li = ws.linkedin;
  const live = <T extends { status: string }>(xs: T[]) => xs.filter((x) => x.status !== "excluded");
  const about = li ? live(li.about).map((a) => a.text).join("\n\n") : "";
  const headline = li?.headlineOptions.find((h) => h.id === li.selectedHeadlineId)?.text ?? "";
  return (
    <>
      <PageHeader title="LinkedIn Builder" subtitle="Editable drafts with evidence labels. Nothing is posted - you copy what you approve into LinkedIn yourself." />
      <AgentPanel agentId="linkedin" runLabel="Draft profile" dataUsed={["your approved positioning", "evidence claims", "roles", "skills with gap status", "projects", "current LinkedIn text"]} />
      {!li ? <Empty>Choose a positioning option, then run the LinkedIn Profile Architect.</Empty> : (
        <>
          <div className="card">
            <div className="card-head"><h2>Headline options</h2><span className="hint">Select one; it is used in the report.</span></div>
            {li.headlineOptions.map((h) => (
              <div key={h.id} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", marginBottom: "0.6rem" }}>
                <input type="radio" name="headline" aria-label={`Select headline ${h.id}`} checked={li.selectedHeadlineId === h.id} onChange={() => act({ type: "select_headline", id: h.id })} style={{ marginTop: "1rem" }} />
                <div style={{ flex: 1 }}><StatementCard s={h} limit={LINKEDIN_LIMITS.headline} /></div>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-head">
              <h2>About</h2>
              <div className="row"><span className="hint">{about.length} chars (commonly cited limit {LINKEDIN_LIMITS.about}; verify in LinkedIn)</span><CopyButton text={about} label="Copy About" /></div>
            </div>
            {li.about.map((s) => <StatementCard key={s.id} s={s} />)}
          </div>
          <div className="card">
            <h2>Experience</h2>
            {li.experience.map((e) => {
              const x = ws.profile?.experiences.find((p) => p.id === e.experienceId);
              const text = live(e.bullets).map((b) => `• ${b.text}`).join("\n");
              return (
                <div key={e.experienceId} style={{ marginBottom: "1rem" }}>
                  <div className="spread"><h3>{x?.title} · {x?.employer} <span className="hint">({x?.start} – {x?.end})</span></h3><CopyButton text={text} label="Copy bullets" /></div>
                  {e.bullets.length === 0 ? <p className="hint">No evidenced achievements for this role yet - add some in the Evidence Interview.</p> : e.bullets.map((b) => <StatementCard key={b.id} s={b} />)}
                </div>
              );
            })}
          </div>
          <div className="grid grid-2">
            <div className="card">
              <div className="spread"><h2>Skills (in order)</h2><CopyButton text={li.skills.map((s) => s.name).join(", ")} /></div>
              <ol>{li.skills.map((s) => <li key={s.name}>{s.name} {s.status === "supported" ? <Badge tone="ok">evidenced</Badge> : <Badge tone="warn">needs evidence</Badge>}</li>)}</ol>
            </div>
            <div className="card">
              <h2>Featured &amp; projects</h2>
              <ul>{li.featured.map((f, i) => <li key={i}><strong>{f.title}</strong> - {f.rationale}</li>)}</ul>
              <h3>Banner brief</h3><p className="hint">{li.bannerBrief}</p>
            </div>
          </div>
          <div className="card">
            <h2>Before / After</h2>
            <div className="grid grid-2">
              <div><h3>Before (your current text)</h3><p className="pre hint">{ws.inputs.existingLinkedinText || "Paste your current LinkedIn text in Import to compare."}</p></div>
              <div><h3>After (draft)</h3><p className="pre"><strong>{headline}</strong>{"\n\n"}{about}</p></div>
            </div>
            <h3>What changed and why</h3>
            <ul>{li.editNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
          </div>
          <div className="card">
            <h2>Recruiter Lens <Badge tone="info">Simulation</Badge></h2>
            <p className="muted">Checks whether the draft communicates role, level, domain and supplied-JD terms. It is a rule-based simulation, not a prediction of LinkedIn search ranking or recruiter behaviour.</p>
            <ul>{lens.map((l) => <li key={l.id}><Badge tone={LENS_TONE[l.result]}>{l.result.replace("_", " ")}</Badge> <strong>{l.label}</strong> - <span className="hint">{l.detail}</span></li>)}</ul>
          </div>
          <div className="card">
            <h2>Profile checklist</h2>
            <ul>{li.checklist.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
          <FeedbackWidget section="linkedin" />
        </>
      )}
    </>
  );
}
