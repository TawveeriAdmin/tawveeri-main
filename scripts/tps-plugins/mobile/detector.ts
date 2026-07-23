// scripts/tps-plugins/mobile/detector.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mobile category detector — PRECISION FIRST (ADR-061).
//
// The phone keyword space overlaps massively with accessories and with other
// device categories, in both languages. Measured on production: of the 2,070
// listings the previous detector claimed, roughly 1,027 were not phones at all.
// Car mounts matched because "حامل جوال" contains "جوال"; silicone cases matched
// because "غطاء ماج سيف ايفون 16" contains "ايفون"; a Galaxy Watch Fit 3,
// AirPods, a Galaxy Tab and even TV wall brackets were all claimed as mobiles.
//
// So accessory and foreign-category signals HARD-REJECT even when a phone
// keyword is present — the same doctrine the laptop detector already uses. A
// listing is a phone only if it survives both rejections AND shows positive
// phone evidence. Unknown beats incorrect.
// ─────────────────────────────────────────────────────────────────────────────
import { normalizeArabic } from "./text";

/** Any of these ⇒ an accessory FOR a phone, never a phone. */
const ACCESSORY_SIGNALS = [
  // protection
  "case", "cover", "كفر", "غطاء", "غطا", "جراب", "حافظه", "حمايه", "واقي", "واقيه",
  "screen protector", "tempered glass", "لاصقه", "ملصق", "film", "protector",
  // power & cabling
  "cable", "كابل", "كيبل", "سلك", "charger", "شاحن", "شاحنه", "adapter", "محول",
  "power bank", "powerbank", "بور بانك", "باور بانك", "battery pack",
  // mounting / holding
  "holder", "حامل", "قاعده", "mount", "stand", "ستاند", "tripod",
  "grip", "قبضه", "popsocket", "selfie stick", "عصا سيلفي",
  // carrying
  "bag", "حقيبه", "شنطه", "sleeve", "pouch", "strap", "حزام", "سوار", "لانيارد",
  // optics / misc
  "lens", "عدسه", "memory card", "بطاقه ذاكره", "stylus", "قلم",
  "airtag", "tracker", "متتبع", "طقم", "accessory", "accessories", "ملحق", "ملحقات",
  "spare part", "قطع غيار",
];

/** Any of these ⇒ a DIFFERENT device category, never a phone. */
const FOREIGN_CATEGORY_SIGNALS = [
  // wearables
  "watch", "ساعه", "smartwatch", "band", "galaxy fit", "سوار ذكي",
  // audio
  "airpods", "buds", "سماعه", "سماعات", "headphone", "headset", "earbud", "earphone", "speaker", "مكبر صوت",
  // tablets
  "tablet", "تابلت", "ipad", "ايباد", "galaxy tab", "جالاكسي تاب", "matepad",
  // computing & display
  "laptop", "لابتوب", "لاب توب", "notebook", "macbook", "ماك بوك",
  "monitor", "تلفزيون", "television", "شاشه تلفزيون",
  // imaging & other
  "camera", "كاميرا", "printer", "طابعه", "router", "راوتر", "playstation", "xbox",
  // large appliances (kept from the original detector's refrigerator guard)
  "ثلاجه", "refrigerator", "fridge", "freezer", "side by side", "french door",
];

/** Positive phone evidence — brand families plus generic phone words. */
const PHONE_SIGNALS = [
  // generic
  "smartphone", "جوال", "جوالات", "هاتف", "هواتف", "موبايل", "mobile phone", "cell phone",
  // Apple
  "iphone", "ايفون",
  // Samsung
  "galaxy", "جالاكسي", "جالكسي", "جلاكسي", "z flip", "زد فليب", "z fold", "زد فولد",
  // Xiaomi family
  "redmi", "ريدمي", "poco", "بوكو",
  // Huawei / Honor
  "nova", "نوفا", "magic", "ماجيك",
  // Oppo / realme / vivo / OnePlus
  "reno", "رينو", "oppo", "اوبو", "realme", "ريلمي", "vivo", "فيفو",
  "oneplus", "ون بلس", "nord", "نورد",
  // Google / Nothing / others
  "pixel", "بكسل", "بيكسل", "nothing phone", "tecno", "تكنو", "infinix", "انفينكس", "spark", "camon",
];

const hit = (text: string, list: string[]) => list.some((s) => text.includes(normalizeArabic(s)));

export function detect(nameAr: string, nameEn: string): boolean {
  const text = normalizeArabic(`${nameAr} ${nameEn}`);
  if (hit(text, ACCESSORY_SIGNALS)) return false;
  if (hit(text, FOREIGN_CATEGORY_SIGNALS)) return false;
  return hit(text, PHONE_SIGNALS);
}
