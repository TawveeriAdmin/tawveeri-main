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

/** SKU is the selected PDP variant; a URL slug is not identity evidence. */
export function hasAmazonAsinConflict(url: string | null | undefined, sku: unknown): boolean {
  const requested = asinFromUrl(url);
  return !!requested && typeof sku === 'string' && isAsin(sku) && requested !== sku.toUpperCase();
}

/**
 * ADR-408: the normalizer refuses a captured Amazon row (store 2) whose URL ASIN differs from the ASIN of the page that was
 * described, in EVERY category. Colour, size, capacity, chip, connectivity and model-year variants share one parent, and the
 * page serves whichever child it selected - so the title/price/specs belong to the SKU, not to the URL.
 */
export const AMAZON_STORE_ID = 2;
export function isAmazonAsinConflictRow(storeId: number | string | null | undefined, url: string | null | undefined, sku: unknown): boolean {
  return Number(storeId) === AMAZON_STORE_ID && hasAmazonAsinConflict(url, sku);
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
