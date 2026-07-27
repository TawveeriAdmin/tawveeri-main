// Shared Arabic search normalization — used by the search API for BOTH the query and product names,
// so they line up. Extracted so its behavior is unit-testable (regression: Arabic-numeral queries
// like "ايفون ١٦" returned zero results because ١٦ never matched "16").

/** Fold Arabic-Indic / Eastern-Arabic-Indic digits to ASCII, strip diacritics, and unify common
 *  letter variants (أإآ→ا, ة→ه, ى→ي, tatweel). Applied identically to query and catalogue text. */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)) // ٠-٩ → 0-9
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0)) // ۰-۹ → 0-9
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ـ/g, '')
    .trim();
}
