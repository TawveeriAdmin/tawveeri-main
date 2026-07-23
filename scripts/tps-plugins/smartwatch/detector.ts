// scripts/tps-plugins/smartwatch/detector.ts
// ─────────────────────────────────────────────────────────────────────────────
// Smartwatch / wearable detector — PRECISION FIRST (ADR-066).
//
// Wearables are the largest uncovered category in the funnel (~973 Saudi
// listings with no identity). The keyword space collides badly with straps,
// chargers and protectors — "حزام ساعة ابل" (Apple Watch strap) contains the
// full product name — so accessory signals HARD-REJECT before any positive
// match, the same doctrine that took mobile from 13.6% to 64.8% (ADR-061).
// ─────────────────────────────────────────────────────────────────────────────
import { normalizeArabic } from "../mobile/text";

/** Any of these ⇒ an accessory FOR a watch, never a watch. */
const ACCESSORY_SIGNALS = [
  "حزام", "احزمة", "سوار بديل", "strap", "band for", "بديل",
  "شاحن", "charger", "كابل", "cable", "دوك", "dock",
  "واقي", "حمايه", "protector", "غطاء", "كفر", "case for", "cover for",
  "حافظه", "لاصقه", "screen protector", "tempered", "ملصق",
  "حامل", "stand", "علبه", "box", "طقم", "accessory", "accessories", "ملحق",
];

/** Any of these ⇒ a different device category. */
const FOREIGN_CATEGORY_SIGNALS = [
  "جوال", "هاتف", "smartphone", "iphone", "ايفون", "galaxy s", "تابلت", "tablet",
  "ipad", "ايباد", "laptop", "لابتوب", "تلفزيون", "سماعه", "سماعات", "buds",
  "airpods", "headphone", "earbud", "ساعه حائط", "wall clock", "منبه", "alarm clock",
];

/** Positive wearable evidence, bilingual. */
const WEARABLE_SIGNALS = [
  "ساعه ذكيه", "ساعه", "smartwatch", "smart watch", "watch",
  "سوار ذكي", "fitness band", "سواره رياضيه", "تراكر", "tracker",
  "apple watch", "galaxy watch", "watch fit", "watch gt", "amazfit", "band",
];

const hit = (text: string, list: string[]) => list.some((s) => text.includes(normalizeArabic(s)));

export function detect(nameAr: string, nameEn: string): boolean {
  const text = normalizeArabic(`${nameAr} ${nameEn}`);
  if (hit(text, ACCESSORY_SIGNALS)) return false;
  if (hit(text, FOREIGN_CATEGORY_SIGNALS)) return false;
  return hit(text, WEARABLE_SIGNALS);
}
