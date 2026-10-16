import { StartButtons } from "@/components/start-buttons";
import { publicProviderStatus } from "@/lib/providers";

export const dynamic = "force-dynamic";

const FEATURES = [
  ["Evidence traceability", "Every generated sentence links to your own words - or is clearly marked “needs confirmation”."],
  ["Positioning alternatives", "Compare 2-3 credible positions side by side, with proof points, trade-offs and what not to claim."],
  ["Market signal cards", "Requirements counted from the job descriptions you supply, always shown as “n of N”."],
  ["Claim safety check", "Flags invented numbers, credentials, titles and overstated expertise before you publish."],
  ["Recruiter lens", "A simulation of whether your profile communicates role, level, domain and key terms."],
  ["Brand studio", "Content pillars, 10 grounded post ideas and a 30-day calendar - no fake stories."],
];

export default function Home() {
  const p = publicProviderStatus();
  return (
    <div className="container">
      <section className="hero">
        <span className="badge brand">Career positioning · LinkedIn · Personal brand</span>
        <h1 style={{ marginTop: "0.75rem" }}>Figure out what you should be known for - then say it credibly.</h1>
        <p className="lead">
          CareerSignal AI guides you through nine specialised agents that structure your experience, mine evidence, read the job
          descriptions you care about, and build a positioning, LinkedIn profile and brand plan grounded in what you have actually done.
        </p>
        <StartButtons />
        <p className="hint" style={{ marginTop: "0.75rem" }}>
          {p.isMock
            ? "Running in demo mode: rule-based agents, no AI provider, no data leaves this server."
            : `AI provider: ${p.provider} (${p.model}). You will be asked for consent before any data is sent to it.`}
        </p>
      </section>
      <section className="grid grid-3 feature-grid" aria-label="Features">
        {FEATURES.map(([t, d]) => (
          <div className="card" key={t}>
            <h3>{t}</h3>
            <p className="muted" style={{ margin: 0 }}>{d}</p>
          </div>
        ))}
      </section>
      <section className="card" style={{ marginTop: "1.5rem" }}>
        <h2>Privacy, in plain terms</h2>
        <ul>
          <li>Your data is stored locally on this server, tied to a private cookie in your browser. Export or delete it any time in Settings.</li>
          <li>Uploaded files are parsed and discarded; only the text you approve is saved.</li>
          <li>We never scrape LinkedIn, publish posts, apply for jobs or contact anyone on your behalf.</li>
          <li>Scores are heuristics with published formulas - never a prediction of getting hired.</li>
        </ul>
      </section>
    </div>
  );
}
