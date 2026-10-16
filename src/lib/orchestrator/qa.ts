/**
 * QA = deterministic rule checks (always on, any provider) + the Critic
 * agent's judgement flags. Produces a verdict that can block the report.
 */
import type { CriticOutput } from "../schemas/agents";
import { BrandOutputSchema, LinkedInOutputSchema } from "../schemas/agents";
import type { QaFlag, QaReport, Workspace } from "../schemas/workspace";
import type { CriticInput } from "../agents/critic";
import { checkStatement, keywordStuffing } from "../analysis/claimSafety";
import { checkConsistency } from "../analysis/consistency";
import { evidenceCorpus, intentPhrases, proseText } from "../analysis/profileText";
import { shortHash } from "../analysis/text";
import { allStatements, selectedOption } from "./apply";

export function criticInput(ws: Workspace): CriticInput {
  const claimMap = new Map(ws.claims.map((c) => [c.id, c]));
  const opt = selectedOption(ws);
  return {
    statements: allStatements(ws)
      .filter((s) => s.statement.status !== "excluded")
      .map((s) => ({
        ref: s.ref,
        area: s.area,
        text: s.statement.text,
        status: s.statement.status,
        citedEvidence: s.statement.evidenceClaimIds.map((id) => claimMap.get(id)?.sourceText ?? "").filter(Boolean),
      })),
    positioning: opt ? { name: opt.name, statement: ws.positioning?.editedStatement ?? opt.statement, stretch: opt.stretch, doNotClaim: opt.doNotClaim } : null,
    market: ws.market ? { sampleSize: ws.market.sampleSize, syntheticCount: ws.market.syntheticCount } : null,
    targetRole: ws.goals?.targetRole ?? "",
    heldTitles: (ws.profile?.experiences ?? []).map((e) => e.title),
  };
}

export function ruleChecks(ws: Workspace): { checks: QaReport["checks"]; flags: QaFlag[] } {
  const flags: QaFlag[] = [];
  const checks: QaReport["checks"] = [];
  const corpus = evidenceCorpus(ws);
  const claimMap = new Map(ws.claims.map((c) => [c.id, c]));
  const statements = allStatements(ws).filter((s) => s.statement.status !== "excluded");

  // 1. Evidence traceability
  const untraced = statements.filter((s) => s.statement.status === "supported" && s.statement.evidenceClaimIds.length === 0 && !s.statement.userApproved);
  checks.push({
    id: "traceability",
    label: "Every factual claim has evidence or is marked for confirmation",
    status: untraced.length ? "fail" : "pass",
    detail: untraced.length ? `${untraced.length} statement(s) marked supported without evidence.` : `${statements.length} statements checked.`,
  });

  // 2. Claim safety: invented metrics, credentials, seniority, generic language
  let critical = 0;
  for (const s of statements) {
    if (s.statement.userApproved) continue;
    const cited = s.statement.evidenceClaimIds.map((id) => claimMap.get(id)).filter((c) => c !== undefined);
    for (const issue of checkStatement(s.statement.text, cited, corpus, intentPhrases(ws))) {
      if (issue.severity === "critical") critical++;
      flags.push({
        id: `rule-${issue.category}-${s.ref}-${shortHash(issue.message)}`,
        source: "rule",
        area: s.area,
        targetRef: s.ref,
        severity: issue.severity,
        category: issue.category,
        message: `${s.section}: ${issue.message}`,
        resolution: "open",
      });
    }
  }
  checks.push({
    id: "no-fabrication",
    label: "No invented metrics, titles or credentials",
    status: critical ? "fail" : "pass",
    detail: critical ? `${critical} critical issue(s) - see flags.` : "All numbers and credentials trace to your material.",
  });

  // 3. Market statistics traceable
  const m = ws.market;
  const badStats = m ? m.requirements.filter((r) => r.total !== m.sampleSize || r.count > r.total) : [];
  checks.push({
    id: "market-traceable",
    label: "Market statistics have a traceable numerator and denominator",
    status: !m ? "warn" : badStats.length ? "fail" : "pass",
    detail: !m ? "No market analysis." : `${m.requirements.length} requirement counts out of ${m.sampleSize} supplied JD(s)${m.syntheticCount ? `; ${m.syntheticCount} synthetic` : ""}.`,
  });

  // 4. Scores defined
  checks.push({
    id: "scores-defined",
    label: "Scores have defined formulas and caveats",
    status: ws.scores && ws.scores.components.every((c) => c.formula) ? "pass" : "warn",
    detail: ws.scores ? `Scoring ${ws.scores.version}; ${ws.scores.components.filter((c) => c.score === null).length} component(s) marked insufficient data.` : "Scores not computed yet.",
  });

  // 5. Positioning aligned with goal and evidence
  const opt = selectedOption(ws);
  checks.push({
    id: "positioning-evidence",
    label: "Positioning is backed by evidence",
    status: !opt ? "fail" : opt.proofPointClaimIds.length === 0 ? "warn" : "pass",
    detail: !opt ? "No positioning selected." : `${opt.proofPointClaimIds.length} proof point(s); stretch: ${opt.stretch ? "yes" : "no"}.`,
  });

  // 6. Keyword stuffing
  const ks = keywordStuffing(proseText(ws));
  if (ks.stuffed)
    flags.push({ id: "rule-keyword_stuffing-profile", source: "rule", area: "linkedin", targetRef: null, severity: "major", category: "keyword_stuffing", message: `Keyword density looks unnatural${ks.repeated.length ? ` (repeated: ${ks.repeated.join(", ")})` : ""}.`, resolution: "open" });
  checks.push({ id: "keyword-stuffing", label: "No keyword stuffing", status: ks.stuffed ? "warn" : "pass", detail: `Term density ${(ks.density * 100).toFixed(0)}%.` });

  // 7. Consistency between sources
  const cons = checkConsistency(ws.profile?.experiences ?? [], ws.inputs.existingLinkedinText);
  cons.forEach((c) =>
    flags.push({ id: `rule-contradiction-${shortHash(c.message)}`, source: "rule", area: "evidence", targetRef: c.experienceId, severity: c.severity, category: "contradiction", message: c.message, resolution: "open" }),
  );
  checks.push({ id: "consistency", label: "Resume and profile facts are consistent", status: cons.some((c) => c.severity === "major") ? "warn" : "pass", detail: `${cons.length} consistency flag(s).` });

  // 8. Brand calendar does not overstate expertise
  const hypo = ws.brand?.postIdeas.filter((p) => p.isHypotheticalExample).length ?? 0;
  checks.push({
    id: "brand-grounded",
    label: "Brand ideas are grounded or labelled as examples",
    status: ws.brand ? "pass" : "warn",
    detail: ws.brand ? `${10 - hypo} of 10 ideas cite your evidence; ${hypo} labelled as examples.` : "No brand strategy.",
  });

  // 9. Schema validity of stored outputs
  const liOk = ws.linkedin ? LinkedInOutputSchema.safeParse({ ...ws.linkedin }).success : false;
  const brOk = ws.brand ? BrandOutputSchema.safeParse({ ...ws.brand }).success : false;
  checks.push({ id: "schema", label: "Outputs conform to schemas", status: liOk && brOk ? "pass" : "fail", detail: `LinkedIn ${liOk ? "valid" : "invalid"}, Brand ${brOk ? "valid" : "invalid"}.` });

  // 10. Untrusted-document instructions
  if (ws.injectionWarnings.length)
    flags.push({ id: "rule-injection", source: "rule", area: "evidence", targetRef: null, severity: "minor", category: "other", message: `${ws.injectionWarnings.length} instruction-like passage(s) found in your documents were treated as data, not instructions.`, resolution: "open" });

  return { checks, flags };
}

export function mergeLlmFlags(ws: Workspace, out: CriticOutput): QaFlag[] {
  const refs = new Set(allStatements(ws).map((s) => s.ref));
  return out.flags.map((f) => {
    const ref = f.targetRef && refs.has(f.targetRef) ? f.targetRef : null;
    return {
      id: `llm-${f.category}-${ref ?? f.area}-${shortHash(f.message)}`,
      source: "llm" as const,
      area: f.area,
      targetRef: ref,
      severity: f.severity,
      category: f.category,
      message: f.message,
      resolution: "open" as const,
    };
  });
}

/** Keep the user's earlier decisions on flags that still apply; mark vanished open flags as revised. */
export function carryResolutions(prev: QaFlag[], next: QaFlag[]): QaFlag[] {
  const prevMap = new Map(prev.map((f) => [f.id, f]));
  const merged = next.map((f) => {
    const p = prevMap.get(f.id);
    return p && p.resolution !== "open" && p.resolution !== "revised" ? { ...f, resolution: p.resolution } : f;
  });
  const nextIds = new Set(next.map((f) => f.id));
  for (const p of prev) if (!nextIds.has(p.id)) merged.push({ ...p, resolution: p.resolution === "open" ? "revised" : p.resolution });
  return merged;
}

export function verdictOf(flags: QaFlag[]): QaReport["verdict"] {
  const open = flags.filter((f) => f.resolution === "open");
  if (open.some((f) => f.severity === "critical")) return "blocked";
  return open.length ? "pass_with_warnings" : "pass";
}

/** Flags worth one automatic revision cycle: critical/major on agent-written statements. */
export function revisionTargets(ws: Workspace, flags: QaFlag[]) {
  const stmts = new Map(allStatements(ws).map((s) => [s.ref, s]));
  return flags
    .filter((f) => f.resolution === "open" && f.severity !== "minor" && f.targetRef && stmts.has(f.targetRef) && !stmts.get(f.targetRef)!.statement.userEdited)
    .map((f) => ({ ref: f.targetRef!, area: stmts.get(f.targetRef!)!.area, issue: f.message }));
}
