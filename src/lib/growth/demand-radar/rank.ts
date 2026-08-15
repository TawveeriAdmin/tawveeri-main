// Explainable opportunity ranking (ADR-247 §15). No opaque "Score: 92" — the
// tier is derived from named components and every contributing reason is a
// founder-readable Arabic string. PRECISION > VOLUME (§16): when uncertain,
// the answer is IGNORE, never a confident HIGH.

import type { Answerability, Classification, RadarCandidate, Tier } from './types';
import { categoryNameAr } from './saudi-lexicon';
import { isStale, isAccessoryQuestion } from './heuristics';

export interface RankResult {
  tier: Tier;
  reasons: string[];
  suggestedQuery: string | null;
}

export function rankOpportunity(
  c: RadarCandidate,
  cls: Classification,
  answerability: Answerability,
  answerabilityReason: string
): RankResult {
  const reasons: string[] = [];

  // Hard IGNORE gates — each is a named, explainable rule.
  if (cls.intentStrength === 'none' || cls.intentClass === 'none') {
    return { tier: 'ignore', reasons: ['لا توجد نية شراء حقيقية في النص'], suggestedQuery: null };
  }
  if (cls.ksaRelevance === 'not_relevant') {
    return { tier: 'ignore', reasons: ['السياق خارج السوق السعودي'], suggestedQuery: null };
  }
  if (answerability === 'no') {
    return { tier: 'ignore', reasons: [`توفيري لا يستطيع المساعدة فعليًا: ${answerabilityReason}`], suggestedQuery: null };
  }
  if (!cls.category) {
    return { tier: 'ignore', reasons: ['لم تتحدد فئة منتج مدعومة'], suggestedQuery: null };
  }
  if (isStale(c.postedAt)) {
    return { tier: 'ignore', reasons: ['المنشور أقدم من نافذة الرد المفيدة (48 ساعة)'], suggestedQuery: null };
  }
  if (isAccessoryQuestion(c.text)) {
    // Deterministic veto proven by the eval: the LLM classified "ابي كفر وستاند
    // لجوالي" as a mobile opportunity — an accessory ask is not a device purchase.
    return { tier: 'ignore', reasons: ['سؤال عن إكسسوار وليس عن الجهاز نفسه'], suggestedQuery: null };
  }

  // Components toward HIGH.
  let points = 0;
  if (cls.intentStrength === 'strong') {
    points += 2;
    reasons.push('نية شراء مباشرة وواضحة');
  } else {
    reasons.push('نية شراء محتملة لكن غير مؤكدة');
  }
  if (cls.isDirectQuestion) {
    points += 1;
    reasons.push('المستخدم يطلب المساعدة صراحة');
  }
  if (cls.budgetSar) {
    points += 1;
    reasons.push(`ميزانية واضحة: ${cls.budgetSar.toLocaleString('ar-SA')} ريال`);
  }
  if (cls.ksaRelevance === 'confirmed') {
    points += 1;
    reasons.push('صلة سعودية مؤكدة بالدليل');
  } else if (cls.ksaRelevance === 'likely') {
    reasons.push('لهجة خليجية — صلة سعودية محتملة');
  } else {
    points -= 1;
    reasons.push('لا دليل على السوق السعودي — حذر');
  }
  if (answerability === 'yes') {
    points += 1;
    reasons.push(`توفيري قادر على المساعدة: ${answerabilityReason}`);
  } else {
    reasons.push(`قدرة جزئية: ${answerabilityReason}`);
  }
  if (cls.confidence < 0.5) {
    points -= 1;
    reasons.push('ثقة التصنيف منخفضة — خُفّض التقييم');
  }
  const freshMinutes = c.postedAt ? Math.round((Date.now() - new Date(c.postedAt).getTime()) / 60000) : null;
  if (freshMinutes !== null && freshMinutes <= 120) {
    points += 1;
    reasons.push(`منشور حديث (قبل ${freshMinutes} دقيقة)`);
  }

  reasons.push(`الفئة: ${categoryNameAr(cls.category)}`);

  // HIGH needs strong intent + answerable + enough corroborating components.
  const tier: Tier =
    points >= 5 && cls.intentStrength === 'strong' && answerability === 'yes'
      ? 'high'
      : points >= 3
        ? 'medium'
        : 'ignore';

  return { tier, reasons, suggestedQuery: buildSuggestedQuery(cls) };
}

/** The Tawveeri search the consumer (and the founder's reply) should use —
 *  built from classified fields only, never from fabricated facts. */
export function buildSuggestedQuery(cls: Classification): string | null {
  if (!cls.category) return null;
  const base: Record<string, string> = {
    mobile: 'جوال',
    laptop: 'لابتوب',
    tv: 'تلفزيون',
    air_conditioner: 'مكيف',
    refrigerator: 'ثلاجة',
    washing_machine: 'غسالة',
    tablet: 'ايباد',
    monitor: 'شاشة كمبيوتر',
    audio: 'سماعة',
  };
  const noun = base[cls.category] ?? cls.category;
  const parts = [noun];
  if (cls.intentClass === 'suitability') parts.push('مناسب');
  if (cls.budgetSar) parts.push(`تحت ${cls.budgetSar}`);
  return parts.join(' ');
}
