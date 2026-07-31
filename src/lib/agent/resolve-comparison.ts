// src/lib/agent/resolve-comparison.ts
// UNIFIED SEARCH → comparison routing, under ONE governing rule:
//
//   **Comparison intent must never route to a comparison that cannot actually be delivered.**
//
// Principle 3 and F3 applied to routing: if the data does not exist, the route does not
// exist. Every condition below is verified against the SAME authority the comparison page
// renders from — `getComparison()` — rather than against a proxy that could agree with it
// today and drift tomorrow. `tps_product_projection.store_count` was the obvious proxy and
// is deliberately NOT used at route time: it counts what the projection saw, while the page
// counts APPROVED retailers with a live price, and those are different questions.
//
// MEASURED, and it decides the shape of this file: only **761 of 5,054 canonicals (15.1%)**
// carry offers from ≥2 retailers. The "cannot deliver" branch is therefore the COMMON case,
// not the edge case, and the honest answer is the main path — not a fallback bolted on.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getComparison, isComparisonError } from '@/lib/compare/get-comparison';
import { detectCompareIntent, normalizeAr, type CompareIntent } from './compare-intent';
import { SAUDI_SEARCH_SYNONYMS } from '@/lib/search/query-normalize';

/**
 * MEASURED, and it is why this exists: `canonical_products.name_ar` holds ENGLISH text —
 * «apple iPhone 16 128GB» is the Arabic name. So an Arabic mention («ايفون 16») matches
 * nothing by `ilike`, and the first run of this resolver returned "no canonical identity"
 * for a product that carries five retailers.
 *
 * The repository already owns the bridge — `SAUDI_SEARCH_SYNONYMS`, the same groups the
 * search layer uses. Reusing it means the comparison router and search agree on what a word
 * means; a second private map here would drift and the two surfaces would disagree about
 * whether a product exists.
 */
const SYNONYMS: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const group of SAUDI_SEARCH_SYNONYMS) {
    const norm = group.map((g) => normalizeAr(g));
    for (const term of norm) m.set(term, norm);
  }
  return m;
})();

/** Every spelling a token could appear under in the catalogue, itself included. */
const variantsOf = (token: string): string[] => SYNONYMS.get(token) ?? [token];

/** A product we could name and price, whether or not it can be compared. */
export interface EvidencedProduct {
  identity_key: string;
  name_ar: string;
  name_en: string | null;
  brand: string | null;
  category: string;
  lowest_price: number | null;
  retailer_count: number;
  /** Present ONLY when the comparison page can genuinely fulfil it. */
  compare_url: string | null;
}

export type ComparisonRoute =
  | { route: 'none'; reason: string }
  /** Verified: the page will render ≥2 approved-retailer offers for this product. */
  | { route: 'comparison'; product: EvidencedProduct; retailer_count: number; reason: string }
  /** Intent understood, comparison NOT deliverable. Carries the best evidence we do have. */
  | { route: 'evidence'; products: EvidencedProduct[]; unresolved: string[]; reason: string };

const MIN_RETAILERS = 2;

/**
 * Categories a comparison is meaningful in. Read from the projection at query time rather
 * than hardcoded — a category earns comparability by holding comparable products, exactly
 * as ADR-150 decided for navigation. A canonical outside it never routes to comparison even
 * if it somehow carries two offers.
 */
async function comparableCategories(sb: SupabaseClient): Promise<Set<string>> {
  const { data } = await sb
    .from('tps_product_projection')
    .select('category, store_count')
    .gte('store_count', MIN_RETAILERS)
    .limit(5000);
  const s = new Set<string>();
  for (const r of (data ?? []) as Array<{ category: string | null }>) if (r.category) s.add(r.category);
  return s;
}

/**
 * Text → canonical identity. Conservative by construction: a mention that does not match a
 * canonical returns nothing rather than the nearest thing, because naming the wrong product
 * in a comparison is worse than saying we could not find it (Principle 1 — unknown beats
 * incorrect).
 */
async function resolveCanonical(sb: SupabaseClient, mention: string): Promise<EvidencedProduct | null> {
  const q = normalizeAr(mention).slice(0, 60);
  if (q.length < 3) return null;
  // Token AND-match on the canonical name, so «ايفون ١٦» does not match every iPhone.
  const tokens = q.split(' ').filter((t) => t.length >= 2).slice(0, 4);
  if (!tokens.length) return null;

  // Match on the token most likely to be distinctive (the longest), widened to its
  // synonyms, then score the candidates. A narrow first filter keeps the read small; the
  // scoring below is what actually decides.
  const anchor = [...tokens].sort((a, b) => b.length - a.length)[0];
  const anchorVariants = variantsOf(anchor);
  const orClause = anchorVariants
    .flatMap((v) => [`name_ar.ilike.%${v}%`, `name_en.ilike.%${v}%`, `brand.ilike.%${v}%`])
    .join(',');
  const { data } = await sb
    .from('canonical_products')
    .select('id, tps_identity_key, name_ar, name_en, brand, category')
    .not('tps_identity_key', 'is', null)
    .or(orClause)
    .limit(200);
  const rows = (data ?? []) as Array<{
    id: string; tps_identity_key: string; name_ar: string; name_en: string | null;
    brand: string | null; category: string;
  }>;
  if (!rows.length) return null;

  // Prefer the candidate that contains the MOST of the shopper's tokens, then the one with
  // the most retailers — a better-evidenced product is a better answer to "compare this".
  // A token "lands" if the candidate contains it OR any of its synonyms — «ايفون» lands on
  // «apple iPhone 16 128GB». Scoring is done on the WHOLE mention, not just the anchor.
  const scored = rows.map((r) => {
    const hay = normalizeAr(`${r.name_ar} ${r.name_en ?? ''} ${r.brand ?? ''} ${r.tps_identity_key}`);
    const hits = tokens.filter((t) => variantsOf(t).some((v) => hay.includes(v))).length;
    return { r, hits, len: `${r.name_ar}`.length };
  }).sort((a, b) => b.hits - a.hits || a.len - b.len);
  // The length tiebreak matters: «ايفون 16» lands equally on "apple iPhone 16 128GB" and
  // "apple iPhone 16 Pro Max 512GB". The shorter name carries fewer qualifiers the shopper
  // did not ask for, so it is the closer reading of what they typed.
  const best = scored[0];
  // Every token must land. A partial match is a different product wearing a similar name,
  // and naming the wrong product in a comparison is worse than saying we could not find it.
  if (best.hits < tokens.length) return null;

  const { data: proj } = await sb
    .from('tps_product_projection')
    .select('lowest_price, store_count')
    .eq('canonical_id', best.r.id)
    .maybeSingle();

  return {
    identity_key: best.r.tps_identity_key,
    name_ar: best.r.name_ar,
    name_en: best.r.name_en,
    brand: best.r.brand,
    category: best.r.category,
    lowest_price: (proj as { lowest_price?: number | null } | null)?.lowest_price ?? null,
    retailer_count: (proj as { store_count?: number | null } | null)?.store_count ?? 0,
    compare_url: null, // never set from the projection — only after getComparison() agrees
  };
}

/** Load the canonical + projection facts for an identity key search already resolved. */
async function hydrateByIdentityKey(sb: SupabaseClient, identityKey: string): Promise<EvidencedProduct | null> {
  if (!identityKey) return null;
  const { data } = await sb
    .from('canonical_products')
    .select('id, tps_identity_key, name_ar, name_en, brand, category')
    .eq('tps_identity_key', identityKey)
    .maybeSingle();
  const r = data as { id: string; tps_identity_key: string; name_ar: string; name_en: string | null; brand: string | null; category: string } | null;
  if (!r) return null;
  const { data: proj } = await sb
    .from('tps_product_projection')
    .select('lowest_price, store_count')
    .eq('canonical_id', r.id)
    .maybeSingle();
  return {
    identity_key: r.tps_identity_key,
    name_ar: r.name_ar,
    name_en: r.name_en,
    brand: r.brand,
    category: r.category,
    lowest_price: (proj as { lowest_price?: number | null } | null)?.lowest_price ?? null,
    retailer_count: (proj as { store_count?: number | null } | null)?.store_count ?? 0,
    compare_url: null,
  };
}

/**
 * The gate. Returns the offer count the comparison PAGE will actually render, by calling the
 * page's own loader. This is the only statement in this file entitled to say a comparison
 * can be delivered.
 */
async function deliverableOfferCount(identityKey: string): Promise<number> {
  const res = await getComparison({ identityKey });
  if (isComparisonError(res)) return 0;
  return res.offers?.length ?? 0;
}

/**
 * Decide the route for a query, verifying every condition before offering a comparison.
 *
 * The four conditions, in the order they can fail cheapest-first:
 *   1. both products resolve to canonical identities
 *   2. both belong to a comparable category
 *   3. at least one product has offers from ≥2 displayable retailers
 *   4. the comparison page can genuinely fulfil the request
 *
 * (4) is not a restatement of (3): (3) is what our projection believes, (4) is what the page
 * will render. They agree today on the samples measured; only (4) is authoritative.
 */
export async function resolveComparisonRoute(
  sb: SupabaseClient,
  text: string,
  intentOverride?: CompareIntent,
  /**
   * The identity keys the search that just ran already resolved, best-first.
   *
   * MEASURED: a private text→canonical resolver in this file could not find «ايفون 16»,
   * because `canonical_products.name_ar` holds ENGLISH («apple iPhone 16 128GB») and the
   * synonym-widened `ilike` had to be truncated, so the target fell outside the slice. The
   * search pipeline already solves that problem properly — bilingual expansion, Algolia,
   * relevance ranking, all measured under P2-2. For a SINGLE-product comparison the query IS
   * the subject, so its top-ranked result is the resolution, at zero extra cost and with no
   * second retrieval to drift from the first.
   */
  searchIdentityKeys?: string[],
): Promise<ComparisonRoute> {
  const intent = intentOverride ?? detectCompareIntent(text);
  if (intent.kind === 'none') return { route: 'none', reason: intent.reason };

  const mentions = intent.kind === 'pair' ? intent.subjects : [intent.subject];
  const resolved: EvidencedProduct[] = [];
  const unresolved: string[] = [];

  // SINGLE: prefer what search already ranked. Fall back to the text resolver only if the
  // search returned nothing identity-bearing.
  if (intent.kind === 'single' && searchIdentityKeys?.length) {
    const fromSearch = await hydrateByIdentityKey(sb, searchIdentityKeys[0]);
    if (fromSearch) resolved.push(fromSearch);
  }
  if (!resolved.length) {
    for (const m of mentions) {
      const p = await resolveCanonical(sb, m);
      if (p) resolved.push(p); else unresolved.push(m);
    }
  }

  // Condition 1 — nothing named, nothing to say. Fall back to ordinary results rather than
  // rendering an explanation about products we could not even identify.
  if (!resolved.length) {
    return { route: 'none', reason: `no canonical identity for: ${mentions.join(' | ')}` };
  }

  // A PAIR never routes to a comparison page, and this is a fact about the product, not a
  // policy choice: the only URL-addressable comparison is /compare/<identity_key>, which
  // compares ONE product across retailers. The two-product view is the localStorage-backed
  // compare LIST, which cannot be addressed by a query — sending a shopper there from a
  // search would land them on whatever they had saved earlier, or on nothing.
  if (intent.kind === 'pair') {
    return {
      route: 'evidence',
      products: await withVerifiedCompareUrls(resolved),
      unresolved,
      reason: 'a two-product comparison has no page that can fulfil it; showing the evidence for each',
    };
  }

  const cats = await comparableCategories(sb);
  const p = resolved[0];

  // Condition 2
  if (!cats.has(p.category)) {
    return {
      route: 'evidence',
      products: await withVerifiedCompareUrls(resolved),
      unresolved,
      reason: `category "${p.category}" holds no products with ${MIN_RETAILERS}+ retailers`,
    };
  }

  // Conditions 3 and 4 — asked of the page's own loader, not of the projection.
  const offers = await deliverableOfferCount(p.identity_key);
  if (offers < MIN_RETAILERS) {
    return {
      route: 'evidence',
      products: await withVerifiedCompareUrls(resolved),
      unresolved,
      reason: `only ${offers} approved-retailer offer(s) — the comparison page would be empty`,
    };
  }

  return {
    route: 'comparison',
    product: { ...p, retailer_count: offers, compare_url: `/compare/${encodeURIComponent(p.identity_key)}` },
    retailer_count: offers,
    reason: `verified ${offers} approved-retailer offers`,
  };
}

/**
 * Attach a compare_url to each product ONLY where the page would honour it.
 *
 * This is the same rule ADR-136 applied to the search card: never render a comparison claim
 * without the surface that backs it. In the evidence answer a shopper may still click
 * through to one product's own retailer comparison — but only when that product really has
 * one.
 */
async function withVerifiedCompareUrls(
  products: EvidencedProduct[],
): Promise<EvidencedProduct[]> {
  return Promise.all(
    products.map(async (p) => {
      const offers = await deliverableOfferCount(p.identity_key);
      return {
        ...p,
        retailer_count: offers,
        compare_url: offers >= MIN_RETAILERS ? `/compare/${encodeURIComponent(p.identity_key)}` : null,
      };
    }),
  );
}
