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
 *  `active` is decided at runtime from production data (answerability.ts), not here. */
export const CATEGORY_LEXICONS: CategoryLexicon[] = [
  {
    category: 'mobile',
    nameAr: 'جوالات',
    xQuery:
      '("وش افضل جوال" OR "ابي جوال" OR "ابغى جوال" OR "افضل جوال تحت" OR "جوال تحت" OR "محتار بين جوال" OR ("محتار" "ايفون") OR ("محتار" "سامسونج") OR "انصحوني بجوال" OR "تنصحون بجوال")',
    keywords: ['جوال', 'موبايل', 'هاتف', 'تلفون', 'ايفون', 'آيفون', 'iphone', 'سامسونج', 'samsung', 'جالكسي', 'بيكسل', 'pixel', 'شاومي', 'xiaomi', 'ريدمي', 'هواوي', 'اوبو', 'ريلمي', 'وان بلس'],
  },
  {
    category: 'laptop',
    nameAr: 'لابتوبات',
    xQuery:
      '("وش افضل لابتوب" OR "ابي لابتوب" OR "ابغى لابتوب" OR "لابتوب للجامعة" OR "لابتوب للدراسة" OR "لابتوب تحت" OR "محتار بين لابتوب" OR "انصحوني بلابتوب" OR "تنصحون بلابتوب" OR "لابتوب العاب")',
    keywords: ['لابتوب', 'لاب توب', 'لابتوبات', 'laptop', 'ماك بوك', 'ماكبوك', 'macbook', 'نوت بوك', 'كمبيوتر محمول', 'ديل', 'لينوفو', 'اتش بي', 'اسوس', 'ايسر', 'ثينك باد'],
  },
  {
    category: 'tv',
    nameAr: 'تلفزيونات',
    xQuery:
      '("وش افضل تلفزيون" OR "ابي تلفزيون" OR "ابي شاشة" OR "ابغى شاشة" OR "افضل شاشة" OR "شاشة تحت" OR "تلفزيون تحت" OR ("محتار" "شاشة") OR "شاشة للبلايستيشن" OR "وش انسب شاشة" OR "انصحوني بشاشة")',
    keywords: ['تلفزيون', 'تلفاز', 'شاشة', 'شاشه', 'tv', 'oled', 'qled', 'اوليد', 'بوصة', 'بوصه', 'سمارت تي في'],
  },
  {
    category: 'air_conditioner',
    nameAr: 'مكيفات',
    xQuery:
      '("وش افضل مكيف" OR "ابي مكيف" OR "ابغى مكيف" OR "مكيف تحت" OR "افضل مكيف" OR ("محتار" "مكيف") OR "مكيف هادي" OR "مكيف سبليت" OR "انصحوني بمكيف" OR "تنصحون بمكيف" OR "مكيفي خرب")',
    keywords: ['مكيف', 'مكيفات', 'سبليت', 'شباك', 'وحدة تبريد', 'انفرتر', 'btu', 'تكييف'],
  },
  {
    category: 'refrigerator',
    nameAr: 'ثلاجات',
    xQuery:
      '("وش افضل ثلاجة" OR "ابي ثلاجة" OR "ابغى ثلاجة" OR "ثلاجة تحت" OR "افضل ثلاجة" OR ("محتار" "ثلاجة") OR "ثلاجة لعائلة" OR "انصحوني بثلاجة" OR "تنصحون بثلاجة" OR "ثلاجتي خربت")',
    keywords: ['ثلاجة', 'ثلاجه', 'ثلاجات', 'برادة', 'فريزر', 'سايد باي سايد', 'بابين', 'قدم'],
  },
  {
    category: 'washing_machine',
    nameAr: 'غسالات',
    xQuery:
      '("وش افضل غسالة" OR "ابي غسالة" OR "ابغى غسالة" OR "غسالة تحت" OR "افضل غسالة" OR ("محتار" "غسالة") OR "غسالة اتوماتيك" OR "امامي ولا علوي" OR "انصحوني بغسالة" OR "غسالتي خربت")',
    keywords: ['غسالة', 'غساله', 'غسالات', 'نشافة', 'نشافه', 'مجفف', 'تحميل امامي', 'تحميل علوي', 'كيلو غسيل'],
  },
  {
    category: 'tablet',
    nameAr: 'أجهزة لوحية',
    xQuery:
      '("وش افضل ايباد" OR "ابي ايباد" OR "ابغى ايباد" OR "ايباد للدراسة" OR "ايباد للجامعة" OR ("محتار" "ايباد") OR "تابلت للاطفال" OR "ابي تابلت" OR "وش افضل تابلت" OR "الفرق بين الايباد")',
    keywords: ['ايباد', 'آيباد', 'ipad', 'تابلت', 'تاب', 'جهاز لوحي', 'جالكسي تاب'],
  },
  {
    category: 'monitor',
    nameAr: 'شاشات كمبيوتر',
    xQuery:
      '("وش افضل شاشة كمبيوتر" OR "ابي شاشة كمبيوتر" OR "شاشة قيمنق" OR "شاشة العاب" OR "شاشة للكمبيوتر" OR ("محتار" "شاشة قيمنق") OR "مونيتر" OR "انصحوني بشاشة كمبيوتر")',
    keywords: ['شاشة كمبيوتر', 'مونيتر', 'monitor', 'قيمنق', 'جيمنج', 'هيرتز', '144', '165', 'كيرفد'],
  },
  {
    category: 'audio',
    nameAr: 'سماعات وصوتيات',
    xQuery:
      '("وش افضل سماعة" OR "ابي سماعة" OR "ابغى سماعات" OR "سماعة تحت" OR ("محتار" "سماعة") OR "انصحوني بسماعة" OR "افضل سماعات" OR "ايربودز ولا")',
    keywords: ['سماعة', 'سماعه', 'سماعات', 'ايربودز', 'airpods', 'هيدفون', 'هيد فون', 'مكبر صوت', 'ساوند بار', 'سبيكر'],
  },
];

export const RADAR_CATEGORY_KEYS = CATEGORY_LEXICONS.map((c) => c.category);

export function categoryNameAr(category: string | null): string {
  return CATEGORY_LEXICONS.find((c) => c.category === category)?.nameAr ?? category ?? 'غير محدد';
}
