import { ProviderError } from "./types";

/** fetch with an AbortController timeout. Converts aborts into TIMEOUT errors. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new ProviderError("TIMEOUT", `Request timed out after ${timeoutMs} ms`);
    throw new ProviderError("PROVIDER_ERROR", `Network error: ${(e as Error).message}`);
  } finally {
    clearTimeout(t);
  }
}

/** Map an HTTP error response to a typed provider error. Never includes secrets. */
export function mapHttpError(status: number, bodyText: string, headers: Headers): ProviderError {
  const body = bodyText.slice(0, 500);
  const retryAfter = Number(headers.get("retry-after")) || undefined;
  const lower = body.toLowerCase();
  if (status === 401 || (status === 400 && lower.includes("api key")) || (status === 403 && lower.includes("key")))
    return new ProviderError("INVALID_API_KEY", `Authentication failed (HTTP ${status}).`);
  if (status === 429) {
    if (lower.includes("quota") || lower.includes("resource_exhausted") || lower.includes("exceeded your current"))
      return new ProviderError("QUOTA_EXHAUSTED", `Quota exhausted (HTTP 429).`, retryAfter);
    return new ProviderError("RATE_LIMITED", `Rate limited (HTTP 429).`, retryAfter);
  }
  if (status === 404 || lower.includes("model_not_found") || lower.includes("does not exist"))
    return new ProviderError("MODEL_UNAVAILABLE", `Model not found or unavailable (HTTP ${status}).`);
  if (status === 408 || status === 504) return new ProviderError("TIMEOUT", `Provider timeout (HTTP ${status}).`);
  return new ProviderError("PROVIDER_ERROR", `Provider error (HTTP ${status}).`);
}
