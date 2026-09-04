// src/lib/campaigns/amazon-evidence.ts
// Amazon Decision Layer V2.1 §3/§6 — the real (not simulated) evidence lookup that feeds
// resolveAmazonDestination()'s EXACT_PRODUCT gate for the live post-search campaign card.
//
// TRUST BOUNDARY: only `productId` (Tawveeri's own internal product row id) is ever
// accepted from the client — never a client-supplied URL, price, or confidence claim.
// Everything used to decide EXACT_PRODUCT eligibility (the Amazon offer URL, its
// freshness, whether the product is corroborated across ≥2 stores) is re-derived here,
// server-side, from product_stores directly — the SAME current-state table the rest of
// the app treats as authoritative (never price_history — SEV-1 Disk IO lesson: the hot
// path never reads history).
//
// Amazon's numeric store id in product_stores.store_id is '2' — an established fact
// already relied on elsewhere (src/app/api/search/route.ts: "both store_id=2 →
// resolveApprovedSlug='amazon'"), not re-derived here.
import { createServerClient } from '@/lib/database';
import { isFreshObservation, hoursSince } from '@/lib/intelligence/evidence-engine';

const AMAZON_STORE_ID = '2';

export interface AmazonExactProductEvidence {
  amazonProductUrl: string | null;
  offerFreshnessHours: number | null;
  inStock: boolean;
  /** Distinct approved stores carrying this product — the same "corroborate before
   *  asserting identity" signal (CLAUDE.md) used as the practical confidence proxy for
   *  EXACT_PRODUCT: a single-store-only match hasn't been cross-verified by Tawveeri's
   *  own pipeline the way a ≥2-store match has. */
  distinctStoreCount: number;
}

const EMPTY_EVIDENCE: AmazonExactProductEvidence = {
  amazonProductUrl: null,
  offerFreshnessHours: null,
  inStock: false,
  distinctStoreCount: 0,
};

/**
 * Looks up the real Amazon offer (if any) for a Tawveeri product id, plus how many
 * distinct stores carry it. Never throws — a lookup failure degrades to "no evidence"
 * (EMPTY_EVIDENCE), which resolveAmazonDestination() already treats as a safe fallback
 * to model_search/category, never a crash and never a guessed exact match.
 */
export async function getAmazonExactProductEvidence(productId: string | null): Promise<AmazonExactProductEvidence> {
  if (!productId || !/^[0-9a-f-]{36}$/i.test(productId)) return EMPTY_EVIDENCE;
  try {
    const supabase = createServerClient() as unknown as { from: (table: string) => any };
    const { data: rows, error } = await supabase
      .from('product_stores')
      .select('store_id, product_url, availability, last_checked_at, last_scraped_at')
      .eq('product_id', productId);
    if (error || !rows || rows.length === 0) return EMPTY_EVIDENCE;

    const distinctStoreCount = new Set(rows.map((r: { store_id: string }) => r.store_id)).size;
    const amazonRow = rows.find((r: { store_id: string }) => r.store_id === AMAZON_STORE_ID) as
      | { product_url: string; availability: string; last_checked_at: string | null; last_scraped_at: string | null }
      | undefined;
    if (!amazonRow || !amazonRow.product_url) return { ...EMPTY_EVIDENCE, distinctStoreCount };

    const observedAt = amazonRow.last_scraped_at || amazonRow.last_checked_at || null;
    const freshnessHours = hoursSince(observedAt);
    return {
      amazonProductUrl: amazonRow.product_url,
      offerFreshnessHours: freshnessHours,
      inStock: amazonRow.availability === 'in_stock' || amazonRow.availability === 'limited_stock',
      distinctStoreCount,
    };
  } catch {
    return EMPTY_EVIDENCE;
  }
}

/** Re-exported for callers that just need the freshness gate without a full lookup. */
export { isFreshObservation };
