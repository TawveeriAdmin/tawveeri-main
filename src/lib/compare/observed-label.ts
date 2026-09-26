// src/lib/compare/observed-label.ts — ADR-388.
// ONE phrasing for "when did we last see this offer" and "is it available AS OF that
// observation", shared by /compare/[key] and /compare (the multi-product tool). Before this
// module the phrasings lived inline in the [key] page and the multi-product page showed no
// observation time at all (founder finding, 2026-09-26).
import { PICK_FRESHNESS_MAX_HOURS } from '@/lib/intelligence/evidence-engine';

/** Day-count freshness with Arabic number agreement (dual, 3–10 plural, singular beyond). */
export function freshnessLabel(iso: string, isAr: boolean, nowMs: number = Date.now()): string {
  const days = Math.floor((nowMs - new Date(iso).getTime()) / 86400000);
  if (!Number.isFinite(days) || days <= 0) return isAr ? 'اليوم' : 'today';
  if (days === 1) return isAr ? 'أمس' : 'yesterday';
  if (isAr) return days === 2 ? 'قبل يومين' : days <= 10 ? `قبل ${days} أيام` : `قبل ${days} يومًا`;
  return `${days} days ago`;
}

/** «رصدناه اليوم / أمس / قبل N …» — the same line on every offer, featured or listed. */
export function observedLabel(iso: string, isAr: boolean, nowMs: number = Date.now()): string {
  return isAr ? `رصدناه ${freshnessLabel(iso, true, nowMs)}` : `observed ${freshnessLabel(iso, false, nowMs)}`;
}

export type AvailabilityTone = 'ok' | 'muted' | 'bad';

/**
 * Availability wording is bound to the observation it came from — «الآن» is never claimed.
 * A stale observation says so explicitly instead of asserting present-tense availability.
 */
export function availabilityLabelFor(
  availability: string | null | undefined,
  stale: boolean,
  isAr: boolean,
): { text: string; tone: AvailabilityTone } | null {
  if (availability === 'out_of_stock') return { text: isAr ? 'غير متوفر عند آخر رصد' : 'Out of stock at last observation', tone: 'bad' };
  if (availability === 'in_stock' || availability === 'limited_stock') {
    if (stale) return { text: isAr ? 'متوفر بحسب آخر رصد' : 'In stock at last observation', tone: 'muted' };
    return { text: availability === 'limited_stock' ? (isAr ? 'كمية محدودة' : 'Limited stock') : (isAr ? 'متوفر' : 'In stock'), tone: 'ok' };
  }
  if (availability === 'pre_order') return { text: isAr ? 'طلب مسبق' : 'Pre-order', tone: 'muted' };
  // ADR-389: the THIRD state, stated rather than silent. "Not stated" is neither out of stock
  // nor a confirmation — the offer may take part in the price comparison (the shared rule
  // excludes only an explicit out_of_stock), but it is never labelled «متوفر».
  return { text: isAr ? 'التوفر غير مذكور عند آخر رصد' : 'Availability not stated at last observation', tone: 'muted' };
}

/** Why an offer sits outside the comparison — one reason per offer, never a blanket label. */
export function exclusionLabelFor(
  reason: 'no_price' | 'out_of_stock' | 'stale' | 'unknown_age',
  observedAt: string | null | undefined,
  isAr: boolean,
  nowMs: number = Date.now(),
): string {
  const windowDays = PICK_FRESHNESS_MAX_HOURS / 24;
  switch (reason) {
    case 'out_of_stock':
      return isAr ? 'غير متوفر عند آخر رصد' : 'Out of stock at last observation';
    case 'no_price':
      return isAr ? 'بلا سعر مرصود' : 'No observed price';
    case 'unknown_age':
      return isAr ? 'زمن الرصد غير معروف' : 'Observation time unknown';
    case 'stale': {
      const days = observedAt ? Math.max(1, Math.floor((nowMs - Date.parse(observedAt)) / 86400000)) : null;
      if (days == null) return isAr ? `أقدم من ${windowDays} أيام` : `Older than ${windowDays} days`;
      return isAr ? `آخر رصد قبل ${days} يومًا — أقدم من ${windowDays} أيام` : `Last observed ${days} days ago — older than ${windowDays} days`;
    }
  }
}
