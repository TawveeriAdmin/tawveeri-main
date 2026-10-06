// src/lib/search/ac-type-intent.ts — an air-conditioner TYPE named in the query is a requirement, not a hint (2026-10-06).
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// MEASURED (production, 2026-10-06): «مكيف سبليت» returned 48 results of which 5 were window units (Gree/TCL/Westinghouse/Ztrust/
// Hisense «Window AC»), 1 cassette and 1 cabinet — and «سبليت» alone and «split ac» each returned the same 5 window units. A shopper who
// types the type has told us which product class they mean; a window unit is a different product (different install, different price
// band: 14% of the active AC canonicals are window units). The type is read from the evidence we already hold, never guessed:
//   1. the canonical identity key (brand|TYPE|series|btu|tech|mode — segment 2 of the 6-segment AC key), else
//   2. the listing title (Arabic and English type words, including the merchants' own typos «Spilt», «Winow»).
// A product whose type cannot be determined is KEPT (unknown ≠ wrong); a product whose type is known and different is dropped.
// A query that names no type, or names several, is untouched.
import { normalizeArabic } from './arabic-normalize';

export type AcType = 'split' | 'window' | 'cassette' | 'cabinet' | 'portable' | 'ducted';

const TYPE_TERMS: Record<AcType, string[]> = {
  split: ['سبليت', 'split', 'spilt'],
  window: ['شباك', 'window', 'winow'],
  cassette: ['كاسيت', 'cassette'],
  cabinet: ['دولابي', 'cabinet', 'floor standing'],
  portable: ['متنقل', 'محمول', 'portable'],
  ducted: ['مخفي', 'ducted'],
};

const KEY_TYPES = new Set<string>(['split', 'window', 'cassette', 'cabinet', 'portable', 'ducted']);

/** Whole-word (script-aware) containment: JS `\b` never matches beside Arabic letters, so split on anything that is not a letter/digit. */
function words(text: string): Set<string> {
  return new Set(normalizeArabic(text || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean));
}

function typesIn(text: string): AcType[] {
  const w = words(text);
  const lowered = ` ${normalizeArabic(text || '').toLowerCase()} `;
  const out: AcType[] = [];
  for (const [type, terms] of Object.entries(TYPE_TERMS) as [AcType, string[]][]) {
    if (terms.some((t) => (t.includes(' ') ? lowered.includes(` ${t} `) : w.has(normalizeArabic(t).toLowerCase())))) out.push(type);
  }
  return out;
}

/** The single AC type a query asks for, or null when it names none or more than one. */
export function acTypeIntent(query: string): AcType | null {
  const found = typesIn(query);
  return found.length === 1 ? found[0] : null;
}

/** The AC type of a product: identity-key segment first, title second; null when neither says. */
export function acTypeOfProduct(p: { tps_identity_key?: string | null; name_ar?: string | null; name_en?: string | null }): AcType | null {
  const seg = (p.tps_identity_key || '').split('|');
  if (seg.length >= 6 && KEY_TYPES.has(seg[1])) return seg[1] as AcType;
  const found = typesIn(`${p.name_ar || ''} ${p.name_en || ''}`);
  return found.length === 1 ? found[0] : null;
}

/** Drops products of a known, different AC type. Pure; a no-op unless the query names exactly one type. */
export function filterByAcTypeIntent<T extends { tps_identity_key?: string | null; name_ar?: string | null; name_en?: string | null }>(products: T[], query: string): T[] {
  const intent = acTypeIntent(query);
  if (!intent) return products;
  return products.filter((p) => {
    const type = acTypeOfProduct(p);
    return type === null || type === intent;
  });
}
