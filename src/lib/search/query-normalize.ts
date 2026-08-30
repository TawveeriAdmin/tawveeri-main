// src/lib/search/query-normalize.ts
// ─────────────────────────────────────────────────────────────────────────────
// SAUDI SEARCH-QUERY NORMALIZATION (ADR-064)
//
// Search is the front door. Measured on the live index 2026-07-23, 6 of 15
// representative Saudi queries returned **zero results**:
//   "آيفون ١٧ برو ماكس"      0 hits — yet "ايفون 17" worked
//   "جوال سامسونج"           0 hits — colloquial word for phone
//   "شاشة 65 بوصة"           0 hits — colloquial word for TV
//   "samsung galaxy s25 ultra" 0 hits — four terms, all required
//   "ايفون رخيص"             0 hits — one intent word killed the query
//
// Two distinct causes, fixed in two places. This module handles the QUERY side:
// the raw string was passed to the engine untouched, so Arabic-Indic digits
// (١٧) never matched ASCII digits in the catalogue. The index side — graceful
// degradation when not every term matches, plus Saudi shopping synonyms — is
// configured in `scripts/configure-tps-algolia-index.ts`.
//
// Deliberately conservative: this only FOLDS characters. It never drops or adds
// words, because silently rewriting what a shopper asked for is how a search
// engine starts lying about what it found.
// ─────────────────────────────────────────────────────────────────────────────

/** Arabic-Indic (٠-٩) and Eastern Arabic-Indic (۰-۹) digits → ASCII. */
const DIGITS: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

/**
 * Fold a shopper's query into the form the catalogue is written in.
 *
 * - Arabic-Indic digits → ASCII  (the proven zero-result cause)
 * - hamza forms أ إ آ ٱ → ا, ى → ي  (merchants and shoppers alternate freely)
 * - strip tatweel and diacritics
 * - collapse whitespace
 *
 * `ة` is intentionally NOT folded to `ه`: the search engine's own Arabic
 * analyzer handles that on both sides, and doing it here as well risks
 * diverging from the engine's normalisation rather than matching it.
 */
export function normalizeSearchQuery(input: string): string {
  if (!input) return "";
  return input
    .replace(/[٠-٩۰-۹]/g, (d) => DIGITS[d] ?? d)
    .replace(/[ـ]/g, "")
    .replace(/[ً-ٰٟ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    // Split an Arabic word glued to a number: "ايفون17" -> "ايفون 17", "شاشة65" -> "شاشة 65".
    // Saudi shoppers routinely omit the space; measured as a zero-result MISS in tps:search-quality.
    // ARABIC-ONLY on purpose: splitting Latin letter/digit would shatter model codes (S25, A17, SM-X200).
    .replace(/([؀-ۿ])(\d)/g, "$1 $2")
    .replace(/(\d)([؀-ۿ])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Saudi shopping vocabulary. Shoppers use colloquial words the catalogue never
 * contains — "جوال" (phone), "شاشة" (TV), "لابتوب" — so these are published to
 * the engine as SYNONYM groups rather than stuffed into product text, which
 * would corrupt relevance ranking and the displayed name.
 *
 * Each group is mutually interchangeable. Kept here, beside the query layer, so
 * the vocabulary and the normalisation that feeds it stay together.
 */
export const SAUDI_SEARCH_SYNONYMS: string[][] = [
  // phones — "jawwal" is the everyday Saudi word; the catalogue says "mobile"
  ["جوال", "جوالات", "موبايل", "هاتف", "هواتف", "تلفون", "mobile", "phone", "smartphone"],
  ["ايفون", "أيفون", "آيفون", "iphone", "ابل", "آبل", "apple"],
  ["جالاكسي", "جالكسي", "قلاكسي", "galaxy", "سامسونج", "samsung"],
  // Honor — 30-day study finding (2026-08-30): real shoppers searched "تابلت هورنر",
  // "Honer تابلت", "Horno ipad", "Ipad Horno", none of which matched the catalog's
  // "Honor" spelling, despite the catalog carrying 69 Honor products (one, Honor
  // Pad 10, drew 20 real merchant exits from shoppers who found it via a query that
  // spelled the brand correctly). Deliberately only the brand token — never widened
  // to a fuzzy/phonetic matcher, which risks false product-identity matches. Word
  // order doesn't matter to Algolia's token matching, so "Horno ipad" and "Ipad
  // Horno" both resolve once "Horno" folds to "Honor" here.
  ["هونر", "هورنر", "هونور", "honor", "honer", "horno"],
  // TV — "shasha" (screen) is how Saudis ask for a television
  ["شاشة", "شاشات", "تلفزيون", "تلفاز", "تي في", "television", "tv", "screen"],
  // computing
  ["لابتوب", "لاب توب", "حاسوب محمول", "كمبيوتر محمول", "laptop", "notebook"],
  ["تابلت", "تاب", "ايباد", "أيباد", "tablet", "ipad"],
  // large appliances
  ["مكيف", "مكيفات", "تكييف", "سبليت", "air conditioner", "ac", "split"],
  ["غسالة", "غسالات", "washing machine", "washer"],
  ["ثلاجة", "ثلاجات", "براد", "refrigerator", "fridge"],
  ["فرن", "افران", "oven"],
  ["مايكرويف", "ميكروويف", "microwave"],
  ["مكنسة", "مكانس", "vacuum", "vacuum cleaner"],
  // common intent words shoppers append — grouped so they never zero a query
  ["رخيص", "ارخص", "عرض", "عروض", "خصم", "تخفيض", "cheap", "offer", "deal", "discount"],
  ["اتوماتيك", "اوتوماتيك", "automatic", "ذكي", "smart"],
];
