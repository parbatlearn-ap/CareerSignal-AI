/**
 * Central, versioned configuration. Scoring weights and thresholds are
 * hypotheses to test with users (PRD section 9), not scientific facts.
 */

export const SCORING_VERSION = "heuristic-v1.0";

export const SCORE_WEIGHTS = {
  completeness: 0.1,
  alignment: 0.25,
  evidence: 0.2,
  searchTerms: 0.15,
  coherence: 0.15,
  differentiation: 0.1,
  brand: 0.05,
} as const;
export type ScoreKey = keyof typeof SCORE_WEIGHTS;

/** Overall score is only shown when this share of total weight has data. */
export const MIN_COVERED_WEIGHT = 0.6;

/** Below this many JDs, market findings are labelled directional. */
export const MIN_JDS_FOR_MARKET_VIEW = 3;
/** Percentages are only displayed at or above this sample size; otherwise "n of N". */
export const MIN_JDS_FOR_PERCENT = 5;

/**
 * LinkedIn section limits. These are commonly cited values, NOT verified
 * against LinkedIn at build time; the UI labels them as such.
 */
export const LINKEDIN_LIMITS = {
  headline: 220,
  about: 2600,
  verified: false,
} as const;

export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const UPLOAD_EXTENSIONS = [".pdf", ".docx", ".txt"] as const;

export const DISCLAIMER =
  "CareerSignal AI offers informational career guidance. It does not guarantee interviews, job offers, recruiter views or salary outcomes. Scores are heuristic diagnostics, not hiring probabilities.";
