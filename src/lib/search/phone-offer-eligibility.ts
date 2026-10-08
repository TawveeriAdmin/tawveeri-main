import type { GroupedSearchProduct } from '@/lib/scraping/search/product-grouper';
import type { SearchProduct } from '@/lib/scraping/search/types';
import { isFreshObservation } from '@/lib/intelligence/evidence-engine';
import { resolveApprovedSlug } from '@/lib/retailers/approved-retailers';
import { phoneCondition, phoneConditionPool, phoneConditionLabel } from './phone-condition';
import { conflictingPhoneModels, isPhoneAccessoryTitle } from './phone-model-intent';

/** Phone search applies the canonical freshness policy to legacy offers too.
 * An unavailable installment-sized legacy price must never set a phone headline. */
export function eligiblePhoneCard(product: GroupedSearchProduct): (GroupedSearchProduct & Pick<SearchProduct, 'store' | 'store_name' | 'observed_at'>) | null {
  if (isPhoneAccessoryTitle(`${product.name_ar || ''} ${product.name_en || ''}`)) return null;
  const fresh = product.stores.filter((s): s is SearchProduct & { current_price: number } => typeof s.current_price === 'number' && Number.isFinite(s.current_price) && s.current_price > 0
    && ['in_stock', 'limited_stock', 'pre_order'].includes(s.availability)
    && isFreshObservation(s.observed_at)
    && !isPhoneAccessoryTitle(s.listing_name || `${s.name_ar || ''} ${s.name_en || ''}`)
    && !conflictingPhoneModels(product.name_en || product.name_ar || '', s.listing_name || s.name_en || s.name_ar || ''));
  const conditionOf = (s: SearchProduct) => s.phone_condition ?? phoneCondition(`${s.name_ar || ''} ${s.name_en || ''}`);
  const stores = phoneConditionPool(fresh, conditionOf).map(s => ({ ...s, phone_condition: conditionOf(s) }));
  if (!stores.length) return null;
  const best = stores.reduce((a, b) => b.current_price < a.current_price ? b : a);
  const count = new Set(stores.map(s => resolveApprovedSlug(s.store_name || s.store) || s.store)).size;
  return {
    ...product, stores, store_count: count,
    name_ar: `${product.name_ar || product.name_en || ''} — ${phoneConditionLabel(best.phone_condition, true)}`,
    name_en: `${product.name_en || product.name_ar || ''} — ${phoneConditionLabel(best.phone_condition, false)}`,
    best_price: best.current_price, current_price: best.current_price,
    original_price: best.original_price ?? null,
    availability: best.availability, observed_at: best.observed_at,
    store: best.store, store_name: best.store_name, product_url: best.product_url,
    has_tps_comparison: !!product.tps_identity_key && count >= 2,
    tps_compare_url: count >= 2 ? product.tps_compare_url : undefined,
  };
}
