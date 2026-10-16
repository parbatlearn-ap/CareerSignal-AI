"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWorkspace } from "@/components/workspace-context";
import { PageHeader } from "@/components/ui";
import { OBJECTIVE_LABELS, type Goals, type PrimaryObjective } from "@/lib/schemas/inputs";

const EMPTY: Goals = {
  primaryObjective: "improve_profile", currentRole: "", targetRole: "", market: "India", industry: "", seniority: "",
  yearsExperience: null, goalsText: "", targetCompanies: [], hoursPerWeek: null, tonePreference: "",
};

export default function GoalsPage() {
  const { view, act } = useWorkspace();
  const router = useRouter();
  const [g, setG] = useState<Goals>(view?.ws.goals ?? EMPTY);
  const [companies, setCompanies] = useState((view?.ws.goals?.targetCompanies ?? []).join(", "));
  if (!view) return null;
  const set = <K extends keyof Goals>(k: K, v: Goals[K]) => setG({ ...g, [k]: v });
  const num = (s: string) => (s.trim() === "" ? null : Math.max(0, Number(s)));
  const text = (k: keyof Goals, label: string, hint?: string, ph?: string) => (
    <div className="field">
      <label htmlFor={k}>{label}</label>
      <input id={k} type="text" value={g[k] as string} placeholder={ph} onChange={(e) => set(k, e.target.value as never)} />
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
  return (
    <>
      <PageHeader title="Goals" subtitle="All fields except the objective are optional - leave anything blank if you are unsure." />
      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault();
          const goals = { ...g, targetCompanies: companies.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20) };
          if (await act({ type: "set_goals", goals })) router.push(`/w/${view.ws.id}/import`);
        }}
      >
        <fieldset className="field" style={{ border: 0, padding: 0 }}>
          <legend style={{ fontWeight: 600, marginBottom: "0.4rem" }}>Primary objective</legend>
          {(Object.keys(OBJECTIVE_LABELS) as PrimaryObjective[]).map((k) => (
            <label key={k} className="check"><input type="radio" name="objective" checked={g.primaryObjective === k} onChange={() => set("primaryObjective", k)} /> {OBJECTIVE_LABELS[k]}</label>
          ))}
        </fieldset>
        <div className="grid grid-2">
          {text("currentRole", "Current role", undefined, "e.g. Business Analyst")}
          {text("targetRole", "Target role", "Used to read job descriptions and frame positioning.", "e.g. AI Product Manager")}
          {text("market", "Country / market")}
          {text("industry", "Target industry", undefined, "e.g. Fintech")}
          {text("seniority", "Seniority", "As you would describe your current level.", "e.g. Mid-level")}
          <div className="field">
            <label htmlFor="years">Years of experience</label>
            <input id="years" type="number" min={0} max={60} value={g.yearsExperience ?? ""} onChange={(e) => set("yearsExperience", num(e.target.value))} />
          </div>
          <div className="field">
            <label htmlFor="hours">Hours per week for career work</label>
            <input id="hours" type="number" min={0} max={80} value={g.hoursPerWeek ?? ""} onChange={(e) => set("hoursPerWeek", num(e.target.value))} />
            <div className="hint">Used to size the 30-day action plan.</div>
          </div>
          {text("tonePreference", "Preferred tone for public content", undefined, "e.g. practical, plain-spoken")}
        </div>
        <div className="field">
          <label htmlFor="companies">Target companies (optional, comma separated)</label>
          <input id="companies" type="text" value={companies} onChange={(e) => setCompanies(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="goalsText">Anything else about your goals or constraints?</label>
          <textarea id="goalsText" value={g.goalsText} onChange={(e) => set("goalsText", e.target.value)} />
          <div className="hint">Please do not include sensitive personal attributes (health, religion, etc.) - they are not used.</div>
        </div>
        <button className="btn btn-primary" type="submit">Save and continue to Import</button>
      </form>
    </>
  );
}
