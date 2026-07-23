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

/**
 * Any of these ⇒ a different device category.
 *
 * The networking and power-bank entries are not defensive guesses — they are
 * measured. A bare "band" signal matched **"Dual Band (2.4 GHz/5 GHz)"** in every
 * router listing, and the Arabic word for hour, "ساعة", is a substring of
 * **"مللي أمبير/ساعة"** (milliamp-hour), so power banks were being claimed as
 * watches. Together they accounted for 128 of 403 rejections.
 */
const FOREIGN_CATEGORY_SIGNALS = [
  // other personal devices
  "جوال", "هاتف", "smartphone", "iphone", "ايفون", "galaxy s", "تابلت", "tablet",
  "ipad", "ايباد", "laptop", "لابتوب", "تلفزيون", "سماعه", "سماعات", "buds",
  "airpods", "headphone", "earbud", "ساعه حائط", "wall clock", "منبه", "alarm clock",
  // networking — "Dual Band" is the reason bare "band" is not a wearable signal
  "router", "راوتر", "access point", "range extender", "repeater", "مقوي",
  "modem", "مودم", "wi-fi 6", "wifi 6", "wi-fi 7", "cpe", "mesh", "adapter", "محول",
  // power — "مللي أمبير/ساعة" (mAh) contains the Arabic word for hour
  "مللي امبير", "مللي أمبير", "بور بانك", "باور بانك", "power bank", "powerbank", "بطاريه متنقله",
  // misc electronics that carried a stray signal
  "projector", "بروجكتر", "vr ", "headset", "game console", "لعبه", "smart ring", "خاتم ذكي",
];

/**
 * Positive wearable evidence, bilingual.
 *
 * Bare "band" is deliberately absent (see above); only qualified band phrases and
 * brand-specific product lines are trusted.
 */
const WEARABLE_SIGNALS = [
  "ساعه ذكيه", "smartwatch", "smart watch", "watch",
  "سوار ذكي", "fitness band", "سواره رياضيه", "تراكر لياقه",
  "apple watch", "galaxy watch", "galaxy fit", "watch fit", "watch gt",
  "amazfit", "mi band", "smart band", "honor band", "huawei band", "فور رانر", "forerunner",
  // Generic "ساعة" is last: it only reaches here once every rejection above has
  // been applied, so power banks and wall clocks can no longer arrive with it.
  "ساعه",
];

const hit = (text: string, list: string[]) => list.some((s) => text.includes(normalizeArabic(s)));

export function detect(nameAr: string, nameEn: string): boolean {
  const text = normalizeArabic(`${nameAr} ${nameEn}`);
  if (hit(text, ACCESSORY_SIGNALS)) return false;
  if (hit(text, FOREIGN_CATEGORY_SIGNALS)) return false;
  return hit(text, WEARABLE_SIGNALS);
}
