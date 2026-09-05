// src/lib/campaigns/amazon-evidence.ts
// Amazon Decision Layer V2.1 §3/§6 — the real (not simulated) evidence lookup that feeds
// resolveAmazonDestination()'s EXACT_PRODUCT gate for the live post-search campaign card.
//
// TRUST BOUNDARY: only `productId` (Tawveeri's own internal product row id) is ever
// accepted from the client — never a client-supplied URL, price, or confidence claim.
// Everything used to decide EXACT_PRODUCT eligibility (the merchant offer URL, its
// freshness, whether the product is corroborated across ≥2 stores) is re-derived here,
// server-side, from product_stores directly — the SAME current-state table the rest of
// the app treats as authoritative (never price_history — SEV-1 Disk IO lesson: the hot
// path never reads history).
//
// Noon Wave 1 (2026-09-05): the lookup itself was already merchant-agnostic in every way
// that matters — only the store_id constant and the exported name were Amazon-specific.
// Extracted the real logic into `getExactProductEvidenceForStore()` (parametrized by
// store_id) and kept `getAmazonExactProductEvidence()` as a thin, unchanged-signature
// wrapper so no existing caller/test needs to change. `getNoonExactProductEvidence()` is
// the same function called with Noon's store_id — no new query, no new risk surface.
import { createServerClient } from '@/lib/database';
import { isFreshObservation, hoursSince } from '@/lib/intelligence/evidence-engine';

// Established elsewhere already (src/app/api/search/route.ts: "store_id=2 → 'amazon'",
// "store_id=3 → 'noon'") — not re-derived here. IMPORTANT: despite
// src/lib/database/types.ts declaring product_stores.store_id as `string`, the live
// column is a Postgres integer — PostgREST (the Supabase JS client) returns it as a
// JS number, not a string. Found via production verification (2026-09-04): a strict
// `=== '2'` string compare silently matched nothing, blocking EXACT_PRODUCT for every
// real candidate. Compared with String(...) below so it's correct regardless of which
// JS type actually comes back.
const AMAZON_STORE_ID = '2';
const NOON_STORE_ID = '3';

export interface AmazonExactProductEvidence {
  amazonProductUrl: string | null;
  offerFreshnessHours: number | null;
  inStock: boolean;
  /** Distinct approved stores carrying this product — the same "corroborate before
   *  asserting identity" signal (CLAUDE.md) used as the practical confidence proxy for
   *  EXACT_PRODUCT: a single-store-only match hasn't been cross-verified by Tawveeri's
   *  own pipeline the way a ≥2-store match has. */
  distinctStoreCount: number;
  /** Added for the commercial-tiebreak module (2026-09-05) — Amazon's own scraped price
   *  for this exact offer, additive field, never displayed to shoppers by the campaign
   *  card itself (`allowPriceDisplay` in destination-resolver.ts stays hardcoded false
   *  regardless of this value; see that file's header for why). */
  priceSar: number | null;
}

/** Merchant-neutral shape — identical fields, without the Amazon-specific name, for
 *  callers (e.g. Noon's evidence lookup, the commercial-tiebreak module) that must not
 *  imply an Amazon-only concept. `productUrl`/`priceSar` replace the Amazon-named field. */
export interface MerchantExactProductEvidence {
  productUrl: string | null;
  priceSar: number | null;
  offerFreshnessHours: number | null;
  inStock: boolean;
  distinctStoreCount: number;
}

const EMPTY_EVIDENCE: MerchantExactProductEvidence = {
  productUrl: null,
  priceSar: null,
  offerFreshnessHours: null,
  inStock: false,
  distinctStoreCount: 0,
};

/**
 * Looks up the real merchant offer (if any) for a Tawveeri product id + store id, plus
 * how many distinct stores carry it. Never throws — a lookup failure degrades to "no
 * evidence" (EMPTY_EVIDENCE), which resolveAmazonDestination() already treats as a safe
 * fallback to model_search/category, never a crash and never a guessed exact match.
 */
export async function getExactProductEvidenceForStore(
  productId: string | null,
  storeId: string,
): Promise<MerchantExactProductEvidence> {
  if (!productId || !/^[0-9a-f-]{36}$/i.test(productId)) return EMPTY_EVIDENCE;
  try {
    const supabase = createServerClient() as unknown as { from: (table: string) => any };
    const { data: rows, error } = await supabase
      .from('product_stores')
      .select('store_id, product_url, current_price, availability, last_checked_at, last_scraped_at')
      .eq('product_id', productId);
    if (error || !rows || rows.length === 0) return EMPTY_EVIDENCE;

    const distinctStoreCount = new Set(rows.map((r: { store_id: string | number }) => String(r.store_id))).size;
    const storeRow = rows.find((r: { store_id: string | number }) => String(r.store_id) === storeId) as
      | { product_url: string; current_price: number | null; availability: string; last_checked_at: string | null; last_scraped_at: string | null }
      | undefined;
    if (!storeRow || !storeRow.product_url) return { ...EMPTY_EVIDENCE, distinctStoreCount };

    const observedAt = storeRow.last_scraped_at || storeRow.last_checked_at || null;
    const freshnessHours = hoursSince(observedAt);
    return {
      productUrl: storeRow.product_url,
      priceSar: typeof storeRow.current_price === 'number' ? storeRow.current_price : null,
      offerFreshnessHours: freshnessHours,
      inStock: storeRow.availability === 'in_stock' || storeRow.availability === 'limited_stock',
      distinctStoreCount,
    };
  } catch {
    return EMPTY_EVIDENCE;
  }
}

/** Unchanged signature/return shape — every existing caller/test keeps working. */
export async function getAmazonExactProductEvidence(productId: string | null): Promise<AmazonExactProductEvidence> {
  const e = await getExactProductEvidenceForStore(productId, AMAZON_STORE_ID);
  return { amazonProductUrl: e.productUrl, offerFreshnessHours: e.offerFreshnessHours, inStock: e.inStock, distinctStoreCount: e.distinctStoreCount, priceSar: e.priceSar };
}

/** Noon Wave 1 — same lookup, Noon's store id. Returns the merchant-neutral shape since
 *  there is no pre-existing Noon-named caller to keep byte-compatible. */
export async function getNoonExactProductEvidence(productId: string | null): Promise<MerchantExactProductEvidence> {
  return getExactProductEvidenceForStore(productId, NOON_STORE_ID);
}

/** Re-exported for callers that just need the freshness gate without a full lookup. */
export { isFreshObservation };
