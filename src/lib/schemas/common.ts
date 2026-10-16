import { z } from "zod";

/** How well a claim is backed by user-supplied material. */
export const EvidenceStatus = z.enum([
  "verified_by_user",
  "user_provided",
  "inferred_needs_confirmation",
  "unsupported",
]);
export type EvidenceStatus = z.infer<typeof EvidenceStatus>;

/** Activity -> output -> outcome -> impact ladder used by the Evidence Mining Agent. */
export const Strength = z.enum(["activity", "output", "outcome", "impact"]);
export type Strength = z.infer<typeof Strength>;

/** Who created a stored item. User-created/edited items are locked against agent overwrite. */
export const Origin = z.enum(["agent", "user"]);
export type Origin = z.infer<typeof Origin>;

/** Status shown on every generated LinkedIn/brand statement. */
export const StatementStatus = z.enum(["supported", "needs_confirmation", "excluded"]);
export type StatementStatus = z.infer<typeof StatementStatus>;

export const Confidence = z.enum(["low", "medium", "high"]);
export type Confidence = z.infer<typeof Confidence>;

export const Id = z.string().min(1).max(120);

export const AGENT_IDS = [
  "discovery",
  "evidence",
  "market",
  "gap",
  "positioning",
  "linkedin",
  "brand",
  "critic",
  "planner",
] as const;
export const AgentId = z.enum(AGENT_IDS);
export type AgentId = z.infer<typeof AgentId>;
