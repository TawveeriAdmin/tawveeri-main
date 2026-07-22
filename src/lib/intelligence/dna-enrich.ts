// src/lib/intelligence/dna-enrich.ts
// Deterministic Product-DNA extraction for model-corroborated canonicals whose
// identity came from a model number but whose spec attributes were empty. Parses
// specs from the (clean, store-provided) title — precision-first: only emit a spec
// when confidently matched; leave unknown ABSENT (honest uncertainty, no fabrication).
// AC/laptop reuse their category plugins; mobile uses these focused extractors
// (storage + variant — the signals decideMobile actually reasons over).

const STORAGE_SET = new Set([64, 128, 256, 512, 1024]);

/** Storage in GB (handles "256GB"/"256 جيجا"/"1 TB"), or null. Storage, not RAM:
 *  we take the largest capacity in the recognized storage set (RAM is smaller). */
export function extractMobileStorage(title: string): number | null {
  const t = title.toLowerCase();
  const tb = t.match(/(\d)\s*(?:tb|تيرا)/);
  if (tb) return Number(tb[1]) * 1024;
  const candidates: number[] = [];
  for (const m of t.matchAll(/(\d{2,4})\s*(?:gb|جيجا|جيجابايت|چيجا)/g)) {
    const n = Number(m[1]);
    if (STORAGE_SET.has(n)) candidates.push(n);
  }
  return candidates.length ? Math.max(...candidates) : null;
}

/** Variant tier token, or "Standard" when none is present. */
export function extractMobileVariant(title: string): string {
  const t = title.toLowerCase();
  if (/pro\s*max|برو\s*ماكس/.test(t)) return "Pro Max";
  if (/ultra|الترا/.test(t)) return "Ultra";
  if (/\bpro\b|برو/.test(t)) return "Pro";
  if (/plus|\+|بلس|بلاس/.test(t)) return "Plus";
  if (/\bfe\b/.test(t)) return "FE";
  if (/\bair\b|إير|اير/.test(t)) return "Air";
  if (/\bmini\b|ميني/.test(t)) return "Mini";
  return "Standard";
}

/** Merge-able mobile DNA (only confidently-extracted fields). */
export function enrichMobileDna(nameAr: string, nameEn: string): Record<string, unknown> {
  const title = `${nameAr} ${nameEn}`;
  const out: Record<string, unknown> = {};
  const storage = extractMobileStorage(title);
  if (storage != null) out.storage = storage;
  const variant = extractMobileVariant(title);
  out.variant = variant; // always emitted ("Standard" is a real, honest default)
  return out;
}
