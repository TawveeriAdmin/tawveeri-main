// scripts/tps-core/arabic-naming.ts
// ONE Arabic display-naming vocabulary for the TPS knowledge layer.
//
// Why this file exists (ADR-185): every registered category plugin composes an Arabic
// display name from the VERIFIED identity key — except `mobile-v1` and `smartwatch-v1`,
// which emitted `${brand} ${englishLabel}` and so carried no Arabic character at all.
// Measured on production: 30% of the names an Arabic shopper reads on the search page
// are entirely English, against 0% for an English shopper.
//
// Rules, and they are not negotiable:
//   • Compose ONLY from fields already in the identity key. Nothing is invented, and a
//     brand we cannot transliterate is kept in Latin rather than guessed at
//     (`UNKNOWN BEATS INCORRECT` — the same rule `arabic-titles.js` follows).
//   • MODEL LINES AND CODES STAY LATIN. «iPhone 16 Pro Max», «Galaxy A07», «Watch GT 3»
//     are the names printed on the box and the names the shopper searches for; a
//     transliteration table over model lines is a drift surface with no upside.
//     What makes the name Arabic is the CATEGORY head and the BRAND.
//   • Internal sentinels (NO_STORAGE / NO_SIZE / Standard) never reach the customer.
//   • Names are METADATA. `tps_identity_key` is untouched by everything here.
//
// `canonical_products` carries a UNIQUE index on (lower(trim(name_ar)), lower(trim(brand))),
// so any caller writing these names must detect collisions before writing.

/**
 * Curated brand transliterations. Values for the thirteen TV brands are byte-identical to
 * the map this replaced in `tps-matcher/tv-matcher-v1-dry.ts` — asserted by
 * `tests/tps/arabic-naming.test.ts`, so TV display names are unchanged by the merge.
 * A brand that is absent is rendered in Latin, never guessed.
 */
export const BRAND_AR: Record<string, string> = {
  // — television (verbatim from tv-matcher-v1-dry.ts; do not edit without re-running the test)
  samsung: "سامسونج", lg: "إل جي", sony: "سوني", tcl: "تي سي إل", hisense: "هايسنس",
  toshiba: "توشيبا", nikai: "نيكاي", panasonic: "باناسونيك", philips: "فيليبس",
  dansat: "دان سات", skyworth: "سكاي ورث", haier: "هاير", vision: "فيجن",
  // — handset / wearable brands present in the catalogue
  apple: "آبل", huawei: "هواوي", xiaomi: "شاومي", honor: "هونر", oppo: "أوبو",
  vivo: "فيفو", realme: "ريلمي", tecno: "تكنو", infinix: "إنفينيكس", nokia: "نوكيا",
  google: "جوجل", oneplus: "ون بلس", motorola: "موتورولا", lenovo: "لينوفو",
  zte: "زد تي إي", itel: "آيتل", poco: "بوكو", redmi: "ريدمي",
  garmin: "جارمن", amazfit: "أمازفيت", fitbit: "فيتبت",
};

/** Arabic category heads. Absent category ⇒ the caller must not claim one. */
export const CATEGORY_AR: Record<string, string> = {
  mobile: "جوال",
  smartwatch: "ساعة ذكية",
};

/** Arabic for a brand, or the brand in Latin when we have no verified transliteration. */
export function arabicBrand(brand: string): string {
  const k = (brand || "").trim().toLowerCase();
  return BRAND_AR[k] ?? brand.trim();
}

/** Title-case a lowercase key-derived brand for the English name. */
export function latinBrand(brand: string): string {
  const b = (brand || "").trim();
  return b ? b.charAt(0).toUpperCase() + b.slice(1) : b;
}

/**
 * The family segment of an identity key often REPEATS the brand — `tecno|Tecno Spark`,
 * `honor|Honor`, `huawei|Huawei Watch GT` — and the old composition rendered both, so the
 * customer read «Tecno Tecno Spark 12» and «Honor Honor X 5» in BOTH locales. Strip the
 * repeated brand token and let the caller prepend the brand once.
 * Returns "" when the family is nothing but the brand.
 */
export function stripBrandPrefix(brand: string, family: string): string {
  const b = (brand || "").trim().toLowerCase();
  const f = (family || "").trim();
  if (!b || !f) return f;
  if (f.toLowerCase() === b) return "";
  // Token boundary only: "Honor X" loses "Honor", "Hono rX" is left alone.
  if (f.toLowerCase().startsWith(b + " ")) return f.slice(b.length + 1).trim();
  return f;
}

/**
 * A Samsung family carries the SERIES LETTER and the generation repeats it —
 * `Galaxy A` + `A07`, `Galaxy S` + `S11`, `Galaxy Z` + `Z Fold 7` — which rendered as
 * «Galaxy A A07». Merge them back into the name the shopper actually knows.
 * Only fires when the family's LAST token is a single letter and the generation opens
 * with that same letter; everything else is returned untouched.
 */
export function joinSeries(family: string, gen: string): string {
  const f = (family || "").trim();
  const g = (gen || "").trim();
  if (!f || !g) return [f, g].filter(Boolean).join(" ");
  const tokens = f.split(/\s+/);
  // The generation can repeat the tail of the family outright —
  // `Galaxy Watch Ultra` + gen `Ultra` rendered «Galaxy Watch Ultra Ultra».
  const genTokens = g.split(/\s+/);
  if (
    genTokens.length <= tokens.length &&
    genTokens.every((t, i) => tokens[tokens.length - genTokens.length + i].toLowerCase() === t.toLowerCase())
  ) return f;
  const last = tokens[tokens.length - 1];
  if (last.length !== 1 || !/[A-Za-z]/.test(last)) return `${f} ${g}`;
  const L = last.toLowerCase();
  const firstGenToken = g.split(/\s+/)[0].toLowerCase();
  // "A07" (letter+digits) or a bare "Z" opening "Z Fold 7".
  const repeats = firstGenToken === L || new RegExp(`^${L}\\d`).test(firstGenToken);
  if (!repeats) return `${f} ${g}`;
  return `${tokens.slice(0, -1).join(" ")} ${g}`.replace(/\s+/g, " ").trim();
}

/** «256 جيجابايت» — omitted entirely for the NO_STORAGE sentinel (never "NO_STORAGEGB"). */
export function arabicStorage(storage: string | null | undefined): string {
  return storage && storage !== "NO_STORAGE" ? ` ${storage} جيجابايت` : "";
}

/** «42 ملم» — omitted for the NO_SIZE sentinel. */
export function arabicCaseSize(size: string | null | undefined): string {
  return size && size !== "NO_SIZE" ? ` ${size} ملم` : "";
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * The variant segment is frequently ALREADY inside the generation —
 * `samsung|Galaxy Z|Z Flip 7|Flip|512` rendered «Galaxy Z Flip 7 Flip». Append the variant
 * only when the label does not already carry it as a whole token sequence.
 * `Standard` is the "no variant" sentinel and is never rendered.
 */
export function variantSuffix(label: string, variant: string | null | undefined): string {
  const v = (variant || "").trim();
  if (!v || v === "Standard") return "";
  const tokens = label.toLowerCase().split(/\s+/);
  const vTokens = v.toLowerCase().split(/\s+/);
  for (let i = 0; i + vTokens.length <= tokens.length; i++) {
    if (vTokens.every((t, j) => tokens[i + j] === t)) return "";
  }
  return ` ${v}`;
}

/**
 * mobile-v1 key: brand|family|gen|variant|storage
 * → «جوال سامسونج Galaxy A07 64 جيجابايت» / "Samsung Galaxy A07 64GB"
 */
export function mobileNames(key: string): { nameAr: string; nameEn: string } {
  const [brand, family, gen, variant, storage] = key.split("|");
  const label = joinSeries(stripBrandPrefix(brand, family), gen);
  const model = squash(`${label}${variantSuffix(label, variant)}`);
  const en = squash(`${latinBrand(brand)} ${model}${storage && storage !== "NO_STORAGE" ? ` ${storage}GB` : ""}`);
  const ar = squash(`${CATEGORY_AR.mobile} ${arabicBrand(brand)} ${model}${arabicStorage(storage)}`);
  return { nameAr: ar, nameEn: en };
}

/**
 * smartwatch-v1 key: brand|family|gen|variant|size|connectivity
 * → «ساعة ذكية هواوي Watch GT 3 Pro 46 ملم خلوي» / "Huawei Watch GT 3 Pro 46mm Cellular"
 */
export function smartwatchNames(key: string): { nameAr: string; nameEn: string } {
  const [brand, family, gen, variant, size, conn] = key.split("|");
  const label = joinSeries(stripBrandPrefix(brand, family), gen);
  const model = squash(`${label}${variantSuffix(label, variant)}`);
  const cellular = conn === "cellular";
  const en = squash(
    `${latinBrand(brand)} ${model}${size && size !== "NO_SIZE" ? ` ${size}mm` : ""}${cellular ? " Cellular" : ""}`
  );
  const ar = squash(
    `${CATEGORY_AR.smartwatch} ${arabicBrand(brand)} ${model}${arabicCaseSize(size)}${cellular ? " خلوي" : ""}`
  );
  return { nameAr: ar, nameEn: en };
}

/** True when a string carries at least one Arabic character — the gate these names exist to pass. */
export const hasArabic = (s: string | null | undefined): boolean => /[؀-ۿ]/.test(s || "");

/** True when a string carries at least one Latin letter. */
export const hasLatin = (s: string | null | undefined): boolean => /[A-Za-z]/.test(s || "");
