/**
 * Amazon identity helpers (ADR-396). One ASIN = one listing. Amazon serves the same
 * detail page for /dp/ASIN, /gp/product/ASIN and the long title-slug + `ref=sr_…`
 * search-result URLs; storing the long form made 12,321 storefront rows out of 6,273
 * ASINs. New amazon rows are persisted on the canonical form only.
 */
const ASIN_RE = /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?&#]|$)/i;

export function asinFromUrl(url: string | null | undefined): string | null {
  const m = (url ?? '').match(ASIN_RE);
  return m ? m[1].toUpperCase() : null;
}

export function isAsin(value: string | null | undefined): value is string {
  return /^[A-Z0-9]{10}$/i.test(value ?? '');
}

/** The affiliate tag is NOT part of the stored URL — `/go` adds it at exit time. */
export function canonicalAmazonUrl(asin: string): string {
  return `https://www.amazon.sa/dp/${asin.toUpperCase()}`;
}

/** Canonical form when the URL carries an ASIN, otherwise the input unchanged. */
export function canonicalizeAmazonUrl(url: string): string {
  const asin = asinFromUrl(url);
  return asin ? canonicalAmazonUrl(asin) : url;
}
