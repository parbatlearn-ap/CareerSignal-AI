import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { OrchestratorError } from "../orchestrator";

export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export const notFound = () => json({ error: "Not found" }, 404);

export function errorResponse(e: unknown) {
  if (e instanceof ZodError)
    return json({ error: e.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ") }, 400);
  if (e instanceof OrchestratorError) return json({ error: e.message, code: e.code }, e.code === "NOT_FOUND" ? 404 : 409);
  console.error(JSON.stringify({ evt: "api_error", message: (e as Error).message }));
  return json({ error: "Unexpected server error." }, 500);
}
