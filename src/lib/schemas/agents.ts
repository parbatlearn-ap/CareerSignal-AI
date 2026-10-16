/**
 * Agent output contracts. Each agent returns exactly one of these shapes;
 * outputs are validated with Zod before anything is stored.
 */
import { z } from "zod";
import { Confidence, EvidenceStatus, Id, StatementStatus, Strength } from "./common";

const txt = z.string().max(4000);
const line = z.string().max(600);

// ---------- Agent 1: Career Discovery ----------
export const DiscoveryOutputSchema = z.object({
  experiences: z
    .array(
      z.object({
        title: line,
        employer: line,
        start: z.string().max(40).nullable(),
        end: z.string().max(40).nullable(),
        bullets: z.array(line).max(30),
        sourceQuote: txt,
      }),
    )
    .max(25),
  skills: z
    .array(
      z.object({
        name: z.string().max(80),
        category: z.enum(["tool", "method", "domain", "soft", "other"]),
        sourceQuote: txt,
      }),
    )
    .max(80),
  projects: z.array(z.object({ name: line, description: txt, sourceQuote: txt })).max(20),
  certifications: z.array(z.object({ name: line, sourceQuote: txt })).max(20),
  education: z.array(z.object({ text: line })).max(10),
  domains: z.array(z.string().max(80)).max(15),
  achievementCandidates: z
    .array(z.object({ text: txt, sourceQuote: txt, experienceIndex: z.number().int().nullable() }))
    .max(60),
  ambiguities: z.array(line).max(30),
  unknowns: z.array(line).max(30),
});
export type DiscoveryOutput = z.infer<typeof DiscoveryOutputSchema>;

// ---------- Agent 2: Evidence Mining ----------
export const EvidenceOutputSchema = z.object({
  claims: z
    .array(
      z.object({
        text: txt,
        sourceText: txt,
        experienceId: z.string().max(120).nullable(),
        strength: Strength,
        metrics: z.array(z.string().max(60)).max(10),
        status: EvidenceStatus,
      }),
    )
    .max(80),
  followUps: z
    .array(
      z.object({
        claimIndex: z.number().int(),
        question: line,
        reason: line,
        priority: z.number().int().min(1).max(5),
      }),
    )
    .max(40),
  unsupportedNotes: z.array(line).max(30),
});
export type EvidenceOutput = z.infer<typeof EvidenceOutputSchema>;

// ---------- Agent 3: Market Intelligence ----------
export const SenioritySignal = z.enum(["entry", "mid", "senior", "lead", "unspecified"]);
export const MarketExtractionSchema = z.object({
  perJd: z
    .array(
      z.object({
        jdId: Id,
        titleNormalized: line,
        seniority: SenioritySignal,
        required: z.array(z.string().max(100)).max(40),
        preferred: z.array(z.string().max(100)).max(40),
        tools: z.array(z.string().max(100)).max(40),
        responsibilities: z.array(line).max(30),
        domainKnowledge: z.array(z.string().max(100)).max(20),
        leadershipSignals: z.array(line).max(20),
        experienceRequirement: line.nullable(),
        credentialRequirements: z.array(line).max(10),
      }),
    )
    .max(15),
});
export type MarketExtraction = z.infer<typeof MarketExtractionSchema>;

// ---------- Agent 4: Skills & Gap Analyst ----------
export const MatchClass = z.enum([
  "demonstrated",
  "partially_demonstrated",
  "claimed_but_unsupported",
  "not_evidenced",
  "not_applicable",
]);
export type MatchClass = z.infer<typeof MatchClass>;

export const GapOutputSchema = z.object({
  rows: z
    .array(
      z.object({
        requirement: z.string().max(120),
        classification: MatchClass,
        evidenceClaimIds: z.array(Id).max(10),
        rationale: line,
        confidence: Confidence,
        nextAction: line,
      }),
    )
    .max(80),
});
export type GapOutput = z.infer<typeof GapOutputSchema>;

// ---------- Agent 5: Positioning Strategist ----------
export const PositioningOptionSchema = z.object({
  id: Id,
  name: line,
  statement: txt,
  audience: line,
  targetJobFamilies: z.array(line).max(6),
  proofPointClaimIds: z.array(Id).max(10),
  strengths: z.array(line).max(8),
  risks: z.array(line).max(8),
  tradeOffs: z.array(line).max(8),
  headlineDirection: line,
  doNotClaim: z.array(line).max(8),
  stretch: z.boolean(),
  confidence: Confidence,
  confidenceReason: line,
});
export type PositioningOption = z.infer<typeof PositioningOptionSchema>;

export const PositioningOutputSchema = z.object({
  options: z.array(PositioningOptionSchema).min(2).max(3),
  recommendedOptionId: Id,
  recommendationReason: line,
});
export type PositioningOutput = z.infer<typeof PositioningOutputSchema>;

// ---------- Statements (shared by LinkedIn + Brand) ----------
export const StatementSchema = z.object({
  id: Id,
  text: txt,
  evidenceClaimIds: z.array(Id).max(10),
  status: StatementStatus,
  explanation: line,
});
export type Statement = z.infer<typeof StatementSchema>;

// ---------- Agent 6: LinkedIn Profile Architect ----------
export const LinkedInOutputSchema = z.object({
  headlineOptions: z.array(StatementSchema).min(1).max(5),
  about: z.array(StatementSchema).min(1).max(8),
  experience: z
    .array(z.object({ experienceId: Id, bullets: z.array(StatementSchema).max(10) }))
    .max(25),
  skills: z.array(z.object({ name: z.string().max(80), evidenceClaimIds: z.array(Id).max(10) })).max(50),
  featured: z.array(z.object({ title: line, rationale: line, evidenceClaimIds: z.array(Id).max(10) })).max(8),
  checklist: z.array(line).max(20),
  editNotes: z.array(line).max(20),
  bannerBrief: line,
});
export type LinkedInOutput = z.infer<typeof LinkedInOutputSchema>;

// ---------- Agent 7: Personal Brand Strategist ----------
export const PostFormat = z.enum(["text", "carousel", "case_study", "short_video", "poll"]);
export const BrandOutputSchema = z.object({
  brandStatement: StatementSchema,
  audience: line,
  pillars: z
    .array(z.object({ id: Id, name: line, pointOfView: line, evidenceClaimIds: z.array(Id).max(10) }))
    .min(3)
    .max(4),
  postIdeas: z
    .array(
      z.object({
        id: Id,
        title: line,
        pillarId: Id,
        format: PostFormat,
        hook: line,
        evidenceClaimIds: z.array(Id).max(10),
        isHypotheticalExample: z.boolean(),
      }),
    )
    .length(10),
  calendar: z
    .array(
      z.object({
        day: z.number().int().min(1).max(30),
        activity: z.enum(["post", "engage", "prepare", "review", "rest"]),
        postIdeaId: Id.nullable(),
        note: line,
      }),
    )
    .length(30),
  toneGuide: z.array(line).max(10),
  avoid: z.array(line).max(10),
  engagementRoutine: z.array(line).max(10),
});
export type BrandOutput = z.infer<typeof BrandOutputSchema>;

// ---------- Agent 8: Critic / QA (LLM part) ----------
export const QaSeverity = z.enum(["critical", "major", "minor"]);
export const CriticOutputSchema = z.object({
  flags: z
    .array(
      z.object({
        area: z.enum(["linkedin", "brand", "positioning", "market", "gap", "evidence", "scores"]),
        targetRef: z.string().max(120).nullable(),
        severity: QaSeverity,
        category: z.enum([
          "unsupported_claim",
          "invented_metric",
          "credential",
          "seniority",
          "contradiction",
          "generic_language",
          "keyword_stuffing",
          "missing_caveat",
          "overconfidence",
          "other",
        ]),
        message: line,
      }),
    )
    .max(40),
  summary: line,
});
export type CriticOutput = z.infer<typeof CriticOutputSchema>;

// ---------- Agent 9: Career Action Planner ----------
export const ActionCategory = z.enum([
  "profile_edit",
  "gather_evidence",
  "develop_skill",
  "demonstrate_project",
  "validate_assumption",
  "brand_content",
]);
export const PlanOutputSchema = z.object({
  actions: z
    .array(
      z.object({
        id: Id,
        week: z.number().int().min(1).max(4),
        title: line,
        category: ActionCategory,
        effortHours: z.number().min(0).max(40),
        dependsOn: z.array(Id).max(5),
        completionCriteria: line,
        linkedRequirement: z.string().max(120).nullable(),
      }),
    )
    .min(1)
    .max(30),
  assumptionsToValidate: z.array(line).max(10),
  capacityNote: line,
});
export type PlanOutput = z.infer<typeof PlanOutputSchema>;
