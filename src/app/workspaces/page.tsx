"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StartButtons } from "@/components/start-buttons";

interface Item { id: string; title: string; isDemo: boolean; createdAt: string; updatedAt: string }

export default function Workspaces() {
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => {
    fetch("/api/workspaces", { cache: "no-store" }).then((r) => r.json()).then((d) => setItems(d.workspaces ?? []));
  }, []);
  return (
    <div className="container narrow">
      <h1>My analyses</h1>
      <p className="muted">Analyses are tied to this browser via a private cookie. Clearing cookies hides them; use Settings to export first.</p>
      {items === null ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <div className="card"><p>No analyses yet.</p><StartButtons /></div>
      ) : (
        <>
          {items.map((w) => (
            <div className="card spread" key={w.id}>
              <div>
                <Link href={`/w/${w.id}`}><strong>{w.title}</strong></Link>{" "}
                {w.isDemo && <span className="badge warn">Synthetic demo</span>}
                <div className="hint">Updated {new Date(w.updatedAt).toLocaleString()}</div>
              </div>
              <Link className="btn btn-sm" href={`/w/${w.id}`}>Open</Link>
            </div>
          ))}
          <StartButtons />
        </>
      )}
    </div>
  );
}
