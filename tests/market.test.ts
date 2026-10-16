import { describe, expect, it } from "vitest";
import { aggregateMarket, formatFrequency } from "@/lib/analysis/market";
import { marketRuleBased } from "@/lib/agents/market";
import type { JobDescription } from "@/lib/schemas/inputs";

const jd = (id: string, text: string): JobDescription => ({ id, title: id, company: "", source: "test", providedAt: "2026-10-01", synthetic: false, text });

describe("job-description frequency", () => {
  const jds = [
    jd("a", "Requirements\n- SQL\n- Stakeholder management"),
    jd("b", "Requirements\n- SQL and Python"),
    jd("c", "Requirements\n- Excel"),
  ];

  it("counts each term once per JD with numerator and denominator", () => {
    const m = aggregateMarket(jds, marketRuleBased({ targetRole: "BA", market: "IN", jds }));
    const sql = m.requirements.find((r) => r.term === "SQL")!;
    expect(sql).toMatchObject({ count: 2, total: 3 });
    expect(sql.jdIds.sort()).toEqual(["a", "b"]);
    expect(m.sampleSize).toBe(3);
    expect(m.requirements.every((r) => r.total === 3 && r.count <= r.total)).toBe(true);
  });

  it("drops terms the model returns that are not in the JD text (no fabrication)", () => {
    const m = aggregateMarket(jds, {
      perJd: [{ jdId: "a", titleNormalized: "a", seniority: "mid", required: ["SQL", "Kubernetes"], preferred: [], tools: [], responsibilities: [], domainKnowledge: [], leadershipSignals: [], experienceRequirement: null, credentialRequirements: [] }],
    });
    expect(m.requirements.some((r) => r.term === "Kubernetes")).toBe(false);
    expect(m.droppedUngroundedTerms).toContain("Kubernetes");
  });

  it("ignores extractions for unknown JD ids", () => {
    const m = aggregateMarket(jds, {
      perJd: [{ jdId: "ghost", titleNormalized: "x", seniority: "mid", required: ["SQL"], preferred: [], tools: [], responsibilities: [], domainKnowledge: [], leadershipSignals: [], experienceRequirement: null, credentialRequirements: [] }],
    });
    expect(m.sampleSize).toBe(0);
  });

  it("labels small samples as directional and hides percentages below 5 JDs", () => {
    const m = aggregateMarket(jds.slice(0, 2), marketRuleBased({ targetRole: "", market: "", jds: jds.slice(0, 2) }));
    expect(m.directional).toBe(true);
    expect(formatFrequency(2, 3)).toBe("2 of 3");
    expect(formatFrequency(4, 5)).toBe("4 of 5 (80%)");
    expect(formatFrequency(0, 0)).toBe("no data");
  });

  it("flags synthetic JDs as not real market evidence", () => {
    const syn = [{ ...jds[0], synthetic: true }];
    const m = aggregateMarket(syn, marketRuleBased({ targetRole: "", market: "", jds: syn }));
    expect(m.syntheticCount).toBe(1);
    expect(m.limitations.join(" ")).toMatch(/SYNTHETIC/);
  });
});
