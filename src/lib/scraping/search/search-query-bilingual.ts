/**
 * Gulf / Saudi retailers often index Arabic titles in WooCommerce search.
 * Latin-only queries (e.g. "freezer") return few results until the Arabic term (فريزر) is used.
 * We expand the search and boost relevance when English tokens align with known Arabic equivalents.
 */

/** Multi-word English phrases → Arabic (longer phrases first for replacement) */
const PHRASE_EN_AR: Array<[string, string]> = [
  ['washing machine', 'غسالة'],
  ['washing machines', 'غسالة'],
  ['air conditioner', 'مكيف'],
  ['air conditioners', 'مكيف'],
  ['coffee machine', 'ماكينة قهوة'],
  ['coffee maker', 'ماكينة قهوة'],
  ['deep freezer', 'فريزر'],
  ['chest freezer', 'فريزر صدر'],
  ['rice cooker', 'طباخ أرز'],
  ['water dispenser', 'برادة ماء'],
  ['vacuum cleaner', 'مكنسة كهربائية'],
  ['food processor', 'محضرة طعام'],
  ['stand mixer', 'عجانة'],
  ['hand mixer', 'خفاقة'],
  ['air fryer', 'قلاية هوائية'],
  ['electric kettle', 'غلاية كهربائية'],
  ['water heater', 'سخان ماء'],
  ['gaming chair', 'كرسي ألعاب'],
  ['sound bar', 'ساوند بار'],
  ['smart watch', 'ساعة ذكية'],
  ['smart tv', 'تلفزيون ذكي'],
  ['smart phone', 'هاتف ذكي'],
  ['smartphone', 'هاتف ذكي'],
  ['cell phone', 'جوال'],
  ['mobile phone', 'جوال'],
  ['memory card', 'ذاكرة'],
  ['power bank', 'بطارية متنقلة'],
  ['wireless charger', 'شاحن لاسلكي'],
  ['screen protector', 'واقي شاشة'],
];

const PHRASES_BY_LENGTH = [...PHRASE_EN_AR].sort((a, b) => b[0].length - a[0].length);

/** Single English tokens → Arabic (lowercase keys) */
const WORD_EN_AR: Record<string, string> = {
  freezer: 'فريزر',
  freezers: 'فريزر',
  refrigerator: 'ثلاجة',
  refrigerators: 'ثلاجة',
  fridge: 'ثلاجة',
  fridges: 'ثلاجة',
  microwave: 'مايكرويف',
  oven: 'فرن',
  ovens: 'فرن',
  dishwasher: 'جلاية صحون',
  dryer: 'مجفف',
  vacuum: 'مكنسة',
  blender: 'خلاط',
  kettle: 'غلاية',
  heater: 'سخان',
  toaster: 'محمصة',
  iron: 'مكواة',
  humidifier: 'مرطب',
  purifier: 'منقي',
  dehumidifier: 'مزيل رطوبة',
  hood: 'شفاط',
  cooktop: 'موقد',
  hob: 'موقد',
  stove: 'موقد',
  tv: 'تلفزيون',
  television: 'تلفزيون',
  monitor: 'شاشة',
  laptop: 'لابتوب',
  tablet: 'تابلت',
  desktop: 'كمبيوتر مكتبي',
  printer: 'طابعة',
  scanner: 'ماسح',
  router: 'راوتر',
  modem: 'مودم',
  speaker: 'سماعة',
  speakers: 'سماعات',
  headphone: 'سماعة',
  headphones: 'سماعات',
  earbuds: 'سماعات',
  earphones: 'سماعات',
  camera: 'كاميرا',
  lens: 'عدسة',
  console: 'كونسول',
  controller: 'يد تحكم',
  keyboard: 'لوحة مفاتيح',
  mouse: 'فأرة',
  cable: 'كيبل',
  charger: 'شاحن',
  adapter: 'محول',
  battery: 'بطارية',
  fan: 'مروحة',
  bulb: 'لمبة',
  lamp: 'مصباح',
};

function hasArabicScript(s: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(s);
}

/**
 * Build a secondary search string with Arabic retail terms so WordPress / regional sites return results.
 */
function buildArabicSearchVariant(query: string): string | null {
  const trimmed = query.trim();
  if (!trimmed || hasArabicScript(trimmed)) return null;

  let working = trimmed;
  let lower = working.toLowerCase();

  for (const [en, ar] of PHRASES_BY_LENGTH) {
    if (lower.includes(en)) {
      working = working.replace(new RegExp(en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ar);
      lower = working.toLowerCase();
    }
  }

  const tokens = working.split(/\s+/);
  const replaced = tokens.map((token) => {
    const alpha = token.toLowerCase().replace(/[^a-z0-9]/gi, '');
    if (!alpha) return token;
    const ar = WORD_EN_AR[alpha];
    return ar ?? token;
  });

  const candidate = replaced.join(' ').trim();
  if (!hasArabicScript(candidate)) return null;
  if (candidate === trimmed) return null;
  return candidate;
}

/**
 * Returns search strings to run (original first, then Arabic-augmented variant if applicable).
 */
export function expandQueriesForRetailSearch(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const ar = buildArabicSearchVariant(trimmed);
  if (!ar) return [trimmed];

  const out = [trimmed, ar];
  return Array.from(new Set(out));
}

/**
 * Extra relevance when the user typed English but product titles are Arabic (Gulf stores).
 */
export function getBilingualRelevanceBoost(normalizedQuery: string, titleLower: string): number {
  let bonus = 0;
  const q = normalizedQuery;

  for (const [en, ar] of PHRASE_EN_AR) {
    if (q.includes(en) && titleLower.includes(ar.toLowerCase())) {
      bonus += 18;
    }
  }

  for (const [en, ar] of Object.entries(WORD_EN_AR)) {
    try {
      if (new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(q)) {
        if (titleLower.includes(ar.toLowerCase())) {
          bonus += 12;
        }
      }
    } catch {
      /* ignore bad regex */
    }
  }

  return Math.min(bonus, 40);
}
