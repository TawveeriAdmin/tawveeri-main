// scripts/tps-core/brand-map.ts
// ─────────────────────────────────────────────────────────────────────────────
// Brand Normalization Layer — TPS Core
// طبقة تطبيع البراند المشتركة بين كل الفئات (mobile, ac, tv...)
// تحوّل كل صيغ البراند (عربي/إنجليزي/كبير/صغير/صيغ متعددة) إلى canonical واحد.
//
// مبدأ: "لا نخمّن — نقرأ". أي براند غير موجود هنا يُرجَع lowercase كما هو،
// ويُسجّل للمراجعة اليدوية بدل التخمين. الإضافة يدوية فقط.
// ─────────────────────────────────────────────────────────────────────────────

// المفتاح: أي صيغة خام (بعد trim + lowercase)
// القيمة: الشكل القانوني الموحّد (canonical)
const BRAND_ALIASES: Record<string, string> = {
  // ── Apple ──
  "apple": "apple",
  "آبل": "apple",
  "ابل": "apple",
  "أبل": "apple",

  // ── Samsung ──
  "samsung": "samsung",
  "سامسونج": "samsung",
  "سامسونغ": "samsung",

  // ── Huawei ──
  "huawei": "huawei",
  "هواوي": "huawei",

  // ── Xiaomi ──
  "xiaomi": "xiaomi",
  "شاومي": "xiaomi",
  "شياومي": "xiaomi",
  "redmi": "xiaomi",      // Redmi علامة فرعية من Xiaomi
  "ريدمي": "xiaomi",
  "poco": "xiaomi",       // Poco كذلك
  "بوكو": "xiaomi",

  // ── Honor ──
  "honor": "honor",
  "هونر": "honor",
  "هونور": "honor",

  // ── Oppo ──
  "oppo": "oppo",
  "أوبو": "oppo",
  "اوبو": "oppo",

  // ── Vivo ──
  "vivo": "vivo",
  "فيفو": "vivo",

  // ── Realme ──
  "realme": "realme",
  "ريلمي": "realme",
  "ريلمى": "realme",

  // ── Nokia / HMD ──
  "nokia": "nokia",
  "نوكيا": "nokia",
  "hmd": "hmd",

  // ── Google ──
  "google": "google",
  "قوقل": "google",
  "جوجل": "google",

  // ── Motorola ──
  "motorola": "motorola",
  "موتورولا": "motorola",

  // ── OnePlus ──
  "oneplus": "oneplus",
  "ون بلس": "oneplus",
  "ونبلس": "oneplus",

  // ── Tecno / Infinix (شائعة بالسوق السعودي) ──
  "tecno": "tecno",
  "تكنو": "tecno",
  "infinix": "infinix",
  "انفينكس": "infinix",
  "إنفينكس": "infinix",

  // ── AC brands (bilingual — Arabic/English of the same well-known brands).
  //    Evidence-backed transliterations only; unknown brands fall through to
  //    lowercase raw (never guessed). Unlocks Arabic↔English AC corroboration.
  "lg": "lg", "إل جي": "lg", "ال جي": "lg", "الجي": "lg",
  "gree": "gree", "جري": "gree", "قري": "gree",
  "midea": "midea", "ميديا": "midea",
  "tcl": "tcl", "تى سى ال": "tcl", "تي سي ال": "tcl", "تيسيال": "tcl",
  "aux": "aux", "أوكس": "aux", "اوكس": "aux",
  "haier": "haier", "هاير": "haier",
  "hisense": "hisense", "هايسنس": "hisense", "هايسينس": "hisense",
  "samsung ": "samsung",
  "westinghouse": "westinghouse", "white westinghouse": "westinghouse",
  "ويستنج هاوس": "westinghouse", "ويستنجهاوس": "westinghouse", "وايت ويستنجهاوس": "westinghouse",
  "general": "general", "جنرال": "general",
  "zamil": "zamil", "زامل": "zamil",
  "kelvinator": "kelvinator", "كلفينيتور": "kelvinator",
  "mtc": "mtc", "إم تي سي": "mtc", "ام تي سي": "mtc",
  "class pro": "classpro", "classpro": "classpro", "كلاس برو": "classpro",
  "crafft": "crafft", "كرافت": "crafft",
  // Evidence-backed 2026-09-07 (Amazon AC brand-detection mission) — real brands measured
  // directly on current Amazon.sa AC listings and/or already-observed TPS-layer canonicals.
  // "super general" listed BEFORE "general" is checked (detectBrandFromText below sorts by
  // key length, longest first) so the distinct real brand "Super General" is never
  // shortened to "General".
  "super general": "supergeneral",
  "enviro": "enviro",
  "impex": "impex",
  "cooline": "cooline",
  "star vision": "starvision", "star-vision": "starvision",
  "aston": "aston",
  "danssat": "dansat", // double-s spelling variant; "dansat"/"دانسات" already mapped below
  "mando": "mando",
  "ugine": "ugine",
  "york": "york",
  "haam": "haam", "هام": "haam",

  // ── Laptop brands (bilingual). Evidence-backed transliterations only; unknown
  //    brands fall through to lowercase raw (never guessed). Apple/Samsung/Huawei/LG
  //    already mapped above and shared across categories.
  "lenovo": "lenovo", "لينوفو": "lenovo",
  "hp": "hp", "اتش بي": "hp", "إتش بي": "hp", "hewlett packard": "hp", "hewlett-packard": "hp", "اش بي": "hp",
  "dell": "dell", "ديل": "dell",
  "asus": "asus", "اسوس": "asus", "أسوس": "asus", "ايسوس": "asus", "إيسوس": "asus",
  "acer": "acer", "ايسر": "acer", "أيسر": "acer", "ايسير": "acer",
  "msi": "msi", "ام اس اي": "msi", "إم إس آي": "msi", "ام اس آي": "msi",
  "microsoft": "microsoft", "مايكروسوفت": "microsoft", "surface": "microsoft", "سيرفس": "microsoft",
  "gigabyte": "gigabyte", "جيجابايت": "gigabyte",
  "razer": "razer", "ريزر": "razer",
  "toshiba": "toshiba", "توشيبا": "toshiba",
  "dynabook": "dynabook", "داينابوك": "dynabook",

  // ── Audio brands (bilingual). Apple/Samsung/Huawei/Sony already/also mapped.
  "jbl": "jbl", "جي بي ال": "jbl", "جي بي إل": "jbl", "جيبيال": "jbl",
  "bose": "bose", "بوز": "bose", "بوس": "bose",
  "beats": "beats", "بيتس": "beats",
  "anker": "anker", "انكر": "anker", "أنكر": "anker", "soundcore": "anker", "ساوند كور": "anker", "ساوندكور": "anker",

  // ── Wearables (ADR-066) ──────────────────────────────────────────────────
  // Saudi retailers carry a long tail of wearable-only brands that no other
  // category needed. Without these aliases the same watch keys under its Arabic
  // brand at one store and its Latin brand at another, so it can never
  // corroborate — the same language split that cost mobile 11 duplicate cards.
  "mibro": "mibro", "ميبرو": "mibro",
  "kieslect": "kieslect", "كيسليكت": "kieslect", "كييسليكت": "kieslect",
  "amazfit": "amazfit", "أمازفيت": "amazfit", "امازفيت": "amazfit",
  "zeblaze": "zeblaze", "زيبليز": "zeblaze",
  "haylou": "haylou", "هايلو": "haylou",
  "imilab": "imilab", "ايميلاب": "imilab",
  "fitbit": "fitbit", "فيتبيت": "fitbit", "فيت بيت": "fitbit",
  "garmin": "garmin", "غارمين": "garmin", "قارمين": "garmin",
  "huami": "amazfit", "هوامي": "amazfit",
  "aukey": "aukey", "أوكي": "aukey", "اوكي": "aukey", "اوكى": "aukey",
  "polar": "polar", "بولار": "polar",
  "oraimo": "oraimo", "أورايمو": "oraimo", "اورايمو": "oraimo",
  "sennheiser": "sennheiser", "سنهايزر": "sennheiser",
  "marshall": "marshall", "مارشال": "marshall",
  "jabra": "jabra", "جابرا": "jabra",

  // ── Camera brands (bilingual). Sony/Panasonic already mapped.
  "canon": "canon", "كانون": "canon",
  "nikon": "nikon", "نيكون": "nikon",
  "fujifilm": "fujifilm", "fuji": "fujifilm", "فوجي": "fujifilm", "فوجي فيلم": "fujifilm",
  "gopro": "gopro", "جو برو": "gopro", "قو برو": "gopro",
  "dji": "dji", "دي جي اي": "dji",

  // ── TV brands (bilingual). Samsung/LG/Huawei/Toshiba already mapped above.
  "sony": "sony", "سوني": "sony",
  "nikai": "nikai", "نيكاي": "nikai",
  "panasonic": "panasonic", "باناسونيك": "panasonic",
  "philips": "philips", "فيليبس": "philips",
  "dansat": "dansat", "دان سات": "dansat", "دانسات": "dansat",
  "skyworth": "skyworth", "سكاي ورث": "skyworth",
  "vision": "vision", "فيجن": "vision",

  // ── Appliance brands (P10, 2026-08-21). Measured live: re-deriving vacuum/
  // blender/coffee_maker/dishwasher identity from raw evidence found the exact
  // SAME real product (same manufacturer model number) split into two separate
  // canonicals purely because one store wrote the brand in Arabic and another in
  // Latin — e.g. `أريستون|MODEL:ARDF658DI3XSA` and `ariston|MODEL:ARDF658DI3XSA`
  // are one real dishwasher, not two. Appliance brands had NO entries in this map
  // at all before this pass; only the pairs actually observed live are added here
  // (existing samsung/midea/panasonic/philips/lg entries above already cover
  // their own standard spellings — these add the DIFFERENT transliterations this
  // pass measured in appliance titles specifically).
  "سامسون": "samsung", "بانسونك": "panasonic", "مايديا": "midea", "فليبس": "philips",
  "bosch": "bosch", "بوش": "bosch",
  "kenwood": "kenwood", "كينوود": "kenwood",
  "tefal": "tefal", "تيفال": "tefal",
  "dyson": "dyson", "دايسون": "dyson",
  "shark": "shark", "شارك": "shark",
  "hitachi": "hitachi", "هيتاشي": "hitachi", "هيتاشى": "hitachi",
  "hoover": "hoover", "هوفر": "hoover",
  "ariston": "ariston", "أريستون": "ariston", "اريستون": "ariston",
  "beko": "beko", "بيكو": "beko",
  "braun": "braun", "براون": "braun",
  "moulinex": "moulinex", "moullinex": "moulinex", "مولينكس": "moulinex",
  "delonghi": "delonghi", "ديلونجي": "delonghi",
  "krups": "krups", "كروبس": "krups",
  "bissell": "bissell", "بيسيل": "bissell",
  "fisher": "fisher", "فيشر": "fisher",
  "black+decker": "black+decker", "بلاك اند ديكر": "black+decker", "بلاك": "black+decker",
  "koolen": "koolen", "كولين": "koolen",
};

/**
 * يحوّل أي صيغة براند خام إلى الشكل القانوني الموحّد.
 * @param raw القيمة الخام (قد تكون null أو عربي أو إنجليزي)
 * @returns الشكل القانوني، أو lowercase الخام لو غير معروف، أو "unknown" لو فارغ
 */
export function canonicalizeBrand(raw: string | null | undefined): string {
  if (!raw || raw.trim().length === 0) return "unknown";
  const key = raw.trim().toLowerCase();
  return BRAND_ALIASES[key] ?? key;
}

/**
 * يفحص هل البراند معروف في الخريطة (لأغراض المراقبة/التسجيل).
 * يُستخدم لبناء قائمة البراندات غير المعروفة التي تحتاج إضافة يدوية.
 */
export function isKnownBrand(raw: string | null | undefined): boolean {
  if (!raw || raw.trim().length === 0) return false;
  return raw.trim().toLowerCase() in BRAND_ALIASES;
}

// Excluded from FREE-TEXT scanning only (detectBrandFromText below) — never from exact-match
// normalization (canonicalizeBrand/isKnownBrand, unaffected). These keys are common English
// words ("general", "york" — also a place name, "aux" — also an audio-jack term) that a
// structured brand field can safely equal exactly, but that a free-text TITLE scan would
// false-positive on across unrelated Amazon categories (e.g. "AUX cable" for headphones,
// "arrow keys" for a keyboard). "Unknown beats incorrect": these stay undetected from title
// text rather than risk a wrong brand.
const FREE_TEXT_SCAN_EXCLUDE = new Set(["general", "جنرال", "york", "aux", "أوكس", "اوكس"]);

/**
 * Detects a known brand WITHIN a longer free-text title — for sources with no structured
 * brand field at all (measured 2026-09-07: Amazon.sa's search-result markup has none; only
 * the free-text title, which often names the brand inline, e.g. "Split Air Conditioner, LG,
 * Jet Cool 2 Ton Cool"). Checks longer alias keys first so a more specific brand ("super
 * general") wins over a shorter one it contains ("general"). Word-boundary matched for Latin
 * keys (so "lg" never matches inside "flag"/"blog"); Arabic keys use substring matching,
 * the same convention `category-utils.ts` already uses (Arabic compounds attach, no clean
 * \b semantics). Returns the ORIGINAL matched substring — preserving the source's own casing,
 * never an invented brand; `canonicalizeBrand()` normalizes it as usual afterward. Returns
 * null, never a guess, when no known brand appears — the caller decides the "Unknown"
 * fallback, exactly as it already does when a structured field is simply absent.
 */
export function detectBrandFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const keys = Object.keys(BRAND_ALIASES)
    .filter((k) => !FREE_TEXT_SCAN_EXCLUDE.has(k))
    .sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const isLatin = /^[a-z0-9 .+]+$/i.test(key);
    if (isLatin) {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const m = text.match(new RegExp(`\\b${escaped}\\b`, "i"));
      if (m) return m[0];
    } else if (text.includes(key)) {
      return key;
    }
  }
  return null;
}

/** يُصدّر الخريطة للقراءة فقط (لأغراض الاختبار والتوثيق) */
export function getBrandAliasCount(): number {
  return Object.keys(BRAND_ALIASES).length;
}