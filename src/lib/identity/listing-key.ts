// src/lib/identity/listing-key.ts
// ─────────────────────────────────────────────────────────────────────────────
// STABLE LISTING IDENTITY (ADR-058) — the same key-integrity invariant as
// store-identifiers.ts, applied to price CONTINUITY rather than product identity.
//
// A "listing" is one store selling one thing at one place. It is the substrate
// for price history, Discount Integrity and Merchant Trust, and it must remain
// the SAME key across every scrape — otherwise history can never accumulate.
//
// PRODUCTION EVIDENCE (2026-07-23) that this was broken:
//   `build-listing-facts` keyed listings on the raw product URL. Amazon embeds
//   per-request session tracking in the URL PATH as well as the query string:
//     /dp/B0CVMTTDMM/ref=sr_1_1?dib=<session>&keywords=…&qid=<timestamp>&sr=8-1
//   so every scrape minted a brand-new listing. Measured result: Amazon had
//   2,422 listings with avg distinct_days = 1.00, max = 1, ZERO usable for any
//   verdict and ZERO verified drops — across 3 scrape days. Amazon's price
//   intelligence was structurally incapable of ever existing.
//
//   Jarir 2,959 listings @ avg 5.86 days and Extra 5,104 @ 5.48 were unaffected
//   (stable URLs), which is why the defect stayed invisible in aggregate.
//
// Note this corrects ADR-048's recorded diagnosis ("Jarir/Amazon payloads use a
// different listing key"). Jarir works; Amazon's problem is URL instability.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Query parameters that carry session/campaign state, never listing identity.
 *
 * PRECISION RULE (Constitution principle 6 — a wrong merge corrupts, a missed
 * one merely defers): a parameter is stripped ONLY when it is unambiguously
 * campaign or session state. Anything that might select a product VARIANT is
 * preserved, because merging two variants into one listing would blend the
 * prices of genuinely different SKUs.
 *
 * Specifically NOT stripped, despite appearing in the scraper's display-URL
 * tracking list: `childSku` — Jarir uses it to select the variant of a parent
 * product page (`…apple-ipad-a16-tablet-pc-jpm1424.html?childSku=654165`).
 * Stripping it merged 89 Jarir listings in a dry run; that would have been a
 * silent price corruption.
 */
const VOLATILE_QUERY_PARAMS = new Set([
  // campaign / attribution
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "utm_id", "gclid", "fbclid", "srsltid", "ref", "ref_",
  // Amazon search-session state (the direct cause of the measured defect)
  "dib", "dib_tag", "qid", "sr", "keywords", "sprefix", "crid",
  // generic campaign
  "spm", "campaign",
]);

/**
 * Store-specific extractors for a durable product identifier embedded in the
 * URL. When one matches it becomes the listing key outright, which is strictly
 * more stable than any URL normalisation.
 */
const URL_PRODUCT_ID: { store: string; pattern: RegExp }[] = [
  { store: "amazon", pattern: /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i },
  { store: "noon", pattern: /\/([NZ][A-Z0-9]{8,})\/p\//i },
  { store: "jarir", pattern: /\/(\d{6,})\.html/i },
];

/**
 * Remove volatile query parameters and Amazon-style `/ref=…` path segments,
 * lowercase the host, and drop the fragment. Returns the input unchanged when
 * it cannot be parsed as a URL — never throws.
 */
export function canonicalListingUrl(rawUrl: string): string {
  const raw = rawUrl.trim();
  if (!raw) return raw;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw;
  }

  for (const key of [...u.searchParams.keys()]) {
    if (VOLATILE_QUERY_PARAMS.has(key.toLowerCase())) u.searchParams.delete(key);
  }
  // Amazon puts tracking in the PATH (`/dp/B0…/ref=sr_1_1`), which query-param
  // stripping alone cannot reach.
  u.pathname = u.pathname.replace(/\/ref=[^/]*/gi, "").replace(/\/{2,}/g, "/");
  u.hash = "";
  u.host = u.host.toLowerCase();
  u.searchParams.sort();

  let out = u.toString();
  // Normalise a trailing slash so `/p/x` and `/p/x/` are one listing.
  out = out.replace(/\/(\?|$)/, "$1");
  return out;
}

/**
 * The durable identity of a listing: `<storeId>::<durable-product-id-or-url>`.
 *
 * Prefers a product identifier embedded in the URL (Amazon ASIN, Noon code,
 * Jarir numeric id) because those survive any amount of session noise; falls
 * back to the canonicalised URL. Returns null when no URL is available — the
 * caller must skip the row rather than invent a key.
 */
export function stableListingKey(
  storeId: number | string,
  rawUrl: string | null | undefined,
  storeSlug?: string | null
): string | null {
  const raw = (rawUrl ?? "").trim();
  if (!raw) return null;

  for (const { store, pattern } of URL_PRODUCT_ID) {
    if (storeSlug && storeSlug !== store) continue;
    const m = pattern.exec(raw);
    if (m) return `${storeId}::${store}:${m[1].toUpperCase()}`;
  }
  return `${storeId}::${canonicalListingUrl(raw)}`;
}
