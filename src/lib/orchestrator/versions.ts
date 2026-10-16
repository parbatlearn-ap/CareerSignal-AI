/** Report versions for re-analysis and comparison. */
import { randomUUID } from "node:crypto";
import type { ReportVersion, Workspace } from "../schemas/workspace";
import { aboutText, selectedHeadline } from "../analysis/profileText";
import { selectedOption } from "./apply";

export function snapshotVersion(ws: Workspace, providerLabel: string, label?: string): ReportVersion {
  const claimCounts: Record<string, number> = {};
  ws.claims.forEach((c) => (claimCounts[c.status] = (claimCounts[c.status] ?? 0) + 1));
  const gapCounts: Record<string, number> = {};
  (ws.gaps ?? []).forEach((g) => (gapCounts[g.classification] = (gapCounts[g.classification] ?? 0) + 1));
  const v: ReportVersion = {
    id: randomUUID().slice(0, 12),
    label: label || `Version ${ws.versions.length + 1}`,
    createdAt: new Date().toISOString(),
    provider: providerLabel,
    scores: ws.scores ? structuredClone(ws.scores) : null,
    positioningName: selectedOption(ws)?.name ?? null,
    headline: selectedHeadline(ws),
    about: aboutText(ws),
    claimCounts,
    gapCounts,
    jdCount: ws.market?.sampleSize ?? 0,
  };
  ws.versions.push(v);
  return v;
}

export { diffVersions, type VersionDiff } from "../analysis/versionDiff";
