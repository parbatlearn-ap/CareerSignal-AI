/**
 * Persisted data model. A Workspace is one user's analysis (owned by a local
 * session). It aggregates the PRD entities as typed collections:
 *   career_profiles/experiences/skills  -> profile
 *   achievements/evidence_claims        -> claims (+ questions)
 *   target_roles                        -> goals
 *   job_descriptions/job_requirements   -> inputs.jobDescriptions / market
 *   analysis_runs                       -> versions
 *   agent_runs                          -> agentRuns
 *   positioning_options                 -> positioning
 *   linkedin_profile_versions           -> linkedin (+ versions snapshots)
 *   brand_strategies/content_calendar   -> brand
 *   user_feedback                       -> feedback
 *   consent_and_preferences             -> consent
 */
import type {
  AgentId,
  Confidence,
  EvidenceStatus,
  Origin,
  StatementStatus,
  Strength,
} from "./common";
import type { Goals, Inputs } from "./inputs";
import type {
  BrandOutput,
  MatchClass,
  PlanOutput,
  PositioningOption,
  Statement,
} from "./agents";

export const SCHEMA_VERSION = 1;

interface Owned {
  origin: Origin;
  /** Locked items were created or edited by the user and are never overwritten by agents. */
  locked: boolean;
}

export interface Experience extends Owned {
  id: string;
  title: string;
  employer: string;
  start: string | null;
  end: string | null;
  bullets: string[];
  sourceQuote: string;
}
export interface Skill extends Owned {
  id: string;
  name: string;
  category: "tool" | "method" | "domain" | "soft" | "other";
  sourceQuote: string;
}
export interface Project extends Owned {
  id: string;
  name: string;
  description: string;
  sourceQuote: string;
}
export interface Certification extends Owned {
  id: string;
  name: string;
  sourceQuote: string;
}
export interface AchievementCandidate {
  id: string;
  text: string;
  sourceQuote: string;
  experienceId: string | null;
}

export interface CareerProfile {
  experiences: Experience[];
  skills: Skill[];
  projects: Project[];
  certifications: Certification[];
  education: { id: string; text: string }[];
  domains: string[];
  achievementCandidates: AchievementCandidate[];
  ambiguities: string[];
  unknowns: string[];
  /** User confirmed the extracted profile before analysis (PRD stage 2). */
  confirmed: boolean;
}

export interface EvidenceClaim extends Owned {
  id: string;
  text: string;
  /** Verbatim text from the user's material that supports the claim. */
  sourceText: string;
  sourceType: "resume" | "interview" | "user_edit";
  experienceId: string | null;
  status: EvidenceStatus;
  strength: Strength;
  /** Only numbers that literally appear in sourceText. */
  metrics: string[];
}

export interface InterviewQuestion {
  id: string;
  claimId: string | null;
  question: string;
  reason: string;
  priority: number;
  state: "open" | "answered" | "skipped";
  answer: string | null;
  answeredAt: string | null;
}

export interface MarketRequirement {
  term: string;
  kind: "required" | "preferred" | "tool" | "domain" | "leadership" | "credential";
  /** Number of supplied JDs that mention it (numerator). */
  count: number;
  /** Number of supplied JDs analysed (denominator). */
  total: number;
  jdIds: string[];
}
export interface MarketAnalysis {
  perJd: {
    jdId: string;
    titleNormalized: string;
    seniority: string;
    required: string[];
    preferred: string[];
    tools: string[];
    responsibilities: string[];
    domainKnowledge: string[];
    leadershipSignals: string[];
    experienceRequirement: string | null;
    credentialRequirements: string[];
  }[];
  requirements: MarketRequirement[];
  seniorityCounts: Record<string, number>;
  sampleSize: number;
  directional: boolean;
  syntheticCount: number;
  /** Terms the model returned that do not appear in the JD text (dropped). */
  droppedUngroundedTerms: string[];
  limitations: string[];
  sources: { jdId: string; title: string; company: string; source: string; providedAt: string; synthetic: boolean }[];
}

export interface GapRow {
  requirement: string;
  kind: MarketRequirement["kind"];
  count: number;
  total: number;
  classification: MatchClass;
  evidenceClaimIds: string[];
  rationale: string;
  confidence: Confidence;
  nextAction: string;
}

export interface PositioningState {
  options: PositioningOption[];
  recommendedOptionId: string;
  recommendationReason: string;
  selectedOptionId: string | null;
  /** User's edited version of the selected statement (approved fact). */
  editedStatement: string | null;
  approvedAt: string | null;
}

export interface EditableStatement extends Statement {
  /** User edited text; protected from agent overwrite. */
  userEdited: boolean;
  /** User explicitly confirmed they can support the claim. */
  userApproved: boolean;
}

export interface LinkedInDraft {
  positioningOptionId: string;
  headlineOptions: EditableStatement[];
  selectedHeadlineId: string | null;
  about: EditableStatement[];
  experience: { experienceId: string; bullets: EditableStatement[] }[];
  skills: { name: string; evidenceClaimIds: string[]; status: StatementStatus }[];
  featured: { title: string; rationale: string; evidenceClaimIds: string[] }[];
  checklist: string[];
  editNotes: string[];
  bannerBrief: string;
  revision: number;
}

export interface BrandStrategy extends Omit<BrandOutput, "brandStatement" | "calendar"> {
  brandStatement: EditableStatement;
  calendar: (BrandOutput["calendar"][number] & { userEdited: boolean; done: boolean })[];
  revision: number;
}

export type FlagResolution = "open" | "revised" | "user_approved" | "excluded" | "dismissed";
export interface QaFlag {
  id: string;
  source: "rule" | "llm";
  area: string;
  targetRef: string | null;
  severity: "critical" | "major" | "minor";
  category: string;
  message: string;
  resolution: FlagResolution;
}
export interface QaReport {
  checks: { id: string; label: string; status: "pass" | "warn" | "fail"; detail: string }[];
  flags: QaFlag[];
  verdict: "pass" | "pass_with_warnings" | "blocked";
  revisionCycles: number;
  llmSummary: string;
  ranAt: string;
}

export interface ActionPlan extends PlanOutput {
  done: Record<string, boolean>;
}

export interface ScoreComponent {
  id: string;
  label: string;
  weight: number;
  /** 0-100, or null when there is insufficient data. */
  score: number | null;
  formula: string;
  reasons: string[];
  basis: "rule";
}
export interface ScoreReport {
  version: string;
  components: ScoreComponent[];
  overall: number | null;
  coveredWeight: number;
  jdCount: number;
  caveats: string[];
  computedAt: string;
}

export interface AgentRun {
  id: string;
  agentId: AgentId;
  status: "running" | "succeeded" | "failed";
  provider: string;
  model: string;
  startedAt: string;
  finishedAt: string | null;
  latencyMs: number | null;
  attempts: number;
  usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | null;
  error: { code: string; message: string } | null;
  summary: string;
  correlationId: string;
}

export interface ReportVersion {
  id: string;
  label: string;
  createdAt: string;
  provider: string;
  scores: ScoreReport | null;
  positioningName: string | null;
  headline: string | null;
  about: string;
  claimCounts: Record<string, number>;
  gapCounts: Record<string, number>;
  jdCount: number;
}

export interface Feedback {
  id: string;
  versionId: string | null;
  section: string;
  rating: 1 | 2 | 3 | 4 | 5 | null;
  flaggedInaccurate: boolean;
  comment: string;
  createdAt: string;
}

export interface Consent {
  /** Required before any user data is sent to an external LLM provider. */
  sendToProvider: boolean;
  /** Keep agent run metadata (never raw prompts) for debugging. */
  retainRunLogs: boolean;
  acceptedAt: string | null;
}

export interface InjectionWarning {
  source: string;
  snippet: string;
}

/** Sections whose user edits make downstream agent outputs stale. */
export type EditKey = "goals" | "inputs" | "jds" | "profile" | "claims" | "positioning" | "linkedin" | "brand";

export interface Workspace {
  id: string;
  schemaVersion: number;
  /** Monotonic counter; each agent success / user edit takes the next value. */
  seq: number;
  stepSeq: Partial<Record<AgentId, number>>;
  editSeq: Partial<Record<EditKey, number>>;
  ownerId: string;
  title: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  consent: Consent;
  goals: Goals | null;
  inputs: Inputs;
  injectionWarnings: InjectionWarning[];
  profile: CareerProfile | null;
  claims: EvidenceClaim[];
  questions: InterviewQuestion[];
  evidenceNotes: string[];
  market: MarketAnalysis | null;
  gaps: GapRow[] | null;
  positioning: PositioningState | null;
  linkedin: LinkedInDraft | null;
  brand: BrandStrategy | null;
  qa: QaReport | null;
  plan: ActionPlan | null;
  scores: ScoreReport | null;
  agentRuns: AgentRun[];
  versions: ReportVersion[];
  feedback: Feedback[];
}
