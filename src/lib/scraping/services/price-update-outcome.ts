import type { PriceUpdateResult } from '../base/types';

/** No work is a successful check, not evidence of refreshed prices. */
export function priceUpdateOutcome(result: Pick<PriceUpdateResult, 'success' | 'products_updated' | 'errors' | 'deferred_quota_stores' | 'stages'>): 'success' | 'partial' | 'failed' {
  if (!result.success) return 'failed';
  // F-003/F-004 (2026-09-29): `stages.deferred` was not consulted here, so a run that
  // stopped early and left products unchecked — the budget self-deadline added to
  // `runPriceUpdateJob`, or any other deferral that records `stages.deferred` without a
  // `deferred_quota_stores` entry — could still report a clean `success`, i.e. claim the
  // whole selected batch was checked when part of it was never attempted. Deferred work is
  // incomplete work: not an error, but not success either.
  const incomplete = result.errors > 0 || !!result.deferred_quota_stores?.length
    || (result.stages?.product_only ?? 0) > 0 || (result.stages?.deferred ?? 0) > 0;
  if (!incomplete) return 'success';
  return result.products_updated > 0 || (result.stages?.product_only ?? 0) > 0 ? 'partial' : 'failed';
}
