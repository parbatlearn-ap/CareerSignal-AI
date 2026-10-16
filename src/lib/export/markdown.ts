/**
 * Report export. Contains only user-facing results - never prompts, secrets,
 * agent inputs or reasoning traces.
 */
import { DISCLAIMER } from "../config";
import { OBJECTIVE_LABELS } from "../schemas/inputs";
import type { EditableStatement, Workspace } from "../schemas/workspace";
import { formatFrequency } from "../analysis/market";
import { aboutText, selectedHeadline } from "../analysis/profileText";
import { recruiterLens } from "../analysis/recruiterLens";
import { selectedOption } from "../orchestrator/apply";

const STATUS_LABEL = { supported: "✅ Supported", needs_confirmation: "⚠️ Needs confirmation", excluded: "⛔ Excluded" } as const;
const CLASS_LABEL: Record<string, string> = {
  demonstrated: "Demonstrated",
  partially_demonstrated: "Partially demonstrated",
  claimed_but_unsupported: "Claimed but unsupported",
  not_evidenced: "Not evidenced in supplied material",
  not_applicable: "Not applicable",
};

const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

function stmt(s: EditableStatement, claimText: (id: string) => string) {
  const ev = s.evidenceClaimIds.map((id) => `"${claimText(id)}"`).join("; ");
  return `${s.text}\n  - _${STATUS_LABEL[s.status]}${s.userApproved ? " (confirmed by you)" : ""}${ev ? ` - evidence: ${ev}` : ""}_`;
}

export function buildReportMarkdown(ws: Workspace): string {
  const out: string[] = [];
  const claim = (id: string) => ws.claims.find((c) => c.id === id)?.text.slice(0, 120) ?? id;
  const opt = selectedOption(ws);
  const g = ws.goals;
  const md = (s: string) => out.push(s);

  md(`# Career Positioning Report - ${ws.title}`);
  md(`_Generated ${new Date().toISOString().slice(0, 10)} by CareerSignal AI._\n`);
  if (ws.isDemo) md(`> **SYNTHETIC DEMO DATA.** The profile and job descriptions in this report are fictional and are not real market research.\n`);
  md(`> ${DISCLAIMER}\n`);
  if (ws.qa?.verdict === "blocked") md(`> **QA status: BLOCKED** - critical issues are unresolved. Do not publish the profile copy below until they are fixed.\n`);

  md(`## 1. Executive summary`);
  md(`- **Objective:** ${g ? OBJECTIVE_LABELS[g.primaryObjective] : "not set"}`);
  md(`- **Current → target:** ${g?.currentRole || "?"} → ${g?.targetRole || "?"} (${g?.market || "market not set"})`);
  md(`- **Recommended positioning:** ${ws.positioning?.options.find((o) => o.id === ws.positioning?.recommendedOptionId)?.name ?? "n/a"}`);
  md(`- **Selected positioning:** ${opt?.name ?? "not selected"}`);
  md(`- **Statement:** ${ws.positioning?.editedStatement ?? opt?.statement ?? "n/a"}`);
  md(`- **Job descriptions analysed:** ${ws.market?.sampleSize ?? 0}${ws.market?.syntheticCount ? ` (${ws.market.syntheticCount} synthetic)` : ""}`);
  md(`- **QA verdict:** ${ws.qa?.verdict ?? "not run"}\n`);

  md(`## 2. Scores (heuristic assessment)`);
  if (ws.scores) {
    md(`Overall: **${ws.scores.overall ?? "Insufficient data"}${ws.scores.overall !== null ? "/100" : ""}** - scoring ${ws.scores.version}\n`);
    md(`| Component | Weight | Score | Definition |\n|---|---|---|---|`);
    ws.scores.components.forEach((c) => md(`| ${c.label} | ${Math.round(c.weight * 100)}% | ${c.score ?? "Insufficient data"} | ${esc(c.formula)} |`));
    md("");
    ws.scores.caveats.forEach((c) => md(`- ${c}`));
  } else md("Not computed.");
  md("");

  md(`## 3. Market requirements (from your supplied job descriptions)`);
  if (ws.market) {
    ws.market.limitations.forEach((l) => md(`- ${l}`));
    md(`\n| Requirement | Type | Frequency |\n|---|---|---|`);
    ws.market.requirements.slice(0, 20).forEach((r) => md(`| ${esc(r.term)} | ${r.kind} | ${formatFrequency(r.count, r.total)} |`));
    md(`\nSources: ${ws.market.sources.map((s) => `${s.title}${s.company ? ` (${s.company})` : ""} - ${s.source}, ${s.providedAt}`).join("; ")}`);
  } else md("No job descriptions analysed.");
  md("");

  md(`## 4. Skills & evidence gaps`);
  if (ws.gaps?.length) {
    md(`| Requirement | JD frequency | Match | Next action |\n|---|---|---|---|`);
    ws.gaps.forEach((r) => md(`| ${esc(r.requirement)} | ${formatFrequency(r.count, r.total)} | ${CLASS_LABEL[r.classification]} | ${esc(r.nextAction)} |`));
  } else md("Not run.");
  md("");

  md(`## 5. Positioning options`);
  ws.positioning?.options.forEach((o) => {
    md(`### ${o.name}${o.id === ws.positioning?.selectedOptionId ? " ✅ selected" : ""}${o.id === ws.positioning?.recommendedOptionId ? " (recommended)" : ""}`);
    md(`${o.statement}\n`);
    md(`- Audience: ${o.audience}`);
    md(`- Confidence: ${o.confidence} - ${o.confidenceReason}`);
    md(`- Proof points: ${o.proofPointClaimIds.map(claim).join("; ") || "none"}`);
    md(`- Risks: ${o.risks.join("; ") || "none noted"}`);
    md(`- Trade-offs: ${o.tradeOffs.join("; ")}`);
    md(`- Do not claim: ${o.doNotClaim.join("; ")}\n`);
  });

  md(`## 6. Recommended LinkedIn profile`);
  if (ws.linkedin) {
    md(`**Headline:** ${selectedHeadline(ws) ?? ""}\n`);
    md(`Other headline options:`);
    ws.linkedin.headlineOptions.filter((h) => h.status !== "excluded").forEach((h) => md(`- ${stmt(h, claim)}`));
    md(`\n**About**\n`);
    ws.linkedin.about.filter((a) => a.status !== "excluded").forEach((a) => md(`- ${stmt(a, claim)}`));
    md(`\n**Experience**`);
    ws.linkedin.experience.forEach((e) => {
      const x = ws.profile?.experiences.find((p) => p.id === e.experienceId);
      md(`\n_${x?.title ?? ""} - ${x?.employer ?? ""} (${x?.start ?? "?"} - ${x?.end ?? "?"})_`);
      e.bullets.filter((b) => b.status !== "excluded").forEach((b) => md(`- ${stmt(b, claim)}`));
    });
    md(`\n**Skills (in order):** ${ws.linkedin.skills.map((s) => s.name).join(", ")}`);
    md(`\n**Featured:**`);
    ws.linkedin.featured.forEach((f) => md(`- ${f.title}: ${f.rationale}`));
    md(`\n**Checklist:**`);
    ws.linkedin.checklist.forEach((c) => md(`- [ ] ${c}`));
    md(`\n**Recruiter Lens (simulation - not a LinkedIn ranking prediction):**`);
    recruiterLens(ws).forEach((s) => md(`- ${s.label}: ${s.result.replace("_", " ")} - ${s.detail}`));
  } else md("Not generated.");
  md("");

  md(`## 7. Personal-brand strategy`);
  if (ws.brand) {
    md(`**Brand statement:** ${ws.brand.brandStatement.text}`);
    md(`**Audience:** ${ws.brand.audience}\n`);
    ws.brand.pillars.forEach((p) => md(`- **${p.name}** - ${p.pointOfView}`));
    md(`\n**Post ideas**`);
    ws.brand.postIdeas.forEach((p, n) => md(`${n + 1}. ${p.title} _(${p.format.replace("_", " ")})_${p.isHypotheticalExample ? " - EXAMPLE, replace with a real experience" : ""}`));
    md(`\n**30-day calendar**\n\n| Day | Activity | Note |\n|---|---|---|`);
    ws.brand.calendar.forEach((c) => md(`| ${c.day} | ${c.activity} | ${esc(c.note)} |`));
    md(`\n**Tone:** ${ws.brand.toneGuide.join(" ")}`);
    md(`**Avoid:** ${ws.brand.avoid.join("; ")}`);
  } else md("Not generated.");
  md("");

  md(`## 8. QA review`);
  if (ws.qa) {
    ws.qa.checks.forEach((c) => md(`- ${c.status === "pass" ? "✅" : c.status === "warn" ? "⚠️" : "❌"} ${c.label} - ${c.detail}`));
    md(`\nFlags:`);
    ws.qa.flags.forEach((f) => md(`- [${f.severity}] ${f.message} - _${f.resolution.replace("_", " ")}_`));
  } else md("Not run.");
  md("");

  md(`## 9. 30-day action plan`);
  if (ws.plan) {
    [1, 2, 3, 4].forEach((w) => {
      md(`\n**Week ${w}**`);
      ws.plan!.actions.filter((a) => a.week === w).forEach((a) => md(`- [${ws.plan!.done[a.id] ? "x" : " "}] ${a.title} (${a.effortHours}h) - done when: ${a.completionCriteria}`));
    });
    md(`\n${ws.plan.capacityNote}`);
    md(`\nAssumptions to validate:`);
    ws.plan.assumptionsToValidate.forEach((a) => md(`- ${a}`));
  } else md("Not generated.");
  md(`\n---\n${DISCLAIMER}`);
  return out.join("\n");
}

export function buildReportHtml(ws: Workspace): string {
  const mdText = buildReportMarkdown(ws);
  const e = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(ws.title)} - CareerSignal AI report</title>
<style>body{font:15px/1.6 system-ui,sans-serif;max-width:860px;margin:2rem auto;padding:0 1rem;color:#1a1f2b;background:#fff}pre{white-space:pre-wrap;font:inherit}@media print{body{margin:0}}</style></head>
<body><pre>${e(mdText)}</pre><p>About section as one block:</p><pre>${e(aboutText(ws))}</pre></body></html>`;
}
