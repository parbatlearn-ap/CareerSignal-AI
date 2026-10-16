/** Pure version comparison (browser-safe). */
import type { ReportVersion } from "../schemas/workspace";

export interface VersionDiff {
  scoreChanges: { label: string; from: number | null; to: number | null }[];
  overall: { from: number | null; to: number | null };
  positioningChanged: boolean;
  headlineChanged: boolean;
  aboutChanged: boolean;
  claimChanges: { status: string; from: number; to: number }[];
  gapChanges: { classification: string; from: number; to: number }[];
  jd: { from: number; to: number };
}

export function diffVersions(a: ReportVersion, b: ReportVersion): VersionDiff {
  const labels = new Set([...(a.scores?.components ?? []), ...(b.scores?.components ?? [])].map((c) => c.label));
  const comp = (v: ReportVersion, l: string) => v.scores?.components.find((c) => c.label === l)?.score ?? null;
  const keys = (x: Record<string, number>, y: Record<string, number>) => [...new Set([...Object.keys(x), ...Object.keys(y)])];
  return {
    scoreChanges: [...labels].map((l) => ({ label: l, from: comp(a, l), to: comp(b, l) })),
    overall: { from: a.scores?.overall ?? null, to: b.scores?.overall ?? null },
    positioningChanged: a.positioningName !== b.positioningName,
    headlineChanged: a.headline !== b.headline,
    aboutChanged: a.about !== b.about,
    claimChanges: keys(a.claimCounts, b.claimCounts).map((s) => ({ status: s, from: a.claimCounts[s] ?? 0, to: b.claimCounts[s] ?? 0 })),
    gapChanges: keys(a.gapCounts, b.gapCounts).map((s) => ({ classification: s, from: a.gapCounts[s] ?? 0, to: b.gapCounts[s] ?? 0 })),
    jd: { from: a.jdCount, to: b.jdCount },
  };
}
