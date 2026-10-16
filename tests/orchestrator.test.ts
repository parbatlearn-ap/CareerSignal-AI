import { describe, expect, it } from "vitest";
import { demoWorkspace, mockDeps, runFullPipeline, runStep } from "./helpers";
import { MockProvider } from "@/lib/providers/mock";
import { ProviderError } from "@/lib/providers/types";
import { applyAction, newWorkspace } from "@/lib/orchestrator/actions";
import { nextStep, stepViews } from "@/lib/orchestrator/steps";
import { allStatements } from "@/lib/orchestrator/apply";
import { buildReportMarkdown } from "@/lib/export/markdown";
import { unsupportedNumbers } from "@/lib/analysis/text";
import { evidenceCorpus } from "@/lib/analysis/profileText";

describe("end-to-end orchestrator (mock provider)", () => {
  it("runs every agent in order and produces a coherent report", async () => {
    const { ws, failed } = await runFullPipeline(demoWorkspace());
    expect(failed).toBeNull();
    const succeeded = new Set(ws.agentRuns.filter((r) => r.status === "succeeded").map((r) => r.agentId));
    expect([...succeeded].sort()).toEqual(["brand", "critic", "discovery", "evidence", "gap", "linkedin", "market", "planner", "positioning"]);
    expect(ws.profile!.experiences).toHaveLength(2);
    expect(ws.claims.length).toBeGreaterThanOrEqual(8);
    expect(ws.market!.sampleSize).toBe(5);
    expect(ws.market!.syntheticCount).toBe(5);
    expect(ws.positioning!.options.length).toBeGreaterThanOrEqual(2);
    expect(ws.positioning!.options.length).toBeLessThanOrEqual(3);
    expect(ws.brand!.pillars.length).toBeGreaterThanOrEqual(3);
    expect(ws.brand!.postIdeas).toHaveLength(10);
    expect(ws.brand!.calendar).toHaveLength(30);
    expect(ws.qa!.verdict).not.toBe("blocked");
    expect(ws.plan!.actions.length).toBeGreaterThan(3);
    expect(ws.versions).toHaveLength(1);
    expect(nextStep(ws).type).toBe("complete");
    const md = buildReportMarkdown(ws);
    expect(md).toContain("SYNTHETIC DEMO DATA");
    expect(md).toContain("5 of 5");
    expect(md).not.toMatch(/system prompt|untrusted_document|API_KEY/i);
  });

  it("detects the injection string in the synthetic JD and treats it as data", async () => {
    const { ws } = await runFullPipeline(demoWorkspace());
    expect(ws.injectionWarnings.length).toBeGreaterThan(0);
    expect(ws.qa!.flags.some((f) => f.id === "rule-injection")).toBe(true);
    // The injected instruction must not have changed any output.
    expect(JSON.stringify(ws.linkedin)).not.toMatch(/10\/10/);
  });

  it("never puts a number in generated copy that is absent from the user's material", async () => {
    const { ws } = await runFullPipeline(demoWorkspace());
    const corpus = evidenceCorpus(ws);
    for (const s of allStatements(ws)) expect(unsupportedNumbers(s.statement.text, corpus)).toEqual([]);
  });

  it("stops at user-approval gates instead of auto-approving", async () => {
    const ws = demoWorkspace();
    const deps = mockDeps();
    await runStep(ws, "discovery", deps);
    expect(nextStep(ws)).toMatchObject({ type: "needs_input", agentId: "evidence" });
    expect(stepViews(ws).find((s) => s.id === "profile")!.status).toBe("needs_input");
    await expect(runStep(ws, "evidence", deps)).rejects.toThrow(/confirm/i);
  });

  it("marks downstream steps stale after the user edits inputs", async () => {
    const { ws } = await runFullPipeline(demoWorkspace());
    applyAction(ws, { type: "add_jd", title: "Extra", company: "", text: "Product Manager role needing SQL, Python and stakeholder management skills." });
    const views = stepViews(ws);
    expect(views.find((v) => v.id === "market")!.status).toBe("stale");
    expect(views.find((v) => v.id === "linkedin")!.status).toBe("stale");
    expect(nextStep(ws)).toEqual({ type: "run", agentId: "market" });
  });

  it("isolates partial failures: a failed agent leaves saved data untouched", async () => {
    const ws = demoWorkspace();
    await runStep(ws, "discovery", mockDeps());
    const before = JSON.stringify(ws.profile);
    const failing = new MockProvider({ failWith: new ProviderError("QUOTA_EXHAUSTED", "429 quota") });
    const runs = await runStep(ws, "discovery", mockDeps(failing));
    expect(runs[0].status).toBe("failed");
    expect(runs[0].error!.code).toBe("QUOTA_EXHAUSTED");
    expect(runs[0].error!.message).toMatch(/quota/i);
    expect(JSON.stringify(ws.profile)).toBe(before);
    expect(stepViews(ws).find((s) => s.id === "profile")!.status).toBe("failed");
  });

  it("repairs malformed JSON once, then succeeds", async () => {
    const ws = demoWorkspace();
    const provider = new MockProvider({ malformedFor: ["discovery"], malformedOnce: true });
    const runs = await runStep(ws, "discovery", mockDeps(provider));
    expect(runs[0].status).toBe("succeeded");
    expect(runs[0].attempts).toBe(2);
  });

  it("fails cleanly when output stays malformed after one repair", async () => {
    const ws = demoWorkspace();
    const provider = new MockProvider({ malformedFor: ["discovery"] });
    const runs = await runStep(ws, "discovery", mockDeps(provider));
    expect(runs[0].status).toBe("failed");
    expect(runs[0].error!.code).toBe("INVALID_OUTPUT");
    expect(runs[0].attempts).toBe(0);
    expect(ws.profile).toBeNull();
  });

  it("requires consent before sending data to an external provider", async () => {
    const ws = demoWorkspace();
    const fake = Object.assign(new MockProvider(), { id: "gemini" as const });
    const runs = await runStep(ws, "discovery", mockDeps(fake as never));
    expect(runs[0].status).toBe("failed");
    expect(runs[0].error!.code).toBe("CONSENT_REQUIRED");
    applyAction(ws, { type: "set_consent", sendToProvider: true });
    const ok = await runStep(ws, "discovery", mockDeps(fake as never));
    expect(ok[0].status).toBe("succeeded");
  });

  it("does not overwrite user-locked profile edits when discovery re-runs", async () => {
    const ws = demoWorkspace();
    await runStep(ws, "discovery", mockDeps());
    const exp = ws.profile!.experiences[0];
    applyAction(ws, { type: "edit_experience", id: exp.id, title: "Business Analyst II", employer: exp.employer, start: exp.start, end: exp.end });
    await runStep(ws, "discovery", mockDeps());
    expect(ws.profile!.experiences.some((e) => e.title === "Business Analyst II" && e.locked)).toBe(true);
  });

  it("requires goals and resume before discovery", async () => {
    const ws = newWorkspace("o");
    await expect(runStep(ws, "discovery", mockDeps())).rejects.toThrow(/Goals/);
  });
});
