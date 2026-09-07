// src/lib/scraping/services/slugify.ts
// ─────────────────────────────────────────────────────────────────────────────
// SHARED SLUG AUTHORITY — extracted from ProductService (2026-09-07, product-
// creation architecture audit).
//
// products.slug is a customer-facing URL/routing field (VARCHAR/text, NOT NULL,
// no default, no DB trigger) — it is NOT product identity. Identity is
// canonical_product_id (TPS layer) / products.id; products.name_ar carries the
// DB's own UNIQUE constraint used for exact-match dedup. Every INSERT into
// `products` must supply slug explicitly, or the insert fails.
//
// PROVEN DEFECT this fixes: `discover-firecrawl/route.ts`'s own separate,
// duplicate `saveProducts()` insert never set slug at all, so every one of its
// scheduled runs — every 6 hours, for all 4 merchants it serves (Almanea,
// Extra, Jarir, Amazon), since the pg_cron mechanism's inception (2026-07-21,
// ADR-009) — has created ZERO net-new products (739/739 scheduled runs, 100%
// failure, silently: the run's own status still reports "success" since only
// the per-item DB error was caught and swallowed). `ProductService.createProduct()`
// (used by the healthy `discover-products`/ScrapingOrchestrator path) already
// generates a correct, deterministic, collision-handled slug — this module
// extracts exactly that logic so both callers share one authority instead of
// discover-firecrawl growing its own duplicate (which is what caused the gap
// in the first place: a name-based candidate list + retry loop, matching
// products.slug's actual role — never the other way around).
// ─────────────────────────────────────────────────────────────────────────────

/** Deterministic base slug from a product name. Never returns an empty string
 * for non-empty input; callers must still handle a genuinely empty name. */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Short, URL-safe suffix derived from a merchant SKU/external id, used to
 * disambiguate two products that would otherwise generate the same base slug. */
export function slugSuffixFromSku(sku: string): string {
  return sku.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
}

/** Ordered slug candidates for a new product: base name, base+SKU-suffix,
 * base+random-suffix — matches ProductService.createProduct()'s existing,
 * already-proven retry-on-conflict shape. Falls back to a timestamp-based slug
 * only when the name itself slugifies to nothing (e.g. a title with no Latin
 * or digit characters at all) — `Unknown beats incorrect`-adjacent: never an
 * empty, NOT-NULL-violating string, but never a fabricated product name either. */
export function slugCandidates(name: string, sku?: string | null): string[] {
  const baseSlug = generateSlug(name) || `product-${Date.now()}`;
  return [
    baseSlug,
    sku ? `${baseSlug}-${slugSuffixFromSku(sku)}` : null,
    `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`,
  ].filter((s): s is string => !!s);
}
