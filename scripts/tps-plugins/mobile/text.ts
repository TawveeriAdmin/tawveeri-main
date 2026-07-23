// scripts/tps-plugins/mobile/text.ts
// ─────────────────────────────────────────────────────────────────────────────
// Arabic text normalization for identity matching (ADR-061).
//
// Saudi merchants spell the same product several ways, and the previous parser
// matched raw substrings — so a single missing orthographic variant silently
// dropped a whole store's catalog. Measured examples from production:
//   ايفون / آيفون / أيفون   — the parser knew only the first two, so every
//                             Extra listing spelled "أيفون 15" failed outright.
//   جالاكسي، اس 25 الترا     — an Arabic comma (،) between words defeated a
//                             regex that required whitespace.
//   جالكسي / جلاكسي         — Almanea and Jarir spell "Galaxy" differently.
//
// Normalizing ONCE, here, means every pattern elsewhere can be written in one
// spelling. This is matching-only: display text is never rewritten.
// ─────────────────────────────────────────────────────────────────────────────

/** Arabic-Indic and Eastern Arabic-Indic digits → ASCII. */
const DIGITS: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

/**
 * Fold orthographic variation so one pattern matches every spelling:
 *  • hamza forms أ إ آ ٱ → ا  and ؤ ئ → و ي
 *  • ى → ي, ة → ه   (merchants alternate freely)
 *  • strip tatweel (ـ) and Arabic diacritics
 *  • Arabic punctuation ، ؛ and dashes → space (they act as separators)
 *  • Arabic-Indic digits → ASCII, whitespace collapsed, lowercased
 */
export function normalizeArabic(input: string): string {
  if (!input) return "";
  let s = input.toLowerCase();
  s = s.replace(/[٠-٩۰-۹]/g, (d) => DIGITS[d] ?? d);
  s = s.replace(/[ـ]/g, "");                 // tatweel
  s = s.replace(/[ً-ٰٟ]/g, "");    // diacritics
  s = s.replace(/[أإآٱ]/g, "ا");
  s = s.replace(/ؤ/g, "و").replace(/ئ/g, "ي");
  s = s.replace(/ى/g, "ي").replace(/ة/g, "ه");
  s = s.replace(/[،؛,;:|/\\\-–—_()[\]{}"'`]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/**
 * Storage tiers that real phones ship with. Anything else is not storage —
 * this is what stops "8 جيجابايت رام" (8GB RAM) becoming a storage identity.
 * Measured harm: `samsung|Galaxy A|A07|Standard|4` used 4GB of RAM as storage.
 */
export const STORAGE_TIERS = new Set([16, 32, 64, 128, 256, 512, 1024, 2048]);

// ── Script-aware word boundaries ─────────────────────────────────────────────
// JavaScript's `\b` is defined on [A-Za-z0-9_], so it NEVER matches next to an
// Arabic letter. Using `\b` around bilingual alternations silently disables every
// Arabic pattern — variants (الترا), storage units (جيجا) and line letters
// (اس / ايه) all fail while their English equivalents work. These lookarounds
// treat Arabic letters as word characters too.
const WORDCHAR = "0-9a-z\\u0600-\\u06FF";
/** Left boundary that works for Arabic and Latin alike. */
export const LB = `(?<![${WORDCHAR}])`;
/** Right boundary that works for Arabic and Latin alike. */
export const RB = `(?![${WORDCHAR}])`;
/** Build a bilingual, boundary-safe regex from an alternation source. */
export const bounded = (source: string, flags = ""): RegExp =>
  new RegExp(`${LB}(?:${source})${RB}`, flags);

/** RAM sizes real phones ship with — used to positively exclude RAM figures. */
export const RAM_TIERS = new Set([2, 3, 4, 6, 8, 12, 16, 24]);
