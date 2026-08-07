export interface AffiliateParam {
  enabled?: boolean;
  param: string;
  value: string;
}

// ADR-225 (2026-08-07): widened from a single {param,value} to an array. Verification
// found this legacy exit path is NOT dead code — it's the path search-client.tsx's
// ProductCard and StoreComparisonPanel use, one of the highest-traffic customer surfaces
// in the app — and it was carrying only `utm_source`, while every piece of real evidence
// for Noon's program (ADR-224) shows utm_source/utm_medium/utm_campaign/adjust_deeplink_js
// always appearing together. A single param here was a real, measurable attribution-leak
// risk on a major traffic path, not just an ADR-224-noted parity gap. Mirrors the governed
// Provider Registry's own `param` network shape (src/lib/providers/types.ts's
// AffiliateConfig.params[]) rather than inventing a new one.
export type AffiliateConfig = AffiliateParam[] | null;

export const DEFAULT_STORE_AFFILIATE_CONFIG: Record<string, AffiliateParam[]> = {
  amazon: [{ param: 'tag', value: 'tawveeri0f-21' }],
  // ADR-224: two real "Generate Custom Link" links from the dashboard's Everyday
  // Campaign (different products) both carried this exact set; C1000094L (ADR-181) was
  // on neither. Kept identical to the governed `/go` path's noon config (registry.ts) —
  // one set of values, two enforcement points, per ADR-225.
  noon: [
    { param: 'utm_source', value: 'C1000264L' },
    { param: 'utm_medium', value: 'AFFfbc721aa80c8' },
    { param: 'utm_campaign', value: 'CMP2ce0b63a6a1anoon' },
    { param: 'adjust_deeplink_js', value: '1' },
  ],
};

/** Accepts a single {param,value} object (legacy DB shape) or an array of them. */
export function normalizeAffiliateConfig(input: unknown): AffiliateConfig {
  if (!input) return null;
  const list = Array.isArray(input) ? input : [input];
  const params: AffiliateParam[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Partial<AffiliateParam>;
    const param = typeof raw.param === 'string' ? raw.param.trim() : '';
    const value = typeof raw.value === 'string' ? raw.value.trim() : '';
    if (!param || !value) continue;
    const enabled = typeof raw.enabled === 'boolean' ? raw.enabled : true;
    params.push({ param, value, enabled });
  }
  return params.length ? params : null;
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
 * Append the store's affiliate parameters to a product URL. No-op when the store
 * slug has no configured affiliate program, when the URL is invalid, or per-param
 * when that exact param is already present (don't clobber an explicit one).
 */
export function applyAffiliateTag(
  baseUrl: string | null | undefined,
  storeSlug: string | null | undefined,
  affiliateConfig?: unknown,
): string | null {
  if (!baseUrl) return null;

  const params = getAffiliateConfig(storeSlug, affiliateConfig);
  if (!params || !params.length) return baseUrl;

  try {
    const url = new URL(baseUrl);
    for (const p of params) {
      if (p.enabled === false) continue;
      if (url.searchParams.has(p.param)) continue;
      url.searchParams.set(p.param, p.value);
    }
    return url.toString();
  } catch {
    // Invalid URL — fall back to manual concat so we don't break the click.
    let out = baseUrl;
    for (const p of params) {
      if (p.enabled === false) continue;
      const separator = out.includes('?') ? '&' : '?';
      out = `${out}${separator}${encodeURIComponent(p.param)}=${encodeURIComponent(p.value)}`;
    }
    return out;
  }
}
