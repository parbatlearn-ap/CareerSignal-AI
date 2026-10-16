/** Small, dependency-free text helpers used by deterministic analysis. */

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive whole-term match that also works for terms like "C++" or "Power BI". */
export function containsTerm(haystack: string, term: string): boolean {
  const t = normalize(term);
  if (!t) return false;
  const re = new RegExp(`(?<![a-z0-9])${escapeRegExp(t)}(?![a-z0-9])`, "i");
  return re.test(normalize(haystack));
}

/** True if `needle` (normalized) occurs inside `haystack` (normalized). */
export function includesNormalized(haystack: string, needle: string): boolean {
  const n = normalize(needle);
  return n.length > 0 && normalize(haystack).includes(n);
}

/**
 * Extract metric-like tokens: percentages, currency amounts, multipliers,
 * and numbers with units. Plain years (e.g. 2019) are excluded.
 */
export function extractMetrics(text: string): string[] {
  const re =
    /(?:[₹$€£]\s?\d[\d,.]*\s?(?:k|m|bn|cr|crore|lakh|lakhs|million|billion)?|\d[\d,.]*\s?(?:%|percent|x\b|k\b|cr\b|crore|lakh|lakhs|million|billion|hours?|hrs?|days?|weeks?|months?|minutes?|mins?|people|users|clients|customers|reports?|dashboards?|stakeholders?|teams?|members?|countries|markets|projects?|processes|tickets|accounts|sites|stores))/gi;
  const out = new Set<string>();
  for (const m of text.matchAll(re)) {
    const tok = m[0].trim();
    if (/^(19|20)\d{2}$/.test(tok)) continue;
    out.add(tok);
  }
  // Bare numbers that are not years (e.g. "reduced from 5 to 2").
  for (const m of text.matchAll(/(?<![\w.])\d+(?:[.,]\d+)?(?![\w%])/g)) {
    const tok = m[0];
    if (/^(19|20)\d{2}$/.test(tok)) continue;
    if (![...out].some((o) => o.includes(tok))) out.add(tok);
  }
  return [...out];
}

/** The bare numeric core of a metric token, e.g. "35%" -> "35", "₹1.2 cr" -> "1.2". */
export function numericCore(token: string): string | null {
  const m = token.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return m ? m[0] : null;
}

/** True when every number in `text` also appears (as a number) in `evidence`. */
export function unsupportedNumbers(text: string, evidence: string): string[] {
  const evNums = new Set(
    [...evidence.replace(/,/g, "").matchAll(/\d+(?:\.\d+)?/g)].map((m) => m[0]),
  );
  const bad: string[] = [];
  for (const tok of extractMetrics(text)) {
    const core = numericCore(tok);
    if (core && !evNums.has(core)) bad.push(tok);
  }
  return bad;
}

export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function stripBullet(l: string): string {
  return l.replace(/^[-*•·▪◦‣]\s*|^\d+[.)]\s+/, "").trim();
}

export function uniqueBy<T>(items: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = key(i);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";
}

/** Stable, short, non-cryptographic hash for IDs and change detection. */
export function shortHash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
