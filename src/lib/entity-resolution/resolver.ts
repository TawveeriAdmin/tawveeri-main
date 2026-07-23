// src/lib/entity-resolution/resolver.ts
// ─────────────────────────────────────────────────────────────────────────────
// Deterministic MULTI-SIGNAL pair resolver — the Constitutional precision layer.
// Semantic systems (embeddings) expand RECALL via candidate generation; THIS layer
// controls PRECISION and the final resolution state. Signals: lexical similarity
// (character trigram + token Jaccard) + brand agreement (hard) + spec-number
// agreement (hard — the discriminator for adversarially-similar hard negatives like
// 256GB vs 512GB). Pure & deterministic; no identifiers required (works on masked
// titles), so it measures genuine generalization, not label reading.
// ─────────────────────────────────────────────────────────────────────────────

export interface ERRecord { title: string; brand?: string | null }

const STOP = new Set(["the", "with", "and", "for", "inch", "smart", "new", "2024", "2025", "version", "middle", "east"]);

function normalize(s: string): string {
  return (s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}
function tokenSet(s: string): Set<string> {
  return new Set(normalize(s).split(" ").filter((w) => w.length > 1 && !STOP.has(w)));
}
function trigrams(s: string): Set<string> {
  const n = ` ${normalize(s).replace(/\s+/g, " ")} `;
  const g = new Set<string>();
  for (let i = 0; i < n.length - 2; i++) g.add(n.slice(i, i + 3));
  return g;
}
function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0; for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
/** Spec numbers = strong discriminators (storage/size/capacity), not RAM/gen noise. */
export function specNumbers(s: string): Set<number> {
  const out = new Set<number>();
  const t = s.toLowerCase();
  for (const m of t.matchAll(/(\d{2,4})\s*(gb|tb|"|inch|بوصة|لتر|l\b|kg)/g)) {
    let n = Number(m[1]); if (m[2] === "tb") n *= 1024; if (n >= 16) out.add(n);
  }
  // standalone storage/size figures in the strong range
  for (const m of t.matchAll(/\b(\d{2,4})\b/g)) { const n = Number(m[1]); if ((n >= 32 && n <= 2048)) out.add(n); }
  return out;
}
function numbersConflict(a: string, b: string): boolean {
  const na = specNumbers(a), nb = specNumbers(b);
  if (!na.size || !nb.size) return false;
  for (const x of na) if (nb.has(x)) return false; // share at least one spec number ⇒ compatible
  return true;                                      // both have spec numbers, none shared ⇒ conflict
}
const canonBrand = (b?: string | null) => (b ? b.toLowerCase().replace(/[^a-z]/g, "") : "");

/**
 * Pair similarity in [0,1]. Precision-first: disagreeing known brands ⇒ 0; conflicting
 * spec numbers ⇒ heavy penalty (adversarial hard negatives). Works on masked titles.
 */
export function pairScore(a: ERRecord, b: ERRecord): number {
  const ba = canonBrand(a.brand), bb = canonBrand(b.brand);
  if (ba && bb && ba !== bb) return 0; // different known brands ⇒ not the same product
  const text = 0.5 * jaccard(trigrams(a.title), trigrams(b.title)) + 0.5 * jaccard(tokenSet(a.title), tokenSet(b.title));
  let score = text;
  if (ba && bb && ba === bb) score = Math.min(1, score + 0.05); // brand agreement boost
  if (numbersConflict(a.title, b.title)) score *= 0.35;          // spec conflict ⇒ likely different SKU
  return score;
}

/** Auto-resolution decision at a calibrated threshold (lexical-only). */
export function pairDecision(a: ERRecord, b: ERRecord, threshold: number): boolean {
  return pairScore(a, b) >= threshold;
}

// Variant/config tokens that distinguish otherwise-similar SKUs (Pro Max ≠ Pro).
const VARIANT_TOKENS = ["pro max", "pro", "max", "ultra", "plus", "\\bfe\\b", "\\bair\\b", "mini", "\\blite\\b", "\\bse\\b", "\\bneo\\b", "\\b5g\\b", "\\b4g\\b", "wifi", "cellular", "lte"];
function variantSet(s: string): Set<string> {
  const t = ` ${s.toLowerCase()} `; const out = new Set<string>();
  for (const v of VARIANT_TOKENS) if (new RegExp(v).test(t)) out.add(v.replace(/\\b|\\/g, ""));
  return out;
}
function variantConflict(a: string, b: string): boolean {
  const va = variantSet(a), vb = variantSet(b);
  if (va.size === 0 && vb.size === 0) return false;
  for (const x of va) if (!vb.has(x)) return true;   // a has a variant token b lacks
  for (const x of vb) if (!va.has(x)) return true;
  return false;
}

// Model DESIGNATION tokens — the family/generation identity embeddings can't separate
// (Galaxy A56 ≠ A25, Watch Series 10 ≠ 11, Huawei GT5 ≠ GT6). Two forms: alphanumeric
// family codes (A56, S25, GT5, X8b) and a generation number right after a family word.
const GEN_KEYWORD = /\b(?:series|gen|generation|gt|note|band|pad|tab|reno|find|mate|nord|edge|neo|watch|fit|legion|victus|loq|vivobook|zenbook|omen|pavilion|nitro|tuf|rog)\s*(\d{1,3})\b/gi;
export function designationSet(s: string): Set<string> {
  const t = s.toLowerCase(); const out = new Set<string>();
  for (const m of t.matchAll(/\b([a-z]{1,4}\d{1,4}[a-z]?)\b/g)) {
    const w = m[1];
    if (/^\d/.test(w)) continue;                 // starts with digit ⇒ a spec (5g, 4k), not a code
    out.add(w);
  }
  for (const m of t.matchAll(GEN_KEYWORD)) out.add(`gen${m[1]}`);
  return out;
}
function designationConflict(a: string, b: string): boolean {
  const da = designationSet(a), db = designationSet(b);
  if (!da.size || !db.size) return false;        // one side has no designation ⇒ don't block (rely on other signals)
  for (const x of da) if (db.has(x)) return false; // share a designation ⇒ compatible
  return true;                                    // both have designations, none shared ⇒ different model
}

// CPU tier & RAM — strong discriminators for laptops that spec-numbers miss
// (i5/8GB ≠ i7/16GB). Category-aware precision signals (founder-authorized).
function cpuTier(s: string): string | null {
  const t = s.toLowerCase();
  let m = t.match(/\b(?:core\s*|intel\s*)?i([3579])\b/); if (m) return "i" + m[1];
  m = t.match(/\bcore\s*([3579])\b/); if (m) return "i" + m[1];
  m = t.match(/\bryzen\s*([3579])\b/); if (m) return "ryzen" + m[1];
  m = t.match(/\b(m[1234])\s*(?:pro|max|ultra)?\b/); if (m) return m[1];
  return null;
}
function ramGb(s: string): number | null {
  const m = s.toLowerCase().match(/(\d{1,3})\s*(?:gb|جيجا|چیجا)?\s*(?:ram|رام)/) || s.toLowerCase().match(/(?:ram|رام)\s*[:\-]?\s*(\d{1,3})/);
  if (m) { const n = Number(m[1]); if ([2, 3, 4, 6, 8, 12, 16, 24, 32, 36, 48, 64, 128].includes(n)) return n; }
  return null;
}
function pairConflict<T>(a: T | null, b: T | null): boolean { return a != null && b != null && a !== b; }

/**
 * DETERMINISTIC VERIFICATION GATE (Constitutional precision layer). Given a candidate
 * pair (surfaced by semantic recall), auto-resolve to SAME only when independent
 * structured signals AGREE: same known brand, no spec-number conflict (256≠512), no
 * variant/config conflict (Pro Max ≠ Pro, 5G ≠ WiFi), and no model-designation conflict
 * (A56 ≠ A25, Series 10 ≠ 11). Rejects adversarial hard negatives embeddings can't
 * separate. Precision over recall.
 */
export function verifySameProduct(a: ERRecord, b: ERRecord): boolean {
  const ba = canonBrand(a.brand), bb = canonBrand(b.brand);
  if (ba && bb && ba !== bb) return false;
  if (numbersConflict(a.title, b.title)) return false;
  if (variantConflict(a.title, b.title)) return false;
  if (designationConflict(a.title, b.title)) return false;
  if (pairConflict(cpuTier(a.title), cpuTier(b.title))) return false; // i5 ≠ i7 (laptops)
  if (pairConflict(ramGb(a.title), ramGb(b.title))) return false;     // 8GB ≠ 16GB
  return true;
}
