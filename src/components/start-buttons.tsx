"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StartButtons() {
  const router = useRouter();
  const [busy, setBusy] = useState<"new" | "demo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const start = async (demo: boolean) => {
    setBusy(demo ? "demo" : "new");
    setError(null);
    try {
      const res = await fetch("/api/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ demo }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/w/${data.id}/${demo ? "" : "goals"}`);
    } catch (e) {
      setError((e as Error).message || "Could not start.");
      setBusy(null);
    }
  };
  return (
    <div>
      <div className="row">
        <button className="btn btn-primary btn-lg" onClick={() => start(false)} disabled={busy !== null}>
          {busy === "new" ? "Starting…" : "Start my analysis"}
        </button>
        <button className="btn btn-lg" onClick={() => start(true)} disabled={busy !== null}>
          {busy === "demo" ? "Loading…" : "Try the synthetic demo"}
        </button>
      </div>
      {error && <p className="alert bad" role="alert" style={{ marginTop: "0.75rem" }}>{error}</p>}
    </div>
  );
}
