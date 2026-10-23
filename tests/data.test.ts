import { describe, expect, it, vi } from "vitest";
import { promises as fsp } from "node:fs";
import { mkdtempSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { FileRepository, MemoryRepository, renameWithRetry } from "@/lib/repo";
import { ActionSchema, newWorkspace } from "@/lib/orchestrator/actions";
import { parseDocument, ParseError } from "@/lib/server/parse";
import { BrandOutputSchema, LinkedInOutputSchema, PositioningOutputSchema } from "@/lib/schemas/agents";
import { AGENTS } from "@/lib/agents";
import { buildReportMarkdown } from "@/lib/export/markdown";
import { demoWorkspace, runFullPipeline } from "./helpers";

describe("repositories: ownership, export and deletion", () => {
  for (const make of [() => new MemoryRepository(), () => new FileRepository(mkdtempSync(path.join(os.tmpdir(), "cs-")))]) {
    it(`${make().constructor.name} isolates owners and deletes data`, async () => {
      const repo = make();
      const a = newWorkspace("owner-a");
      const b = newWorkspace("owner-b");
      await repo.create(a);
      await repo.create(b);
      expect((await repo.listByOwner("owner-a")).map((w) => w.id)).toEqual([a.id]);
      expect(await repo.deleteByOwner("owner-a")).toBe(1);
      expect(await repo.get(a.id)).toBeNull();
      expect(await repo.get(b.id)).not.toBeNull();
      expect(await repo.delete(b.id)).toBe(true);
      expect(await repo.get(b.id)).toBeNull();
    });
  }

  it("FileRepository rejects path traversal ids and leaves no temp files", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "cs-"));
    const repo = new FileRepository(dir);
    expect(await repo.get("../../etc/passwd")).toBeNull();
    await repo.save(newWorkspace("o"));
    expect(readdirSync(dir).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });
});

describe("Windows/OneDrive file locks", () => {
  it("retries a rename blocked by a transient EPERM lock, then saves", async () => {
    const real = fsp.rename.bind(fsp);
    let calls = 0;
    const spy = vi.spyOn(fsp, "rename").mockImplementation(async (a, b) => {
      calls++;
      if (calls < 3) throw Object.assign(new Error("locked"), { code: "EPERM" });
      return real(a, b);
    });
    const repo = new FileRepository(mkdtempSync(path.join(os.tmpdir(), "cs-")));
    const ws = newWorkspace("o");
    await repo.save(ws);
    spy.mockRestore();
    expect(calls).toBe(3);
    expect((await repo.get(ws.id))?.id).toBe(ws.id);
  });

  it("gives up after the retry limit and cleans up the temp file", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "cs-"));
    const spy = vi.spyOn(fsp, "rename").mockRejectedValue(Object.assign(new Error("locked"), { code: "EBUSY" }));
    await fsp.writeFile(path.join(dir, "a.tmp"), "x");
    await expect(renameWithRetry(path.join(dir, "a.tmp"), path.join(dir, "a.json"), 3)).rejects.toThrow("locked");
    spy.mockRestore();
    expect(readdirSync(dir)).toEqual([]);
  });
});

describe("schemas", () => {
  it("rejects malformed actions", () => {
    expect(ActionSchema.safeParse({ type: "add_jd", title: "x", company: "", text: "short" }).success).toBe(false);
    expect(ActionSchema.safeParse({ type: "nope" }).success).toBe(false);
    expect(ActionSchema.safeParse({ type: "answer_question", questionId: "q", answer: "", confirmed: true }).success).toBe(false);
  });

  it("enforces agent output contracts (2-3 options, 10 ideas, 30 days)", () => {
    expect(PositioningOutputSchema.safeParse({ options: [], recommendedOptionId: "x", recommendationReason: "" }).success).toBe(false);
    expect(BrandOutputSchema.shape.postIdeas.safeParse([]).success).toBe(false);
    expect(LinkedInOutputSchema.safeParse({}).success).toBe(false);
  });

  it("every agent is a distinct module with its own prompt and schema", () => {
    const defs = Object.values(AGENTS);
    expect(defs).toHaveLength(9);
    expect(new Set(defs.map((d) => d.system)).size).toBe(9);
    expect(new Set(defs.map((d) => d.outputSchema)).size).toBe(9);
    expect(new Set(defs.map((d) => d.responsibility)).size).toBe(9);
  });

  it("rule-based outputs validate against each agent's schema", async () => {
    const { ws } = await runFullPipeline(demoWorkspace());
    expect(LinkedInOutputSchema.safeParse(ws.linkedin).success).toBe(true);
    expect(BrandOutputSchema.safeParse(ws.brand).success).toBe(true);
  });
});

describe("document parsing", () => {
  it("parses TXT and rejects unsupported, empty, oversized or disguised files", async () => {
    expect((await parseDocument("cv.txt", Buffer.from("Business Analyst\nSQL"))).text).toContain("SQL");
    await expect(parseDocument("cv.exe", Buffer.from("x"))).rejects.toBeInstanceOf(ParseError);
    await expect(parseDocument("cv.txt", Buffer.alloc(0))).rejects.toThrow(/empty/);
    await expect(parseDocument("cv.txt", Buffer.alloc(6 * 1024 * 1024, 97))).rejects.toThrow(/larger/);
    await expect(parseDocument("cv.pdf", Buffer.from("not a pdf"))).rejects.toThrow(/valid PDF/);
    await expect(parseDocument("cv.docx", Buffer.from("not a docx"))).rejects.toThrow(/valid DOCX/);
  });
});

describe("export", () => {
  it("contains no prompts, secrets or reasoning traces", async () => {
    process.env.GEMINI_API_KEY = "sk-should-never-appear";
    const { ws } = await runFullPipeline(demoWorkspace());
    const md = buildReportMarkdown(ws);
    for (const def of Object.values(AGENTS)) expect(md).not.toContain(def.system.slice(0, 40));
    expect(md).not.toContain("sk-should-never-appear");
    expect(md).not.toContain("Non-negotiable rules");
    expect(md).toMatch(/heuristic/i);
    delete process.env.GEMINI_API_KEY;
  });
});
