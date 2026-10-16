/**
 * Prompt-injection detection for untrusted documents. Detection is a warning
 * only: documents are always passed to models as delimited data, never as
 * instructions, regardless of what this scan finds.
 */
const PATTERNS: RegExp[] = [
  /ignore (all |any )?(the )?(previous|prior|above) (instructions|prompts?)/i,
  /disregard (all |any )?(the )?(previous|prior|above|system)/i,
  /you are now (a|an|the)\b/i,
  /(reveal|print|show) (the |your )?(system prompt|hidden instructions|api key)/i,
  /system prompt/i,
  /act as (a|an) (?!team|bridge)/i,
  /rate (this|the) (candidate|resume) (as )?(10|100|excellent|perfect)/i,
  /<\/?(system|assistant|instructions?)>/i,
];

export function scanForInjection(text: string): string[] {
  const hits: string[] = [];
  for (const re of PATTERNS) {
    const m = text.match(re);
    if (m && m.index !== undefined) {
      hits.push(text.slice(Math.max(0, m.index - 20), m.index + m[0].length + 20).replace(/\s+/g, " ").trim());
    }
  }
  return hits;
}

/** Wrap untrusted text so models treat it as data. Closing tags inside the text are neutralised. */
export function asUntrusted(label: string, text: string): string {
  const safe = text.replace(/<\/?untrusted_document[^>]*>/gi, "[tag removed]");
  return `<untrusted_document label="${label}">\n${safe}\n</untrusted_document>`;
}
