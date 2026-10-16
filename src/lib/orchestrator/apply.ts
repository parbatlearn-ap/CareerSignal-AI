/**
 * For each agent: build its MINIMAL typed input from the workspace, and apply
 * its validated output back to the workspace with deterministic grounding:
 * references are checked, ungrounded facts are dropped or downgraded, numbers
 * are verified against sources, and user-locked items are never overwritten.
 */
import type {
  BrandOutput,
  DiscoveryOutput,
  EvidenceOutput,
  GapOutput,
  LinkedInOutput,
  MarketExtraction,
  PlanOutput,
  PositioningOutput,
  Statement,
} from "../schemas/agents";
import type {
  CareerProfile,
  EditableStatement,
  EvidenceClaim,
  GapRow,
  InterviewQuestion,
  Workspace,
} from "../schemas/workspace";
import type { DiscoveryInput } from "../agents/discovery";
import type { EvidenceInput } from "../agents/evidence";
import type { MarketInput } from "../agents/market";
import type { GapInput } from "../agents/gap";
import type { PositioningInput } from "../agents/positioning";
import type { LinkedInInput } from "../agents/linkedin";
import type { BrandInput } from "../agents/brand";
import type { PlannerInput } from "../agents/planner";
import { aggregateMarket, keyRequirements } from "../analysis/market";
import { checkStatement, deriveStatus } from "../analysis/claimSafety";
import { evidenceCorpus, intentPhrases } from "../analysis/profileText";
import { termGrounded } from "../analysis/taxonomy";
import { includesNormalized, numericCore, shortHash, uniqueBy } from "../analysis/text";

// ---------------- Discovery ----------------
export function discoveryInput(ws: Workspace): DiscoveryInput {
  return {
    resumeText: ws.inputs.resumeText,
    existingLinkedinText: ws.inputs.existingLinkedinText,
    currentRole: ws.goals?.currentRole ?? "",
    targetRole: ws.goals?.targetRole ?? "",
  };
}

export function applyDiscovery(ws: Workspace, out: DiscoveryOutput): string {
  const corpus = `${ws.inputs.resumeText}\n${ws.inputs.existingLinkedinText}`;
  const grounded = (s: string) => s.trim().length > 0 && (includesNormalized(corpus, s) || termGrounded(corpus, s));
  const prev = ws.profile;
  const ambiguities = [...out.ambiguities];
  const dropped: string[] = [];

  const experiences = out.experiences
    .filter((e) => {
      const ok = grounded(e.title) || grounded(e.employer);
      if (!ok) dropped.push(`role "${e.title} at ${e.employer}"`);
      else if (!grounded(e.employer) && e.employer) ambiguities.push(`Employer "${e.employer}" could not be matched to your text - please check.`);
      return ok;
    })
    .map((e, n) => ({ ...e, id: `exp-${n + 1}`, origin: "agent" as const, locked: false }));

  const skills = uniqueBy(
    out.skills.filter((s) => {
      const ok = grounded(s.name);
      if (!ok) dropped.push(`skill "${s.name}"`);
      return ok;
    }),
    (s) => s.name.toLowerCase(),
  ).map((s) => ({ ...s, id: `skill-${shortHash(s.name.toLowerCase())}`, origin: "agent" as const, locked: false }));

  const certifications = out.certifications
    .filter((c) => {
      const ok = grounded(c.name) || grounded(c.sourceQuote);
      if (!ok) dropped.push(`certification "${c.name}"`);
      return ok;
    })
    .map((c, n) => ({ ...c, id: `cert-${n + 1}`, origin: "agent" as const, locked: false }));

  const profile: CareerProfile = {
    experiences: mergeLocked(prev?.experiences ?? [], experiences, (e) => `${e.title}|${e.employer}`.toLowerCase()),
    skills: mergeLocked(prev?.skills ?? [], skills, (s) => s.name.toLowerCase()),
    projects: mergeLocked(
      prev?.projects ?? [],
      out.projects.filter((p) => grounded(p.name) || grounded(p.sourceQuote)).map((p, n) => ({ ...p, id: `proj-${n + 1}`, origin: "agent" as const, locked: false })),
      (p) => p.name.toLowerCase(),
    ),
    certifications: mergeLocked(prev?.certifications ?? [], certifications, (c) => c.name.toLowerCase()),
    education: out.education.filter((e) => grounded(e.text)).map((e, n) => ({ id: `edu-${n + 1}`, text: e.text })),
    domains: [...new Set(out.domains.filter(grounded))],
    achievementCandidates: out.achievementCandidates
      .filter((a) => includesNormalized(corpus, a.sourceQuote))
      .map((a) => ({
        id: `ach-${shortHash(a.sourceQuote)}`,
        text: a.text,
        sourceQuote: a.sourceQuote,
        experienceId: a.experienceIndex !== null && experiences[a.experienceIndex] ? experiences[a.experienceIndex].id : null,
      })),
    ambiguities,
    unknowns: out.unknowns,
    confirmed: false,
  };
  if (dropped.length) profile.ambiguities.push(`Removed ${dropped.length} item(s) not found in your text: ${dropped.slice(0, 5).join(", ")}.`);
  ws.profile = profile;
  return `${profile.experiences.length} roles, ${profile.skills.length} skills, ${profile.achievementCandidates.length} achievement candidates, ${profile.unknowns.length} unknowns.`;
}

function mergeLocked<T extends { locked: boolean }>(prev: T[], next: T[], key: (t: T) => string): T[] {
  const locked = prev.filter((p) => p.locked);
  const keys = new Set(locked.map(key));
  return [...locked, ...next.filter((n) => !keys.has(key(n)))];
}

// ---------------- Evidence ----------------
export function evidenceInput(ws: Workspace): EvidenceInput {
  const p = ws.profile!;
  return {
    candidates: p.achievementCandidates,
    experiences: p.experiences.map(({ id, title, employer }) => ({ id, title, employer })),
  };
}

export function applyEvidence(ws: Workspace, out: EvidenceOutput): string {
  const corpus = evidenceCorpus(ws);
  const expIds = new Set(ws.profile?.experiences.map((e) => e.id));
  const lockedClaims = ws.claims.filter((c) => c.locked);
  const lockedSources = new Set(lockedClaims.map((c) => c.sourceText.split("\n[Interview answer]")[0]));
  const newClaims: EvidenceClaim[] = out.claims.map((c) => {
    const isGrounded = includesNormalized(corpus, c.sourceText);
    const metrics = c.metrics.filter((m) => {
      const core = numericCore(m);
      return core !== null && c.sourceText.replace(/,/g, "").includes(core);
    });
    let strength = c.strength;
    if (strength === "impact" && metrics.length === 0) strength = "outcome";
    return {
      id: `c-${shortHash(c.sourceText)}`,
      text: c.text,
      sourceText: c.sourceText,
      sourceType: "resume",
      experienceId: c.experienceId && expIds.has(c.experienceId) ? c.experienceId : null,
      status: !isGrounded ? "inferred_needs_confirmation" : c.status === "verified_by_user" ? "user_provided" : c.status,
      strength,
      metrics,
      origin: "agent",
      locked: false,
    };
  });
  const indexToId = newClaims.map((c) => c.id);
  ws.claims = uniqueBy([...lockedClaims, ...newClaims.filter((c) => !lockedSources.has(c.sourceText))], (c) => c.id);

  const prevQ = new Map(ws.questions.map((q) => [q.id, q]));
  const questions: InterviewQuestion[] = out.followUps
    .filter((f) => indexToId[f.claimIndex])
    .map((f) => {
      const id = `q-${shortHash(f.question)}`;
      const existing = prevQ.get(id);
      return existing ?? { id, claimId: indexToId[f.claimIndex], question: f.question, reason: f.reason, priority: f.priority, state: "open", answer: null, answeredAt: null };
    });
  // Keep answered/skipped questions and adaptive follow-ups that are no longer generated.
  for (const q of ws.questions) if (q.state !== "open" && !questions.some((x) => x.id === q.id)) questions.push(q);
  ws.questions = questions.sort((a, b) => b.priority - a.priority);
  ws.evidenceNotes = out.unsupportedNotes;
  const open = ws.questions.filter((q) => q.state === "open").length;
  return `${ws.claims.length} claims, ${open} open follow-up question(s).`;
}

// ---------------- Market ----------------
export function marketInput(ws: Workspace): MarketInput {
  return {
    targetRole: ws.goals?.targetRole ?? "",
    market: ws.goals?.market ?? "",
    jds: ws.inputs.jobDescriptions.map(({ id, title, text }) => ({ id, title, text })),
  };
}

export function applyMarket(ws: Workspace, out: MarketExtraction): string {
  // One extraction per supplied JD; missing ones are reported, never invented.
  ws.market = aggregateMarket(ws.inputs.jobDescriptions, out);
  const missing = ws.inputs.jobDescriptions.length - ws.market.sampleSize;
  if (missing > 0) ws.market.limitations.push(`${missing} job description(s) returned no extraction and were excluded.`);
  return `${ws.market.sampleSize} JD(s) analysed, ${ws.market.requirements.length} requirements found.`;
}

// ---------------- Gap ----------------
export function gapInput(ws: Workspace): GapInput {
  return {
    requirements: keyRequirements(ws.market!, 20).map(({ term, kind, count, total }) => ({ term, kind, count, total })),
    claims: ws.claims.map(({ id, text, strength, status, experienceId }) => ({ id, text, strength, status, experienceId })),
    listedSkills: (ws.profile?.skills ?? []).map((s) => s.name),
    experiences: (ws.profile?.experiences ?? []).map(({ id, title, employer }) => ({ id, title, employer })),
  };
}

export function applyGap(ws: Workspace, out: GapOutput): string {
  const reqs = keyRequirements(ws.market!, 20);
  const claimMap = new Map(ws.claims.map((c) => [c.id, c]));
  const rows: GapRow[] = reqs.map((r) => {
    const row = out.rows.find((x) => x.requirement.toLowerCase() === r.term.toLowerCase());
    const ids = (row?.evidenceClaimIds ?? []).filter((id) => claimMap.has(id));
    let classification = row?.classification ?? "not_evidenced";
    const validEvidence = ids.filter((id) => claimMap.get(id)!.status !== "unsupported");
    if ((classification === "demonstrated" || classification === "partially_demonstrated") && validEvidence.length === 0) {
      classification = (ws.profile?.skills ?? []).some((s) => termGrounded(s.name, r.term)) ? "claimed_but_unsupported" : "not_evidenced";
    }
    return {
      requirement: r.term,
      kind: r.kind,
      count: r.count,
      total: r.total,
      classification,
      evidenceClaimIds: validEvidence,
      rationale: row?.rationale ?? "Not evidenced in supplied material.",
      confidence: row?.confidence ?? "low",
      nextAction: row?.nextAction ?? "Add an example if you have this experience.",
    };
  });
  ws.gaps = rows;
  const d = rows.filter((r) => r.classification === "demonstrated").length;
  return `${rows.length} requirements: ${d} demonstrated, ${rows.filter((r) => r.classification === "not_evidenced").length} not evidenced.`;
}

// ---------------- Positioning ----------------
export function positioningInput(ws: Workspace): PositioningInput {
  return {
    currentRole: ws.goals?.currentRole ?? "",
    targetRole: ws.goals?.targetRole ?? "",
    market: ws.goals?.market ?? "",
    objective: ws.goals?.primaryObjective ?? "improve_profile",
    domains: ws.profile?.domains ?? [],
    claims: ws.claims.map(({ id, text, strength, status }) => ({ id, text, strength, status })),
    gaps: (ws.gaps ?? []).map(({ requirement, classification, count, total, evidenceClaimIds }) => ({ requirement, classification, count, total, evidenceClaimIds })),
  };
}

export function applyPositioning(ws: Workspace, out: PositioningOutput): string {
  const ids = new Set(ws.claims.map((c) => c.id));
  const options = uniqueBy(out.options, (o) => o.id).map((o) => ({ ...o, proofPointClaimIds: o.proofPointClaimIds.filter((id) => ids.has(id)) }));
  const recommended = options.some((o) => o.id === out.recommendedOptionId) ? out.recommendedOptionId : options[0].id;
  ws.positioning = {
    options,
    recommendedOptionId: recommended,
    recommendationReason: out.recommendationReason,
    selectedOptionId: null, // always requires fresh user approval
    editedStatement: null,
    approvedAt: null,
  };
  return `${options.length} positioning options; recommended: ${options.find((o) => o.id === recommended)?.name}.`;
}

export function selectedOption(ws: Workspace) {
  const p = ws.positioning;
  return p?.options.find((o) => o.id === p.selectedOptionId) ?? null;
}

// ---------------- Statements (LinkedIn + Brand) ----------------
export function groundStatement(ws: Workspace, s: Statement, prev?: EditableStatement): EditableStatement {
  if (prev?.userEdited) return { ...prev, ...recheck(ws, prev) };
  const claimMap = new Map(ws.claims.map((c) => [c.id, c]));
  const ids = s.evidenceClaimIds.filter((id) => claimMap.has(id));
  const base: EditableStatement = { ...s, evidenceClaimIds: ids, userEdited: false, userApproved: false };
  return { ...base, ...recheck(ws, base) };
}

/** Re-derive status + explanation from evidence and safety checks. */
export function recheck(ws: Workspace, s: EditableStatement): Pick<EditableStatement, "status" | "explanation"> {
  const claimMap = new Map(ws.claims.map((c) => [c.id, c]));
  const cited = s.evidenceClaimIds.map((id) => claimMap.get(id)).filter((c): c is EvidenceClaim => Boolean(c));
  const issues = checkStatement(s.text, cited, evidenceCorpus(ws), intentPhrases(ws));
  let status = deriveStatus(s, cited, issues);
  // An agent may mark its own statement as needing confirmation; never upgrade that silently.
  if (s.status === "needs_confirmation" && !s.userApproved && status === "supported" && !s.userEdited) status = "needs_confirmation";
  const base = s.explanation.split(" | Safety:")[0];
  const serious = issues.filter((i) => i.severity !== "minor");
  return { status, explanation: serious.length ? `${base} | Safety: ${serious.map((i) => i.message).join("; ")}` : base };
}

// ---------------- LinkedIn ----------------
export function linkedinInput(ws: Workspace, revise: { ref: string; issue: string }[] = []): LinkedInInput {
  const opt = selectedOption(ws)!;
  const market = ws.market;
  return {
    positioning: {
      name: opt.name,
      statement: ws.positioning?.editedStatement ?? opt.statement,
      headlineDirection: opt.headlineDirection,
      doNotClaim: opt.doNotClaim,
      targetJobFamilies: opt.targetJobFamilies,
    },
    goals: {
      currentRole: ws.goals?.currentRole ?? "",
      targetRole: ws.goals?.targetRole ?? "",
      seniority: ws.goals?.seniority ?? "",
      market: ws.goals?.market ?? "",
    },
    claims: ws.claims.map(({ id, text, strength, status, experienceId }) => ({ id, text, strength, status, experienceId })),
    experiences: (ws.profile?.experiences ?? []).map(({ id, title, employer, start, end }) => ({ id, title, employer, start, end })),
    skills: (ws.profile?.skills ?? []).map((s) => {
      const row = ws.gaps?.find((g) => termGrounded(s.name, g.requirement) || termGrounded(g.requirement, s.name));
      const ids = row?.evidenceClaimIds.length ? row.evidenceClaimIds : ws.claims.filter((c) => termGrounded(c.text, s.name)).map((c) => c.id).slice(0, 3);
      return { name: s.name, classification: row?.classification ?? null, evidenceClaimIds: ids, jdCount: market?.requirements.find((r) => termGrounded(r.term, s.name))?.count ?? 0 };
    }),
    projects: (ws.profile?.projects ?? []).map(({ name, description }) => ({ name, description })),
    domains: ws.profile?.domains ?? [],
    existingLinkedinText: ws.inputs.existingLinkedinText,
    revise,
  };
}

export function applyLinkedIn(ws: Workspace, out: LinkedInOutput): string {
  const prev = ws.linkedin;
  const prevMap = new Map<string, EditableStatement>();
  prev?.headlineOptions.forEach((s) => prevMap.set(s.id, s));
  prev?.about.forEach((s) => prevMap.set(s.id, s));
  prev?.experience.forEach((e) => e.bullets.forEach((s) => prevMap.set(s.id, s)));
  const g = (s: Statement) => groundStatement(ws, s, prevMap.get(s.id));
  const expIds = new Set(ws.profile?.experiences.map((e) => e.id));
  const claimIds = new Set(ws.claims.map((c) => c.id));
  const allowedSkills = [...(ws.profile?.skills ?? []).map((s) => s.name)];
  const headlineOptions = uniqueBy(out.headlineOptions, (s) => s.id).map(g);
  ws.linkedin = {
    positioningOptionId: ws.positioning!.selectedOptionId!,
    headlineOptions,
    selectedHeadlineId: headlineOptions.some((h) => h.id === prev?.selectedHeadlineId) ? prev!.selectedHeadlineId : headlineOptions[0]?.id ?? null,
    about: uniqueBy(out.about, (s) => s.id).map(g),
    experience: out.experience.filter((e) => expIds.has(e.experienceId)).map((e) => ({ experienceId: e.experienceId, bullets: uniqueBy(e.bullets, (s) => s.id).map(g) })),
    // Never list a skill that is not in the user's own profile.
    skills: out.skills
      .filter((s) => allowedSkills.some((a) => a.toLowerCase() === s.name.toLowerCase()))
      .map((s) => {
        const ids = s.evidenceClaimIds.filter((id) => claimIds.has(id));
        return { name: s.name, evidenceClaimIds: ids, status: ids.length ? ("supported" as const) : ("needs_confirmation" as const) };
      }),
    featured: out.featured.map((f) => ({ ...f, evidenceClaimIds: f.evidenceClaimIds.filter((id) => claimIds.has(id)) })),
    checklist: out.checklist,
    editNotes: out.editNotes,
    bannerBrief: out.bannerBrief,
    revision: (prev?.revision ?? 0) + 1,
  };
  const all = allStatements(ws).filter((s) => s.area === "linkedin");
  return `${headlineOptions.length} headlines, ${all.filter((s) => s.statement.status === "supported").length} supported / ${all.filter((s) => s.statement.status === "needs_confirmation").length} need confirmation.`;
}

// ---------------- Brand ----------------
export function brandInput(ws: Workspace, revise: { ref: string; issue: string }[] = []): BrandInput {
  const opt = selectedOption(ws)!;
  const demonstrated = (ws.gaps ?? []).filter((g) => g.classification === "demonstrated").map((g) => g.requirement);
  return {
    positioning: { name: opt.name, statement: ws.positioning?.editedStatement ?? opt.statement, audience: opt.audience },
    targetRole: ws.goals?.targetRole ?? "",
    currentRole: ws.goals?.currentRole ?? "",
    tone: ws.goals?.tonePreference ?? "",
    themes: [...demonstrated, ...(ws.profile?.domains ?? [])],
    claims: ws.claims.map(({ id, text, strength, status }) => ({ id, text, strength, status })),
    projects: (ws.profile?.projects ?? []).map(({ name, description }) => ({ name, description })),
    revise,
  };
}

export function applyBrand(ws: Workspace, out: BrandOutput): string {
  const prev = ws.brand;
  const claimIds = new Set(ws.claims.map((c) => c.id));
  const pillars = out.pillars.map((p) => ({ ...p, evidenceClaimIds: p.evidenceClaimIds.filter((id) => claimIds.has(id)) }));
  const pillarIds = new Set(pillars.map((p) => p.id));
  const postIdeas = out.postIdeas.map((i) => {
    const ids = i.evidenceClaimIds.filter((id) => claimIds.has(id));
    return { ...i, pillarId: pillarIds.has(i.pillarId) ? i.pillarId : pillars[0].id, evidenceClaimIds: ids, isHypotheticalExample: i.isHypotheticalExample || ids.length === 0 };
  });
  const ideaIds = new Set(postIdeas.map((i) => i.id));
  const byDay = new Map(out.calendar.map((c) => [c.day, c]));
  const calendar = Array.from({ length: 30 }, (_, k) => {
    const day = k + 1;
    const old = prev?.calendar.find((c) => c.day === day);
    if (old?.userEdited) return old;
    const c = byDay.get(day) ?? { day, activity: "rest" as const, postIdeaId: null, note: "" };
    return { ...c, postIdeaId: c.postIdeaId && ideaIds.has(c.postIdeaId) ? c.postIdeaId : null, userEdited: false, done: old?.done ?? false };
  });
  ws.brand = {
    brandStatement: groundStatement(ws, out.brandStatement, prev?.brandStatement),
    audience: out.audience,
    pillars,
    postIdeas,
    calendar,
    toneGuide: out.toneGuide,
    avoid: out.avoid,
    engagementRoutine: out.engagementRoutine,
    revision: (prev?.revision ?? 0) + 1,
  };
  return `${pillars.length} pillars, 10 post ideas (${postIdeas.filter((i) => i.isHypotheticalExample).length} labelled as examples), 30-day calendar.`;
}

// ---------------- Planner ----------------
export function plannerInput(ws: Workspace): PlannerInput {
  return {
    targetRole: ws.goals?.targetRole ?? "",
    hoursPerWeek: ws.goals?.hoursPerWeek ?? null,
    gaps: (ws.gaps ?? []).map(({ requirement, classification, count, total }) => ({ requirement, classification, count, total })),
    openQuestions: ws.questions.filter((q) => q.state === "open").length,
    statementsNeedingConfirmation: allStatements(ws).filter((s) => s.statement.status === "needs_confirmation").length,
    qaOpenFlags: (ws.qa?.flags ?? []).filter((f) => f.resolution === "open").length,
    brandPostsPlanned: ws.brand?.calendar.filter((c) => c.activity === "post").length ?? 0,
    directionalMarket: ws.market?.directional ?? true,
  };
}

export function applyPlan(ws: Workspace, out: PlanOutput): string {
  const ids = new Set(out.actions.map((a) => a.id));
  ws.plan = {
    ...out,
    actions: out.actions.map((a) => ({ ...a, dependsOn: a.dependsOn.filter((d) => ids.has(d) && d !== a.id) })),
    done: Object.fromEntries(Object.entries(ws.plan?.done ?? {}).filter(([k]) => ids.has(k))),
  };
  return `${out.actions.length} actions over 4 weeks.`;
}

// ---------------- Helpers ----------------
export interface StatementRef {
  ref: string;
  area: "linkedin" | "brand";
  section: string;
  statement: EditableStatement;
}

export function allStatements(ws: Workspace): StatementRef[] {
  const out: StatementRef[] = [];
  const li = ws.linkedin;
  if (li) {
    li.headlineOptions.forEach((s) => out.push({ ref: s.id, area: "linkedin", section: "Headline", statement: s }));
    li.about.forEach((s) => out.push({ ref: s.id, area: "linkedin", section: "About", statement: s }));
    li.experience.forEach((e) => {
      const exp = ws.profile?.experiences.find((x) => x.id === e.experienceId);
      e.bullets.forEach((s) => out.push({ ref: s.id, area: "linkedin", section: `Experience · ${exp?.title ?? e.experienceId}`, statement: s }));
    });
  }
  if (ws.brand) out.push({ ref: ws.brand.brandStatement.id, area: "brand", section: "Brand statement", statement: ws.brand.brandStatement });
  return out;
}

export function findStatement(ws: Workspace, ref: string): EditableStatement | null {
  return allStatements(ws).find((s) => s.ref === ref)?.statement ?? null;
}
