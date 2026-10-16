import { createProvider, publicProviderStatus } from "@/lib/providers";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Provider configuration status. `?deep=1` performs a live reachability check (never returns secrets). */
export async function GET(req: Request) {
  const status = publicProviderStatus();
  const deep = new URL(req.url).searchParams.get("deep") === "1";
  const health = deep ? await createProvider().checkHealth() : null;
  return json({ ...status, health });
}
