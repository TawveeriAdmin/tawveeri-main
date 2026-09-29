import type { PriceUpdateResult } from '../base/types';

/** No work is a successful check, not evidence of refreshed prices. */
export function priceUpdateOutcome(result: Pick<PriceUpdateResult, 'success' | 'products_updated' | 'errors' | 'deferred_quota_stores' | 'stages'>): 'success' | 'partial' | 'failed' {
  if (!result.success) return 'failed';
  const incomplete = result.errors > 0 || !!result.deferred_quota_stores?.length || (result.stages?.product_only ?? 0) > 0;
  if (!incomplete) return 'success';
  return result.products_updated > 0 || (result.stages?.product_only ?? 0) > 0 ? 'partial' : 'failed';
}
