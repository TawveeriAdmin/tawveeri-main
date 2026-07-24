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
  // protection — "حافظ" without the ta-marbuta is how Almanea writes it, and
  // `normalizeArabic` folds ة→ه, so "حافظه" alone never matched "حافظ جهاز".
  "case", "cover", "كفر", "غطاء", "غطا", "جراب", "حافظ", "حافظه", "حمايه", "واقي", "واقيه",
  // trackers — "سمارت تاج 2 سامسونج جالكسي" matched on "جالكسي"
  "سمارت تاج", "smarttag", "smart tag", "airtag",
  "screen protector", "tempered glass", "لاصقه", "ملصق", "film", "protector",
  // power & cabling
  "cable", "كابل", "كيبل", "سلك", "charger", "شاحن", "شاحنه", "adapter", "محول",
  "power bank", "powerbank", "بور بانك", "باور بانك", "battery pack",
  "بنك الطاقه", "بنك طاقه", "مللي امبير",
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
  // Xiaomi and Redmi tablets are named "…Pad", written "باد" in Arabic, and were
  // being claimed as phones off the brand token alone.
  "شاومي باد", "ريدمي باد", "redmi pad", "xiaomi pad", "mi pad", "لوحه مفاتيح عربيه",
  // Tecno Megapad is a tablet; it was claimed as a phone off the "tecno" token.
  "ميجا باد", "megapad", "mega pad",
  // Monitor-only resolution tokens — a phone is never described as WQHD.
  "wqhd",
  // computing & display — "أسوس فيفو بوك" (Asus VivoBook) matched the "فيفو"
  // (vivo) phone signal, and LG televisions matched on "Magic Remote".
  "laptop", "لابتوب", "لاب توب", "notebook", "macbook", "ماك بوك",
  "فيفو بوك", "vivobook", "zenbook", "زين بوك", "thinkpad", "ideapad", "chromebook",
  "monitor", "تلفزيون", "television", "شاشه تلفزيون",
  // NOTE: "بوصه" (inch) is deliberately NOT here — phones state their screen size
  // in inches too ("أيفون 15، 6.1 بوصة"), so rejecting on it discarded real
  // phones. Televisions are already caught by the specific signals below.
  "smart tv", "oled", "qled", "webos", "magic remote", "uhd",
  // Xiaomi sells across nearly every category, so admitting the bare brand as a
  // phone signal pulled in its TV sticks, vacuum parts and scooters. These are
  // correct rejections for any brand.
  "ستيك", "tv stick", "streaming stick", "مكنسه", "ممسحه", "مكانس",
  "سكوتر", "scooter", "دراجه", "مصباح", "lamp", "منقي هواء", "air purifier",
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
  // Xiaomi family — the parent brand was missing entirely, so "شاومي ايه 5"
  // (Xiaomi A5) was never even detected.
  "redmi", "ريدمي", "poco", "بوكو", "xiaomi", "شاومي",
  // Huawei / Honor — bare "magic" is gone: it matched LG's "Magic Remote".
  "nova", "نوفا", "honor magic", "هونر ماجيك",
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
  // A WHOLE-inch screen size of 20"+ is a monitor/TV/large display, never a phone.
  // Catches "34 بوصة" curved gaming monitors that slip in on a shared brand token.
  // The lookbehind excludes a preceding digit OR dot so a fractional phone size like
  // "6.67 بوصة" is NOT read as "67 بوصة" (that false-rejected real phones).
  const inch = text.match(/(?<![\d.])(\d{2})\s*(?:بوصه|inch|")/);
  if (inch && Number(inch[1]) >= 20) return false;
  return hit(text, PHONE_SIGNALS);
}
