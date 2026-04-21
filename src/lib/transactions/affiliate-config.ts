/**
 * Per-store affiliate parameters, keyed by the `stores.slug` value.
 *
 * To update a code without a deploy we'd need a `stores.affiliate_config`
 * JSONB column + admin UI; that's deferred. For now edits here + redeploy.
 *
 * If Noon confirms a different query-param name for their partner program
 * (`aff_code` is an educated guess — the client supplied the value `DNC160`
 * without a param name), update `noon.param` and redeploy.
 */

export interface AffiliateParam {
  param: string;
  value: string;
}

export const STORE_AFFILIATE_CONFIG: Record<string, AffiliateParam> = {
  amazon: { param: 'tag', value: 'tawveeri-21' },
  noon: { param: 'aff_code', value: 'DNC160' },
};

/**
 * Append the store's affiliate parameter to a product URL. No-op when the
 * store slug has no configured affiliate program, when the URL is invalid,
 * or when the same param is already present (don't clobber an explicit one).
 */
export function applyAffiliateTag(
  baseUrl: string | null | undefined,
  storeSlug: string | null | undefined,
): string | null {
  if (!baseUrl) return null;
  if (!storeSlug) return baseUrl;

  const config = STORE_AFFILIATE_CONFIG[storeSlug];
  if (!config) return baseUrl;

  try {
    const url = new URL(baseUrl);
    if (url.searchParams.has(config.param)) {
      return url.toString();
    }
    url.searchParams.set(config.param, config.value);
    return url.toString();
  } catch {
    // Invalid URL — fall back to manual concat so we don't break the click.
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${encodeURIComponent(config.param)}=${encodeURIComponent(config.value)}`;
  }
}
