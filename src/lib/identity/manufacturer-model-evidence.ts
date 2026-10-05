// src/lib/identity/manufacturer-model-evidence.ts — ONE manufacturer-model evidence function (+ pairwise relation + subclusters).
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// STATUS: SHADOW ONLY. Nothing in production imports this module. It is the single implementation the key generator, the verifier,
// the signals job, the shadow replay and the projection are to call once the founder approves a cutover (separate decision).
//
// DOCTRINE (Evidence-First closure, 2026-10-04):
//   * Evidence decides, labels never do. PRICE is not an input of any function here — not even as a tie-break.
//   * Trust belongs to the (merchant, field) PAIR and is MEASURED (source-field-trust-matrix.ts), never to a field name or a merchant.
//   * Rules A–F apply to PAIRS; groups are then reduced to verified SUBCLUSTERS (largest mutually consistent subsets).
//   * Different trusted manufacturer codes are DIFFERENT unless the alias registry holds a documented equivalence.
//   * One-sided code ⇒ REVIEW; untrusted generic model field ⇒ never authoritative; region/version tags ⇒ REVIEW;
//     new vs refurbished/used ⇒ a different commercial offer state.
import { extractManufacturerModel, extractManufacturerModelFromName, isStoreInternalIdentifier } from './store-identifiers';
import { declaredShortModel, titleShortModel, trapClass, norm } from './tv-short-model';
import { sourceFieldTrust, type TrustLevel } from './source-field-trust-matrix';
import { aliasStatus, MANUFACTURER_ALIASES, type AliasStatus, type ManufacturerAlias } from './manufacturer-alias-registry';
import { isValidGtin } from './page-evidence';

export type EvidenceType =
  | 'structured_mpn' | 'structured_model_number' | 'spec_model_number'
  | 'generic_model_field' | 'title_model' | 'title_short_code'
  | 'page_field'   // a statement CAPTURED from the merchant's product page (page-evidence.ts)
  | 'gtin';        // a checksum-valid GTIN/EAN/UPC (payload or page)

/** The documented output of the unified function (one record per distinct normalized value and source). */
export interface ModelEvidence {
  raw_value: string;
  normalized_value: string;
  manufacturer: string | null;    // the listing's brand/manufacturer as stated, when known
  source_merchant: string;
  source_field: string;           // `top.mpn`, `spec.model_number`, `page.jsonld.mpn`, `title`, …
  source_url: string | null;      // the page the statement was read from (captured evidence only)
  captured_at: string | null;
  trust_level: TrustLevel;
  evidence_type: EvidenceType;
  /** Whether this value may take part in an identity decision (see `isTrusted`). */
  usable_for_identity: boolean;
  alias_status: AliasStatus;
  warnings: string[];
}

/** A statement captured from a merchant page and stored append-only (`tps_listing_evidence`). */
export interface CapturedItem { field: string; value: string; url?: string | null; captured_at?: string | null }

export interface EvidenceInput {
  merchant: string;
  title: string;
  brand?: string | null;
  payload: Record<string, unknown>;
  /** Page-captured statements for this listing; absent = payload/title evidence only (byte-for-byte the pre-capture behaviour). */
  captured?: CapturedItem[];
}

const cleanKey = (k: string) => k.toLowerCase().replace(/[\s‎‏‪-‮:]+/g, ' ').trim();
const SPEC_CODE_KEYS = /^(item model number|model number|model_number|manufacturer part number|part number|mpn)$/;
const STRUCTURED_TYPE: Record<string, EvidenceType> = { mpn: 'structured_mpn', modelNumber: 'structured_model_number', model_number: 'structured_model_number' };

const isCode = (v: string): boolean => {
  const t = norm(v);
  return t.length >= 4 && t.length <= 24 && /\d/.test(t) && /[A-Z]/.test(t) && !trapClass(t) && !isStoreInternalIdentifier(v);
};

/**
 * A title that names two DIFFERENT long manufacturer models ("… QA55Q7FAAUXSA … QA55Q6FAAUXSA", a Noon listing found by the independent audit)
 * does not state which one ships. Long = ≥8 characters; one code containing the other (a marketing code inside the full code) is one model.
 */
/** A LONG manufacturer-model-looking token: ≥8 chars, ≥3 digits, ≥2 letters; dimensions/resolutions ("3840x2160") and brand-size words ("HISENSE-55") are not models. */
function isLongModelToken(t: string): boolean {
  const n = norm(t);
  if (n.length < 8 || n.length > 24 || !isCode(t)) return false;
  if ((n.match(/\d/g) ?? []).length < 3 || (n.match(/[A-Z]/g) ?? []).length < 2) return false;
  if (/\d+X\d+/.test(n) || /(1920|1080|2160|3840|1366|768)/.test(n) && n.length <= 10) return false;
  return true;
}

function titleNamesSeveralModels(title: string): boolean {
  const codes = [...new Set(title.toUpperCase().split(/[\s,()|،\/&+;]+/).map((t) => t.replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/g, '')).filter(isLongModelToken).map(norm))];
  const distinct = codes.filter((c, i) => !codes.some((o, j) => j !== i && (o.includes(c) || sameCode(o, c)) && (o.length > c.length || (o.length === c.length && j < i))));
  return distinct.length >= 2;
}

/** Page fields that state a manufacturer code on purpose, vs fields that only SOMETIMES hold one (sku, model name). */
const PAGE_CODE_FIELDS = /^page\.(jsonld\.mpn|label\.manufacturer_no|script\.modelNumber|table\.(model_number|item_model_number|manufacturer_part_number|part_number|mpn|manufacturer_no|manufacturer_number))$/;
const PAGE_NAME_FIELDS = /^page\.(jsonld\.sku|table\.(model_name|model))$/;   // jsonld.model is deliberately NOT read: a merchant's short `model` drops the size prefix and duplicates `mpn`

/** `A/B`, `A, B`, `A & B`, `A + B`, `A or B` where EVERY part is itself model-shaped (`MDHH4AB/A` is one model: `A` is not model-shaped). */
function isComposite(v: string): boolean {
  const parts = v.split(/\s*(?:[\/,;&+]|\bor\b|\bو\b)\s*/i).map((p) => p.trim()).filter(Boolean);
  return parts.length >= 2 && parts.every((p) => isCode(p));
}

/** Normalized parts of every whitespace-delimited title token that joins two or more model-shaped codes (`98Q6C/98C6K`). */
function titleCompositeParts(title: string): Set<string> {
  const out = new Set<string>();
  for (const tok of title.split(/[\s,()|،]+/)) if (isComposite(tok)) for (const p of tok.split(/[\/&+;]/)) if (isCode(p)) out.add(norm(p));
  return out;
}

/** An explicit-intent field (mpn / modelNumber / model_number / spec code) is usable at MEDIUM or HIGH; the GENERIC model field only at HIGH. */
function usable(type: EvidenceType, trust: TrustLevel): boolean {
  if (type === 'generic_model_field') return trust === 'HIGH';
  if (type === 'gtin') return trust === 'HIGH';   // the strongest evidence only when cross-merchant-confirmed: an unconfirmed barcode field may be an internal code
  if (type === 'title_model' || type === 'title_short_code') return trust !== 'LOW'; // corroboration is judged in `relateModels`; LOW = refused (composite)
  return trust === 'HIGH' || trust === 'MEDIUM';
}

/** All manufacturer-model evidence a single listing carries — raw, normalized, where it came from, how far it can be trusted. */
export function extractModelEvidence(input: EvidenceInput): ModelEvidence[] {
  const out: ModelEvidence[] = [];
  // `alias_status` is a property of a PAIR of codes; it is resolved in `relateModels`, so a single listing's evidence always carries 'none'.
  const push = (raw: string, field: string, type: EvidenceType, trust: TrustLevel, warnings: string[] = [], src?: { url?: string | null; captured_at?: string | null }) => {
    const normalized = norm(raw);
    if (!normalized) return;
    // A field naming TWO models ("98Q6C/98C6K") is a merchant's own uncertainty or an alias claim from ONE source — neither is a model code.
    if (isComposite(raw)) { trust = 'LOW'; warnings = [...warnings, 'composite_value_multiple_models']; }
    if (out.some((e) => e.normalized_value === normalized && e.source_field === field)) return;
    out.push({
      raw_value: raw, normalized_value: normalized, manufacturer: input.brand ?? null, source_merchant: input.merchant, source_field: field,
      source_url: src?.url ?? null, captured_at: src?.captured_at ?? null, trust_level: trust,
      evidence_type: type, usable_for_identity: usable(type, trust), alias_status: 'none', warnings,
    });
  };

  // 1) Structured top-level fields of explicit manufacturer intent.
  for (const f of ['mpn', 'modelNumber', 'model_number'] as const) {
    const raw = input.payload[f];
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const v = raw.trim();
    const { trust } = sourceFieldTrust(input.merchant, `top.${f}`);
    const w: string[] = [];
    if (!isCode(v) && !declaredShortModel({ [f]: v }, input.title)) w.push('shape_not_model_like');
    if (trust === 'UNMEASURED') w.push('source_field_unmeasured');
    if (w.includes('shape_not_model_like')) { push(v, `top.${f}`, STRUCTURED_TYPE[f], 'LOW', w); continue; }
    push(v, `top.${f}`, STRUCTURED_TYPE[f], trust, w);
  }

  // 2) The generic `model` field — authoritative only where the matrix measured it HIGH for this merchant.
  const gen = extractManufacturerModel({ model: input.payload.model });
  if (gen) {
    const { trust } = sourceFieldTrust(input.merchant, 'top.model');
    push(gen, 'top.model', 'generic_model_field', trust, trust === 'HIGH' ? [] : ['generic_field_not_authoritative']);
  }

  // 3) Model-looking keys inside `specifications` (Noon `model_number`, Amazon `item model number`, …).
  const spec = input.payload.specifications;
  if (spec && typeof spec === 'object' && !Array.isArray(spec)) {
    for (const [k, v] of Object.entries(spec as Record<string, unknown>)) {
      const ck = cleanKey(k);
      if (!SPEC_CODE_KEYS.test(ck) || typeof v !== 'string' || !v.trim()) continue;
      const { trust } = sourceFieldTrust(input.merchant, `spec.${ck}`);
      push(v.trim(), `spec.${ck}`, 'spec_model_number', isCode(v) ? trust : 'LOW', isCode(v) ? (trust === 'UNMEASURED' ? ['source_field_unmeasured'] : []) : ['shape_not_model_like']);
    }
  }

  // 3b) GTIN in the payload (Almanea/Shaker/Najm carry a `gtin` key) — only a checksum-valid one is evidence.
  const pg = input.payload.gtin;
  if (typeof pg === 'string' || typeof pg === 'number') {
    const g = String(pg).trim();
    const { trust } = sourceFieldTrust(input.merchant, 'top.gtin');
    if (isValidGtin(g)) push(g, 'top.gtin', 'gtin', trust, trust === 'UNMEASURED' ? ['source_field_unmeasured'] : []);
    else push(g, 'top.gtin', 'gtin', 'LOW', ['gtin_checksum_invalid']);
  }

  // 3c) Statements CAPTURED from the merchant's own product page. Trust is the MEASURED trust of (merchant, page field); an unmeasured
  // page field is recorded with a warning and is not authority.
  for (const c of input.captured ?? []) {
    const src = { url: c.url ?? null, captured_at: c.captured_at ?? null };
    const value = (c.value ?? '').trim();
    if (!value) continue;
    const { trust } = sourceFieldTrust(input.merchant, c.field);
    const w = trust === 'UNMEASURED' ? ['source_field_unmeasured'] : [];
    if (c.field === 'page.jsonld.gtin') {
      if (isValidGtin(value)) push(value, c.field, 'gtin', trust, w, src);
      else push(value, c.field, 'gtin', 'LOW', ['gtin_checksum_invalid'], src);
    } else if (PAGE_CODE_FIELDS.test(c.field)) {
      if (isCode(value) || declaredShortModel({ mpn: value }, input.title)) push(value, c.field, 'page_field', trust, w, src);
      else push(value, c.field, 'page_field', 'LOW', ['shape_not_model_like'], src);
    }
    // other page fields (jsonld.sku/model, table.model_name) are stored but never read as a model unless they are matrix-measured AND code-shaped
    else if (PAGE_NAME_FIELDS.test(c.field) && isCode(value)) push(value, c.field, 'page_field', trust, w, src);
  }

  // 4) The listing's own title — a long manufacturer code, then a size-prefixed short code (ADR-177 conditions).
  // A title that names TWO models in one token ("98Q6C/98C6K") states neither: refuse both halves instead of picking the first.
  // The listing states its name in more than one language/field (Amazon "75P8L من TCL" is only in `name_ar`): every name the merchant
  // gave this listing is a title for evidence purposes, each tagged with where it came from.
  const titles: { field: string; text: string }[] = [{ field: 'title', text: input.title }];
  for (const k of ['name_ar', 'name_en'] as const) {
    const t = input.payload[k];
    if (typeof t === 'string' && t.trim() && !titles.some((x) => x.text === t)) titles.push({ field: `title.${k}`, text: t });
  }
  for (const { field, text } of titles) {
    const compositeParts = titleCompositeParts(text);
    const multiModel = titleNamesSeveralModels(text);
    const fromTitle = (v: string | null, type: EvidenceType) => {
      if (!v) return;
      if (compositeParts.has(norm(v)) || multiModel) push(v, field, type, 'LOW', ['title_names_multiple_models']);
      else push(v, field, type, 'MEDIUM', ['title_only_unless_corroborated']);
    };
    fromTitle(extractManufacturerModelFromName(text), 'title_model');
    fromTitle(titleShortModel(text), 'title_short_code');
  }

  return out;
}

// ───────────────────────────── pairwise relation (Rules A–F) ─────────────────────────────
export type PairRelation =
  | 'MATCH_CANDIDATE_STRONG'   // Rule A: exact trusted code on both sides, no material conflict
  | 'MATCH_CANDIDATE_MEDIUM'   // exact code, but at least one side only title-level / MEDIUM source
  | 'DIFFERENT_VARIANT'        // Rule B: two different trusted codes (no documented alias)
  | 'DIFFERENT_CONDITION'      // Rule F: new vs refurbished/used — different commercial offer
  | 'REVIEW'                   // Rules C/E: one-sided code, region/version/prefix/variant-word doubt, documented non-identical alias
  | 'NO_EVIDENCE';             // no trusted code on either side — the pair cannot be adjudicated by model evidence

export interface PairVerdict { relation: PairRelation; reasons: string[]; a_codes: string[]; b_codes: string[] }

export type Condition = 'new' | 'refurbished' | 'used' | 'unknown';
const REFURB = /(refurbish|renewed|مجدد|مجددة|مُجدد|reconditioned|certified pre-?owned)/i;
const USED = /(\bused\b|pre-?owned|open[ -]?box|مستعمل|ستوك|استعمال)/i;
const NEW_EXPLICIT = /(\bbrand new\b|\bnew\b|جديد)/i;
export function conditionOf(title: string, attributes?: Record<string, unknown>): Condition {
  const cond = typeof attributes?.condition === 'string' ? attributes.condition : '';
  const text = `${title} ${cond}`;
  if (REFURB.test(text)) return 'refurbished';
  if (USED.test(text)) return 'used';
  if (NEW_EXPLICIT.test(text)) return 'new';
  return 'unknown';
}

const VARIANT_WORDS = ['PRO', 'PLUS', 'MAX', 'ULTRA', 'EVO', 'LITE'];
/** `X` vs `XPRO` — one code is the other plus a variant word. */
const variantWordPrefix = (a: string, b: string): boolean => {
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  return l.startsWith(s) && VARIANT_WORDS.includes(l.slice(s.length));
};
/** Long codes that differ only in a short trailing tag look like regional/version variants of one hardware (Rule E). */
const regionalTailDoubt = (a: string, b: string): boolean => {
  if (a.length < 10 || b.length < 10) return false;
  const n = Math.min(a.length, b.length); let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return n - i <= 3 && Math.abs(a.length - b.length) <= 3;
};
const truncationPrefix = (a: string, b: string): boolean => {
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  return s !== l && l.startsWith(s);
};

/**
 * Screen-size notation: a merchant may print `Q71Q` where the manufacturer prints `65Q71Q` (Jarir's JSON-LD `model` vs its `mpn`). A code with a
 * 2–3 digit size prefix equals the same code WITHOUT it; two codes that BOTH carry a size prefix are compared exactly (`65Q71Q` ≠ `55Q71Q`).
 */
const SIZE_PREFIX = /^(\d{2,3})(?=[A-Z][A-Z0-9]{3,}$)/;
export const sameCode = (x: string, y: string): boolean => {
  if (x === y) return true;
  const px = SIZE_PREFIX.test(x), py = SIZE_PREFIX.test(y);
  if (px && py) return false;
  return x.replace(SIZE_PREFIX, '') === y.replace(SIZE_PREFIX, '');
};
const hasCode = (codes: string[], c: string): boolean => codes.some((x) => sameCode(x, c));

const trustedCodes = (ev: ModelEvidence[]) => ev.filter((e) => e.usable_for_identity && e.evidence_type !== 'gtin');
const trustedGtins = (ev: ModelEvidence[]) => [...new Set(ev.filter((e) => e.usable_for_identity && e.evidence_type === 'gtin').map((e) => e.normalized_value))];

/** Strength of one side's code: structured/spec evidence at HIGH or MEDIUM counts as source-explicit; title-only is corroboration-dependent. */
const sourceExplicit = (e: ModelEvidence) => e.evidence_type !== 'title_model' && e.evidence_type !== 'title_short_code';

export function relateModels(
  a: { evidence: ModelEvidence[]; brand?: string | null; condition?: Condition },
  b: { evidence: ModelEvidence[]; brand?: string | null; condition?: Condition },
  registry: readonly ManufacturerAlias[] = MANUFACTURER_ALIASES,
): PairVerdict {
  const A = trustedCodes(a.evidence), B = trustedCodes(b.evidence);
  const ac = [...new Set(A.map((e) => e.normalized_value))], bc = [...new Set(B.map((e) => e.normalized_value))];
  const reasons: string[] = [];
  const done = (relation: PairRelation): PairVerdict => ({ relation, reasons, a_codes: ac, b_codes: bc });

  // Rule F — commercial offer state.
  const ca = a.condition ?? 'unknown', cb = b.condition ?? 'unknown';
  if (ca !== 'unknown' && cb !== 'unknown' && ca !== cb) { reasons.push(`condition ${ca} vs ${cb}`); return done('DIFFERENT_CONDITION'); }
  if ((ca === 'refurbished' || ca === 'used') !== (cb === 'refurbished' || cb === 'used')) {
    // one side explicitly not-new-state, the other unstated → cannot assert same offer
    reasons.push(`condition ${ca} vs ${cb} (one side not new/unstated)`);
    if (ca === 'unknown' || cb === 'unknown') return done('REVIEW');
    return done('DIFFERENT_CONDITION');
  }

  // GTIN (a checksum-valid, measured-trust GTIN/EAN/UPC): the strongest evidence there is. Equal GTINs ⇒ the same trade item, unless
  // both sides ALSO state different trusted codes (strong evidence in conflict ⇒ REVIEW, never a silent choice). Differing GTINs alone
  // are not a difference (one GTIN per colour/pack variant), so they only matter when there is no code to decide.
  const ga = trustedGtins(a.evidence), gb = trustedGtins(b.evidence);
  const sharedGtin = ga.find((g) => gb.includes(g));
  if (sharedGtin) {
    if (ac.length && bc.length && !ac.some((c) => hasCode(bc, c))) { reasons.push(`GTIN ${sharedGtin} equal but trusted codes differ ${ac.join('|')} vs ${bc.join('|')}`); return done('REVIEW'); }
    reasons.push(`exact GTIN ${sharedGtin}`); return done('MATCH_CANDIDATE_STRONG');
  }
  if (!ac.length && !bc.length) {
    if (ga.length && gb.length) { reasons.push('GTINs differ and no model code (possibly colour/pack variants)'); return done('REVIEW'); }
    reasons.push('no trusted code on either side'); return done('NO_EVIDENCE');
  }
  // Rule C — one-sided code.
  if (!ac.length || !bc.length) { reasons.push('trusted code on one side only'); return done('REVIEW'); }

  // Exact agreement (Rule A): any code shared by both sides with no conflicting different code in a source-explicit field.
  const shared = ac.filter((c) => hasCode(bc, c));
  const aExplicit = [...new Set(A.filter(sourceExplicit).map((e) => e.normalized_value))];
  const bExplicit = [...new Set(B.filter(sourceExplicit).map((e) => e.normalized_value))];
  if (shared.length) {
    const conflictA = aExplicit.filter((c) => !hasCode(bc, c)), conflictB = bExplicit.filter((c) => !hasCode(ac, c));
    if (conflictA.length && conflictB.length && aExplicit.length && bExplicit.length) {
      // both sides also state a different explicit code — internally inconsistent evidence
      reasons.push('shared code but both sides also state a different source-explicit code'); return done('REVIEW');
    }
    const strong = A.some((e) => sameCode(e.normalized_value, shared[0]) && sourceExplicit(e) && e.trust_level === 'HIGH')
      || B.some((e) => sameCode(e.normalized_value, shared[0]) && sourceExplicit(e) && e.trust_level === 'HIGH')
      || (A.some((e) => sameCode(e.normalized_value, shared[0]) && sourceExplicit(e)) && B.some((e) => sameCode(e.normalized_value, shared[0]) && sourceExplicit(e)));
    reasons.push(`exact code ${shared[0]}${strong ? ' (source-explicit)' : ' (title-level)'}`);
    return done(strong ? 'MATCH_CANDIDATE_STRONG' : 'MATCH_CANDIDATE_MEDIUM');
  }

  // No shared code. Rule E / variant-word / truncation doubts, then alias, then Rule B.
  for (const x of ac) for (const y of bc) {
    const al = aliasStatus(a.brand ?? b.brand ?? null, x, y, registry);
    if (al === 'documented_identical') { reasons.push(`documented alias ${x} ≡ ${y}`); return done('MATCH_CANDIDATE_STRONG'); }
    if (al === 'documented_not_identical') { reasons.push(`documented non-identical alias ${x} / ${y}`); return done('REVIEW'); }
  }
  for (const x of ac) for (const y of bc) {
    if (variantWordPrefix(x, y)) {
      // Rule G: a variant word (PRO/PLUS/MAX/ULTRA…) that BOTH sides state through a source-explicit field is a stated difference
      // (TCL sells C6K and C6K PRO as separate series); if either side only has it in a title it may be a truncation ⇒ REVIEW.
      const explicitBoth = A.some((e) => e.normalized_value === x && sourceExplicit(e)) && B.some((e) => e.normalized_value === y && sourceExplicit(e))
        || A.some((e) => e.normalized_value === y && sourceExplicit(e)) && B.some((e) => e.normalized_value === x && sourceExplicit(e));
      reasons.push(`variant word: ${x} / ${y}${explicitBoth ? ' (both source-explicit)' : ''}`);
      return done(explicitBoth ? 'DIFFERENT_VARIANT' : 'REVIEW');
    }
    if (regionalTailDoubt(x, y)) { reasons.push(`possible region/version tag: ${x} / ${y}`); return done('REVIEW'); }
    if (truncationPrefix(x, y)) { reasons.push(`one code is a prefix of the other: ${x} / ${y}`); return done('REVIEW'); }
  }
  reasons.push(`different trusted codes ${ac.join('|')} vs ${bc.join('|')}`);
  return done('DIFFERENT_VARIANT');
}

// ───────────────────────────── verified subclusters ─────────────────────────────
export interface Subcluster { members: number[]; strength: 'strong' | 'medium'; }
export interface SubclusterResult { verified: Subcluster[]; unverified: number[]; pairs: { a: number; b: number; verdict: PairVerdict }[] }

/**
 * Largest mutually consistent verified subsets. Two listings join only through MATCH_CANDIDATE_* and a cluster never contains a pair that is
 * DIFFERENT_* or REVIEW (a clique in the match graph). Listings with no match to anyone are `unverified` — they are NOT asserted different.
 * Deterministic: maximal cliques are taken greedily, largest first, ties broken by lowest member index.
 */
export function verifiedSubclusters(items: { evidence: ModelEvidence[]; brand?: string | null; condition?: Condition }[], registry: readonly ManufacturerAlias[] = MANUFACTURER_ALIASES): SubclusterResult {
  const n = items.length;
  const pairs: SubclusterResult['pairs'] = [];
  const match = Array.from({ length: n }, () => Array<'strong' | 'medium' | null>(n).fill(null));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const verdict = relateModels(items[i], items[j], registry);
    pairs.push({ a: i, b: j, verdict });
    if (verdict.relation === 'MATCH_CANDIDATE_STRONG') match[i][j] = match[j][i] = 'strong';
    else if (verdict.relation === 'MATCH_CANDIDATE_MEDIUM') match[i][j] = match[j][i] = 'medium';
  }
  // Bron–Kerbosch (groups are small: ≤ ~12 listings).
  const cliques: number[][] = [];
  const bk = (r: number[], p: number[], x: number[]) => {
    if (!p.length && !x.length) { if (r.length >= 2) cliques.push([...r]); return; }
    for (const v of [...p]) {
      const nb = (k: number) => match[v][k] !== null;
      bk([...r, v], p.filter(nb), x.filter(nb));
      p = p.filter((k) => k !== v); x = [...x, v];
    }
  };
  bk([], Array.from({ length: n }, (_, i) => i), []);
  cliques.sort((c, d) => d.length - c.length || Math.min(...c) - Math.min(...d));
  const used = new Set<number>(); const verified: Subcluster[] = [];
  for (const c of cliques) {
    const free = c.filter((m) => !used.has(m)); if (free.length < 2) continue;
    free.sort((p, q) => p - q); free.forEach((m) => used.add(m));
    let strength: 'strong' | 'medium' = 'strong';
    for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) if (match[free[i]][free[j]] === 'medium') strength = 'medium';
    verified.push({ members: free, strength });
  }
  const unverified = Array.from({ length: n }, (_, i) => i).filter((i) => !used.has(i));
  return { verified, unverified, pairs };
}

// ───────────────────────────── what the verifier is given ─────────────────────────────
/**
 * The single manufacturer model the VERIFIER should treat as the listing's declared model (`structured.model`), or null.
 * Source-explicit evidence (payload fields, spec fields, captured page fields) outranks a title-only code; two DIFFERENT source-explicit
 * codes on one listing are an internal contradiction ⇒ null (never a silent pick); a composite title/field yields nothing.
 * This is the ONE place the key builder, signals job and compare page ask the question, so they cannot disagree.
 */
export function verifierDeclaredModel(evidence: ModelEvidence[]): string | null {
  const codes = evidence.filter((e) => e.usable_for_identity && e.evidence_type !== 'gtin');
  const pick = (set: ModelEvidence[]): string | null => {
    const distinct = [...new Set(set.map((e) => e.normalized_value))].reduce<string[]>((acc, v) => (acc.some((a) => sameCode(a, v)) ? acc : [...acc, v]), []);
    if (distinct.length !== 1) return null;
    // prefer the fullest notation (size-prefixed) of the highest-trust statement
    const best = [...set].sort((x, y) => (x.trust_level === 'HIGH' ? 0 : 1) - (y.trust_level === 'HIGH' ? 0 : 1) || y.normalized_value.length - x.normalized_value.length)[0];
    return best.raw_value.trim().toUpperCase();
  };
  const explicit = codes.filter(sourceExplicit);
  if (explicit.length) return pick(explicit);
  return pick(codes);
}

/** The declared model for ONE listing, asked of the unified function (payload + title + page-captured evidence). */
export function declaredModelForListing(input: EvidenceInput): string | null {
  return verifierDeclaredModel(extractModelEvidence(input));
}

/** A capture older than this is not read (a page can be re-pointed at a different product; we re-capture rather than trust old statements). */
export const MAX_CAPTURE_AGE_DAYS = 60;

/**
 * Group stored capture rows by listing — key `${store_id}|${url}` — keeping only the NEWEST capture of each listing
 * (all rows of one capture share `captured_at`) and dropping captures older than MAX_CAPTURE_AGE_DAYS.
 */
export function newestCaptures(
  rows: { store_id: number | string; url: string; field: string; raw_value: string; captured_at: string | Date }[],
  now: number = Date.now(),
): Map<string, CapturedItem[]> {
  const stamp = (v: string | Date) => (v instanceof Date ? v.getTime() : Date.parse(v));
  const newest = new Map<string, number>();
  for (const r of rows) { const k = `${r.store_id}|${r.url}`; const t = stamp(r.captured_at); if (!(t < now - MAX_CAPTURE_AGE_DAYS * 86_400_000) && t > (newest.get(k) ?? -Infinity)) newest.set(k, t); }
  const out = new Map<string, CapturedItem[]>();
  for (const r of rows) {
    const k = `${r.store_id}|${r.url}`;
    if (stamp(r.captured_at) !== newest.get(k)) continue;
    (out.get(k) ?? out.set(k, []).get(k)!).push({ field: r.field, value: r.raw_value, url: r.url, captured_at: new Date(stamp(r.captured_at)).toISOString() });
  }
  return out;
}
