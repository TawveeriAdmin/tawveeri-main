// scripts/tps-core/url-util.ts
// Shared offer-URL selection for TPS matchers. Stores expose several URL fields;
// some (Extra `urlAr`/`urlEn`) are ROOT-RELATIVE and drop the locale prefix, so
// `new URL()` in /go throws (500) or the resolved path 404s. The absolute
// `productUrl`/`product_url` is authoritative when present. Prefer any absolute
// (http) URL; fall back to the first non-empty value only if none is absolute.
const asStr = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export function pickBestUrl(p: Record<string, unknown>): string | null {
  const candidates = [p.productUrl, p.product_url, p.urlEn, p.urlAr, p.url, p.link, p.href, p.canonicalUrl]
    .map(asStr)
    .filter((v): v is string => !!v);
  const absolute = candidates.find((u) => /^https?:\/\//i.test(u));
  return absolute ?? candidates[0] ?? null;
}
