// src/lib/catalog/same-listing-identity.ts — ADR-389.
// A storefront `products` row (discover-firecrawl "memory" writer) can hold an English-only
// `name_ar` and NO image while the knowledge layer already holds an Arabic name and an image
// for the SAME merchant listing (the Samsung 18000 case: products row `c938d587…` vs canonical
// `eea9c4f2…`, both Extra `/p/100226575`). The proof of sameness is the one ADR-387/388 use for
// search cards — equality of the (store, normalized listing URL) pair — never a name guess.
// This helper resolves that canonical server-side (service role; `tps_current_offers` is not
// anon-readable) so the product page can prefer the documented Arabic title and load the
// listing's own image. It never links rows in the database (no relinking, ADR-388 §7).
import { createServerClient } from '@/lib/database';
import { normalizeListingUrl } from '@/lib/catalog/merge-verified-canonical-search-results';

export interface SameListingIdentity {
  canonical_id: string;
  tps_identity_key: string;
  name_ar: string | null;
  name_en: string | null;
  image_url: string | null;
  brand: string | null;
  /** The URL that proved the match (normalized), for evidence/logging. */
  matched_url: string;
}

interface CurrentOfferRow { identity_key: string | null; url: string | null; store_id: number | string | null }
interface CanonicalRow { id: string; tps_identity_key: string; name_ar: string | null; name_en: string | null; image_url: string | null; brand: string | null }

/** Pure: pick the canonical whose current offer URL equals one of the product's listing URLs. */
export function pickSameListingCanonical(
  productUrls: Array<string | null | undefined>,
  offers: CurrentOfferRow[],
  canonicals: CanonicalRow[],
): SameListingIdentity | null {
  const wanted = new Map<string, string>();
  for (const u of productUrls) { const n = normalizeListingUrl(u); if (n) wanted.set(n, u as string); }
  if (wanted.size === 0) return null;
  for (const o of offers) {
    const n = normalizeListingUrl(o.url);
    if (!n || !o.identity_key || !wanted.has(n)) continue;
    const c = canonicals.find((x) => x.tps_identity_key === o.identity_key);
    if (!c) continue;
    return { canonical_id: c.id, tps_identity_key: c.tps_identity_key, name_ar: c.name_ar, name_en: c.name_en, image_url: c.image_url, brand: c.brand, matched_url: n };
  }
  return null;
}

export async function findSameListingCanonical(productUrls: Array<string | null | undefined>): Promise<SameListingIdentity | null> {
  const urls = productUrls.filter((u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u));
  if (urls.length === 0) return null;
  try {
    const supabase = createServerClient();
    // Exact-URL lookup first (the stored URL is the listing URL as observed); the normalized
    // comparison in pickSameListingCanonical guards host/case/trailing-slash/tracking drift.
    const { data: offers, error } = await supabase
      .from('tps_current_offers')
      .select('identity_key, url, store_id')
      .in('url', urls)
      .limit(20);
    if (error || !offers || offers.length === 0) return null;
    const keys = Array.from(new Set((offers as CurrentOfferRow[]).map((o) => o.identity_key).filter((k): k is string => !!k)));
    if (keys.length === 0) return null;
    const { data: canonicals, error: cErr } = await supabase
      .from('canonical_products')
      .select('id, tps_identity_key, name_ar, name_en, image_url, brand')
      .in('tps_identity_key', keys)
      .eq('is_active', true)
      .limit(20);
    if (cErr || !canonicals) return null;
    return pickSameListingCanonical(urls, offers as CurrentOfferRow[], canonicals as unknown as CanonicalRow[]);
  } catch {
    return null;
  }
}

/** True when a string contains at least one Arabic letter. */
export function hasArabicLetters(s: string | null | undefined): boolean {
  return !!s && /[؀-ۿ]/.test(s);
}
