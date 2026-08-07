export interface AffiliateParam {
  enabled?: boolean;
  param: string;
  value: string;
}

export type AffiliateConfig = AffiliateParam | null;

export const DEFAULT_STORE_AFFILIATE_CONFIG: Record<string, AffiliateParam> = {
  amazon: { param: 'tag', value: 'tawveeri0f-21' },
  // ADR-224 (2026-08-07) superseded ADR-181's C1000094L: two real "Generate Custom Link"
  // links from the dashboard's Everyday Campaign (different products) both carried
  // C1000264L instead, with C1000094L on neither. This legacy single-param path (unlike
  // the Provider Registry's `param` network, ADR-085) can only carry ONE query param, so
  // it carries utm_source alone — the same account-identifying value the governed `/go`
  // path leads its own param list with. A known, accepted limitation: a customer exiting
  // through this legacy card/detail-page path gets weaker attribution (missing
  // utm_medium/utm_campaign/adjust_deeplink_js) than one exiting through `/go`, which is
  // still correct-if-partial rather than wrong, and unchanged in shape from before this fix.
  noon: { param: 'utm_source', value: 'C1000264L' },
};

export function normalizeAffiliateConfig(input: unknown): AffiliateConfig {
  if (!input || typeof input !== 'object') return null;

  const raw = input as Partial<AffiliateParam>;
  const param = typeof raw.param === 'string' ? raw.param.trim() : '';
  const value = typeof raw.value === 'string' ? raw.value.trim() : '';
  const enabled = typeof raw.enabled === 'boolean' ? raw.enabled : true;

  if (!param || !value) return null;
  return { enabled, param, value };
}

export function getAffiliateConfig(
  storeSlug: string | null | undefined,
  affiliateConfig?: unknown,
): AffiliateConfig {
  const configured = normalizeAffiliateConfig(affiliateConfig);
  if (configured) return configured;
  if (!storeSlug) return null;
  return DEFAULT_STORE_AFFILIATE_CONFIG[storeSlug] || null;
}

/**
 * Append the store's affiliate parameter to a product URL. No-op when the
 * store slug has no configured affiliate program, when the URL is invalid,
 * or when the same param is already present (don't clobber an explicit one).
 */
export function applyAffiliateTag(
  baseUrl: string | null | undefined,
  storeSlug: string | null | undefined,
  affiliateConfig?: unknown,
): string | null {
  if (!baseUrl) return null;

  const config = getAffiliateConfig(storeSlug, affiliateConfig);
  if (!config || config.enabled === false) return baseUrl;

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
