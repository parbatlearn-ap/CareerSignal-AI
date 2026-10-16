import { z } from "zod";
import { Id } from "./common";

export const PrimaryObjective = z.enum([
  "improve_profile",
  "transition_role",
  "promotion_leadership",
  "personal_brand",
  "understand_gaps",
  "explore_directions",
]);
export type PrimaryObjective = z.infer<typeof PrimaryObjective>;

export const OBJECTIVE_LABELS: Record<PrimaryObjective, string> = {
  improve_profile: "Improve my current LinkedIn profile",
  transition_role: "Transition to a new role",
  promotion_leadership: "Position for promotion / senior leadership",
  personal_brand: "Build a professional personal brand",
  understand_gaps: "Understand target-role gaps",
  explore_directions: "Explore plausible career directions",
};

const short = z.string().trim().max(200);

export const GoalsSchema = z.object({
  primaryObjective: PrimaryObjective,
  currentRole: short,
  targetRole: short,
  market: short, // country / market, e.g. "India"
  industry: short,
  seniority: short,
  yearsExperience: z.number().min(0).max(60).nullable(),
  goalsText: z.string().trim().max(2000),
  targetCompanies: z.array(short).max(20),
  hoursPerWeek: z.number().min(0).max(80).nullable(),
  tonePreference: short,
});
export type Goals = z.infer<typeof GoalsSchema>;

export const JobDescriptionSchema = z.object({
  id: Id,
  title: short,
  company: short,
  source: short, // e.g. "Pasted by user", "Uploaded file: jd.pdf"
  providedAt: z.string(),
  synthetic: z.boolean(),
  text: z.string().min(1).max(30000),
});
export type JobDescription = z.infer<typeof JobDescriptionSchema>;

export const InputsSchema = z.object({
  resumeText: z.string().max(60000),
  resumeSource: short,
  /** Reference only. The app never fetches or scrapes LinkedIn. */
  linkedinUrl: z.string().max(300),
  /** Optional: the user's current LinkedIn text, pasted, used for before/after + consistency. */
  existingLinkedinText: z.string().max(30000),
  jobDescriptions: z.array(JobDescriptionSchema).max(15),
});
export type Inputs = z.infer<typeof InputsSchema>;
