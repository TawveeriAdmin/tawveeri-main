// One bounded metadata-only request before REST-dependent work. A failed
// dependency must not start a full-history refresh via a still-working pooler.
const REST_JOBS = new Set(['refresh', 'price_update', 'discovery', 'manual_trigger', 'product_recovery', 'dispatch_sweep']);

export interface RestAdmission { allowed: boolean; reason: 'ready' | 'quota' | 'unavailable' | 'unconfigured' | 'independent'; }

export function createRestAdmission(fetcher: typeof fetch, now: () => number = Date.now) {
  let cached: { url: string; until: number; result: RestAdmission } | null = null;
  return async (job: string, url?: string, key?: string): Promise<RestAdmission> => {
    if (!REST_JOBS.has(job)) return { allowed: true, reason: 'independent' };
    if (!url || !key) return { allowed: false, reason: 'unconfigured' };
    if (cached?.url === url && now() < cached.until) return cached.result;
    let result: RestAdmission;
    try {
      const endpoint = new URL('/rest/v1/stores?select=id&limit=1', url);
      const response = await fetcher(endpoint, {
        method: 'HEAD', redirect: 'error',
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(5000),
      });
      result = response.ok ? { allowed: true, reason: 'ready' }
        : { allowed: false, reason: response.status === 402 ? 'quota' : 'unavailable' };
    } catch { result = { allowed: false, reason: 'unavailable' }; }
    cached = { url, until: now() + (result.reason === 'quota' ? 300000 : 30000), result };
    return result;
  };
}
