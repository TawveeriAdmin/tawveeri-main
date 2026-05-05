export interface AffiliateParam {
  enabled?: boolean;
  param: string;
  value: string;
}

export type AffiliateConfig = AffiliateParam | null;

export const DEFAULT_STORE_AFFILIATE_CONFIG: Record<string, AffiliateParam> = {
  amazon: { param: 'tag', value: 'tawveeri-21' },
  noon: { param: 'aff_code', value: 'DNC160' },
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
