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
import { resolveApprovedSlug } from '@/lib/retailers/approved-retailers';
import type { GroupedSearchProduct } from '@/lib/scraping/search/product-grouper';
import type { SearchProduct } from '@/lib/scraping/search/types';

const VERIFIED_LINK_FILTER = {
  status: 'active',
  rule_version: 'convergence-v1',
  identity_key_status: 'valid',
} as const;

/**
 * Live-caught (2026-09-25, same verification pass): a single card can already carry
 * the SAME store spelled two different ways ("أمازون" vs "أمازون السعودية" — two
 * `product_stores` rows for the identical amazon ASIN with inconsistent
 * `store_name` values, the very column instability ADR-377 first documented) — a
 * raw string key would treat them as two different stores and show both. Group by
 * the canonical slug `resolveApprovedSlug()` already resolves every known display-
 * name variant to, falling back to the raw (lowercased) string only for a name that
 * map doesn't recognize, so an unmapped store is still deduped against itself
 * without being wrongly merged into a DIFFERENT unmapped store.
 */
function storeKey(s: SearchProduct): string {
  return resolveApprovedSlug(s.store) ?? s.store.trim().toLowerCase();
}

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
    const existing = byStore.get(storeKey(s));
    if (!existing) { byStore.set(storeKey(s), s); continue; }
    if (isValidOffer(s) && !isValidOffer(existing)) byStore.set(storeKey(s), s);
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
    const existing = byStore.get(storeKey(s));
    if (!existing) { byStore.set(storeKey(s), s); continue; }
    if (isValidOffer(s) && !isValidOffer(existing)) byStore.set(storeKey(s), s);
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

/** A merchant listing URL normalized for equality: scheme/host case, tracking query, fragment
 *  and trailing slash removed. Two cards carrying the same normalized URL for the same store
 *  are the SAME listing — the `url_exact` lane the identity projection itself trusts. */
export function normalizeListingUrl(url: string | null | undefined): string | null {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const u = new URL(url);
    return `${u.host.toLowerCase().replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '').toLowerCase()}`;
  } catch { return null; }
}

function rawListingUrls(card: GroupedSearchProduct): string[] {
  const out: string[] = [];
  for (const s of card.stores) {
    const n = normalizeListingUrl(s.listing_url ?? (s.product_url?.startsWith('http') ? s.product_url : null));
    if (n) out.push(`${storeKey(s)}|${n}`);
  }
  return out;
}

/** Which card should represent a same-listing group: the one that can be COMPARED (carries a
 *  TPS identity key), else the one that can be routed (a product_slug), else the first. */
function pickRepresentative(group: GroupedSearchProduct[]): GroupedSearchProduct {
  return group.find((c) => !!c.tps_identity_key) ?? group.find((c) => !!c.product_slug) ?? group[0];
}

function mergeSameListingGroup(group: GroupedSearchProduct[]): GroupedSearchProduct {
  const rep = pickRepresentative(group);
  const merged = mergeCards([rep, ...group.filter((c) => c !== rep)]);
  // mergeCards picks its metadata by price; for a SAME-LISTING group the identity-bearing
  // card must stay the representative (its compare URL is the shopper's real destination).
  return { ...merged, ...pickRepresentativeFields(rep) };
}

function pickRepresentativeFields(rep: GroupedSearchProduct) {
  return {
    name_ar: rep.name_ar, name_en: rep.name_en, brand: rep.brand, image_urls: rep.image_urls,
    product_id: rep.product_id, product_slug: rep.product_slug, tps_identity_key: rep.tps_identity_key,
    tps_compare_url: rep.tps_compare_url, has_tps_comparison: rep.has_tps_comparison, category: rep.category,
  };
}

/**
 * ADR-387 — two evidence lanes that need no database:
 *   1. SAME LISTING: cards sharing a (store, normalized listing URL) pair are one merchant
 *      listing rendered twice (a storefront `products` row and a TPS canonical, or a TPS
 *      canonical and an Algolia hit). Live case: «مكيف سامسونج 18000» → three cards, one
 *      Extra URL `/p/100226575`.
 *   2. IDENTITY-LESS SHADOW: `canonical_products` rows with NO `tps_identity_key` (the
 *      discover-firecrawl "memory" writer creates one per product name — 9,882 active rows,
 *      2026-09-26) surface as cards with no compare URL and often no exit. One whose
 *      `name_ar`/`name_en` is EXACTLY another card's is that card's shadow (the writer keys
 *      them on `name_ar` equality) and is folded into it — never a fuzzy title match.
 * Store-neutral: only WHICH cards merge changes; prices/order are recomputed by the same
 * rules as every other merge.
 */
export function mergeSameListingCards(products: GroupedSearchProduct[]): GroupedSearchProduct[] {
  if (products.length < 2) return products;
  // Union-find over cards by shared listing keys.
  const parent = products.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };

  const byListing = new Map<string, number>();
  products.forEach((card, i) => {
    for (const k of rawListingUrls(card)) {
      const j = byListing.get(k);
      if (j == null) byListing.set(k, i); else union(i, j);
    }
  });
  const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
  const byName = new Map<string, number>();
  products.forEach((card, i) => {
    for (const n of [norm(card.name_ar), norm(card.name_en)]) {
      if (!n) continue;
      const j = byName.get(n);
      if (j == null) { byName.set(n, i); continue; }
      // Only an identity-less canonical card is a "shadow" — two identity-bearing cards with
      // the same title are left alone (a title is not identity).
      if (!card.tps_identity_key || !products[j].tps_identity_key) union(i, j);
    }
  });

  const groups = new Map<number, GroupedSearchProduct[]>();
  products.forEach((card, i) => { const r = find(i); const g = groups.get(r); if (g) g.push(card); else groups.set(r, [card]); });
  if (groups.size === products.length) return products;
  const out: GroupedSearchProduct[] = [];
  const emitted = new Set<number>();
  products.forEach((_, i) => {
    const r = find(i);
    if (emitted.has(r)) return;
    emitted.add(r);
    const g = groups.get(r)!;
    out.push(g.length === 1 ? g[0] : mergeSameListingGroup(g));
  });
  return out;
}

/**
 * Merges search-result cards that are VERIFIED to be the same real-world product
 * (a different `products.id` each, per `storefront_identity_links`), and collapses
 * any remaining same-store duplicates on every card. Fails closed to the original,
 * un-merged (but still store-deduped) list on any error.
 */
export async function mergeVerifiedCanonicalSearchResults(
  input: GroupedSearchProduct[],
): Promise<GroupedSearchProduct[]> {
  // ADR-387: the no-database lanes run first, so a verified-link group below can still
  // absorb whatever they produced.
  const products = mergeSameListingCards(input);
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
