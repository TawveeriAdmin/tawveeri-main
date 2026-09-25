// src/lib/catalog/get-cross-canonical-offers.ts
// ─────────────────────────────────────────────────────────────────────────────
// Cross-store comparison-visibility fix (2026-09-25, ADR-381).
//
// The storefront layer creates ONE `products` row per store's own discovered
// listing unless ProductMatcher recognizes it as an existing product at ingest
// time. When it doesn't, the SAME real-world product ends up on two SEPARATE
// `products.id` rows — one store's offer is simply invisible on the other
// store's `/products/[slug]` page, even though both are genuinely comparable.
//
// `products.canonical_product_id` links to the TPS knowledge-layer identity,
// but is NOT uniformly trustworthy: a 2026-06-26 migration wrote it once via
// unvalidated name/brand text matching (docs/TPS.md's own recorded debt), and
// `project-storefront-identity.ts`'s R3 rule never overwrites those old links.
// The ONLY trustworthy signal is `storefront_identity_links` — ADR-242's
// listing-equality projection, gated by unanimity/uniqueness/tier-gate rules
// before it ever writes. This function trusts ONLY rows there with
// `status='active'`, `rule_version='convergence-v1'`, `identity_key_status='valid'`
// — never a bare `products.canonical_product_id` read alone.
//
// Store-neutral by construction: returns every OTHER approved store's offer on
// the same verified canonical, whichever store that happens to be — never
// filtered or reordered to favor one retailer. Ranking (selectBestPriceOffer)
// is applied by the caller, unchanged, on the merged set.
// ─────────────────────────────────────────────────────────────────────────────
import { createServerClient } from '@/lib/database';
import { isApprovedStoreId } from '@/lib/retailers/approved-retailers';
import type { Database } from '@/lib/database/types';

type StoreSummary = Pick<
  Database['public']['Tables']['stores']['Row'],
  'id' | 'slug' | 'name_ar' | 'name_en' | 'logo_url' | 'average_rating' | 'total_reviews'
>;

export interface CrossCanonicalOffer {
  id: string;
  current_price: number;
  original_price: number | null;
  currency: string | null;
  availability: string | null;
  stock_quantity: number | null;
  product_url: string | null;
  affiliate_url: null; // product_stores carries no such column in production (verified live) — see /go/[offerId]'s own note.
  delivery_time_days: number | null;
  delivery_cost: number | null;
  is_free_delivery: boolean | null;
  is_deal: boolean | null;
  deal_expires_at: string | null;
  coupon_code: string | null;
  updated_at: string | null;
  stores: StoreSummary;
}

const VERIFIED_LINK_FILTER = {
  status: 'active',
  rule_version: 'convergence-v1',
  identity_key_status: 'valid',
} as const;

/**
 * Offers for the SAME real-world product living on a DIFFERENT `products.id`
 * than `currentProductId`, per a verified ADR-242 identity link. `excludeStoreIds`
 * should be the set of store ids already present on the current product's own
 * `product_stores` rows, so a store never appears twice on one page.
 */
export async function getCrossCanonicalOffers(
  currentProductId: string,
  excludeStoreIds: ReadonlySet<number>,
): Promise<CrossCanonicalOffer[]> {
  // `storefront_identity_links` is not in the generated Database types (a newer,
  // internal provenance table — see ADR-242) — cast, same convention as other
  // untyped-table access in this codebase (e.g. scraping-orchestrator.ts's stampChecked).
  const supabase = createServerClient() as unknown as {
    from(table: string): {
      select(cols: string): {
        eq(col: string, val: unknown): {
          match(f: Record<string, string>): {
            maybeSingle(): Promise<{ data: { canonical_product_id?: string } | null }>;
            neq(col: string, val: unknown): Promise<{ data: { product_id: string }[] | null }>;
          };
        };
        in(col: string, vals: string[]): Promise<{ data: unknown[] | null }>;
      };
    };
  };

  const { data: ownLink } = await supabase
    .from('storefront_identity_links')
    .select('canonical_product_id')
    .eq('product_id', currentProductId)
    .match(VERIFIED_LINK_FILTER)
    .maybeSingle();

  const canonicalId = ownLink?.canonical_product_id;
  if (!canonicalId) return [];

  const { data: siblingLinks } = await supabase
    .from('storefront_identity_links')
    .select('product_id')
    .eq('canonical_product_id', canonicalId)
    .match(VERIFIED_LINK_FILTER)
    .neq('product_id', currentProductId);

  const siblingIds = [...new Set(((siblingLinks ?? []) as { product_id: string }[]).map((r) => r.product_id))];
  if (!siblingIds.length) return [];

  const { data: rows } = await supabase
    .from('product_stores')
    .select(
      `id, current_price, original_price, currency, availability, stock_quantity, product_url,
       delivery_time_days, delivery_cost, is_free_delivery, is_deal, deal_expires_at, coupon_code,
       updated_at, last_seen_at, price_quarantined_at, store_id,
       stores(id, slug, name_ar, name_en, logo_url, average_rating, total_reviews)`
    )
    .in('product_id', siblingIds);

  type Row = {
    id: string; current_price: number; original_price: number | null; currency: string | null;
    availability: string | null; stock_quantity: number | null; product_url: string | null;
    delivery_time_days: number | null; delivery_cost: number | null; is_free_delivery: boolean | null;
    is_deal: boolean | null; deal_expires_at: string | null; coupon_code: string | null;
    updated_at: string | null; last_seen_at: string | null; price_quarantined_at: string | null;
    store_id: number; stores: StoreSummary | StoreSummary[] | null;
  };

  // A sibling product can itself carry the same known amazon-style duplicate
  // (product_id, store_id) rows (ADR-377) — without this, one store could appear
  // several times on the SAME page with different prices. Keep only ONE
  // authoritative offer per store_id — the most recently CONFIRMED valid price,
  // never merely "most recently observed" (2026-09-25 correction, ADR-382): a row
  // whose latest touch was a FAILED/rejected check (still quarantined, or no real
  // price) must lose to a row with a genuine confirmed price, however less
  // recently that row itself was touched. `updated_at` only advances on a credible
  // confirmation (ADR-380's fix), so it — not `last_seen_at` (bumped on every
  // discovery pass, success or not) — is the primary signal of "confirmed" here.
  const isConfirmedValid = (r: Row) =>
    !r.price_quarantined_at && typeof r.current_price === 'number' && r.current_price > 0 && r.availability !== 'out_of_stock';
  const byStore = new Map<number, Row>();
  for (const r of (rows ?? []) as Row[]) {
    if (!r.stores) continue;
    const existing = byStore.get(r.store_id);
    if (!existing) { byStore.set(r.store_id, r); continue; }
    const rOk = isConfirmedValid(r);
    const eOk = isConfirmedValid(existing);
    if (rOk !== eOk) {
      if (rOk) byStore.set(r.store_id, r);
      continue;
    }
    const rUpdated = r.updated_at ?? '';
    const eUpdated = existing.updated_at ?? '';
    const winner = rUpdated !== eUpdated ? rUpdated > eUpdated : (r.last_seen_at ?? '') > (existing.last_seen_at ?? '');
    if (winner) byStore.set(r.store_id, r);
  }

  return [...byStore.values()]
    .filter((r) => isApprovedStoreId(r.store_id) && !excludeStoreIds.has(r.store_id))
    .map((r) => ({
      id: r.id,
      current_price: r.current_price,
      original_price: r.original_price,
      currency: r.currency,
      availability: r.availability,
      stock_quantity: r.stock_quantity,
      product_url: r.product_url,
      affiliate_url: null,
      delivery_time_days: r.delivery_time_days,
      delivery_cost: r.delivery_cost,
      is_free_delivery: r.is_free_delivery,
      is_deal: r.is_deal,
      deal_expires_at: r.deal_expires_at,
      coupon_code: r.coupon_code,
      updated_at: r.updated_at,
      stores: (Array.isArray(r.stores) ? r.stores[0] : r.stores) as StoreSummary,
    }));
}
