"use client";

import { useWorkspace } from "@/components/workspace-context";
import { AgentPanel, Badge, Empty, FeedbackWidget, PageHeader } from "@/components/ui";

const CAT: Record<string, string> = {
  profile_edit: "Profile edit", gather_evidence: "Gather evidence", develop_skill: "Develop skill",
  demonstrate_project: "Demonstrable project", validate_assumption: "Validate assumption", brand_content: "Brand content",
};

export default function PlanPage() {
  const { view, act } = useWorkspace();
  if (!view) return null;
  const plan = view.ws.plan;
  const done = plan ? plan.actions.filter((a) => plan.done[a.id]).length : 0;
  return (
    <>
      <PageHeader title="30-day Action Plan" subtitle="Prioritised, sized to your available time. You perform every external action yourself." />
      <AgentPanel agentId="planner" runLabel="Build plan" dataUsed={["gap matrix", "open interview questions", "unconfirmed statements and QA flags", "hours per week from Goals"]} />
      {!plan ? <Empty>Run the QA review first (and resolve any critical flags).</Empty> : (
        <>
          <div className="card">
            <div className="spread"><h2>Progress</h2><Badge tone="info">{done} of {plan.actions.length} done</Badge></div>
            <div className="bar"><span style={{ width: `${(done / plan.actions.length) * 100}%` }} /></div>
            <p className="hint" style={{ marginTop: "0.5rem" }}>{plan.capacityNote}</p>
          </div>
          {[1, 2, 3, 4].map((w) => (
            <div className="card" key={w}>
              <h2>Week {w}</h2>
              {plan.actions.filter((a) => a.week === w).map((a) => (
                <label key={a.id} className="check" style={{ marginBottom: "0.6rem" }}>
                  <input type="checkbox" checked={Boolean(plan.done[a.id])} onChange={(e) => act({ type: "toggle_action", actionId: a.id, done: e.target.checked })} />
                  <span>
                    <strong style={{ textDecoration: plan.done[a.id] ? "line-through" : undefined }}>{a.title}</strong> <Badge>{CAT[a.category]}</Badge> <Badge>{a.effortHours}h</Badge>
                    <span className="hint" style={{ display: "block" }}>Done when: {a.completionCriteria}{a.dependsOn.length ? ` · after ${a.dependsOn.join(", ")}` : ""}</span>
                  </span>
                </label>
              ))}
              {plan.actions.filter((a) => a.week === w).length === 0 && <p className="hint">Nothing scheduled - buffer week.</p>}
            </div>
          ))}
          <div className="card"><h2>Assumptions to validate</h2><ul>{plan.assumptionsToValidate.map((a, i) => <li key={i}>{a}</li>)}</ul></div>
          <FeedbackWidget section="plan" />
        </>
      )}
    </>
  );
}
