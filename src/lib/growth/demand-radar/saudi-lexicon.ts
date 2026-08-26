// Saudi purchase-language lexicon (ADR-247). CATEGORY-BALANCED BY CONSTRUCTION:
// every radar category gets the same structure — retrieval query, category
// keywords, and per-category phrasing — so prompt-example frequency (the AC
// bias the mission warns about, §9) cannot skew discovery coverage. Real demand
// volume is then whatever the market actually produces.
//
// X query notes (verified against docs.x.com 2026-08-15): recent-search matching
// is diacritic-insensitive; queries are written in bare forms with hamza/spelling
// variants OR'd in; ≤512 chars each; `lang:ar -is:retweet` on every rule.
// Keywords RETRIEVE candidates — they never define opportunities (§7); the
// intent layer decides.
//
// ARABIC REGEX DISCIPLINE: JS `\b` never matches beside Arabic letters — all
// matching here uses substring/character-class checks, never \b word boundaries.

export interface CategoryLexicon {
  /** Production category key (tps_product_projection.category). */
  category: string;
  nameAr: string;
  /** X recent-search query (≤512 chars, lang/retweet filters appended by the adapter). */
  xQuery: string;
  /** Category keywords for classification (bare Arabic + common English/Arabizi). */
  keywords: string[];
}

// Generic Saudi purchase-intent markers (variants included: ابي/أبي/ابغى/أبغى,
// وش/ايش/وشو, تنصح/تنصحون/تنصحوني…). Used by heuristics for intent scoring.
export const INTENT_MARKERS: string[] = [
  'ابي', 'أبي', 'ابغى', 'أبغى', 'ابغا', 'ودي', 'احتاج', 'أحتاج',
  'وش افضل', 'وش أفضل', 'ايش افضل', 'ايش أفضل', 'وش انسب', 'وش أنسب',
  'وش تنصح', 'ايش تنصح', 'تنصحون', 'تنصحوني', 'انصحوني', 'نصيحتكم',
  'محتار', 'محتاره', 'محتارة', 'احتار',
  'يستاهل', 'تستاهل', 'يسوى',
  'وين الاقي', 'وين ألاقي', 'وين احصل', 'وين أحصل', 'وين ارخص', 'وين أرخص',
  'كم سعر', 'بكم', 'سعره كم',
  'تحت ', 'اقل من', 'أقل من', 'ميزانيتي', 'بحدود',
  'اشتري', 'أشتري', 'اخذ', 'آخذ', 'شراء',
  'خرب وابي', 'خربت وابي', 'ابي بديل', 'أبي بديل', 'ابغى بديل',
  'الفرق بين', 'ايهم افضل', 'أيهم أفضل', 'ولا', // "X ولا Y؟" comparisons
];

/** Signals that the text is an AD/PROMO/NEWS, not a consumer question. */
export const NOISE_MARKERS: string[] = [
  'عرض خاص', 'عروض خاصة', 'خصم يصل', 'كود خصم', 'كوبون', 'اطلبه الان', 'اطلبه الآن',
  'متوفر لدينا', 'متوفر الان لدى', 'للطلب', 'واتساب للطلب', 'توصيل مجاني',
  'اعلان', 'إعلان', 'ممول', 'مسابقة', 'اربح', 'رتويت', 'سحب على',
  'انطلق البيع', 'رسميا', 'رسمياً', 'يعلن عن اطلاق', 'مواصفات وسعر', // launch news
  'مراجعة كاملة', 'انبوكسينق', 'فتح صندوق', // reviews (content, not a question)
];

/** KSA relevance signals (evidence-based states only — never asserted without one). */
export const KSA_MARKERS: string[] = [
  'ريال', 'ر.س', 'sar', 'السعودية', 'السعوديه', 'الرياض', 'جدة', 'جده', 'الدمام',
  'مكة', 'مكه', 'المدينة المنورة', 'الخبر', 'الطائف', 'ابها', 'أبها', 'تبوك', 'حائل',
  'القصيم', 'بريدة', 'جازان', 'نجران',
  'جرير', 'اكسترا', 'إكسترا', 'نون', 'امازون السعودية', 'أمازون السعودية', 'المنيع',
  'الشتاء والصيف', 'الصندوق الأسود', 'بلاك بوكس', 'لولو', 'شرف دي جي',
];

// Saudi-dialect function words — a weaker "likely KSA/Gulf" signal.
export const GULF_DIALECT_MARKERS: string[] = [
  'وش ', 'ابي ', 'أبي ', 'ابغى ', 'أبغى ', 'الحين', 'زين', 'مره ', 'مرّه', 'يجنن',
  'كذا ', 'ليه ', 'وشلون', 'شرايكم', 'ش رايكم', 'يا جماعة', 'يالربع',
];

/** The radar's category lexicons — one per production-supported major category.
 *  `active` is decided at runtime from production data (answerability.ts), not here.
 *
 *  Founder decision (2026-08-26): queries narrowed from broad category chatter
 *  ("وش افضل X", "محتار بين X", "انصحوني بـX" — comparison-shopping/opinion posts)
 *  to direct purchase-need phrasing only (ابي/أبي/ابغى/أبغى/احتاج/أحتاج + noun,
 *  plus "خرب/خربت وابي بديل" replacement-need and "بدور على" looking-for
 *  phrasing) — precision over breadth, matching the review-window tightening
 *  in the same change. */
export const CATEGORY_LEXICONS: CategoryLexicon[] = [
  {
    category: 'mobile',
    nameAr: 'جوالات',
    xQuery:
      '("ابي جوال" OR "أبي جوال" OR "ابغى جوال" OR "أبغى جوال" OR "احتاج جوال" OR "أحتاج جوال" OR "جوالي خرب وابي بديل" OR "بدور على جوال")',
    keywords: ['جوال', 'موبايل', 'هاتف', 'تلفون', 'ايفون', 'آيفون', 'iphone', 'سامسونج', 'samsung', 'جالكسي', 'بيكسل', 'pixel', 'شاومي', 'xiaomi', 'ريدمي', 'هواوي', 'اوبو', 'ريلمي', 'وان بلس'],
  },
  {
    category: 'laptop',
    nameAr: 'لابتوبات',
    xQuery:
      '("ابي لابتوب" OR "أبي لابتوب" OR "ابي لاب توب" OR "أبي لاب توب" OR "ابغى لابتوب" OR "أبغى لابتوب" OR "احتاج لابتوب" OR "أحتاج لابتوب" OR "بدور على لابتوب")',
    keywords: ['لابتوب', 'لاب توب', 'لابتوبات', 'laptop', 'ماك بوك', 'ماكبوك', 'macbook', 'نوت بوك', 'كمبيوتر محمول', 'ديل', 'لينوفو', 'اتش بي', 'اسوس', 'ايسر', 'ثينك باد'],
  },
  {
    category: 'tv',
    nameAr: 'تلفزيونات',
    xQuery:
      '("ابي تلفزيون" OR "أبي تلفزيون" OR "ابي شاشة" OR "أبي شاشة" OR "ابغى شاشة" OR "أبغى شاشة" OR "احتاج تلفزيون" OR "أحتاج تلفزيون" OR "بدور على شاشة")',
    keywords: ['تلفزيون', 'تلفاز', 'شاشة', 'شاشه', 'tv', 'oled', 'qled', 'اوليد', 'بوصة', 'بوصه', 'سمارت تي في'],
  },
  {
    category: 'air_conditioner',
    nameAr: 'مكيفات',
    xQuery:
      '("ابي مكيف" OR "أبي مكيف" OR "ابغى مكيف" OR "أبغى مكيف" OR "احتاج مكيف" OR "أحتاج مكيف" OR "مكيفي خرب وابي بديل" OR "بدور على مكيف")',
    keywords: ['مكيف', 'مكيفات', 'سبليت', 'شباك', 'وحدة تبريد', 'انفرتر', 'btu', 'تكييف'],
  },
  {
    category: 'refrigerator',
    nameAr: 'ثلاجات',
    xQuery:
      '("ابي ثلاجة" OR "أبي ثلاجة" OR "ابغى ثلاجة" OR "أبغى ثلاجة" OR "احتاج ثلاجة" OR "أحتاج ثلاجة" OR "ثلاجتي خربت وابي بديل" OR "بدور على ثلاجة")',
    keywords: ['ثلاجة', 'ثلاجه', 'ثلاجات', 'برادة', 'فريزر', 'سايد باي سايد', 'بابين', 'قدم'],
  },
  {
    category: 'washing_machine',
    nameAr: 'غسالات',
    xQuery:
      '("ابي غسالة" OR "أبي غسالة" OR "ابغى غسالة" OR "أبغى غسالة" OR "احتاج غسالة" OR "أحتاج غسالة" OR "غسالتي خربت وابي بديل" OR "بدور على غسالة")',
    keywords: ['غسالة', 'غساله', 'غسالات', 'نشافة', 'نشافه', 'مجفف', 'تحميل امامي', 'تحميل علوي', 'كيلو غسيل'],
  },
  {
    category: 'tablet',
    nameAr: 'أجهزة لوحية',
    xQuery:
      '("ابي ايباد" OR "أبي ايباد" OR "ابي آيباد" OR "ابغى ايباد" OR "أبغى ايباد" OR "ابي تابلت" OR "أبي تابلت" OR "احتاج تابلت" OR "أحتاج تابلت")',
    keywords: ['ايباد', 'آيباد', 'ipad', 'تابلت', 'تاب', 'جهاز لوحي', 'جالكسي تاب'],
  },
  {
    category: 'monitor',
    nameAr: 'شاشات كمبيوتر',
    xQuery:
      '("ابي شاشة كمبيوتر" OR "أبي شاشة كمبيوتر" OR "ابي مونيتر" OR "أبي مونيتر" OR "ابغى شاشة قيمنق" OR "احتاج شاشة كمبيوتر")',
    keywords: ['شاشة كمبيوتر', 'مونيتر', 'monitor', 'قيمنق', 'جيمنج', 'هيرتز', '144', '165', 'كيرفد'],
  },
  {
    category: 'audio',
    nameAr: 'سماعات وصوتيات',
    xQuery:
      '("ابي سماعة" OR "أبي سماعة" OR "ابغى سماعة" OR "أبغى سماعة" OR "احتاج سماعة" OR "أحتاج سماعة" OR "ابي سماعات" OR "أبي سماعات")',
    keywords: ['سماعة', 'سماعه', 'سماعات', 'ايربودز', 'airpods', 'هيدفون', 'هيد فون', 'مكبر صوت', 'ساوند بار', 'سبيكر'],
  },
  {
    // Added 2026-08-26 per founder example list. Live catalog check at add
    // time: 109 products, 7 comparable, 28 fresh-in-7d — below the ACTIVE bar
    // (answerability.ts MIN_COMPARABLE=20), so this reads PARTIAL and caps at
    // MEDIUM tier (never HIGH) until oven's catalog coverage improves.
    category: 'oven',
    nameAr: 'أفران',
    xQuery:
      '("ابي فرن" OR "أبي فرن" OR "ابغى فرن" OR "أبغى فرن" OR "احتاج فرن" OR "أحتاج فرن" OR "فرني خرب وابي بديل")',
    keywords: ['فرن', 'أفران', 'افران', 'فرن كهربائي', 'فرن غاز', 'فرن بلت ان', 'oven'],
  },
];

export const RADAR_CATEGORY_KEYS = CATEGORY_LEXICONS.map((c) => c.category);

export function categoryNameAr(category: string | null): string {
  return CATEGORY_LEXICONS.find((c) => c.category === category)?.nameAr ?? category ?? 'غير محدد';
}
