import { resolveCondition, type ConditionEvidence, type MerchantCondition } from '@/lib/campaigns/condition';

/** Condition belongs to the merchant offer, never inherited from its canonical. */
export function phoneCondition(title: string, evidence?: Omit<ConditionEvidence, 'title'>): MerchantCondition {
  return resolveCondition({ ...evidence, title }).condition;
}

/** A price comparison may contain only one condition. Unknown is its own bucket,
 * never evidence of new. Prefer new, then unspecified, for an unqualified query. */
export function phoneConditionPool<T>(offers: T[], condition: (offer: T) => MerchantCondition): T[] {
  const selected = (['NEW', 'UNKNOWN', 'RENEWED', 'REFURBISHED', 'USED'] as const)
    .find(value => offers.some(offer => condition(offer) === value));
  return offers.filter(offer => condition(offer) === selected);
}

export function phoneConditionLabel(condition: MerchantCondition, ar: boolean): string {
  const labels = {
    NEW: ['جديد', 'New'], UNKNOWN: ['الحالة غير مؤكدة', 'Condition unconfirmed'],
    RENEWED: ['مجدد', 'Renewed'], REFURBISHED: ['معاد تأهيله', 'Refurbished'], USED: ['مستعمل', 'Used'],
  };
  return labels[condition][ar ? 0 : 1];
}
