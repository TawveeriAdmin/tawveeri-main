// src/lib/retailers/exit-url.ts
//
// Repairs known-broken retailer URL SHAPES on the way out. Read-side only: evidence is
// never rewritten, and removing this file restores the previous behaviour exactly.
//
// MEASURED (2026-07-29, production):
//   Almanea serves one product under two path shapes —
//     m.dev-almanea.com/<slug>-p-<id>            → 200 (the shape we ingest, 22,010 rows)
//     www.almanea.sa/<locale>/product/p-<id>     → 200 (the live canonical shape)
//   but the dev-host SLUG shape does not exist on the LIVE host:
//     www.almanea.sa/<slug>-p-<id>               → 404
//   and `product_stores` holds 280 of those, i.e. 21.6% of Almanea's 1,298 storefront
//   offers are dead links. The same product id resolves at the canonical shape:
//   .../aukey-...-p-170114809999007 → 404, /ar/product/p-170114809999007 → 200 (verified).
//
// This is the whole of the harness's recurring `شاحن → outbound DEAD: HTTP 404`. It is a
// deterministic shape defect, not link rot, so it is repaired by rewriting rather than
// detected by crawling — a health check would only have told us what we already know,
// one sample at a time.
//
// NOTE ON SCOPE: the `/go` exit path is NOT affected (0 live-host legacy rows there); the
// defect is confined to the storefront card's direct `product_url`. The related IDENTITY
// defect — the same two shapes producing two listing keys — is ADR-134's deferred item and
// is deliberately untouched here, because that one needs a serialized facts rebuild.

/** `www.almanea.sa/<slug>-p-<id>` 404s; `/{locale}/product/p-<id>` is the live shape. */
const ALMANEA_LIVE_LEGACY = /^https?:\/\/(?:www\.)?almanea\.sa\/(?!(?:ar|en)\/)[^?#]*-p-(\d{6,})/i;

/**
 * Rewrite a retailer URL to a shape that actually resolves, when we have measured that
 * the stored shape does not. Anything unrecognised is returned untouched — a URL we have
 * not proven broken is left exactly as ingested.
 */
export function normalizeExitUrl(url: string | null | undefined, locale: 'ar' | 'en' = 'ar'): string | null {
  if (!url || typeof url !== 'string') return url ?? null;

  const almanea = ALMANEA_LIVE_LEGACY.exec(url);
  if (almanea) {
    return `https://www.almanea.sa/${locale === 'en' ? 'en' : 'ar'}/product/p-${almanea[1]}`;
  }

  return url;
}
