import type { ProductCategory } from '@/lib/database/types';

// التصنيفات الفعلية في قاعدة البيانات فقط:
// smartphone | laptop | tablet | tv | audio | camera
// accessories | monitor | smartwatch | air_conditioner | other

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  smartphone: [
    'smartphone', 'mobile phone', 'cell phone',
    'iphone', 'iphone 15', 'iphone 16',
    'galaxy s', 'galaxy z', 'galaxy a',
    'galaxy s24', 'galaxy s25', 'galaxy s26',
    'pixel phone', 'redmi note', 'poco x', 'oneplus',
    'هاتف ذكي', 'هاتف جوال', 'جوال',
    'ايفون', 'آيفون',
    'جالاكسي اس', 'جالاكسي زد', 'جالاكسي ايه',
    'موتورولا ايدج', 'موتورولا موتو',
  ],
  laptop: [
    'laptop', 'notebook', 'ultrabook', 'macbook', 'chromebook',
    'macbook pro', 'macbook air',
    'لابتوب', 'حاسوب محمول', 'كمبيوتر محمول', 'ماك بوك',
  ],
  tablet: [
    'tablet', 'ipad', 'ipad pro', 'ipad air', 'ipad mini',
    'galaxy tab', 'galaxy tab s', 'matebook',
    'تابلت', 'آيباد', 'ايباد', 'جهاز لوحي',
    'جالاكسي تاب',
  ],
  tv: [
    'smart tv', 'television', 'oled tv', 'qled tv',
    '4k tv', '8k tv', 'nanocell', 'miniled tv',
    'تلفزيون', 'تلفاز',
  ],
  monitor: [
    'monitor', 'gaming monitor', 'curved monitor', 'ultrawide monitor',
    '4k monitor', 'ips monitor',
    'شاشة كمبيوتر', 'شاشة حاسوب', 'مونيتور', 'شاشة قيمنج',
  ],
  audio: [
    'headphone', 'headset', 'earbuds', 'in-ear',
    'airpods', 'airpods pro', 'galaxy buds',
    'bluetooth speaker', 'soundbar', 'subwoofer',
    'wireless earbuds', 'noise cancelling',
    'سماعة', 'سماعات', 'مكبر صوت', 'سبيكر',
    'سماعة رأس', 'سماعة بلوتوث',
  ],
  camera: [
    'digital camera', 'dslr', 'mirrorless camera',
    'action camera', 'action cam', 'security camera',
    'كاميرا', 'كاميرا رقمية',
  ],
  gaming: [
    'playstation 5', 'playstation 4', 'ps5', 'ps4',
    'xbox series', 'xbox one', 'nintendo switch',
    'steam deck', 'gaming console', 'game controller',
    'دراعة تحكم', 'بلايستيشن', 'إكس بوكس', 'نينتندو',
  ],
  smartwatch: [
    'smartwatch', 'smart watch', 'fitness tracker', 'fitness band',
    'apple watch', 'apple watch series', 'apple watch ultra',
    'galaxy watch', 'galaxy watch ultra',
    'huawei watch', 'huawei band',
    'xiaomi watch', 'xiaomi band',
    'garmin', 'fitbit',
    'ساعة ذكية', 'ساعات ذكية', 'سوار ذكي', 'سوار رياضي',
    'ساعة سامسونج', 'ساعة هواوي', 'ساعة شاومي', 'ساعة ابل',
  ],
  // مكيفات الهواء فقط — بدون منقيات أو مراوح
  air_conditioner: [
    'air conditioner', 'split ac', 'window ac', 'portable ac',
    'inverter ac', 'central ac',
    'مكيف', 'مكيفات', 'مكيف سبليت', 'مكيف هواء',
    'مكيف شباك', 'مكيف متنقل',
  ],
  // Large home appliances (refrigeration, laundry, cleaning). Added 2026-07-27 — these were all
  // falling through to `accessories` (292 refrigerators + 246 washers were miscategorised).
  appliance: [
    'refrigerator', 'fridge', 'freezer', 'chest freezer', 'mini fridge',
    'washing machine', 'washer', 'washer/dryer', 'front load', 'top load', 'tumble dryer', 'clothes dryer',
    'dishwasher', 'vacuum cleaner', 'robot vacuum', 'steam cleaner',
    'water heater', 'water dispenser', 'chest fridge',
    'ثلاجة', 'ثلاجه', 'براد', 'فريزر', 'غسالة', 'غساله', 'غسالة ملابس', 'نشافة', 'نشافه', 'مجفف',
    'غسالة صحون', 'جلاية', 'مكنسة', 'مكنسه', 'مكنسة كهربائية', 'سخان',
  ],
  // Kitchen electrical appliances (countertop). Kept separate from large appliances.
  kitchen: [
    'microwave', 'oven', 'air fryer', 'deep fryer', 'blender', 'hand blender', 'food processor',
    'mixer', 'stand mixer', 'juicer', 'toaster', 'sandwich maker', 'coffee maker', 'coffee machine',
    'espresso machine', 'electric kettle', 'kettle', 'rice cooker', 'pressure cooker', 'slow cooker',
    'grinder', 'gas cooker', 'electric cooker', 'cooktop', 'induction hob', 'grill',
    'ميكروويف', 'مايكروويف', 'فرن', 'قلاية', 'قلاية هوائية', 'خلاط', 'عجان', 'عصارة', 'محمصة',
    'صانعة قهوة', 'ماكينة قهوة', 'غلاية', 'غلاية كهربائية', 'طباخ', 'قدر ضغط', 'كبة',
  ],
  printer: ['printer', 'scanner', 'all-in-one printer', 'laser printer', 'inkjet', 'طابعة', 'ماسح ضوئي'],
  networking: ['router', 'wifi router', 'modem', 'access point', 'wifi extender', 'mesh wifi', 'راوتر', 'موزع', 'مقوي واي فاي'],
};

// الترتيب: الأكثر تحديداً أولاً
//
// MEASURED DEFECT (2026-08-10, D→E mission Part F — founder follow-up "fix the شاشة
// miscategorization"): a smartwatch titled "...Smart Watch with Heart Rate/Sleep Monitor,
// Fitness Watch with Bluetooth Call..." was categorized `monitor`, not `smartwatch` — it
// then leaked into "شاشة" (screen/monitor) search results. `monitor`'s bare keyword
// ('monitor', no qualifier) matched the health-tracking phrase "Sleep Monitor" BEFORE
// `smartwatch`'s own — far more specific — keywords ("smart watch", "fitness tracker",
// "heart rate"...) ever got checked, since detection returns on the FIRST category match in
// this order. `smartwatch` moved ahead of `monitor` (a genuine computer-monitor listing
// never contains "smart watch"/"fitness tracker"/"apple watch"/"galaxy watch"/"garmin"/
// "fitbit", so this has no way to cost a real monitor a correct classification).
const CATEGORY_DETECTION_ORDER: string[] = [
  'laptop',
  'tablet',
  'smartwatch',      // قبل monitor لأن "Heart Rate/Sleep Monitor" يظهر في وصف الساعات الذكية
                      // قبل smartphone لأن galaxy watch يحتوي galaxy
  'monitor',
  'tv',
  'audio',
  'camera',
  'gaming',
  'air_conditioner',
  'kitchen',         // kitchen countertop appliances before large appliances (microwave→kitchen)
  'appliance',       // large home appliances (fridge/washer/…) before the accessories default
  'printer',
  'networking',
  'smartphone',
  'accessories',
];

// كلمات تدل على ملحق — نمنع تصنيف المنتج كجهاز أساسي
const ACCESSORY_INDICATORS = [
  ' case', ' cover', 'screen protector', 'tempered glass',
  'protective film', ' sleeve', ' pouch',
  'laptop bag', 'camera bag', 'tablet bag',
  ' charger', ' adapter', ' cable', 'usb cable',
  'lightning cable', 'type-c cable',
  ' stand', ' mount', ' holder', ' bracket',
  'wall mount', 'car mount', 'phone grip',
  'power bank', 'powerbank',
  'tripod', 'selfie stick', 'lens filter',
  'strap', 'replacement band', 'watch band',
  // Arabic
  'جراب', 'كفر', 'واقي شاشة', 'واقي عدسة',
  'حامل', 'شاحن', 'كيبل', 'كابل',
  'حافظة', 'ستراب', 'حزام ساعة', 'غطاء',
  'بطارية متنقلة', 'باور بانك',
];

function looksLikeAccessory(text: string): boolean {
  return ACCESSORY_INDICATORS.some((kw) => text.includes(kw));
}

/**
 * Exported accessory detector (ADR-243): true when the title carries an explicit
 * accessory word (case/cover/charger/strap/…, Arabic included). Same vocabulary
 * `classifyFromTitle` consults — one list, two callers — but with one stricter
 * rule for THIS caller: a Latin indicator must end at a word boundary, so
 * " stand" never matches "Floor Standing AC" (measured false veto). Arabic
 * indicators keep substring matching because Arabic compounds attach — the real
 * production catch was «كفرايربودز», with كفر fused to the product word.
 * classifyFromTitle's own behavior is deliberately unchanged.
 */
export function isAccessoryTitle(title: string | null | undefined, headLen = Infinity): boolean {
  if (!title) return false;
  const t = title.toLowerCase();
  return ACCESSORY_INDICATORS.some((kw) => {
    let from = 0;
    while (true) {
      const i = t.indexOf(kw, from);
      if (i === -1 || i > headLen) return false;
      const next = t[i + kw.length];
      const latinEnding = /[a-z]$/.test(kw);
      if (!latinEnding || next === undefined || !/[a-z]/.test(next)) return true;
      from = i + 1;
    }
  });
}

/**
 * Head-anchored accessory detector for the identity-projection guard (ADR-243):
 * an ACCESSORY LISTING names itself in the title head («كفرايربودز برو» at
 * position ~11; "Universal TV stand…" at 13), while a MAIN product merely
 * mentions accessories later ("Apple Watch Ultra … Titanium Case", "Monitor …
 * with stand", "Tablet … with Case Cover" — measured 2026-08-12: a full-title
 * scan flagged 56 of 2,102 verified-correct links, nearly all this bundled/
 * descriptor class). Head-only keeps the veto for real accessory listings and
 * silent for products that ship WITH one.
 */
export function isAccessoryTitleHead(title: string | null | undefined): boolean {
  return isAccessoryTitle(title, 30);
}

/**
 * AUDIO-SCOPED accessory-vs-device disambiguator (2026-08-27, quality-program P0-B — the
 * AirPods Pro 2 SAR-79 incident, ADR pending). `isAccessoryTitleHead`'s 30-char window
 * cannot separate two near-identical real title shapes: a genuine "سماعات AirPods Pro
 * الجيل الثاني مع حافظة MagSafe" (real earbuds, case mentioned as a bundled feature) and
 * the production-confirmed accessory "Baykron Airpods Pro 2nd Gen Silicone Case" both
 * place their accessory word around the SAME character offset (~36-37) — position alone
 * cannot tell them apart, and widening the head window only trades one false result for
 * the other.
 *
 * The signal that DOES separate them: whether the title also names a genuine audio
 * DEVICE noun (earbuds/headphone/speaker/سماعة/…) anywhere, not just the target BRAND.
 * Reuses `CATEGORY_KEYWORDS.audio` (this file's own, already-proven audio vocabulary),
 * minus the three brand/product-line entries ("airpods", "airpods pro", "galaxy buds")
 * that legitimately appear on BOTH a real product and a third-party accessory targeting
 * it — those three are the ONLY reason a pure accessory listing gets classified as audio
 * at all, so they cannot also count as evidence the listing IS the device. A title naming
 * a real device noun is the product, even if it also mentions a bundled case; a title
 * naming only the target brand plus an accessory word, with no device noun of its own, is
 * the accessory.
 */
const AUDIO_BRAND_ONLY_TERMS = new Set(['airpods', 'airpods pro', 'galaxy buds']);
// MEASURED (2026-08-27, real-catalog validation before wiring this guard into the primary
// ingestion path): `CATEGORY_KEYWORDS.audio` has no microphone term at all, so genuine
// current products — Hollyland LARK A1, BOYA Mini 2, DJI Mic Mini, FIFINE/FDUCE gaming
// mics — were false-positively flagged as accessory-only, because every one legitimately
// ships "with Charging Case"/"with Tripod Stand" and none matched a recognized device
// noun. Added here rather than to the shared `CATEGORY_KEYWORDS.audio` list itself, to
// keep this fix scoped to this one guard and not risk changing general category
// classification elsewhere in the codebase.
const AUDIO_DEVICE_NOUNS = [
  ...CATEGORY_KEYWORDS.audio.filter((kw) => !AUDIO_BRAND_ONLY_TERMS.has(kw)),
  // MEASURED (2026-08-27, real-catalog validation): live `tps_current_offers` rows carry
  // only ONE title string per offer (not a combined ar+en field like the storefront
  // `products` table) — a genuine BOYA/DJI/Hollyland microphone's single English title
  // often abbreviates to "Mic", never spelling out "Microphone", so both forms are needed.
  'microphone', 'mic', 'ميكروفون',
];

// "mic" is short enough to collide with an unrelated word ("gimmick", "comic") if matched
// as a bare substring — word-boundary it. Every other term here is either a multi-char
// phrase specific enough to be safe as a substring, or Arabic (compounds attach, so
// substring matching is the existing convention `isAccessoryTitle` already uses).
const WORD_BOUNDARY_TERMS = new Set(['mic']);

function firstIndexOfAny(text: string, terms: string[]): number {
  let min = -1;
  for (const term of terms) {
    const i = WORD_BOUNDARY_TERMS.has(term)
      ? (text.match(new RegExp(`\\b${term}\\b`))?.index ?? -1)
      : text.indexOf(term);
    if (i !== -1 && (min === -1 || i < min)) min = i;
  }
  return min;
}

export function isAccessoryOnlyAudioTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  if (!isAccessoryTitle(title)) return false; // no accessory word at all — nothing to veto
  const t = title.toLowerCase();
  // ORDER matters, not just presence: "Universal Hard Carrying Case for Wireless
  // Earbuds" names "earbuds" only as the accessory's COMPATIBILITY TARGET, appearing
  // AFTER the accessory word — that is still a pure accessory. A genuine product names
  // its device noun as the SUBJECT, appearing BEFORE any accessory word it also mentions
  // ("AirPods Pro 3 Earbuds, ... Charging Case" / "سماعات AirPods Pro ... مع حافظة").
  const accessoryIdx = firstIndexOfAny(t, ACCESSORY_INDICATORS);
  const deviceIdx = firstIndexOfAny(t, AUDIO_DEVICE_NOUNS);
  if (deviceIdx !== -1 && deviceIdx < accessoryIdx) return false;
  return true;
}

function containsKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

/**
 * Bare English "speaker" — deliberately NOT in `CATEGORY_KEYWORDS.audio`'s general
 * full-title list, unlike "bluetooth speaker"/"soundbar"/every other audio keyword there
 * (and unlike Arabic "سبيكر", already present and full-title — English was the measured gap).
 *
 * MEASURED (2026-08-21, live production audit): a plain full-title match would correctly
 * catch genuine standalone speakers (`"Jbl Portable Speaker Go Essential Black"`, `"Sony
 * Wireless Party Speaker…"`, `"Xiaomi Sound Pocket Mini Speaker…"` — all miscategorized under
 * `accessories` today) — but it would ALSO catch a REAL gaming console (`"ROG Ally X XBOX
 * Gaming Console … Dolby Speaker TYPE C …"`) and a mini projector, both of which only mention
 * a built-in speaker as a feature deep in their spec list. Monitor/laptop/tv/tablet titles
 * have the exact same "Built-in Speakers" feature-mention pattern but are already safe: their
 * OWN device-noun keyword is checked earlier in `CATEGORY_DETECTION_ORDER` and wins first.
 * `gaming`/`camera`/`kitchen`/`appliance` are checked AFTER `audio`, so they have no such
 * protection — a bare full-title "speaker" would silently reclassify a real gaming console
 * as `audio`.
 *
 * A genuine speaker PRODUCT names itself in the title HEAD (`"Jbl Portable Speaker Go…"`,
 * index 13); a device that merely HAS a speaker mentions it deep in the spec list (`"…Dolby
 * Speaker TYPE C…"`, index 172). Live-measured across every confirmed case: every genuine
 * speaker's "speaker" sits at index ≤ 48; both false-positive risks sit at index ≥ 90 — a
 * 42-character gap. Head-anchored to 55, same "a listing names itself in the head" principle
 * `isAccessoryTitleHead` already uses.
 */
const BARE_SPEAKER_HEAD_LEN = 55;
function isBareSpeakerTitleHead(title: string): boolean {
  const idx = title.toLowerCase().indexOf('speaker');
  return idx !== -1 && idx <= BARE_SPEAKER_HEAD_LEN;
}

/**
 * تصنيف من العنوان — يرجع دائماً قيمة.
 * الافتراضي: accessories
 *
 * MEASURED DEFECT (2026-08-21): 'smartphone' and 'audio' matched on the DEVICE NAME
 * embedded inside an accessory title — "غطاء ايفون 16 برو" ("iPhone 16 Pro case")
 * contains "ايفون"; "حافظة سماعات الأذن" ("earphone case") contains "سماعات" — so a
 * phone case or earbuds case was classified as the device itself. Live-measured: 65 of
 * 568 (11.4%) `products.category='smartphone'` and 14 of 923 (1.5%) `category='audio'`
 * were accessories, not the device. `classifyFromTitle` already guarded against this
 * (`looksLikeAccessory` before its loop); `determineCategory` — the function the
 * scrapers actually call to WRITE `products.category` — never did.
 *
 * Head-anchored (`isAccessoryTitleHead`, ADR-243 precedent) rather than full-title: an
 * ACCESSORY LISTING names itself in the title head ("غطاء ايفون…" at position 0), while
 * a genuine device merely SHIPPING WITH one mentions it later ("Apple Watch Ultra …
 * Titanium Case"). Head-only keeps the veto for real accessory listings without
 * regressing devices that ship with an accessory. Scoped to smartphone/audio only —
 * the two categories measured affected; not a blanket veto over every category.
 */
export function determineCategory(title: string): ProductCategory {
  const t = title.toLowerCase();
  for (const category of CATEGORY_DETECTION_ORDER) {
    const matchesAudioByBareSpeaker = category === 'audio' && isBareSpeakerTitleHead(title);
    if (containsKeyword(t, CATEGORY_KEYWORDS[category] ?? []) || matchesAudioByBareSpeaker) {
      if ((category === 'smartphone' || category === 'audio') && isAccessoryTitleHead(title)) {
        continue;
      }
      return category as ProductCategory;
    }
  }
  return 'accessories';
}

/**
 * مصنّف بثقة عالية — يرجع null إذا لم يكن متأكداً.
 * لا يرجع accessories أبداً.
 */
export function classifyFromTitle(title: string): ProductCategory | null {
  if (!title) return null;
  const t = title.toLowerCase();
  if (looksLikeAccessory(t)) return null;
  for (const category of CATEGORY_DETECTION_ORDER) {
    if (category === 'accessories') continue;
    if (containsKeyword(t, CATEGORY_KEYWORDS[category] ?? [])) {
      return category as ProductCategory;
    }
  }
  return null;
}

/**
 * هل المنتج ينتمي لهذه الفئة؟
 */
export function matchesCategory(
  product: {
    category?: ProductCategory | string;
    name_en?: string | null;
    name_ar?: string | null;
  },
  category: ProductCategory,
): boolean {
  if (product.category && product.category !== 'accessories') {
    return product.category === category;
  }
  if (category === 'accessories' && product.category === 'accessories') {
    return true;
  }
  const title = product.name_en || product.name_ar || '';
  return title ? determineCategory(title) === category : false;
}
