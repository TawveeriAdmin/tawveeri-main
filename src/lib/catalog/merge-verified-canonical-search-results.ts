// src/lib/catalog/merge-verified-canonical-search-results.ts
// ─────────────────────────────────────────────────────────────────────────────
// Search-results counterpart to get-cross-canonical-offers.ts (ADR-381/ADR-382).
//
// `/api/search`'s DB fallback path (`toGroupedSearchProduct`, src/app/api/search/
// route.ts) builds ONE result card per `products.id` row. When the SAME real-world
// product lives on two separate `products.id` rows (the exact gap ADR-381 fixed on
// the product detail page), a search whose text matches BOTH listings' titles
// returns TWO SEPARATE cards — e.g. "Samsung 55 inch OLED" returning one card for
// extra's "Samsung 55 inch 4K Smart Tv OLED 165 Hz" and a SEPARATE card for
// amazon's "Samsung 55 Inch OLED S90H..." — live-reproduced 2026-09-25.
//
// Same trust rule as ADR-381: only merges cards whose `product_id` is linked to the
// SAME canonical via a VERIFIED `storefront_identity_links` row (rule_version=
// 'convergence-v1', status='active', identity_key_status='valid') — never a blanket
// merge of every split group, never a bare `products.canonical_product_id` read.
// Store-neutral: never reorders/favors a retailer: the merged card's own price/
// best-price/representative metadata are recomputed the same way for every store.
// ─────────────────────────────────────────────────────────────────────────────
import { createServerClient } from '@/lib/database';
import type { GroupedSearchProduct } from '@/lib/scraping/search/product-grouper';
import type { SearchProduct } from '@/lib/scraping/search/types';

const VERIFIED_LINK_FILTER = {
  status: 'active',
  rule_version: 'convergence-v1',
  identity_key_status: 'valid',
} as const;

/** A store's offer is fit to stand alone: a real, positive price and not out of stock.
 *  Never "confirmed valid" from a merely-recent timestamp — see ADR-382. */
function isValidOffer(s: SearchProduct): boolean {
  return typeof s.current_price === 'number' && s.current_price > 0 && s.availability !== 'out_of_stock';
}

/**
 * Collapse a card's own `stores[]` to one offer per store — a defensive safety net
 * against ANY source (a single split-canonical row's own known duplicate
 * `product_stores` rows, ADR-377) ever putting the same retailer on one card twice
 * with conflicting prices. Prefers a VALID offer over an invalid one; otherwise
 * keeps whichever was seen first (deterministic, no fabricated preference between
 * two equally-valid duplicates).
 */
function dedupeCardStores(card: GroupedSearchProduct): GroupedSearchProduct {
  const byStore = new Map<string, SearchProduct>();
  for (const s of card.stores) {
    const existing = byStore.get(s.store);
    if (!existing) { byStore.set(s.store, s); continue; }
    if (isValidOffer(s) && !isValidOffer(existing)) byStore.set(s.store, s);
  }
  if (byStore.size === card.stores.length) return card; // no-op, nothing collapsed
  const stores = [...byStore.values()];
  const prices = stores.map((s) => s.current_price).filter((n): n is number => typeof n === 'number' && n > 0);
  const bestPrice = prices.length ? Math.min(...prices) : card.best_price;
  return {
    ...card,
    stores,
    best_price: bestPrice,
    current_price: bestPrice,
    availability: stores.some((s) => s.availability === 'in_stock') ? 'in_stock' : card.availability,
    store_count: stores.length,
  };
}

function mergeCards(group: GroupedSearchProduct[]): GroupedSearchProduct {
  const allStores = group.flatMap((c) => c.stores);
  const byStore = new Map<string, SearchProduct>();
  for (const s of allStores) {
    const existing = byStore.get(s.store);
    if (!existing) { byStore.set(s.store, s); continue; }
    if (isValidOffer(s) && !isValidOffer(existing)) byStore.set(s.store, s);
  }
  const stores = [...byStore.values()];
  const prices = stores.map((s) => s.current_price).filter((n): n is number => typeof n === 'number' && n > 0);
  const bestPrice = prices.length ? Math.min(...prices) : 0;
  const anyInStock = stores.some((s) => s.availability === 'in_stock');

  // Representative card's own metadata (name/brand/image/product_id/slug) is whichever
  // source card's OWN price happens to be the merged group's minimum — a neutral,
  // store-blind tie-break (never "prefer amazon's title" or similar).
  const rep = group.reduce((best, c) => (c.best_price > 0 && (best.best_price <= 0 || c.best_price < best.best_price) ? c : best), group[0]);

  return {
    ...rep,
    stores,
    best_price: bestPrice,
    current_price: bestPrice,
    availability: anyInStock ? 'in_stock' : rep.availability,
    store_count: stores.length,
  };
}

/**
 * Merges search-result cards that are VERIFIED to be the same real-world product
 * (a different `products.id` each, per `storefront_identity_links`), and collapses
 * any remaining same-store duplicates on every card. Fails closed to the original,
 * un-merged (but still store-deduped) list on any error.
 */
export async function mergeVerifiedCanonicalSearchResults(
  products: GroupedSearchProduct[],
): Promise<GroupedSearchProduct[]> {
  if (products.length < 2) return products.map(dedupeCardStores);

  try {
    const ids = [...new Set(products.map((p) => p.product_id).filter((id): id is string => !!id))];
    if (ids.length < 2) return products.map(dedupeCardStores);

    // `storefront_identity_links` is not in the generated Database types — cast, same
    // convention as get-cross-canonical-offers.ts / scraping-orchestrator.ts.
    const supabase = createServerClient() as unknown as {
      from(table: string): {
        select(cols: string): {
          in(col: string, vals: string[]): {
            match(f: Record<string, string>): Promise<{ data: { product_id: string; canonical_product_id: string }[] | null }>;
          };
        };
      };
    };

    const { data: links } = await supabase
      .from('storefront_identity_links')
      .select('product_id, canonical_product_id')
      .in('product_id', ids)
      .match(VERIFIED_LINK_FILTER);

    const canonicalByProductId = new Map((links ?? []).map((l) => [l.product_id, l.canonical_product_id]));
    if (!canonicalByProductId.size) return products.map(dedupeCardStores);

    const byCanonical = new Map<string, GroupedSearchProduct[]>();
    const passthrough: GroupedSearchProduct[] = [];
    for (const p of products) {
      const cid = p.product_id ? canonicalByProductId.get(p.product_id) : undefined;
      if (!cid) { passthrough.push(p); continue; }
      const group = byCanonical.get(cid);
      if (group) group.push(p); else byCanonical.set(cid, [p]);
    }

    const merged: GroupedSearchProduct[] = passthrough.map(dedupeCardStores);
    for (const group of byCanonical.values()) {
      merged.push(dedupeCardStores(group.length === 1 ? group[0] : mergeCards(group)));
    }
    return merged;
  } catch (error) {
    console.error('mergeVerifiedCanonicalSearchResults error:', error);
    return products.map(dedupeCardStores);
  }
}
