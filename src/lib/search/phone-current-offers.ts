import { isFreshObservation } from '@/lib/intelligence/evidence-engine';
import { isDisplayableRetailer, resolveApprovedSlug } from '@/lib/retailers/approved-retailers';
import { phoneCondition, phoneConditionPool } from './phone-condition';
import { isPhoneAccessoryTitle } from './phone-model-intent';

export interface PhoneCurrentOffer {
  identity_key: string; store_id: number; raw_obs_id: number | string;
  status: string; name: string; price: number; observed_at: string;
  payload: { _availability?: string; _identity_quarantine?: string; _superseded_by_identity?: string } | null;
}

export function eligiblePhoneCurrentOffers(rows: PhoneCurrentOffer[]): PhoneCurrentOffer[] {
  return phoneConditionPool(rows.filter(row => row.status === 'valid'
    && !isPhoneAccessoryTitle(row.name)
    && !row.payload?._identity_quarantine && !row.payload?._superseded_by_identity
    && isDisplayableRetailer(resolveApprovedSlug(row.store_id) ?? '')
    && Number.isFinite(Number(row.price)) && Number(row.price) > 0
    && ['in_stock', 'limited_stock', 'pre_order'].includes(row.payload?._availability ?? '')
    && isFreshObservation(row.observed_at)), row => phoneCondition(row.name));
}

/** Indexed current-state reads only, bounded batches; no observation/history scans. */
export async function loadPhoneOfferPools(client: unknown, keys: string[]): Promise<Map<string, PhoneCurrentOffer[]>> {
  const db = client as { from(table: string): { select(columns: string): { eq(column: string, value: string): { in(column: string, values: string[]): Promise<{ data: PhoneCurrentOffer[] | null; error: unknown }> } } } };
  const result = new Map<string, PhoneCurrentOffer[]>();
  const unique = [...new Set(keys)];
  for (let i = 0; i < unique.length; i += 40) {
    const slice = unique.slice(i, i + 40);
    const { data, error } = await db.from('tps_current_offers')
      .select('identity_key,store_id,raw_obs_id,status,name,price,observed_at,payload').eq('category', 'mobile').in('identity_key', slice);
    if (error) continue; // Unknown evidence never backs a price claim.
    for (const key of slice) result.set(key, eligiblePhoneCurrentOffers((data ?? []).filter(row => row.identity_key === key)));
  }
  return result;
}
