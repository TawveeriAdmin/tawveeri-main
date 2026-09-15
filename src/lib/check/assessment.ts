import { classifyCondition, type MerchantCondition } from '@/lib/campaigns/condition';
import { computePriceVerdict, type PricePoint } from '@/lib/intelligence/price-intelligence';
import { isFreshObservation } from '@/lib/intelligence/evidence-engine';

export interface CheckOffer {
  store: string; storeName: string; title: string; price: number;
  observedAt: string | null; condition: MerchantCondition; href: string | null;
  source: boolean; availability: string | null; stale: boolean;
}
export type HistoryLabel = 'insufficient' | 'lowest' | 'near_low' | 'above_typical' | 'typical';

/** A lower price alone never proves an equivalent commercial offer. */
export function comparableDescription(a: CheckOffer, b: CheckOffer): boolean {
  const normalized = (v: string) => v.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  return a.condition !== 'UNKNOWN' && a.condition === b.condition && normalized(a.title) === normalized(b.title);
}

export function summarizeOffers(offers: CheckOffer[]) {
  // Price only; deterministic non-commercial tie break. No affiliate policy imported.
  const ordered = [...offers].sort((a, b) => a.price - b.price || a.store.localeCompare(b.store));
  const source = ordered.find(o => o.source);
  const eligible = (o: CheckOffer) => isFreshObservation(o.observedAt) && Date.parse(o.observedAt!) <= Date.now() && o.availability === 'in_stock';
  const cheaper = source && eligible(source) ? ordered.filter(o => !o.source && eligible(o) && o.price < source.price && comparableDescription(source, o)) : [];
  const conditionDifference = !!source && source.condition !== 'UNKNOWN' && ordered.some(o => o.condition !== 'UNKNOWN' && o.condition !== source.condition);
  return { offers: ordered, cheaperCount: cheaper.length, conditionDifference };
}

export function assessCheckHistory(points: PricePoint[], price: number, observedAt: string | null, now = Date.now()): { label: HistoryLabel; days: number } {
  const valid = points.filter(p => Number.isFinite(new Date(p.at).getTime()) && new Date(p.at).getTime() <= now && Number(p.price) > 0);
  const verdict = computePriceVerdict(valid, now);
  // Reuse the existing evidence engine; sparse, stale or mismatched history gets no claim.
  if (!isFreshObservation(observedAt, now) || Date.parse(observedAt!) > now || !verdict.confident || verdict.currentBest !== price) return { label: 'insufficient', days: verdict.distinctDays };
  const label: HistoryLabel = verdict.isObservedLow
    ? (price === verdict.observedLow ? 'lowest' : 'near_low')
    : verdict.verdict === 'elevated' ? 'above_typical' : 'typical';
  return { label, days: verdict.distinctDays };
}

export { classifyCondition };
