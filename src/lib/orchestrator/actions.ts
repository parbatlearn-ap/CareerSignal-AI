/**
 * User actions. Every mutation from the UI is a validated, typed action.
 * User edits lock the edited items so agents can never overwrite them.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { EvidenceStatus } from "../schemas/common";
import { GoalsSchema } from "../schemas/inputs";
import { SCHEMA_VERSION, type EditKey, type Workspace } from "../schemas/workspace";
import { DEMO_GOALS, DEMO_JDS, DEMO_LINKEDIN, DEMO_RESUME } from "../fixtures/demo";
import { scanForInjection } from "../analysis/injection";
import { computeScores } from "../analysis/scoring";
import { extractMetrics, shortHash } from "../analysis/text";
import { classifyStrength } from "../agents/evidence";
import { findStatement, recheck } from "./apply";
import { verdictOf } from "./qa";
import { snapshotVersion } from "./versions";
import { OrchestratorError } from "./index";

const str = (max: number) => z.string().max(max);

export const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("rename"), title: str(120).min(1) }),
  z.object({ type: z.literal("set_goals"), goals: GoalsSchema }),
  z.object({
    type: z.literal("set_inputs"),
    resumeText: str(60000).optional(),
    resumeSource: str(200).optional(),
    linkedinUrl: str(300).optional(),
    existingLinkedinText: str(30000).optional(),
  }),
  z.object({ type: z.literal("add_jd"), title: str(200), company: str(200), text: str(30000).min(30, "Paste the full job description (at least 30 characters)."), source: str(200).optional() }),
  z.object({ type: z.literal("remove_jd"), id: str(80) }),
  z.object({ type: z.literal("load_demo") }),
  z.object({ type: z.literal("set_consent"), sendToProvider: z.boolean().optional(), retainRunLogs: z.boolean().optional() }),
  z.object({ type: z.literal("edit_experience"), id: str(80), title: str(200), employer: str(200), start: str(40).nullable(), end: str(40).nullable() }),
  z.object({ type: z.literal("add_profile_item"), kind: z.enum(["skill", "certification", "project"]), name: str(120).min(1), description: str(1000).optional() }),
  z.object({ type: z.literal("remove_profile_item"), kind: z.enum(["experience", "skill", "certification", "project"]), id: str(80) }),
  z.object({ type: z.literal("confirm_profile") }),
  z.object({ type: z.literal("answer_question"), questionId: str(80), answer: str(3000).min(1), confirmed: z.boolean(), rewrite: str(1000).optional() }),
  z.object({ type: z.literal("skip_question"), questionId: str(80) }),
  z.object({ type: z.literal("add_claim"), text: str(1000).min(5), experienceId: str(80).nullable() }),
  z.object({ type: z.literal("set_claim_status"), claimId: str(80), status: EvidenceStatus }),
  z.object({ type: z.literal("choose_positioning"), optionId: str(80), editedStatement: str(2000).nullable() }),
  z.object({ type: z.literal("select_headline"), id: str(80) }),
  z.object({ type: z.literal("edit_statement"), ref: str(120), text: str(4000).min(1) }),
  z.object({ type: z.literal("set_statement"), ref: str(120), action: z.enum(["approve", "exclude", "restore"]) }),
  z.object({ type: z.literal("resolve_flag"), flagId: str(200), resolution: z.enum(["open", "user_approved", "excluded", "dismissed"]) }),
  z.object({ type: z.literal("edit_calendar"), day: z.number().int().min(1).max(30), note: str(600).optional(), done: z.boolean().optional() }),
  z.object({ type: z.literal("toggle_action"), actionId: str(80), done: z.boolean() }),
  z.object({ type: z.literal("feedback"), section: str(80), rating: z.number().int().min(1).max(5).nullable(), flaggedInaccurate: z.boolean(), comment: str(2000) }),
  z.object({ type: z.literal("snapshot"), label: str(80).optional() }),
]);
export type Action = z.infer<typeof ActionSchema>;

export function newWorkspace(ownerId: string, title = "My career analysis"): Workspace {
  const now = new Date().toISOString();
  return {
    id: randomUUID().replace(/-/g, "").slice(0, 20),
    schemaVersion: SCHEMA_VERSION,
    seq: 0,
    stepSeq: {},
    editSeq: {},
    ownerId,
    title,
    isDemo: false,
    createdAt: now,
    updatedAt: now,
    consent: { sendToProvider: false, retainRunLogs: true, acceptedAt: null },
    goals: null,
    inputs: { resumeText: "", resumeSource: "", linkedinUrl: "", existingLinkedinText: "", jobDescriptions: [] },
    injectionWarnings: [],
    profile: null,
    claims: [],
    questions: [],
    evidenceNotes: [],
    market: null,
    gaps: null,
    positioning: null,
    linkedin: null,
    brand: null,
    qa: null,
    plan: null,
    scores: null,
    agentRuns: [],
    versions: [],
    feedback: [],
  };
}

function edited(ws: Workspace, ...keys: EditKey[]) {
  for (const k of keys) {
    ws.seq += 1;
    ws.editSeq[k] = ws.seq;
  }
}

function rescan(ws: Workspace) {
  const w: Workspace["injectionWarnings"] = [];
  scanForInjection(ws.inputs.resumeText).forEach((s) => w.push({ source: "Resume / profile text", snippet: s }));
  scanForInjection(ws.inputs.existingLinkedinText).forEach((s) => w.push({ source: "Current LinkedIn text", snippet: s }));
  ws.inputs.jobDescriptions.forEach((j) => scanForInjection(j.text).forEach((s) => w.push({ source: `Job description: ${j.title || j.id}`, snippet: s })));
  ws.injectionWarnings = w;
}

const fail = (m: string): never => {
  throw new OrchestratorError("INVALID_ACTION", m);
};

export function applyAction(ws: Workspace, action: Action, providerLabel = ""): Workspace {
  const now = new Date().toISOString();
  switch (action.type) {
    case "rename":
      ws.title = action.title;
      break;
    case "set_goals":
      ws.goals = action.goals;
      edited(ws, "goals");
      break;
    case "set_inputs": {
      const { type: _t, ...rest } = action;
      void _t;
      Object.assign(ws.inputs, Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)));
      rescan(ws);
      edited(ws, "inputs");
      break;
    }
    case "add_jd":
      if (ws.inputs.jobDescriptions.length >= 15) fail("Up to 15 job descriptions are supported.");
      ws.inputs.jobDescriptions.push({
        id: `jd-${randomUUID().slice(0, 8)}`,
        title: action.title || "Untitled role",
        company: action.company,
        source: action.source || "Pasted by user",
        providedAt: now.slice(0, 10),
        synthetic: false,
        text: action.text,
      });
      rescan(ws);
      edited(ws, "jds");
      break;
    case "remove_jd":
      ws.inputs.jobDescriptions = ws.inputs.jobDescriptions.filter((j) => j.id !== action.id);
      rescan(ws);
      edited(ws, "jds");
      break;
    case "load_demo":
      ws.isDemo = true;
      ws.title = "Demo: synthetic Business Analyst → AI Product Manager";
      ws.goals = structuredClone(DEMO_GOALS);
      ws.inputs = {
        resumeText: DEMO_RESUME,
        resumeSource: "SYNTHETIC demo resume",
        linkedinUrl: "",
        existingLinkedinText: DEMO_LINKEDIN,
        jobDescriptions: structuredClone(DEMO_JDS),
      };
      rescan(ws);
      edited(ws, "goals", "inputs", "jds");
      break;
    case "set_consent":
      if (action.sendToProvider !== undefined) ws.consent.sendToProvider = action.sendToProvider;
      if (action.retainRunLogs !== undefined) ws.consent.retainRunLogs = action.retainRunLogs;
      ws.consent.acceptedAt = now;
      break;
    case "edit_experience": {
      const e = ws.profile?.experiences.find((x) => x.id === action.id) ?? fail("Role not found.");
      Object.assign(e, { title: action.title, employer: action.employer, start: action.start, end: action.end, origin: "user", locked: true });
      edited(ws, "profile");
      break;
    }
    case "add_profile_item": {
      const p = ws.profile ?? fail("Run Career Discovery first.");
      const id = `${action.kind}-u-${shortHash(action.name + now)}`;
      const base = { origin: "user" as const, locked: true, sourceQuote: `Added by user: ${action.name}` };
      if (action.kind === "skill") p.skills.push({ id, name: action.name, category: "other", ...base });
      if (action.kind === "certification") p.certifications.push({ id, name: action.name, ...base });
      if (action.kind === "project") p.projects.push({ id, name: action.name, description: action.description ?? "", ...base });
      edited(ws, "profile");
      break;
    }
    case "remove_profile_item": {
      const p = ws.profile ?? fail("No profile.");
      const key = ({ experience: "experiences", skill: "skills", certification: "certifications", project: "projects" } as const)[action.kind];
      (p[key] as { id: string }[]) = (p[key] as { id: string }[]).filter((x) => x.id !== action.id);
      edited(ws, "profile");
      break;
    }
    case "confirm_profile":
      if (!ws.profile) fail("Nothing to confirm yet.");
      ws.profile!.confirmed = true;
      break;
    case "answer_question": {
      const q = ws.questions.find((x) => x.id === action.questionId) ?? fail("Question not found.");
      q.state = "answered";
      q.answer = action.answer;
      q.answeredAt = now;
      const c = q.claimId ? ws.claims.find((x) => x.id === q.claimId) : undefined;
      if (c) {
        c.sourceText = `${c.sourceText}\n[Interview answer] ${action.answer}`;
        if (action.rewrite?.trim()) c.text = action.rewrite.trim();
        c.metrics = [...new Set([...c.metrics, ...extractMetrics(action.answer)])];
        const rank = { activity: 0, output: 1, outcome: 2, impact: 3 } as const;
        const s2 = classifyStrength(`${c.text} ${action.answer}`);
        if (rank[s2] > rank[c.strength]) c.strength = s2;
        c.status = action.confirmed ? "verified_by_user" : "user_provided";
        c.sourceType = "interview";
        c.locked = true;
        c.origin = "user";
        // Adaptive follow-up: one gentle probe when an answer is brief and unmeasured.
        const words = action.answer.trim().split(/\s+/).length;
        const fid = `q-fu-${c.id}`;
        if (words < 12 && extractMetrics(action.answer).length === 0 && q.priority >= 4 && !ws.questions.some((x) => x.id === fid))
          ws.questions.push({
            id: fid,
            claimId: c.id,
            question: "Thanks. Is there any measure you can add (time, volume, error rate, cost), or a qualitative signal such as feedback, adoption or sign-off?",
            reason: "Your answer was brief; a concrete signal makes this claim much stronger.",
            priority: q.priority - 1,
            state: "open",
            answer: null,
            answeredAt: null,
          });
      }
      edited(ws, "claims");
      break;
    }
    case "skip_question": {
      const q = ws.questions.find((x) => x.id === action.questionId) ?? fail("Question not found.");
      q.state = "skipped";
      break;
    }
    case "add_claim":
      ws.claims.push({
        id: `c-u-${shortHash(action.text + now)}`,
        text: action.text,
        sourceText: action.text,
        sourceType: "user_edit",
        experienceId: action.experienceId,
        status: "user_provided",
        strength: classifyStrength(action.text),
        metrics: extractMetrics(action.text),
        origin: "user",
        locked: true,
      });
      edited(ws, "claims");
      break;
    case "set_claim_status": {
      const c = ws.claims.find((x) => x.id === action.claimId) ?? fail("Claim not found.");
      c.status = action.status;
      c.locked = true;
      edited(ws, "claims");
      break;
    }
    case "choose_positioning": {
      const p = ws.positioning ?? fail("Run positioning first.");
      if (!p.options.some((o) => o.id === action.optionId)) fail("Unknown option.");
      p.selectedOptionId = action.optionId;
      p.editedStatement = action.editedStatement?.trim() || null;
      p.approvedAt = now;
      edited(ws, "positioning");
      break;
    }
    case "select_headline": {
      const li = ws.linkedin ?? fail("No LinkedIn draft.");
      if (!li.headlineOptions.some((h) => h.id === action.id)) fail("Unknown headline.");
      li.selectedHeadlineId = action.id;
      edited(ws, "linkedin");
      break;
    }
    case "edit_statement": {
      const s = findStatement(ws, action.ref) ?? fail("Statement not found.");
      s.text = action.text;
      s.userEdited = true;
      s.userApproved = false;
      if (s.status === "excluded") s.status = "needs_confirmation";
      Object.assign(s, recheck(ws, s));
      edited(ws, action.ref === "brand-statement" ? "brand" : "linkedin");
      break;
    }
    case "set_statement": {
      const s = findStatement(ws, action.ref) ?? fail("Statement not found.");
      if (action.action === "approve") s.userApproved = true;
      if (action.action === "exclude") s.status = "excluded";
      if (action.action === "restore") {
        s.status = "needs_confirmation";
        s.userApproved = false;
      }
      Object.assign(s, recheck(ws, s));
      edited(ws, action.ref === "brand-statement" ? "brand" : "linkedin");
      break;
    }
    case "resolve_flag": {
      const qa = ws.qa ?? fail("No QA report.");
      const f = qa.flags.find((x) => x.id === action.flagId) ?? fail("Flag not found.");
      if (action.resolution === "dismissed" && f.severity === "critical")
        fail("Critical flags cannot be dismissed. Confirm you can support the claim, edit it, or exclude it.");
      f.resolution = action.resolution;
      const s = f.targetRef ? findStatement(ws, f.targetRef) : null;
      if (s && action.resolution === "user_approved") s.userApproved = true;
      if (s && action.resolution === "excluded") s.status = "excluded";
      if (s) Object.assign(s, recheck(ws, s));
      qa.verdict = verdictOf(qa.flags);
      break;
    }
    case "edit_calendar": {
      const c = ws.brand?.calendar.find((x) => x.day === action.day) ?? fail("Calendar day not found.");
      if (action.note !== undefined) {
        c.note = action.note;
        c.userEdited = true;
      }
      if (action.done !== undefined) c.done = action.done;
      break;
    }
    case "toggle_action": {
      const p = ws.plan ?? fail("No plan.");
      p.done[action.actionId] = action.done;
      break;
    }
    case "feedback":
      ws.feedback.push({
        id: randomUUID().slice(0, 12),
        versionId: ws.versions.at(-1)?.id ?? null,
        section: action.section,
        rating: action.rating as 1 | 2 | 3 | 4 | 5 | null,
        flaggedInaccurate: action.flaggedInaccurate,
        comment: action.comment,
        createdAt: now,
      });
      break;
    case "snapshot":
      snapshotVersion(ws, providerLabel, action.label);
      break;
  }
  ws.scores = ws.profile ? computeScores(ws) : ws.scores;
  ws.updatedAt = now;
  return ws;
}
