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
 * The DEV-HOST shape (ADR-259, measured 2026-08-18).
 *
 * Almanea's Algolia index ships `m.dev-almanea.com/<slug>-p-<id>` and it reached the
 * consumer exit path: 49,918 normalized observations carry that host (1,048 observed in
 * the last 72h), and `/go` resolves its destination straight from that row. The 2026-07-29
 * note above recorded `/go` as unaffected — that was true of the LIVE-host legacy shape it
 * was written for, and is not true of the dev host.
 *
 * Two reasons this is repaired rather than tolerated, both measured on 8 real production
 * URLs: the dev host already 404s on 2 of the 8 (Tawveeri is sending Saudi shoppers to
 * dead pages today), and the canonical shape resolved 200 on 8 of 8. Beyond the dead
 * links, a merchant's development host is not a destination we may knowingly hand a
 * consumer — it can change or disappear without notice and it is not where the merchant
 * sells.
 *
 * 99.9% of these rows carry the `-p-<id>` key (49,867 of 49,918), so the rewrite is
 * deterministic. The remainder cannot be mapped and are refused at the exit rather than
 * guessed at — unknown beats incorrect.
 */
const ALMANEA_DEV_HOST = /^https?:\/\/(?:[a-z0-9-]+\.)*dev-almanea\.com\/[^?#]*-p-(\d{6,})/i;

/**
 * Hosts that are a merchant's development/staging environment rather than the storefront
 * they actually sell from. A consumer exit must never land on one.
 */
const NON_PRODUCTION_HOST = /^https?:\/\/[^/]*(?:\bdev[-.]|^dev\.|\.dev\.|staging[-.]|\.staging\.|\.test\.)/i;

/**
 * True when a URL still points at a non-production merchant host after normalization.
 * Callers on the exit path should refuse rather than redirect. Kept separate from
 * `normalizeExitUrl` so the decision to BLOCK is explicit at the call site.
 */
export function isNonProductionExitUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  return NON_PRODUCTION_HOST.test(url);
}

/**
 * Rewrite a retailer URL to a shape that actually resolves, when we have measured that
 * the stored shape does not. Anything unrecognised is returned untouched — a URL we have
 * not proven broken is left exactly as ingested.
 */
export function normalizeExitUrl(url: string | null | undefined, locale: 'ar' | 'en' = 'ar'): string | null {
  if (!url || typeof url !== 'string') return url ?? null;

  const loc = locale === 'en' ? 'en' : 'ar';

  const almanea = ALMANEA_LIVE_LEGACY.exec(url);
  if (almanea) {
    return `https://www.almanea.sa/${loc}/product/p-${almanea[1]}`;
  }

  const almaneaDev = ALMANEA_DEV_HOST.exec(url);
  if (almaneaDev) {
    return `https://www.almanea.sa/${loc}/product/p-${almaneaDev[1]}`;
  }

  return url;
}
