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
  "haam": "haam", "هام": "haam",
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

/** يُصدّر الخريطة للقراءة فقط (لأغراض الاختبار والتوثيق) */
export function getBrandAliasCount(): number {
  return Object.keys(BRAND_ALIASES).length;
}