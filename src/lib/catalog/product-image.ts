// src/lib/catalog/product-image.ts
// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT IMAGE SELECTION (ADR-063)
//
// Measured on production 2026-07-23: **0 of 1,215 products in the serving
// projection had an image**, while **100% of raw observations carried image
// evidence**. The projection builder simply never read it. Every product card,
// every search result and every comparison rendered with no picture — for a
// shopping platform that is close to unusable, and it is a pure propagation
// gap, not missing data.
//
// Stores publish images in three different payload fields and two different
// shapes (a JSON-array string, or a bare string), so parsing is defensive.
// Real production shapes:
//   jarir    image_urls  ["https://ak-asset.jarir.com/...jpg"]
//   amazon   image_urls  ["https://m.media-amazon.com/images/I/...._AC_UL320_.jpg"]
//   extra    imageUrl    ["https://media.extra.com/s/aurora/...?locale=en"]
//   almanea  image_url   https://imgs.dev-almanea.com/media/catalog/...jpg
//   swsg     image_urls  ["https://swsg.co/data:image/png;base64,iVBOR..."]  ← placeholder
//
// SWSG serves a base64 1×1 lazy-loading placeholder rather than a real image;
// rendering it would show an empty box that looks like a broken product. Such
// values are rejected — no image is better than a fake one (Constitution:
// unknown beats incorrect).
//
// NOTE on Almanea: its images are served from `imgs.dev-almanea.com`. That looks
// like a mistake but was VERIFIED to return HTTP 200, while the plausible
// production host `imgs.almanea.sa` does not resolve at all. Rewriting the host
// would have broken every Almanea image, so the host is used as published and
// recorded as supplier risk.
// ─────────────────────────────────────────────────────────────────────────────

/** One store's image evidence for a product. */
export interface ImageCandidate {
  /** Raw payload value: JSON-array string, array, or bare URL string. */
  raw: unknown;
  /** Lower price ⇒ preferred, so the picture matches the headline offer. */
  price?: number | null;
}

/**
 * Hosts verified to serve product imagery.
 *
 * MUST stay a subset of `images.remotePatterns` in `next.config.ts` — Next.js
 * refuses to optimise an image from an unlisted host, so accepting one here
 * would store a URL that renders as a broken image. Adding a host means adding
 * it in BOTH places.
 *
 * `swsg.co` is deliberately absent: SWSG publishes only base64 lazy-load
 * placeholders today, and it is not in `remotePatterns`, so admitting it would
 * turn a future real image into a broken one.
 */
const KNOWN_IMAGE_HOSTS = [
  "ak-asset.jarir.com", "jarir.com",
  "m.media-amazon.com", "images-na.ssl-images-amazon.com", "amazon.sa",
  "media.extra.com", "extra.com",
  "imgs.dev-almanea.com", "almanea.com",
  "f.nooncdn.com", "nooncdn.com", "noon.com",
  // Feed-store CDNs (ADR-113) — all present in next.config remotePatterns. Without these,
  // every Salla/Zid/Woo/Shopify product rendered imageless despite carrying a valid image
  // (the presentation build host-rejected them). Base domains → subdomains match via endsWith.
  "salla.sa",         // cdn.salla.sa — Salla stores (najm/hdf/alnakheelk/alsfeerzone/alhowaish/…)
  "zid.store",        // media.zid.store — Zid stores (aletawik/pcpalace/amnkwm/alduaalbarq)
  "shakersa.com",     // shaker (WooCommerce)
  "mhzm.sa",          // shop.mhzm.sa — mhzm (WooCommerce)
  "shopify.com",      // cdn.shopify.com — Shopify stores (Sony World)
  "samsung.com",      // images.samsung.com — Samsung KSA
];

/** Extract every candidate URL string from a payload value of any shape. */
function toUrlList(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.flatMap(toUrlList);
  if (typeof raw !== "string") return [];
  const s = raw.trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.flatMap(toUrlList);
    } catch {
      /* fall through — treat as a plain string */
    }
  }
  return [s];
}

/**
 * True when a URL is a real, renderable product image.
 *
 * Rejects base64/data payloads (SWSG's lazy-load placeholder is literally
 * `https://swsg.co/data:image/png;base64,...`), non-http(s) schemes, and hosts
 * we have not verified — an unverified host renders as a broken image, which
 * damages trust more than showing none.
 */
export function isUsableImageUrl(value: string): boolean {
  const s = (value || "").trim();
  if (!s) return false;
  if (/^data:/i.test(s)) return false;
  if (/data:image\/|;base64,/i.test(s)) return false;   // placeholder smuggled into a path
  if (!/^https?:\/\//i.test(s)) return false;
  let host: string;
  try { host = new URL(s).hostname.toLowerCase(); } catch { return false; }
  if (!KNOWN_IMAGE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return false;
  // A real image URL has a path; a bare host is not an image.
  try { if (new URL(s).pathname.replace(/\/+$/, "") === "") return false; } catch { return false; }
  return true;
}

/**
 * Choose the single best image for a product from its offers' evidence.
 *
 * Preference order: the cheapest offer's image first, because the card's
 * headline price comes from that offer and a mismatched picture misleads.
 * Returns null when no candidate is usable — the caller must render a proper
 * empty state rather than a broken image.
 */
export function pickProductImage(candidates: ImageCandidate[]): string | null {
  const ordered = [...candidates].sort((a, b) => {
    const pa = a.price ?? Number.POSITIVE_INFINITY;
    const pb = b.price ?? Number.POSITIVE_INFINITY;
    return pa - pb;
  });
  for (const c of ordered) {
    for (const url of toUrlList(c.raw)) {
      const trimmed = url.trim();
      if (isUsableImageUrl(trimmed)) return trimmed;
    }
  }
  return null;
}

/** Exposed for tests and for diagnosing a store's image quality. */
export const __internal = { toUrlList, KNOWN_IMAGE_HOSTS };
