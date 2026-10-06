/**
 * ADR-396 — Amazon discovery gate for the adapter route (`/api/cron/discover-firecrawl`).
 *
 * A search-result tile is evidence that a listing EXISTS (or is back), not evidence of its
 * price: visited live 2026-10-01, the tile value for B0GS29FHVB was the strike-through list
 * price (1,899) while the detail page sold at 1,699.17, and across 26 same-row pairs the tile
 * ran +27% over the detail page. Until this gate the route upserted every tile straight onto
 * `product_stores.current_price` with `updated_at = now()` (the storefront freshness signal)
 * and wrote it to `price_history` — ~385 rows/day, 57% of the comparison layer's current
 * amazon observations, bypassing the price-truth gate and overwriting detail-page readings.
 *
 * Rules (amazon only; extra/almanea read a merchant index whose price IS the page price):
 *   1. Known ASIN (storefront row exists) → the tile never writes a price. If that row is
 *      out_of_stock or dead-lettered, the sighting is a RESURRECTION signal: the detail page
 *      is fetched and, if a buy box exists, the offer is refreshed through the normal
 *      price-truth path.
 *   2. New ASIN → the detail page is fetched (bounded per run). With a buy box the row is
 *      created with the page price; without one (unavailable / fetch failed) the row is
 *      created with the tile price but `updated_at = null` and no price_history/raw
 *      observation — visible as a listing, never "fresh", never "best price", until
 *      price_update confirms it.
 *   3. Every persisted amazon row carries `external_id = ASIN` and the canonical
 *      `https://www.amazon.sa/dp/ASIN` URL.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedOffer } from '../adapters/types';
import type { ScrapedProduct } from '../base/types';
import { asinFromUrl, canonicalAmazonUrl, isAsin } from '../utils/amazon-asin';

export type AmazonTileVerdict = 'new' | 'known_live' | 'known_resurrect' | 'no_asin';

export interface KnownAmazonRow {
  id: string;
  product_id: string;
  external_id: string | null;
  product_url: string;
  availability: string | null;
  consecutive_misses: number | null;
}

export interface AmazonPartition {
  /** tiles whose ASIN has no storefront row */
  fresh: NormalizedOffer[];
  /** tiles whose row is out_of_stock or dead-lettered (>= DEAD_MISSES failures) */
  resurrect: Array<{ offer: NormalizedOffer; row: KnownAmazonRow }>;
  /** tiles whose row is live — dropped, never repriced from a tile */
  knownLive: number;
  noAsin: number;
}

export const DEAD_MISSES = 7;

export function asinOfOffer(o: Pick<NormalizedOffer, 'external_id' | 'product_url'>): string | null {
  return (isAsin(o.external_id) ? o.external_id.toUpperCase() : null) ?? asinFromUrl(o.product_url);
}

/** Pure: split tiles by what the storefront already knows about their ASIN. */
export function partitionAmazonOffers(offers: NormalizedOffer[], known: Map<string, KnownAmazonRow>): AmazonPartition {
  const out: AmazonPartition = { fresh: [], resurrect: [], knownLive: 0, noAsin: 0 };
  const seen = new Set<string>();
  for (const o of offers) {
    const asin = asinOfOffer(o);
    if (!asin) { out.noAsin++; continue; }
    if (seen.has(asin)) continue;
    seen.add(asin);
    const canonical: NormalizedOffer = { ...o, external_id: asin, product_url: canonicalAmazonUrl(asin) };
    const row = known.get(asin);
    if (!row) { out.fresh.push(canonical); continue; }
    const dead = (row.consecutive_misses ?? 0) >= DEAD_MISSES;
    if (row.availability === 'out_of_stock' || dead) out.resurrect.push({ offer: canonical, row });
    else out.knownLive++;
  }
  return out;
}

/** Storefront rows for these ASINs, by external_id first and URL as the legacy fallback. */
export async function loadKnownAmazonRows(sb: SupabaseClient, storeId: number, asins: string[]): Promise<Map<string, KnownAmazonRow>> {
  const known = new Map<string, KnownAmazonRow>();
  const uniq = [...new Set(asins.map((a) => a.toUpperCase()))];
  for (let i = 0; i < uniq.length; i += 100) {
    const slice = uniq.slice(i, i + 100);
    const { data, error } = await sb
      .from('product_stores')
      .select('id, product_id, external_id, product_url, availability, consecutive_misses')
      .eq('store_id', storeId)
      .or([`external_id.in.(${slice.join(',')})`, ...slice.map((a) => `product_url.ilike.%/dp/${a}%`)].join(','))
      .order('consecutive_misses', { ascending: true, nullsFirst: true });
    if (error) throw new Error(`known-ASIN lookup failed: ${error.message}`);
    for (const r of (data ?? []) as KnownAmazonRow[]) {
      const a = (isAsin(r.external_id) ? r.external_id.toUpperCase() : null) ?? asinFromUrl(r.product_url);
      if (a && !known.has(a)) known.set(a, r); // healthiest row first (ordered by misses)
    }
  }
  return known;
}

export interface VerifiedOffer {
  offer: NormalizedOffer;
  /** detail page read; null price = page had no buy box (unavailable) or fetch failed */
  page: ScrapedProduct | null;
  verified: boolean;
  unavailable: boolean;
}

/**
 * Read the detail page for up to `max` offers, in order. Never throws: a failed read leaves
 * the offer unverified (tile price kept, flagged), it does not abort the batch.
 */
export async function verifyAmazonOffers(
  offers: NormalizedOffer[],
  fetchPage: (url: string) => Promise<ScrapedProduct | null>,
  max: number,
): Promise<VerifiedOffer[]> {
  const out: VerifiedOffer[] = [];
  for (let i = 0; i < offers.length; i++) {
    const offer = offers[i];
    if (i >= max) { out.push({ offer: markUnverified(offer), page: null, verified: false, unavailable: false }); continue; }
    let page: ScrapedProduct | null = null;
    try { page = await fetchPage(offer.product_url); } catch { page = null; }
    if (page && page.current_price != null && page.current_price > 0) {
      out.push({
        offer: { ...offer, current_price: page.current_price, original_price: page.original_price ?? null, availability: page.availability === 'out_of_stock' ? 'out_of_stock' : 'in_stock', _raw: { ...(offer._raw as object), _price_source: 'product_page' } },
        page, verified: true, unavailable: false,
      });
    } else if (page && page.availability === 'out_of_stock') {
      out.push({ offer: { ...markUnverified(offer), availability: 'out_of_stock' }, page, verified: false, unavailable: true });
    } else {
      out.push({ offer: markUnverified(offer), page: null, verified: false, unavailable: false });
    }
  }
  return out;
}

/**
 * TARGETED SEEDS (2026-10-06, external review item 7): ASINs a person verified on amazon.sa that the generic discovery queries never reach. Only a seed with NO storefront row is
 * read (bounded by `max`), and only a detail page WITH a buy-box price in stock becomes an offer — a seed is never persisted from a guess, from a tile, or without a price. The offer is
 * shaped exactly like a verified discovery tile (canonical /dp/ASIN URL, `_price_source: 'product_page'`) so it rides the normal price-truth / raw-observation path. Never throws.
 */
export async function verifiedSeedOffers(
  seeds: Array<{ asin: string; brand?: string }>,
  known: Map<string, KnownAmazonRow>,
  fetchPage: (url: string) => Promise<ScrapedProduct | null>,
  max: number,
): Promise<{ offers: NormalizedOffer[]; requested: number; alreadyKnown: number; unavailable: number; failed: number }> {
  const out = { offers: [] as NormalizedOffer[], requested: 0, alreadyKnown: 0, unavailable: 0, failed: 0 };
  for (const seed of seeds) {
    const asin = seed.asin.toUpperCase();
    if (!isAsin(asin)) continue;
    if (known.has(asin)) { out.alreadyKnown++; continue; }
    if (out.requested >= max) break;
    out.requested++;
    const url = canonicalAmazonUrl(asin);
    let page: ScrapedProduct | null = null;
    try { page = await fetchPage(url); } catch { page = null; }
    if (!page || !(page.current_price != null && page.current_price > 0)) { out.failed++; continue; }
    if (page.availability === 'out_of_stock') { out.unavailable++; continue; }
    const title = (page.name_en || page.name_ar || '').trim();
    if (!title) { out.failed++; continue; }
    const brand = seed.brand || (page.brand && page.brand !== 'Unknown' ? page.brand : '');
    out.offers.push({
      name_ar: page.name_ar || title, name_en: page.name_en || title, brand, category: page.category || '',
      current_price: page.current_price, original_price: page.original_price ?? null, product_url: url,
      image_url: page.image_urls?.[0] ?? null,
      availability: 'in_stock', barcode: null, external_id: asin,
      _raw: { ...(page as unknown as object), _price_source: 'product_page', _seed: true },
      _source: 'amazon-search',
    });
  }
  return out;
}

function markUnverified(offer: NormalizedOffer): NormalizedOffer {
  return { ...offer, _raw: { ...(offer._raw as object), _price_source: 'search_tile_unverified' } };
}
