import { describe, expect, it } from "vitest";
import { computeScores, scoreAlignment, scoreEvidence } from "@/lib/analysis/scoring";
import { SCORE_WEIGHTS } from "@/lib/config";
import { newWorkspace } from "@/lib/orchestrator/actions";
import type { EvidenceClaim, GapRow, Workspace } from "@/lib/schemas/workspace";
import { demoWorkspace, runFullPipeline } from "./helpers";

const claim = (p: Partial<EvidenceClaim>): EvidenceClaim => ({
  id: Math.random().toString(36).slice(2),
  text: "x",
  sourceText: "x",
  sourceType: "resume",
  experienceId: null,
  status: "user_provided",
  strength: "activity",
  metrics: [],
  origin: "agent",
  locked: false,
  ...p,
});
const row = (p: Partial<GapRow>): GapRow => ({
  requirement: "SQL", kind: "required", count: 1, total: 2, classification: "not_evidenced",
  evidenceClaimIds: [], rationale: "", confidence: "low", nextAction: "", ...p,
});

describe("scoring", () => {
  it("weights sum to 100% and match the PRD", () => {
    expect(Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(SCORE_WEIGHTS).toEqual({ completeness: 0.1, alignment: 0.25, evidence: 0.2, searchTerms: 0.15, coherence: 0.15, differentiation: 0.1, brand: 0.05 });
  });

  it("returns insufficient data (null) instead of guessing", () => {
    const ws = newWorkspace("o");
    const r = computeScores(ws);
    expect(r.overall).toBeNull();
    expect(r.components.every((c) => c.score === null)).toBe(true);
    expect(r.caveats.join(" ")).toMatch(/withheld/);
  });

  it("evidence strength is a reproducible formula", () => {
    const ws = newWorkspace("o");
    ws.claims = [
      claim({ strength: "impact", status: "verified_by_user" }), // 1.0
      claim({ strength: "output", status: "user_provided" }), // 0.425
      claim({ strength: "activity", status: "unsupported" }), // 0
    ];
    expect(scoreEvidence(ws).score).toBe(Math.round(((1 + 0.425 + 0) / 3) * 100));
  });

  it("alignment is frequency-weighted and ignores not-applicable rows", () => {
    const ws = newWorkspace("o") as Workspace;
    ws.market = { sampleSize: 2 } as Workspace["market"];
    ws.gaps = [
      row({ requirement: "SQL", count: 2, total: 2, classification: "demonstrated" }), // f=1, w=1
      row({ requirement: "Python", count: 1, total: 2, classification: "not_evidenced" }), // f=.5, w=0
      row({ requirement: "X", count: 2, total: 2, classification: "not_applicable" }),
    ];
    expect(scoreAlignment(ws).score).toBe(67);
  });

  it("never describes scores as probabilities and discloses JD count", async () => {
    const { ws } = await runFullPipeline(demoWorkspace());
    const r = ws.scores!;
    expect(r.overall).not.toBeNull();
    expect(r.jdCount).toBe(5);
    const text = JSON.stringify(r).toLowerCase();
    expect(text).toContain("not a probability");
    expect(text).not.toMatch(/chance of (getting|an) (interview|job|offer)/);
    expect(r.components.every((c) => c.formula.length > 10 && c.basis === "rule")).toBe(true);
  });

  it("is deterministic for the same workspace", async () => {
    const { ws } = await runFullPipeline(demoWorkspace());
    const a = computeScores(ws, new Date(0));
    const b = computeScores(ws, new Date(0));
    expect(a).toEqual(b);
  });
});
