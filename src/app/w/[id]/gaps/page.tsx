"use client";

import { useWorkspace } from "@/components/workspace-context";
import { AgentPanel, Badge, Empty, FeedbackWidget, PageHeader } from "@/components/ui";
import { CurrentVsTarget } from "@/components/visuals";
import { formatFrequency } from "@/lib/analysis/market";

const LABEL: Record<string, [string, string]> = {
  demonstrated: ["ok", "Demonstrated"],
  partially_demonstrated: ["info", "Partially demonstrated"],
  claimed_but_unsupported: ["warn", "Claimed but unsupported"],
  not_evidenced: ["", "Not evidenced in supplied material"],
  not_applicable: ["", "Not applicable"],
};

export default function GapsPage() {
  const { view } = useWorkspace();
  if (!view) return null;
  const { ws } = view;
  return (
    <>
      <PageHeader title="Skills & Gaps" subtitle="“Not evidenced” means your material doesn't show it yet - not that you lack it." />
      <AgentPanel agentId="gap" runLabel="Run gap analysis" dataUsed={["key requirements from Market Signals", "your evidence claims", "skills you listed", "roles held (for domain evidence)"]} />
      {!ws.gaps ? <Empty>Run Market Intelligence and Evidence Mining first.</Empty> : (
        <>
          <CurrentVsTarget ws={ws} />
          <div className="card">
            <h2>Requirement matrix</h2>
            <div className="table-wrap"><table>
              <thead><tr><th>Requirement</th><th>In supplied JDs</th><th>Match</th><th>Evidence</th><th>Next action</th></tr></thead>
              <tbody>{ws.gaps.map((g) => (
                <tr key={g.requirement}>
                  <td><strong>{g.requirement}</strong><div className="hint">{g.kind}</div></td>
                  <td>{formatFrequency(g.count, g.total)}</td>
                  <td><Badge tone={LABEL[g.classification][0]}>{LABEL[g.classification][1]}</Badge><div className="hint">confidence: {g.confidence}</div></td>
                  <td className="hint">{g.rationale}{g.evidenceClaimIds.length > 0 && (
                    <details><summary>{g.evidenceClaimIds.length} claim(s)</summary><ul className="evidence-list">
                      {g.evidenceClaimIds.map((id) => <li key={id}>“{ws.claims.find((c) => c.id === id)?.text}”</li>)}</ul></details>)}</td>
                  <td className="hint">{g.nextAction}</td>
                </tr>))}
              </tbody>
            </table></div>
          </div>
          <FeedbackWidget section="gaps" />
        </>
      )}
    </>
  );
}
