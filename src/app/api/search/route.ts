import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import type { ScrapedSearchResult } from '@/lib/scraping/search-types';
import type { GroupedSearchProduct } from '@/lib/scraping/search/product-grouper';
import type { SearchProduct } from '@/lib/scraping/search/types';
import type { ProductCategory } from '@/lib/database/types';
import { extractSpecsFromTitle } from '@/lib/scraping/config/spec-configs';
import { searchAlgolia, isAlgoliaConfigured, type AlgoliaHit } from '@/lib/algolia/search';
import { identityKeyToSlug } from '@/lib/catalog/getProductComparison';
import { isApprovedStore, isDisplayableRetailer, resolveApprovedSlug, retailerDisplayName } from '@/lib/retailers/approved-retailers';
import { normalizeExitUrl } from '@/lib/retailers/exit-url';
import { routeQuery } from '@/lib/agent/route-query';
import type { CompareIntent } from '@/lib/agent/compare-intent';
import { parseShoppingTask } from '@/lib/agent/task-parser';
import { resolveComparisonRoute } from '@/lib/agent/resolve-comparison';
import { hoursSince, PICK_FRESHNESS_MAX_HOURS, productTrust, type TrustAssessment } from '@/lib/intelligence/evidence-engine';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

interface SearchBody {
  query?: string;
  category?: ProductCategory | string;
  page?: number;
  pageSize?: number;
  pages?: number;
  sort?: string;
  min_price?: number;
  max_price?: number;
  brand?: string;
  brands?: string[];
  stores?: string[];
  availability?: string[];
  deals_only?: boolean;
  free_delivery_only?: boolean;
  in_stock_only?: boolean;
  specs?: Record<string, string[]>;
  discount?: number;
}

interface ProductRow {
  id: string;
  name_ar: string;
  name_en: string;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  product_stores: ProductStoreRow[];
}

interface ProductStoreRow {
  id: string;
  store_name: string | null;
  current_price: number;
  original_price: number | null;
  availability: 'in_stock' | 'out_of_stock' | 'limited_stock' | 'pre_order' | null;
  product_url: string;
  coupon_code: string | null;
  stores?: { name: string | null } | null;
}

interface CanonicalProductRow {
  id: string;
  name_ar: string;
  name_en: string;
  brand: string | null;
  image_url: string | null;
  model_number: string | null;
  tps_identity_key: string | null;
  // compare_url قد لا يكون موجوداً، لذا نجعله optional
  compare_url?: string | null;
  category?: string | null;
}

type DecisionTopMatch = {
  product_id: string;
  name_ar: string;
  best_price: number;
  store_count: number;
  availability: string;
  rating: number;
  product_url: string;
  store_name: string;
  reason_ar: string;
};

type DecisionLayer = {
  decisionCard: {
    title: string;
    best_price: number;
    store_name: string;
    product_url: string;
    store_count: number;
    reason_ar: string;
    is_tps: boolean;
    // ADR-136 — the surface that HONOURS the store count this card claims. The Smart Pick
    // used to render "مقارنة موثقة · متوفر في 3 متاجر" whose only link was a single-store
    // `/go/<id>` exit: a comparison claim with no comparison to go to. When this is null the
    // card must not claim a store count at all (unknown beats incorrect).
    compare_url: string | null;
    // ADR-193 — the observation time behind the claimed best price (the best-price store's
    // own latest row). Null on live-scraped picks, whose observation is this request.
    last_observed_at: string | null;
    // ONE TAWVEERI BRAIN (2026-08-09): the "our pick" claim now cites the SAME evidence-
    // engine trust computation Waffar's decide() route uses (productTrust), instead of
    // being backed only by the private scoreProduct() ranking heuristic that chose it.
    // Does NOT change which product wins — scoreProduct still ranks the whole grid,
    // untouched — this only makes the WINNING pick's trust claim shared/citable rather
    // than implicit. See buildDecisionLayer().
    trust: TrustAssessment;
  } | null;
  topMatches: DecisionTopMatch[];
};

import { normalizeArabic } from '@/lib/search/arabic-normalize';
import { expandQueriesForRetailSearch } from '@/lib/scraping/search/search-query-bilingual';

const ARABIC_TO_ENGLISH: Record<string, string[]> = {
  'جوال': ['phone', 'smartphone', 'mobile'],
  'هاتف': ['phone', 'smartphone', 'mobile'],
  'ايفون': ['iphone', 'apple'],
  'سامسونج': ['samsung'],
  // PLURAL FORMS (measured 2026-08-04, docs/baselines/2026-08-04-ac-basket-query): the six
  // matrix pairs showed plurals with no expansion entry form a relevance group of the bare
  // plural string, which almost no product title contains — «شاشات» collapsed 48 → 1
  // result, «جوالات» returned mixed junk. Each plural carries its English expansion AND its
  // Arabic SINGULAR, because catalogue titles are written in the singular.
  'جوالات': ['phone', 'smartphone', 'mobile', 'جوال'],
  'هواتف': ['phone', 'smartphone', 'mobile', 'هاتف'],
  'شاشات': ['tv', 'monitor', 'screen', 'display', 'شاشة'],
  'ثلاجات': ['refrigerator', 'fridge', 'ثلاجة'],
  'غسالات': ['washing machine', 'washer', 'غسالة'],
  'لابتوبات': ['laptop', 'notebook', 'لابتوب'],
  'لابتوب': ['laptop', 'notebook'],
  'حاسوب': ['laptop', 'computer'],
  'كمبيوتر': ['computer', 'laptop', 'desktop'],
  'تلفزيون': ['tv', 'television'],
  'شاشة': ['tv', 'monitor', 'screen', 'display'],
  'سماعات': ['headphones', 'earbuds', 'audio'],
  'سماعة': ['headphone', 'earbuds', 'speaker'],
  'مكيف': ['split ac', 'air conditioner', 'ac'],
  'مكيفات': ['split ac', 'air conditioner', 'ac', 'مكيف'],
  // EN→AR mirror for the AC noun (measured 2026-08-04 after-run): most AC titles are
  // Arabic-only, so the EN word-group could never match them and the EN basket sentence
  // fell to the honest-zero path. Same map, same mechanism, opposite direction.
  'conditioner': ['مكيف', 'سبليت'],
  'conditioners': ['conditioner', 'مكيف', 'سبليت'],
  'سبليت': ['split'],
  'شباك': ['window'],
  'ثلاجة': ['refrigerator', 'fridge'],
  'فريزر': ['freezer'],
  'غسالة': ['washing machine', 'washer'],
  'نشافة': ['dryer'],
  'مكنسة': ['vacuum', 'cleaner'],
  // The catalogue spells it مايكرويف (no و after ر) on EVERY microwave canonical, so a
  // shopper typing either of the two common forms must still reach it — expansion carries
  // the catalogue's spelling as a term, not just the English word.
  'مايكروويف': ['microwave', 'مايكرويف'],
  'ميكروويف': ['microwave', 'مايكرويف'],
  'مايكرويف': ['microwave'],
  'فرن': ['oven'],
  'طابعة': ['printer'],
  'راوتر': ['router', 'wifi', 'network'],
  'كاميرا': ['camera'],
  'ساعة': ['smartwatch', 'watch'],
  'تابلت': ['tablet'],
  'غسالة صحون': ['dishwasher'],
  'جلاية': ['dishwasher'],
  'قلاية': ['air fryer', 'fryer'],
  'قلايه هوائية': ['air fryer', 'fryer'],
  'صانعة قهوة': ['coffee maker', 'coffee machine', 'espresso'],
  'ماكينة قهوة': ['coffee maker', 'coffee machine', 'espresso'],
  'مجفف': ['dryer'],
  'خلاط': ['blender'],
  'عصارة': ['juicer'],
  'محمصة': ['toaster'],
  'مكواة': ['iron', 'steamer'],
  'ايباد': ['ipad'],
  'تاب': ['tab', 'tablet'],
  'واتش': ['watch', 'smartwatch'],
  'ابل': ['apple'],
  'جالكسي': ['galaxy'],
  'صحون': ['dishwasher'],
  'اطباق': ['dishwasher'],
  'قهوة': ['coffee', 'espresso'],
  'قيمنق': ['gaming'],
  'قيمنج': ['gaming'],
  'جيمنج': ['gaming'],
  'جيمينج': ['gaming'],
  'برو': ['pro'],
  'ماكس': ['max'],
  'بلس': ['plus'],
  'الترا': ['ultra'],
  'ميني': ['mini'],
  'اير': ['air'],
};

// BUG FIX (Founder product-first audit 2026-07-27): the map keys keep ة/ى (ثلاجة, غسالة, نشافة, مكنسة,
// سماعة, قلاية …) but query words are normalizeArabic-folded (ة→ه, ى→ي) BEFORE lookup — so every
// appliance term ending in ة silently missed its English expansion, and "ثلاجة" returned 0 while 292
// refrigerators sat in the catalogue under English names. This normalized index makes the folded query
// word hit its expansion. (Terms without ة/ى — مكيف, لابتوب, تلفزيون — worked already; that's why the
// bug hid.)
const ARABIC_TO_ENGLISH_NORM: Record<string, string[]> = Object.fromEntries(
  Object.entries(ARABIC_TO_ENGLISH).map(([k, v]) => [normalizeArabic(k), v]),
);
// MEASURED DEFECT (2026-08-10, D→E mission Part F — re-verification sweep): sorting "مكيف"
// lowest-price-first put AIR FRYERS (383–1110 SAR) and even a "تابلت Air Tab" tablet ABOVE
// every genuine air conditioner (which start at 1065 SAR) — worse than an accessory leaking
// in, since these products share NO real relationship to an AC at all. Root cause traced to
// `ARABIC_TO_ENGLISH['مكيف'] = ['split ac', 'air conditioner', 'ac']`: each phrase is split
// into INDIVIDUAL words and added to Algolia as OPTIONAL terms (any single-word match
// returns the record) — so "air conditioner" silently injects bare "air" as its own optional
// word, and "air" alone is one of the most generic tokens in English product titles (Air
// Fryer, Air Tab, AirPods, Nike Air, …). `compareBySort`'s price-sort branch does not consult
// relevance scoring AT ALL (only the accessory-hint tiebreak, which "air fryer" never
// matches) — so once "air" pulls an unrelated product into the candidate set, sorting by
// price lets it rise straight to the top unchecked. This is the SAME "price must never make
// an ineligible product eligible" invariant Part B's `excludeIneligibleCandidates` already
// enforces for accessories — but that filter's two signals (accessory-hint keywords,
// statistical price floor) cannot catch a wrong-category product that is neither accessory-
// shaped nor abnormally cheap relative to the (already-contaminated) candidate set's own
// median. The fix belongs upstream, at the point where a phrase becomes optional SEARCH
// terms: a token proven too generic to signal product identity on its own must never be
// injected as a standalone optional word, regardless of which phrase it came from.
// MEASURED DEFECT, five more (2026-08-10, same session, founder follow-up "check other
// categories for the same bare-token leak"): the same mechanism recurred wherever a category
// mapped to a generic English word describing a FEATURE rather than the product itself —
// confirmed live, not guessed:
//   - "شاشة"/"شاشات" → 'display' put a SMARTWATCH (its spec sheet says "1.83in HD Display")
//     into monitor/TV results.
//   - "راوتر" → 'wifi'/'network' severely polluted router results with WiFi security
//     cameras, a smart plug, and mini projectors — every smart-home device advertises WiFi.
//   - "مكنسة" → 'cleaner' pulled in a phone-cleaning-kit accessory (a "cleaner" for phones,
//     not a vacuum cleaner).
//   - "غسالة" → 'washer' put a "Karcher Pressure Washer" at position #1 (the CHEAPEST
//     result) of an otherwise all-genuine washing-machine list. Same query's 'washing
//     machine' phrase also injects bare 'machine' — independently confirmed earlier this
//     session pulling coffee machines/ice makers/game consoles into washing-machine results
//     (at the time mischaracterized as "a different mechanism, out of scope"; it is not —
//     same root cause as every entry here, corrected once the mechanism was fully traced).
// In every case the GENUINE results for that category were already Arabic-titled and matched
// natively without needing the stoplisted word at all (verified against the live candidate
// set before stoplisting each one) — so removing these costs no real recall, unlike "ac"
// (kept; see `hasStrongACSignal` for why that one needed a different fix).
// MEASURED DEFECT (2026-08-10, D→E mission Part F, founder follow-up "check other categories
// for the same leak"): sorting "مكواة" (clothes iron) lowest-price-first returned ZERO
// genuine irons in its top 15 — every result was an unrelated cooking appliance (electric
// pots, food steamers, pressure cookers, waffle/sandwich makers, grills). `ARABIC_TO_ENGLISH['مكواة']
// = ['iron', 'steamer']` injects both as bare optional words: "steamer" matches FOOD
// steamers (a completely different kitchen category) and "iron" matches "waffle iron"/
// "cast iron" cookware. The catalog DOES have genuine irons (several Black & Decker steam
// irons, confirmed via a more specific query) — they were simply buried under far more
// cooking-appliance contamination once ranked by price alone.
export const GENERIC_EXPANSION_STOPWORDS = new Set(['air', 'display', 'wifi', 'network', 'cleaner', 'washer', 'machine', 'iron', 'steamer']);

function lookupArToEn(word: string): string[] | undefined {
  // `.toLowerCase()` matters for the LATIN keys (conditioner/conditioners): a typed
  // "Conditioners" otherwise misses its expansion — the same case trap that let an
  // uppercase "SAR" through the stopword filters (2026-08-04).
  const lw = word.toLowerCase();
  return (
    ARABIC_TO_ENGLISH[lw] ||
    ARABIC_TO_ENGLISH[normalizeArabic(lw)] ||
    ARABIC_TO_ENGLISH_NORM[normalizeArabic(lw)]
  );
}

const ACCESSORY_HINTS_AR = ['حامل', 'فتحة', 'موجه', 'غطاء', 'كفر', 'ملحق', 'ملحقات', 'حافظة', 'واقي', 'شاحن', 'كيبل', 'سلك', 'لاصقة', 'حماية', 'استاند', 'عدسة', 'ماجسيف', 'جراب', 'سماعه اذن',
  // A bag for a laptop is not a laptop (measured 2026-07-29: "Lenovo Laptop Bag T210" was
  // the Smart Pick for the query `laptop`, in both locales).
  'حقيبة', 'حقائب', 'شنطة',
  // MEASURED (2026-08-10, D→E mission Part F cross-category sweep): sorting "فرن" (oven)
  // lowest-price-first put an oven baking TRAY and an oven THERMOMETER — accessories FOR an
  // oven, not ovens — above every genuine oven (which start at 220 SAR).
  'صينية', 'صواني', 'مقياس حرارة',
  // MEASURED (2026-08-10, same sweep, continued): "مايكروويف" put a microwave SHELF/rack
  // (79 SAR) and a microwave timer SWITCH/knob (109.7 SAR) above every genuine microwave
  // (starting at 189 SAR) — "shelf" was already in ACCESSORY_HINTS_EN but missing from the
  // Arabic list. "قلاية" put silicone egg-mold TRAY inserts FOR an air fryer at position #1.
  'رف', 'مفتاح', 'قوالب',
  // MEASURED (2026-08-10, D→E mission Part F, fifth "check other categories" follow-up):
  // "خلاط" (blender) surfaced a "Blender Bottle"-brand protein SHAKER (78.2 SAR — its own
  // title says "زجاجة شيكر... من بليندر بوتل", a shaker bottle, not a blender at all) and a
  // Kenwood TRAVEL CUP accessory "for" specific blender models (96.25 SAR, "كوب سفر للخلاط").
  // Neither is a brand-name-matching problem needing new logic — both are the SAME
  // accessory-hint-list gap as the oven/microwave/air-fryer fixes above, just missing
  // keywords. A genuinely different item in the same result set ("زجاجة خلط البروتين
  // الكهربائية...خلاط محمول" — explicitly self-described as a PORTABLE ELECTRIC blender) was
  // deliberately left untouched: no evidence it is anything other than what it says.
  'شيكر', 'كوب سفر'];
const ACCESSORY_HINTS_EN = ['accessory', 'accessories', 'cover', 'mount', 'holder', 'vent', 'adapter', 'charger', 'cable', 'case', 'remote', 'bracket', 'protector', 'stand', 'sticker', 'skin', 'lens', 'magsafe', 'tempered',
  // compatible peripherals that keyword-match a device but are NOT the device itself
  'mouse', 'keyboard', 'stylus',
  // consumables/parts/organizers that keyword-match an appliance but are NOT the appliance itself
  'organizer', 'liner', 'disposable', 'replacement', 'refill', 'spare part', 'storage bag', 'storage box', 'paper liner', 'cleaning brush', 'descaler', 'filter cartridge', 'water filter', 'ice tray', 'ice mold', 'shelf', 'drip tray',
  // dishwasher/washer consumables (detergent, not the appliance)
  'tablets', 'detergent', 'rinse aid', 'anti-limescale', 'limescale',
  // coffee servingware / warmers (not a coffee MAKER)
  'cup heater', 'cup warmer', 'mug warmer', 'coffee server', 'carafe',
  // carrying goods that keyword-match the device they carry
  'bag', 'sleeve', 'backpack', 'briefcase', 'messenger', 'pouch'];

// Compatibility phrasing is a strong accessory signal: an item described as
// "compatible with" or "for" a phone IS an accessory for that phone, not the
// phone itself. These patterns caught real trust failures in production
// (a phone case surfaced as the top result and "smart pick" for "iphone 15").
const ACCESSORY_COMPAT_AR = /متوافق|مخصص\s+ل|(?:^|\s)ل(?:هاتف|جوال|ايفون|آيفون|سامسونج|جالاكسي)/;
const ACCESSORY_COMPAT_EN = /\bcompatible\b|\bfor\s+(?:iphone|samsung|galaxy|apple|xiaomi|huawei)\b/;

const MAIN_PRODUCT_TYPES = new Set<string>([
  'جوال', 'هاتف', 'ايفون', 'جوالات', 'هواتف',
  'مكيف', 'مكيفات', 'سبليت',
  'لابتوب', 'حاسوب', 'كمبيوتر',
  'تلفزيون', 'شاشه', 'شاشات',
  'ثلاجه', 'ثلاجات', 'فريزر', 'غساله', 'غسالات', 'نشافه', 'مكنسه', 'لابتوبات',
  'مايكروويف', 'ميكروويف', 'فرن', 'طابعه', 'راوتر', 'كاميرا', 'ساعه', 'تابلت',
  'ايباد', 'واتش', 'تاب', 'جالكسي',
  'سماعه', 'سماعات',
  // BILINGUAL ASYMMETRY (measured 2026-07-31): 'جالكسي' was here but 'galaxy' was not, so
  // `Galaxy S24 Ultra 512` was not treated as a product-type query — which switches OFF
  // both the relevance gate and the accessory penalty. Result: we returned a Samsung
  // Galaxy A07 64GB while "Samsung Galaxy S S24 Ultra 512GB" sat in the catalogue. The
  // right product existed and we showed the wrong one. Third bug of this exact class,
  // after the ة/ى folding and the برو/pro generic-stripping ones.
  'galaxy', 'macbook', 'ipad', 'airpods', 'pixel',
  // 'conditioner(s)': the EN phrase "air conditioner(s)" carried NO main-product word, so
  // the relevance gate never engaged for it and the EN basket sentence kept junk results
  // while the AR one was fixed (measured 2026-08-04 after-run). 'air' alone stays generic.
  'conditioner', 'conditioners',
  'phone', 'iphone', 'smartphone', 'mobile', 'laptop', 'tv', 'television',
  'refrigerator', 'fridge', 'freezer', 'washer', 'dryer', 'vacuum',
  'microwave', 'oven', 'printer', 'router', 'camera', 'tablet', 'headphones',
]);

/**
 * CANDIDATE ELIGIBILITY, GENERICALLY (2026-08-09, D→E mission, Section 6 — the founder's
 * "cable ranked as a phone recommendation" production failure).
 *
 * AUDITED (not the specific bug — that is fixed at the call site by routing follow-up/
 * mutation sentences away from this endpoint entirely, see `mutation-turn.ts`): when
 * `isMainProductTypeQuery` is false, the relevance/category gate below is SKIPPED
 * unconditionally — whatever Algolia/Supabase's word-level fuzzy match returned is served
 * unfiltered. That is true for ANY caller, not only a follow-up sentence: a sentence-shaped
 * query with no recognized product-type noun reaching this endpoint by any path had no
 * category boundary at all.
 *
 * This is the generic fix Section 6 asks for — not "detect this one phrasing", but "a
 * sentence with no product-type noun is not a product query, regardless of why it arrived
 * here". A real product search is almost never 6+ words or phrased as a question; when a
 * query has neither a recognized product-type noun NOR product-search shape, honest zero
 * (matching the SAME "zero beats wrong" precedent `categoryEnforcedZero` already uses just
 * below) is safer than serving whatever a fuzzy match happened to surface.
 */
export function looksLikeSentenceNotProductQuery(raw: string): boolean {
  const words = raw.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 6) return true; // a real product query is almost never this long
  // Space-padded on BOTH sides, markers required to have a space on both sides too — the
  // same CHECKPOINT #17 lesson this codebase has already paid for elsewhere: `\b` never
  // matches beside Arabic letters, and a bare substring check is worse — «مكيف» (AC)
  // contains «كيف» ("how") as a substring, so an unpadded/one-sided check would misfire on
  // an ordinary AC query. Requiring spaces on BOTH sides of the marker is what a real word
  // boundary means here.
  return /[؟?]| وش | ليش | كيف | هل | متى | وين /.test(` ${words.join(' ')} `);
}

function isMainProductTypeQuery(raw: string): boolean {
  const norm = normalizeArabic(raw).toLowerCase();
  const words = norm.split(/\s+/).filter(Boolean);
  return words.some((w) => MAIN_PRODUCT_TYPES.has(w));
}

// Determine the SINGLE canonical category to search for a query, so we never
// fetch both mobile and AC canonicals indiscriminately. Accessory queries get
// no TPS canonical (a Smart Pick must not surface for an accessory search).
// Clearly-AC queries → air_conditioner. Everything else → mobile (preserves all
// existing mobile behavior; non-matching queries simply return []).
const AC_QUERY_WORDS = new Set(['مكيف', 'مكيفات', 'سبليت', 'شباك', 'كاسيت', 'دولابي', 'ac']);

/**
 * Query → canonical categories to search for a verified comparison.
 *
 * MEASURED DEFECT (2026-07-29): this returned ONLY 'mobile' or 'air_conditioner', so
 * `searchTPSCanonical` — the sole source of multi-store comparison cards — could never
 * look at any other category. Of the 459 canonicals carrying live offers from ≥2 approved
 * retailers, only 132 (mobile 81 + AC 51) were reachable. The other 323 were comparable,
 * present, corroborated, and impossible for a customer to find:
 *   tv 65 · tablet 55 · washing_machine 48 · monitor 34 · audio 30 · laptop 28 ·
 *   smartwatch 27 · printer 12 · refrigerator 11 · dishwasher 5 · vacuum 3 · camera 3 ·
 *   microwave 1 · kettle 1
 * That is 3.4x the reachable comparison inventory, already paid for — no acquisition, no
 * credentials, no merchant negotiation. Cheaper than onboarding a store, and it lands first.
 *
 * Terms are matched on the NORMALIZED query (ة→ه, ى→ي), so keys are written folded.
 * Order matters: the most specific phrase wins (غساله صحون → dishwasher, not washing_machine).
 */
const CATEGORY_QUERY_TERMS: Array<{ cats: string[]; terms: string[] }> = [
  // Specific multi-word phrases first — they would otherwise be caught by a broader term.
  { cats: ['dishwasher'], terms: ['غساله صحون', 'جلايه', 'dishwasher', 'صحون', 'اطباق'] },
  { cats: ['air_conditioner'], terms: ['مكيف', 'مكيفات', 'سبليت', 'شباك', 'كاسيت', 'دولابي', 'split ac', 'air condition'] },
  { cats: ['washing_machine'], terms: ['غساله', 'غسالات', 'washer', 'washing machine', 'نشافه', 'dryer'] },
  { cats: ['refrigerator'], terms: ['ثلاجه', 'ثلاجات', 'refrigerator', 'fridge', 'فريزر', 'freezer'] },
  { cats: ['tv', 'monitor'], terms: ['تلفزيون', 'تلفاز', 'شاشه', 'شاشات', 'tv', 'television', 'monitor', 'display'] },
  { cats: ['laptop'], terms: ['لابتوب', 'laptop', 'notebook', 'macbook', 'ماك بوك', 'حاسوب', 'كمبيوتر', 'chromebook'] },
  { cats: ['tablet'], terms: ['ايباد', 'ipad', 'تابلت', 'tablet', 'تاب'] },
  { cats: ['smartwatch'], terms: ['ساعه', 'ساعات', 'smartwatch', 'واتش', 'apple watch', 'جالكسي واتش'] },
  { cats: ['audio'], terms: ['سماعه', 'سماعات', 'headphone', 'headphones', 'earbud', 'earbuds', 'مكبر صوت', 'speaker', 'soundbar', 'ايربودز', 'airpods'] },
  { cats: ['printer'], terms: ['طابعه', 'طابعات', 'printer'] },
  { cats: ['vacuum'], terms: ['مكنسه', 'vacuum'] },
  { cats: ['microwave'], terms: ['ميكروويف', 'مايكروويف', 'مايكرويف', 'microwave'] },
  { cats: ['camera'], terms: ['كاميرا', 'camera'] },
  { cats: ['mobile'], terms: ['جوال', 'جوالات', 'هاتف', 'هواتف', 'ايفون', 'iphone', 'phone', 'smartphone', 'mobile', 'جالكسي', 'galaxy', 'بكسل', 'pixel'] },
];

function detectCanonicalCategories(raw: string): string[] | null {
  const norm = normalizeArabic(raw).toLowerCase();
  if (
    ACCESSORY_HINTS_AR.some((h) => norm.includes(normalizeArabic(h))) ||
    ACCESSORY_HINTS_EN.some((h) => norm.includes(h)) ||
    ACCESSORY_COMPAT_AR.test(norm) || ACCESSORY_COMPAT_EN.test(norm)
  ) return null;

  // Short tokens must match as WHOLE WORDS. "ac" is a substring of black, macbook, jacket —
  // substring-matching it would route half the catalogue to air conditioners. (Caught by
  // `gree ac` regressing to mobile when this was first written as a substring match.)
  const words = norm.split(/\s+/).filter(Boolean);
  if (words.some((w) => AC_QUERY_WORDS.has(w))) return ['air_conditioner'];

  for (const entry of CATEGORY_QUERY_TERMS) {
    if (entry.terms.some((t) => norm.includes(normalizeArabic(t)))) return entry.cats;
  }
  // Unrecognised (e.g. a bare brand like "سامسونج"): keep the previous behaviour and look
  // in mobile rather than widening to every category, which would cost latency for no
  // measured gain. Widen only when a measurement says it pays.
  return ['mobile'];
}

// A full-device connectivity spec that ONLY a watch/phone BODY carries ("GPS + Cellular", "(GPS",
// "Wi-Fi + Cellular"). A protective case/band never lists it. Used to override a false accessory hit
// when the DEVICE's own wording ("Titanium Case", "with … Band") would otherwise misclassify it.
const DEVICE_SIGNAL_EN = /\bgps\s*\+\s*cellular\b|\(gps\b|\bwi-?fi\s*\+\s*cellular\b/;

function hasAccessoryHint(nameAr: string, nameEn: string): boolean {
  const ar = normalizeArabic(nameAr);
  const en = (nameEn || '').toLowerCase();
  const isCompat = ACCESSORY_COMPAT_AR.test(ar) || ACCESSORY_COMPAT_EN.test(en);
  const hasHint = ACCESSORY_HINTS_AR.some((h) => ar.includes(normalizeArabic(h))) ||
    ACCESSORY_HINTS_EN.some((h) => en.includes(h)) ||
    isCompat;
  if (!hasHint) return false;
  // Device override: a title with a full-device connectivity signal that is NOT a "for/compatible"
  // accessory IS the device itself (e.g. "Apple Watch Ultra (GPS + Cellular) - Titanium Case …").
  // Its own "Case"/"Band" wording must not sink it below the cheap protective cases.
  if (DEVICE_SIGNAL_EN.test(en) && !isCompat) return false;
  return true;
}

/**
 * Does the QUERY ITSELF ask for an accessory (2026-08-10, D→E mission Part B — the founder's
 * own distinction: "I want an iPhone 16" vs "I want an iPhone 16 case"). Reuses the SAME
 * accessory vocabulary `hasAccessoryHint` already applies to PRODUCT titles — this is the
 * missing other half: nothing previously checked whether the search text itself signals
 * accessory intent, so a genuine accessory search like «جراب ايفون» would set
 * `queryIsMainProduct=true` (from "ايفون") and then penalize/exclude the very cases the
 * shopper is asking for. Any eligibility exclusion keyed on `queryIsMainProduct` below must
 * be skipped when this returns true.
 */
export function isAccessoryShapedQuery(raw: string): boolean {
  const norm = normalizeArabic(raw).toLowerCase();
  return (
    ACCESSORY_HINTS_AR.some((h) => norm.includes(normalizeArabic(h))) ||
    ACCESSORY_HINTS_EN.some((h) => norm.includes(h)) ||
    ACCESSORY_COMPAT_AR.test(norm) || ACCESSORY_COMPAT_EN.test(norm)
  );
}

/**
 * CANDIDATE ELIGIBILITY, HARD (2026-08-10, D→E mission Part B — founder mandate: "FILTER
 * ELIGIBILITY FIRST. SORT SECOND. PRICE MAY RANK ELIGIBLE PRODUCTS. PRICE MUST NEVER MAKE AN
 * INELIGIBLE PRODUCT ELIGIBLE"). Two DISTINCT defects, one fix:
 *
 * (1) `hasAccessoryHint`-flagged products used to be handled ONLY by a SCORE penalty
 *     (`scoreProduct`'s `accessoryPenalty`) and a sort-tail rule (`compareBySort`) — both are
 *     RANKING treatments, not eligibility ones. Excluded here entirely instead: gone from the
 *     candidate set before any sort mode runs, so no sort (default, price-low, price-high)
 *     can ever surface one for a device query, by construction rather than convention.
 *
 * (2) MEASURED LIVE (production, "لابتوب" sorted lowest price first, 2026-08-10): "لابتوب
 *     pingcool PC18" (4 SAR), "لابتوب baseus SUZC-0G" (21 SAR — baseus is an accessory-only
 *     brand, never sold a laptop), "لابتوب لينوفو GX41K08218" (75 SAR), and an actual
 *     "internal speaker assembly for laptop" (101 SAR, tagged "hot deal") ALL ranked above
 *     every genuine laptop (cheapest real one ~196 SAR renewed). NONE of these matched
 *     `hasAccessoryHint`'s keyword list — the titles use brand names and cryptic model codes,
 *     not descriptive accessory words ("شاحن", "كفر", …), proving keyword matching alone
 *     cannot catch this class of junk. A genuine device of ANY category never sells for a
 *     small fraction of what every OTHER matching result costs — computed from the SAME
 *     candidate set already fetched (the median, robust to a handful of outliers, never the
 *     mean), not a guessed category-specific dollar floor, which this mission's own "unknown
 *     beats incorrect" principle forbids. 15% of the observed median leaves a genuine
 *     clearance-priced device (routinely 30-60% of median) untouched while catching every
 *     measured junk item above (all under 5% of the ~2,299+ SAR laptop median).
 *
 * Gated by the CALLER on `queryIsMainProduct && !isAccessoryShapedQuery(rawQuery)` — a
 * shopper explicitly searching for an accessory («شاحن لابتوب») must still see genuine
 * accessories; this exists to protect a DEVICE search from accessory junk, not to hide
 * accessories from someone who wants one. Never wipes the page: each stage only applies its
 * filter when the result is non-empty, so an unrelated/degenerate case falls back to the
 * unfiltered set rather than a confident (and possibly wrong) zero — `categoryEnforcedZero`
 * elsewhere already owns that decision for a genuinely unmatched query.
 */
export function excludeIneligibleCandidates<T extends { name_ar?: string | null; name_en?: string | null; best_price: number }>(
  products: T[],
  isAcQuery = false,
  isMonitorQuery = false,
  isWatchQuery = false,
): T[] {
  let result = products;
  const keywordFiltered = result.filter((p) => !hasAccessoryHint(p.name_ar || '', p.name_en || ''));
  if (keywordFiltered.length > 0) result = keywordFiltered;

  // MEASURED DEFECT (2026-08-10, D→E mission Part F — founder follow-up "fix the ac token
  // leak"): GENERIC_EXPANSION_STOPWORDS stops "air" from being injected as an Algolia
  // optional word, but "ac" itself was deliberately KEPT (removing it would hurt genuine AC
  // search recall — many real listings are literally titled "Split AC"/"Window AC"). Bare
  // "ac"/"a/c" is still too weak a signal on its own, though: it also matches "AC/DC-12V"
  // power specs on unrelated TVs and "802.11...ac..." Wi-Fi standard mentions on routers —
  // neither of which is an accessory (`hasAccessoryHint` correctly does not flag them) nor
  // abnormally cheap (865-1149 SAR, well inside the genuine AC price range), so neither of
  // this function's existing two signals could catch them. `hasStrongACSignal` requires a
  // COMPOUND AC-specific phrase (Arabic مكيف/سبليت/شباك/تكييف, or English "split ac"/
  // "window ac"/"air condition"/BTU/inverter/"cool only"/"hot & cool") rather than bare
  // "ac"/"a/c" alone — every genuine AC title observed in this mission's live testing
  // trivially satisfies at least one of these (BTU is near-universal AC listing vocabulary),
  // while "AC/DC" and "802.11...ac..." satisfy none.
  if (isAcQuery) {
    const acFiltered = result.filter((p) => hasStrongACSignal(p.name_ar || '', p.name_en || ''));
    if (acFiltered.length > 0) result = acFiltered;
  }

  // MEASURED DEFECT (2026-08-10, same session, founder follow-up "fix the شاشة
  // miscategorization too"): fixing the DB category (a smartwatch had been mistagged
  // `monitor` — see the CATEGORY_DETECTION_ORDER fix in category-utils.ts) did NOT fully
  // remove it from "شاشة" results, because it is ALSO reachable via a second, independent
  // path: bare "monitor" is a live Algolia optional word (kept — many genuine listings are
  // literally titled "Essential Monitor" with no other qualifier), and the smartwatch's own
  // title contains "Heart Rate/Sleep Monitor", matching it directly regardless of its DB
  // category field. `hasStrongMonitorSignal` requires a health-context "___ monitor" phrase
  // (heart rate/sleep/blood pressure/glucose/baby/fitness monitor) to be paired with an
  // actual DISPLAY-specific compound phrase (computer/gaming/curved/4k/ips/led/oled monitor)
  // before it counts — bare "monitor" with no health-context phrase still passes untouched,
  // so a genuine "Essential Monitor" listing loses nothing.
  if (isMonitorQuery) {
    const monitorFiltered = result.filter((p) => hasStrongMonitorSignal(p.name_ar || '', p.name_en || ''));
    if (monitorFiltered.length > 0) result = monitorFiltered;
  }

  // MEASURED DEFECT (2026-08-10, same session, founder follow-up "check other categories for
  // the same leak"): Arabic "ساعة" means both "watch" and "hour" — sorting "ساعة"
  // lowest-price-first surfaced power banks via "مللي أمبير/ساعة" (mAh). See
  // `hasStrongWatchSignal`'s own comment for the measured evidence.
  if (isWatchQuery) {
    const watchFiltered = result.filter((p) => hasStrongWatchSignal(p.name_ar || '', p.name_en || ''));
    if (watchFiltered.length > 0) result = watchFiltered;
  }

  const positivePrices = result.map((p) => p.best_price).filter((n) => n > 0).sort((a, b) => a - b);
  if (positivePrices.length >= 4) {
    const median = positivePrices[Math.floor(positivePrices.length / 2)];
    const floor = median * 0.15;
    const priceFiltered = result.filter((p) => p.best_price <= 0 || p.best_price >= floor);
    if (priceFiltered.length > 0) result = priceFiltered;
  }
  return result;
}

function hasACSignal(nameAr: string, nameEn: string): boolean {
  const ar = normalizeArabic(nameAr);
  const en = (nameEn || '').toLowerCase();
  const arHit = /(^|\s)مكيف|سبليت|شباك/.test(ar);
  const enHit = /\bsplit\b/.test(en) || /\bair\s*condition/.test(en) || /\ba\/?c\b/.test(en);
  return arHit || enHit;
}

// See excludeIneligibleCandidates' own comment above for why this exists distinct from
// hasACSignal: that function's bare "ac"/"a/c" alternative is fine for a +10 SCORE boost
// (worst case, an unrelated item gets a small undeserved nudge among many other factors) but
// is not precise enough for a HARD EXCLUSION gate, where the same bare match would wrongly
// keep "AC/DC" TVs and "802.11ac" routers on an air-conditioner search.
export function hasStrongACSignal(nameAr: string, nameEn: string): boolean {
  const ar = normalizeArabic(nameAr || '');
  const en = (nameEn || '').toLowerCase();
  const arHit = /(^|\s)مكيف|مكيفات|تكييف|سبليت|شباك|كاسيت|دولابي/.test(ar);
  const enHit = /\bsplit\s*a\/?c\b|\bwindow\s*a\/?c\b|air\s*condition|\binverter\b|\bbtu\b|cool\s*only|hot\s*&?\s*cool/.test(en);
  return arHit || enHit;
}

// A health-context "___ monitor" phrase (fitness trackers/smartwatches routinely describe a
// "Heart Rate Monitor"/"Sleep Monitor") is not a display — see excludeIneligibleCandidates'
// own comment above for the measured evidence. Only titles carrying one of these phrases are
// held to the stricter check; a plain "Essential Monitor" with no health context still passes
// on bare "monitor" alone, so genuine recall is untouched.
const HEALTH_MONITOR_PHRASES = /heart\s*rate\s*monitor|sleep\s*monitor|blood\s*pressure\s*monitor|glucose\s*monitor|baby\s*monitor|fitness\s*monitor|health\s*monitor(?:ing)?|activity\s*monitor|spo2\s*monitor/i;

// MEASURED LIVE (production, 2026-08-10, same session): after HEALTH_MONITOR_PHRASES shipped,
// "شاشة" results dropped from 398→166 but STILL surfaced Huawei Band smartwatches — a
// DIFFERENT, related gap: "شاشة X بوصة" (an X-inch screen) is a genuine, true, extremely
// common spec LINE on smartwatch listings, not a claim to be a monitor — the exact word, used
// honestly to describe a real feature, just on the wrong device. A title that independently
// signals "this is a smartwatch/band/tracker" must never pass on "شاشة" alone, no matter how
// legitimately that word describes the watch's own screen.
const SMARTWATCH_OVERRIDE = /ساعة\s*ذكية|ساعات\s*ذكية|سوار\s*ذكي|سوار\s*رياضي|هواوي\s*باند|smart\s*watch|smartwatch|fitness\s*tracker|apple\s*watch|galaxy\s*watch|huawei\s*watch|huawei\s*band|xiaomi\s*watch|xiaomi\s*band|\bgarmin\b|\bfitbit\b/i;

// MEASURED LIVE (production, 2026-08-10, same session): a power bank ("...45 واط، شاشة
// رقمية...") also survived both overrides — "شاشة رقمية" (digital display) is a genuine,
// true spec line on power banks with a charge-percentage readout, same class of gap as
// SMARTWATCH_OVERRIDE but a different device type. This is inherently a per-device-type
// pattern (any gadget with a digital readout can, in principle, describe it this way); this
// override closes the one measured instance rather than claiming to be exhaustive against
// every possible display-bearing accessory.
const POWER_BANK_OVERRIDE = /باور\s*بانك|power\s*bank|powerbank|بطارية\s*متنقلة|شاحن\s*متنقل|power\s*station/i;

export function hasStrongMonitorSignal(nameAr: string, nameEn: string): boolean {
  const ar = normalizeArabic(nameAr || '');
  const en = (nameEn || '').toLowerCase();
  // CHECKPOINT #17 class check: `ar` is already ة→ه folded (normalizeArabic), so this pattern
  // must match the FOLDED form ("شاشه", not "شاشة") or it can never match at all.
  const strongComputerMonitorPhrase = () =>
    /\b(?:computer|gaming|curved|ultrawide|4k|8k|ips|led|oled|qled|portable|external|desktop|touch)\s*monitor\b/.test(en)
    || /شاشه\s*كمبيوتر|شاشه\s*حاسوب/.test(ar);
  if (SMARTWATCH_OVERRIDE.test(`${ar} ${en}`) || POWER_BANK_OVERRIDE.test(`${ar} ${en}`)) return strongComputerMonitorPhrase();
  // Arabic has no equivalent of the English "monitor" homograph (screen vs. health-tracking
  // device) — "شاشة" never describes a heart-rate/sleep monitor, so bare "شاشة"/"شاشات"
  // (normalized "شاشه"/"شاشات") is a sufficient positive signal on its own. Genuine Arabic
  // monitor titles observed live ("شاشة gameon 24 بوصة...", "شاشة viewsonic 24 بوصة...")
  // never say "شاشة كمبيوتر" — requiring that compound phrase would wrongly exclude them.
  if (/(^|\s)شاشه|شاشات|مونيتور/.test(ar)) return true;
  if (HEALTH_MONITOR_PHRASES.test(en)) {
    return strongComputerMonitorPhrase();
  }
  return /\bmonitor\b/.test(en);
}

// MEASURED LIVE (production, 2026-08-10, D→E mission Part F, founder follow-up "check other
// categories for the same leak"): Arabic "ساعة" is a genuine homonym — "watch/clock" AND
// "hour", the time unit in battery-capacity specs ("10,000 مللي أمبير/ساعة" = 10,000 mAh,
// "20 ألف مللي أمبير في الساعة"). Sorting "ساعة" lowest-price-first surfaced 4 power banks
// via this exact pattern, none of them accessory-shaped or abnormally cheap. A title using
// "ساعة" only as the hour unit next to "أمبير"/"واط" is not a watch, no matter how correctly
// the spec line uses the word — require genuine watch vocabulary in that case.
const HOUR_UNIT_SIGNAL = /أمبير[\s/]*(?:في\s*)?(?:ال)?ساعه|واط[\s/]*(?:في\s*)?(?:ال)?ساعه/;

export function hasStrongWatchSignal(nameAr: string, nameEn: string): boolean {
  const ar = normalizeArabic(nameAr || '');
  const en = (nameEn || '').toLowerCase();
  const genuineWatchSignal = () =>
    /ساعه\s*ذكيه|ساعات\s*ذكيه|سوار\s*ذكي|سوار\s*رياضي/.test(ar)
    || /smart\s*watch|smartwatch|apple\s*watch|galaxy\s*watch|huawei\s*watch|garmin|fitbit|wrist\s*watch|watch\s*band/.test(en);
  if (HOUR_UNIT_SIGNAL.test(ar)) return genuineWatchSignal();
  return /(^|\s)ساعه|ساعات/.test(ar) || /\bwatch\b|smartwatch/.test(en);
}

// Budget-phrase wrapper tokens (NORMALIZED forms — ة→ه, since they are matched against
// normalizeArabic'd words). MEASURED 2026-08-04 («ابي 3 مكيفات بميزانيتي 5000 ريال»):
// «بميزانيتي» and «ريال» each formed a REQUIRED relevance word-group no product title can
// contain, so the gate found zero survivors and disabled itself — unrelated categories then
// shipped as confident results. Constraint language is not product language; it must never
// enter retrieval or relevance. Kept as its own set so the Algolia query string can strip
// exactly these without touching how ordinary stopwords behave.
const BUDGET_WRAPPER = new Set<string>([
  'ريال', 'ريالا', 'ريالات', 'بميزانيه', 'بميزانيتي', 'ميزانيه', 'ميزانيتي', 'الميزانيه',
  'sar', 'riyal', 'riyals', 'budget',
  // Room-size constraint language, same class (measured on the founder's reference query
  // «مكيف رخيص لغرفه 40 متر» — لغرفه/متر formed impossible groups and zeroed the grid the
  // advisor was answering above). The parsed room NUMBER joins constraintNumbers below.
  'غرفه', 'لغرفه', 'غرفتي', 'الغرفه', 'مساحه', 'مساحتها', 'بمساحه', 'متر', 'امتار',
  'room', 'bedroom', 'sqm', 'meter', 'meters', 'square',
  // MEASURED FAILURE (2026-08-09, Golden Query «مكيف لغرفة 30 متر هادي تحت 4000»): the
  // wrapper words «تحت»/«اقل»/«أقل»/«بحدود»/«حدود»/«يتعدى» — every non-«ميزانية» phrasing
  // `parseBudget` already recognizes — were never added here, so once a room-size constraint
  // consumed the other STOPWORDS/BUDGET_WRAPPER slots, the budget wrapper word became its
  // OWN required relevance group with no product title containing it, and the AND-gate
  // zeroed out (`categoryEnforcedZero`) exactly like the ميزانيتي defect ADR-205 fixed.
  // Live-verified before this fix: «…لغرفة 30 متر بحدود 4000» → 0, «…لغرفة 30 متر ما
  // يتعدى 4000» → 0, while «…لغرفة 30 متر» alone → 496.
  // «يتعدي» not «يتعدى»: normalizeArabic folds ى→ي, so the unfolded alef-maqsura spelling
  // never actually reaches this Set comparison (MEASURED, 2026-08-09 — «يتعدى» sat in this
  // set the whole time and the query still collapsed, because the runtime token was
  // «يتعدي»). Same folding trap as the ة/ى class documented elsewhere in this file.
  'تحت', 'اقل', 'أقل', 'حدود', 'بحدود', 'يتعدي', 'دون', 'حد', 'اكثر', 'أكثر',
  'under', 'below', 'max', 'less', 'exceed', 'exceeds',
]);

// Soft-preference trigger words `parsePriorities` (task-parser.ts) already classifies
// structurally («هادئ» → priority "quiet", «موفر» → "low_electricity", …). A preference is
// NOT product language — no catalogue title says «هادئ» — so it must never become a
// REQUIRED literal relevance group, exactly like BUDGET_WRAPPER above. MEASURED FAILURE
// (2026-08-09): «مكيف لغرفة 30 متر هادي» AND «…هادئ» (both spellings — parsePriorities
// already matched هادئ, recognition was never the problem) both collapsed 496 → 0, because
// recognizing a word as a structured priority never removed the literal word from
// relevanceGroups. Kept in sync with parsePriorities' own trigger vocabulary.
const PREFERENCE_WRAPPER = new Set<string>([
  'هادي', 'هادئ', 'هادى', 'هادئه', 'هادية', 'هدوء', 'صامت', 'صامته', 'quiet', 'silent',
  // «موفره» (feminine of موفر — MEASURED 2026-08-09: «ثلاجة كبيرة موفرة تحت 4000» → 0)
  // and «قوي/قويه» (MEASURED: «جوال قوية تحت 2000» → 0) added; PREFERENCE_WRAPPER only ever
  // had the masculine/base form of each adjective, not its feminine agreement — Arabic
  // adjectives inflect for the noun's gender (ثلاجة is feminine), so a feminine sentence hit
  // an unstripped word every time. Same defect class as the هادي/هادئ gap, different word.
  'موفر', 'موفره', 'توفير', 'كهرباء', 'فاتوره', 'اقتصادي', 'تدفئه', 'دفء',
  'قوي', 'قويه',
  'العاب', 'قيمنق', 'افلام', 'سينما', 'رياضه', 'كره', 'مباريات', 'مضيئه',
  'اضاءه', 'انتاجيه', 'عمل', 'قراءه', 'كتب',
  'بطاريه', 'احدث', 'خفيف', 'محمول', 'للسفر', 'كبير', 'كبيره', 'عائله', 'عائليه',
  // MEASURED FAILURE (2026-08-09, 10-journey acceptance sweep): «لابتوب للدراسة والبرمجة
  // وميزانيتي 3500 وخفيف» and «آيباد للدراسة والرسم بحدود 2500» both collapsed —
  // «دراسة»/«برمجة»/«رسم» (study/programming/drawing use-case descriptors) and «تصوير»/
  // «ممتاز» (photography/excellent — MEASURED on «جوال تصويره ممتاز وبطاريته قوية») were
  // never in this dictionary at all. Each is a USE-CASE or QUALITY descriptor, not product-
  // title text — no laptop title literally says «للدراسة».
  'دراسه', 'برمجه', 'رسم', 'تصوير', 'ممتاز', 'ممتازه',
  // «أشخاص»/«شخص» (people/person, as in «لعائلة 6 أشخاص») — MEASURED 2026-08-09: household-
  // size phrasing («غسالة لعائلة 6 أشخاص وميزانيتي 3000») still collapsed after «لعائلة» was
  // stripped, because «أشخاص» itself was never in this dictionary. The bare digit «6» is
  // already safe on its own — `expandWordTerms`'s length>=2 filter drops single-character
  // terms, so a lone household-size number never forms a relevance group.
  'اشخاص', 'شخص',
  'gaming', 'games', 'movies', 'cinema', 'netflix', 'sports', 'football',
  'productivity', 'work', 'office', 'reading', 'books', 'battery', 'latest', 'newest',
  'portable', 'lightweight', 'travel', 'large', 'family', 'big', 'powerful', 'strong',
  'study', 'studying', 'programming', 'coding', 'drawing', 'sketching', 'photography', 'excellent', 'great',
  'people', 'person', 'members',
]);

const STOPWORDS = new Set<string>([
  'افضل', 'احسن', 'ارخص', 'اغلى', 'رخيص', 'غالي', 'الافضل', 'الارخص',
  'جديد', 'الجديد', 'قديم', 'عرض', 'عروض', 'سعر', 'اسعار', 'الاسعار',
  'بكم', 'كم', 'في', 'من', 'على', 'مع', 'الى', 'او', 'و', 'ابي', 'ابغى', 'اريد', 'ودي',
  // Question/negation particles («وش يبي», «ما يتعدى» — MEASURED 2026-08-09: «وش افضل
  // مكيف لغرفة 30 متر وميزانيتي 4000» still collapsed with «وش» unstripped).
  'وش', 'ما', 'لا',
  'best', 'cheapest', 'cheap', 'price', 'prices', 'new', 'offer', 'offers', 'deal', 'deals',
  'the', 'a', 'an', 'in', 'of', 'for', 'with', 'and', 'or', 'want',
  ...BUDGET_WRAPPER,
  ...PREFERENCE_WRAPPER,
]);

// MEASURED FAILURE (2026-08-09): «وميزانيتي 4000» («and my budget» — the attached
// conjunction و + an already-recognized wrapper word) still collapsed the Golden Query,
// because Set membership is exact-match and Arabic freely prefixes ANY word with the
// single-letter proclitic و ("and"). Enumerating every prefixed variant by hand is the
// same unbounded whack-a-mole CHECKPOINT #17 and ADR-205 already burned time on — so a
// word is treated as a wrapper word if it matches directly OR if it starts with و and its
// remainder does. Deliberately narrow: only و (by far the most common clause-joining
// proclitic in these compound need-sentences), and only against BUDGET_WRAPPER/
// PREFERENCE_WRAPPER (never the general STOPWORDS/product vocabulary), so a real product
// word that happens to start with و (واتش "watch", واي-فاي "wifi") is untouched — its
// remainder ("اتش"/"اي") is not itself a wrapper word.
// MEASURED FAILURE (2026-08-09, Gate 3 sweep): «غسالة للعائلة تحت 3000» → 0 — «للعائلة»
// («لـ» "for" + assimilated «الـ» "the" + «عائلة») is the SAME class as the و-prefix gap
// above, just a different (and in Arabic, arguably even more common) proclitic. «لل» is
// stripped as a 2-char unit (لـ + assimilated الـ elides the ا), and bare «ل» as 1 char
// (e.g. «لصالتي»-style "for my living room" phrasing), each only accepted when the
// remainder is a KNOWN wrapper word — never a blind strip.
// MEASURED FAILURE (2026-08-09, category-generalization check): «تلفزيون للألعاب والأفلام
// تحت 3000» still collapsed. «والأفلام» stacks TWO proclitics — و ("and") THEN the
// unassimilated definite article ال ("the") — which the single-level checks below did not
// compose: stripping و alone left «الأفلام», which matched neither «أفلام» (already in
// PREFERENCE_WRAPPER) nor anything else. Arabic proclitics compose (و + ل/لل/ال, or just
// ل/لل/ال alone), and hand-enumerating every combination is the same unbounded problem
// already hit twice. Generalized below: strip an optional leading و, THEN try لل/ال/ل on
// what's left (and on the un-stripped word too, since ل/لل/ال can appear without و) —
// never a blind strip, every candidate is checked against the same closed dictionary.
// MEASURED FAILURE (2026-08-09, founder 10-journey acceptance sweep): «جوال تصويره ممتاز
// وبطاريته قوية تحت 2500» collapsed. «تصويره» ("its photography/camera") is a REGULAR
// possessive attachment — «تصوير» (a consonant-final noun) + «ه», no ة/ا→ت elision — a
// different pattern than the «كاميرا→كاميرته» class `isPossessiveQualityDescriptor` already
// handles. Generalized here: try stripping a plain trailing ه/ها/هم/ك/ي (longest first) and
// check the remainder against the same closed wrapper dictionary — never a blind strip, and
// deliberately NOT applied to BARE category nouns for the same reason the prefix logic
// isn't («تصوير» itself is not a product category, so no bare-noun collision risk here the
// way «كاميرا»/«شاشة» would have had).
const REGULAR_POSSESSIVE_SUFFIXES = ['ها', 'هم', 'ه', 'ك', 'ي'];
function possessiveSuffixCandidates(w: string): string[] {
  const out: string[] = [];
  for (const suf of REGULAR_POSSESSIVE_SUFFIXES) {
    if (w.length > suf.length + 2 && w.endsWith(suf)) out.push(w.slice(0, -suf.length));
  }
  return out;
}

function isWrapperWord(rawWord: string): boolean {
  const w = rawWord.toLowerCase();
  if (STOPWORDS.has(w)) return true;
  const isKnownWrapper = (s: string) => BUDGET_WRAPPER.has(s) || PREFERENCE_WRAPPER.has(s);
  const candidates = new Set<string>();
  const bases = [w];
  if (w.length > 2 && w[0] === 'و') bases.push(w.slice(1));
  for (const b of bases) {
    candidates.add(b);
    if (b.length > 4 && b.startsWith('لل')) candidates.add(b.slice(2));
    else if (b.length > 3 && b.startsWith('ال')) candidates.add(b.slice(2));
    else if (b.length > 2 && b[0] === 'ل') candidates.add(b.slice(1));
    for (const c of possessiveSuffixCandidates(b)) candidates.add(c);
  }
  for (const c of candidates) if (c !== w && isKnownWrapper(c)) return true;
  // MEASURED FAILURE (2026-08-09, 10-journey acceptance sweep): «وبطاريته قوية» still
  // collapsed while «بطاريته» alone and «وتصويره» both worked. Root cause: this check ran
  // against the ORIGINAL word only — for «وبطاريته», the ة/ا→ت elision check needs the
  // leading و stripped FIRST («بطاريته» → stem «بطاري» → «بطاريه» ∈ dictionary), but «و» was
  // still attached when this function received the whole word, so the reconstructed stem
  // became «وبطاريه» (never in the dictionary) instead of «بطاريه». Checked against every
  // `bases` candidate (both the original word and its و-stripped form), not just the
  // original — same fix shape as the prefix/suffix candidates above.
  return bases.some(isPossessiveQualityDescriptor);
}

// MEASURED FAILURE (Gate 3 sweep, 2026-08-09; tracked as a follow-up rather than patched at
// the time — closing it now that the higher-value decision-agent work is done): «جوال
// كاميرته ممتازة تحت 2500» and «جوال بطاريته تحت 2000» both collapsed. «كاميرته»/«بطاريته»
// are possessive-suffixed quality descriptors ("its camera"/"its battery") — genuine Arabic
// morphology, not another proclitic: attaching a possessive pronoun (ـه/ـها/ـهم/ـك/ـي) to an
// ة- or ا-final noun shifts the ending to ت (كاميرا→كاميرته, بطارية→بطاريته).
//
// Deliberately NOT added to PREFERENCE_WRAPPER: «كاميرا» is itself the CAMERA category noun
// (parseCategory) and «شاشة» the TV one — stripping the BARE noun would risk a plain
// category browse ("كاميرا") silently losing its own relevance term the way «شاشة» almost
// did in an earlier draft of this fix. This check only fires when a possessive suffix is
// PRESENT — a shopper never types the bare possessive form ("كاميرته") to browse a
// category, so gating on the suffix is safe by construction, not just by the closed
// dictionary. Scoped to the measured nouns; not a general possessive stemmer.
const POSSESSIVE_QUALITY_BASES = new Set(['كاميرا', 'بطاريه', 'شاشه', 'سرعه', 'ذاكره']);
const POSSESSIVE_SUFFIXES = ['تها', 'تهم', 'ته', 'تك', 'تي'];
function isPossessiveQualityDescriptor(w: string): boolean {
  for (const suf of POSSESSIVE_SUFFIXES) {
    if (w.length > suf.length + 2 && w.endsWith(suf)) {
      const stem = w.slice(0, -suf.length);
      if (POSSESSIVE_QUALITY_BASES.has(stem + 'ا') || POSSESSIVE_QUALITY_BASES.has(stem + 'ه')) return true;
    }
  }
  return false;
}

function expandWordTerms(word: string): string[] {
  const norm = normalizeArabic(word).toLowerCase();
  const terms = new Set<string>();
  if (norm) terms.add(norm);
  // English plural → singular as an ADDITIONAL term (never a replacement): catalogue titles
  // are singular ("Air Conditioner"), so a plural query word ("conditioners") formed a
  // relevance group no title could satisfy (measured 2026-08-04 — the EN mirror of the
  // Arabic-plural gap fixed in ARABIC_TO_ENGLISH). Latin-only and length-guarded so model
  // codes and Arabic words are untouched; an over-eager strip only adds a term that
  // matches nothing.
  if (/^[a-z]{4,}s$/.test(norm)) terms.add(norm.slice(0, -1));
  const mapped = lookupArToEn(word);
  if (mapped) {
    for (const m of mapped) {
      for (const tok of m.split(/\s+/)) {
        if (tok.length >= 2) terms.add(tok.toLowerCase());
      }
    }
  }
  return [...terms];
}

function buildOrPool(words: string[]): string {
  const parts: string[] = [];
  for (const word of words) {
    const clean = word.replace(/[(),]/g, ' ').trim();
    if (!clean) continue;
    // The query words are fully normalized (ة→ه, ى→ي), but the catalogue usually keeps ة/ى, so an
    // ilike on the folded form misses them (e.g. query "ثلاجه" vs catalogue "ثلاجة"). Also match the
    // un-folded trailing variants so real products are actually fetched as candidates.
    const variants = new Set([clean, clean.replace(/ه$/, 'ة'), clean.replace(/ي$/, 'ى')]);
    for (const v of variants) {
      if (v) parts.push(`name_ar.ilike.%${v}%`);
    }
    parts.push(`name_en.ilike.%${clean}%`, `brand.ilike.%${clean}%`);
    const mapped = lookupArToEn(clean);
    if (mapped) {
      for (const m of mapped) {
        for (const tok of m.split(/\s+/)) {
          if (tok.length >= 2) parts.push(`name_en.ilike.%${tok}%`);
        }
      }
    }
  }
  return [...new Set(parts)].join(',');
}

/**
 * MULTI-WORD ENGLISH QUERIES COLLAPSED because the phrase map was never consulted.
 *
 * `search-query-bilingual.ts` already holds `['air conditioner', 'مكيف']` and
 * `['washing machine', 'غسالة']`, but this route split the query into WORDS first and expanded
 * each word alone — so the phrase was destroyed before any phrase mapping could apply. Matching
 * then required BOTH "air" AND "conditioner" to appear, which no Arabic-titled product contains.
 *
 * Measured 2026-07-31, English total vs its Arabic equivalent:
 *   air conditioner    14 vs 500  (2.8%)      refrigerator  362 vs 362 (100%)
 *   washing machine    58 vs 404  (14%)       vacuum        230 vs 233 (99%)
 * Single-word English was fine; multi-word English collapsed. Same catalogue, same retailers —
 * the gap was ours.
 *
 * The fix is an OR at the TOP level, never a loosening of either side: a row matches if every
 * query word matches, OR if every word of the Arabic phrase equivalent matches. Both branches
 * still require ALL their terms, so precision is unchanged and only recall is restored.
 */
function arabicVariantTerms(rawQuery: string): string[][] {
  const variants = expandQueriesForRetailSearch(rawQuery);
  const ar = variants.find((v) => v !== rawQuery.trim());
  if (!ar) return [];
  return normalizeArabic(ar).split(/\s+/).filter(Boolean)
    .map(expandWordTerms).filter((t) => t.length > 0);
}

function matchesTermLists(hay: string, primary: string[][], alt: string[][]): boolean {
  const all = (list: string[][]) => list.length > 0 && list.every((terms) => terms.some((t) => hay.includes(t)));
  return all(primary) || all(alt);
}

function productMatchesAllWords(row: ProductRow, wordTermsList: string[][], altTermsList: string[][] = []): boolean {
  const hay = (
    normalizeArabic(row.name_ar || '') + ' ' +
    normalizeArabic(row.name_en || '') + ' ' +
    normalizeArabic(row.brand || '')
  ).toLowerCase();
  return matchesTermLists(hay, wordTermsList, altTermsList);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyCommonFilters(query: any, body: SearchBody): any {
  // This route uses the service-role client, which bypasses RLS (the RLS policy on
  // product_stores already hides quarantined rows from anon/browser reads) — filter
  // explicitly. See price-truth-gate.ts / P0 incident 2026-08-05.
  query = query.is('product_stores.price_quarantined_at', null);
  if (body.category && body.category !== 'all') query = query.eq('category', body.category);
  if (body.brands && body.brands.length > 0) query = query.in('brand', body.brands);
  else if (body.brand) query = query.ilike('brand', body.brand);
  if (body.stores && body.stores.length > 0) query = query.in('product_stores.store_name', body.stores);
  if (body.availability && body.availability.length > 0) {
    const VALID = ['in_stock', 'out_of_stock', 'limited_stock', 'pre_order'] as const;
    type A = typeof VALID[number];
    const filtered = body.availability.filter((a): a is A => (VALID as readonly string[]).includes(a));
    if (filtered.length > 0) query = query.in('product_stores.availability', filtered);
  } else if (body.in_stock_only) {
    query = query.eq('product_stores.availability', 'in_stock');
  }
  if (typeof body.min_price === 'number') query = query.gte('product_stores.current_price', body.min_price);
  if (typeof body.max_price === 'number') query = query.lte('product_stores.current_price', body.max_price);
  return query;
}

function scoreProduct(p: GroupedSearchProduct, priceMin: number, priceMax: number, queryIsMainProduct: boolean, relevanceGroups: string[][] = [], isAcQuery = false): number {
  const isAccessory = hasAccessoryHint(p.name_ar || '', p.name_en || '');
  const acSignal = hasACSignal(p.name_ar || '', p.name_en || '');
  // Relevance DOMINATES: a product must match the query's product noun (every word-group), not just a
  // stray number. Matching all groups is a huge boost; missing any is a huge penalty for a product-type
  // query — so a 4-store iPhone beats a cheap 1-store AC that only shared the "16" in "16000 BTU".
  let relevanceScore = 0;
  if (relevanceGroups.length) {
    const hay = (normalizeArabic(p.name_ar || '') + ' ' + (p.name_en || '') + ' ' + (p.brand || '')).toLowerCase();
    const matched = relevanceGroups.filter((g) => g.some((t) => hay.includes(t))).length;
    if (matched === relevanceGroups.length) relevanceScore = 300;
    else relevanceScore = -400 * (relevanceGroups.length - matched);
  }
  const inStockBoost = p.stores.some((s) => s.availability === 'in_stock') ? 25 : 0;
  // CORROBORATION BEFORE CHEAPNESS (CLAUDE.md, non-negotiable). This was capped at 18
  // while the price term is worth up to 22, so the cheapest single-store listing could
  // outrank a product two or three retailers agree on — the exact inversion the rule
  // forbids. One corroborating retailer now outweighs the entire price range.
  const storeBoost = Math.min(p.store_count * 14, 56);
  const dealBoost = p.stores.some((s) => s.original_price && s.current_price && s.original_price > s.current_price) ? 8 : 0;
  const rating = Math.max(...p.stores.map((s) => s.rating ?? 0));
  const ratingBoost = rating > 0 ? rating * 3 : 0;
  let pricePenalty = 22;
  if (p.best_price > 0 && priceMax > priceMin) {
    pricePenalty = ((p.best_price - priceMin) / (priceMax - priceMin)) * 22;
  } else if (p.best_price > 0) {
    pricePenalty = 0;
  }
  const accessoryPenalty = isAccessory ? (queryIsMainProduct ? 1000 : 60) : 0;
  // acBoost only when the QUERY is about ACs — otherwise an AC unfairly outranks the searched product.
  const acBoost = (isAcQuery && acSignal) ? 10 : 0;
  const tpsBonus = (p.has_tps_comparison || !!p.tps_compare_url) ? 15 : 0;
  return relevanceScore + inStockBoost + storeBoost + dealBoost + ratingBoost + acBoost + tpsBonus - pricePenalty - accessoryPenalty;
}

function buildReasonAr(p: GroupedSearchProduct, isCheapest: boolean): string {
  const parts: string[] = [];
  if (isCheapest) parts.push('أرخص سعر');
  // ADR-136: the store count is only stated where a comparison surface exists to honour it.
  // A "متوفر في 3 متاجر" line with nowhere to see those 3 stores is a claim we cannot back.
  if (p.store_count >= 2 && !!p.tps_compare_url) parts.push(`متوفر في ${p.store_count} متاجر`);
  // ADR-129 SAVINGS_GATE (default on): the merchant "was" (original_price) is not a drop we verified —
  // suppress the "خصم %" claim unless the gate is explicitly off.
  if (process.env.NEXT_PUBLIC_SAVINGS_GATE === 'off') {
    const dealStore = p.stores.find((s) => s.original_price && s.current_price && s.original_price > s.current_price);
    if (dealStore && dealStore.original_price) {
      const pct = Math.round(((dealStore.original_price - dealStore.current_price) / dealStore.original_price) * 100);
      if (pct > 0) parts.push(`خصم ${pct}%`);
    }
  }
  const inStock = p.stores.some((s) => s.availability === 'in_stock');
  if (inStock && parts.length === 0) parts.push('متوفر الآن');
  return parts.length ? parts.join(' · ') : 'خيار مناسب';
}

function buildDecisionLayer(
  products: GroupedSearchProduct[],
  queryIsMainProduct: boolean,
  relevanceGroups: string[][] = [],
  isAcQuery = false,
): DecisionLayer {
  const prices = products.map((p) => p.best_price).filter((n) => n > 0);
  const priceMin = prices.length ? Math.min(...prices) : 0;
  const priceMax = prices.length ? Math.max(...prices) : 0;
  // MEASURED DEFECT (2026-07-29): `relevanceGroups` was never passed here, so it
  // defaulted to [] and the relevance term of scoreProduct — the term that DOMINATES
  // every other signal in the results list — was silently zero for the Smart Pick. The
  // card the customer is steered to was therefore chosen by price and store count over
  // whatever the page happened to return. That is how the query `لابتوب اتش بي` came to
  // present a JBL speaker as "اختيار توفيري". The pick now ranks by the same rule the
  // results below it are ranked by.
  const ranked = [...products].sort(
    (a, b) => scoreProduct(b, priceMin, priceMax, queryIsMainProduct, relevanceGroups, isAcQuery)
            - scoreProduct(a, priceMin, priceMax, queryIsMainProduct, relevanceGroups, isAcQuery),
  );
  const top3 = ranked.slice(0, 3);
  const best = top3[0] || null;

  // Trust gate: never present an accessory as the "smart pick" for a
  // main-product query (Constitution: truth before convenience; a phone case
  // is not a defensible answer to "iphone 15"). When the best available match
  // is an accessory for a product search, we show no smart-pick card rather
  // than a misleading one — the ranked results still render below it.
  const bestIsAccessory = best ? hasAccessoryHint(best.name_ar || '', best.name_en || '') : false;
  // A pick must also actually ANSWER the query. When nothing matches every word-group,
  // showing the least-bad item as "اختيار توفيري" asserts an answer we do not have —
  // unknown beats incorrect. The results list still renders below; only the claim goes.
  const bestMatchesQuery = !best || relevanceGroups.length === 0 || (() => {
    const hay = (normalizeArabic(best.name_ar || '') + ' ' + (best.name_en || '') + ' ' + (best.brand || '')).toLowerCase();
    return relevanceGroups.every((g) => g.some((t) => hay.includes(t)));
  })();
  const trustworthyPick = !!best && best.best_price > 0 && bestMatchesQuery
    && !(queryIsMainProduct && bestIsAccessory);

  // ADR-193 — the pick's price claim carries its observation time, and the label is not
  // awarded on evidence in the freshness floor band (>PICK_FRESHNESS_MAX_HOURS). The
  // product still ranks in the grid below; only the claim is withheld (Master Book §31.5,
  // P3: no dead end). Live-scraped picks carry no stored timestamp — their observation is
  // this request — so the gate applies to TPS-sourced evidence only.
  const bestStoreEntry = best
    ? (best.stores.find((s) => s.current_price === best.best_price) ?? best.stores[0] ?? null)
    : null;
  const pickObservedAt = bestStoreEntry?.observed_at ?? null;
  const pickAgeHours = hoursSince(pickObservedAt);
  const pickTooStale = pickAgeHours != null && pickAgeHours > PICK_FRESHNESS_MAX_HOURS;
  if (pickTooStale && best) {
    console.warn(`[smart-pick-freshness] label withheld: age=${Math.round(pickAgeHours)}h > ${PICK_FRESHNESS_MAX_HOURS}h · "${(best.name_ar || best.name_en || '').slice(0, 60)}"`);
  }

  const decisionCard = trustworthyPick && best && !pickTooStale
    ? {
        title: best.name_ar,
        best_price: best.best_price,
        store_name: bestStoreEntry?.store_name || '',
        product_url: bestStoreEntry?.product_url || '',
        store_count: best.store_count,
        reason_ar: buildReasonAr(best, best.best_price === priceMin && priceMin > 0),
        is_tps: !!(best.has_tps_comparison || best.tps_compare_url),
        compare_url: best.tps_compare_url ?? null,
        last_observed_at: pickObservedAt,
        // Shared evidence source (see DecisionLayer type comment) — computed from signals
        // already available on the winning card; never changes which product is `best`.
        trust: productTrust({
          store_count: best.store_count,
          has_comparison: best.has_tps_comparison ?? (best.store_count >= 2),
          tps_identity_key: best.tps_identity_key ?? null,
          last_observed_at: pickObservedAt,
        }),
      }
    : null;
  const topMatches: DecisionTopMatch[] = top3.map((p) => ({
    product_id: p.product_id || '',
    name_ar: p.name_ar,
    best_price: p.best_price,
    store_count: p.store_count,
    availability: p.availability,
    rating: Math.max(...p.stores.map((s) => s.rating ?? 0)),
    product_url: p.stores.find((s) => s.current_price === p.best_price)?.product_url || p.stores[0]?.product_url || '',
    store_name: p.stores.find((s) => s.current_price === p.best_price)?.store_name || p.stores[0]?.store_name || '',
    reason_ar: buildReasonAr(p, p.best_price === priceMin && priceMin > 0),
  }));
  return { decisionCard, topMatches };
}

function algoliaHitToGrouped(hit: AlgoliaHit): GroupedSearchProduct | null {
  // Approved-27 scope gate: only surface offers from approved retailers (Founder Directive 2026-07-27).
  // isDisplayableRetailer, not isApprovedStore: LuLu/Sharaf DG are approved to INGEST but must
  // never be named to a customer as a comparison source (LAUNCH_VOCABULARY §3, F1).
  const validStores = (hit.stores || []).filter((s) => s.current_price != null && isDisplayableRetailer(s.store_name));
  if (validStores.length === 0) return null;
  const storeEntries: SearchProduct[] = validStores.map((s) => ({
    name_ar: hit.name_ar,
    name_en: hit.name_en,
    brand: hit.brand || '',
    model: '',
    sku: null,
    current_price: Number(s.current_price),
    original_price: s.original_price != null ? Number(s.original_price) : null,
    availability: (s.availability || 'in_stock') as SearchProduct['availability'],
    // Repair known-dead URL shapes on the way out (see lib/retailers/exit-url).
    product_url: normalizeExitUrl(s.product_url) || '',
    image_urls: hit.image_url ? [hit.image_url] : [],
    specifications: {} as Record<string, unknown>,
    category: '' as ProductCategory,
    description_ar: null,
    description_en: null,
    is_free_delivery: false,
    delivery_time_days: null,
    delivery_cost: 0,
    is_deal: !!(s.original_price && s.current_price && s.original_price > s.current_price),
    coupon_code: s.coupon_code ?? null,
    store: s.store_name || 'unknown',
    store_name: s.store_name || '',
    rating: null,
    review_count: null,
  }));
  // Collapse offers to ONE per CANONICAL retailer identity (ADR-132). A store ingested under two
  // name spellings — e.g. "أمازون" + "أمازون السعودية", both store_id=2 → resolveApprovedSlug='amazon'
  // — must NOT be counted as two stores or shown as a false multi-store comparison. Keep the cheapest
  // offer per canonical retailer. Fixes the measured launch defect where 100% of "2-store" cards were
  // Amazon double-counted. Read-side only; no index rebuild, no schema change.
  const byRetailer = new Map<string, SearchProduct>();
  for (const e of storeEntries) {
    const key = resolveApprovedSlug(e.store_name) || (e.store_name || 'unknown').trim().toLowerCase();
    const existing = byRetailer.get(key);
    if (!existing || e.current_price < existing.current_price) byRetailer.set(key, e);
  }
  const dedupStores = [...byRetailer.values()];
  const prices = dedupStores.map((e) => e.current_price).filter((n) => n > 0);
  const bestPrice = prices.length ? Math.min(...prices) : 0;
  const anyInStock = dedupStores.some((e) => e.availability === 'in_stock');
  const uniqueStores = byRetailer.size;
  const rep = dedupStores[0];
  return {
    ...rep,
    current_price: bestPrice,
    availability: anyInStock ? 'in_stock' : rep.availability,
    stores: dedupStores,
    best_price: bestPrice,
    store_count: uniqueStores,
    product_id: hit.objectID,
    product_slug: hit.objectID,
  } as GroupedSearchProduct;
}

// ── Deduplication ─────────────────────────────────────────────
function deduplicateProducts(products: GroupedSearchProduct[]): GroupedSearchProduct[] {
  const seen = new Set<string>();
  return products.filter((p) => {
    const key = p.tps_identity_key || p.product_id || normalizeArabic(p.name_ar || '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
// ─────────────────────────────────────────────────────────────

// ── TPS Enrichment (Type-safe) ────────────────────
const MODEL_CODE_REGEX = /\b([A-Z]{2}\d{2}[A-Z0-9]{4,}(?:\/[A-Z0-9]+)?)\b/g;

async function enrichWithTPS(
  products: GroupedSearchProduct[],
  supabase: ReturnType<typeof createServerClient>
): Promise<GroupedSearchProduct[]> {
  if (!products.length) return products;

  try {
    const productModels = products.map((p, idx) => {
      const text = `${p.name_en || ''} ${p.name_ar || ''}`;
      const codes = [...text.matchAll(MODEL_CODE_REGEX)].map(m => m[1].toUpperCase());
      return { idx, codes };
    });

    const allCodes = [...new Set(productModels.flatMap(p => p.codes))];
    if (!allCodes.length) return products;

    const { data: canonicalRows } = await supabase
      .from('canonical_products')
      .select(`
        id,
        name_ar,
        name_en,
        brand,
        image_url,
        model_number,
        tps_identity_key
      `)
      .in('model_number', allCodes)
      .eq('is_active', true);

    if (!canonicalRows?.length) return products;

    const canonicalMap = new Map<string, CanonicalProductRow>();
    for (const row of canonicalRows) {
      if (row.model_number) {
        canonicalMap.set(row.model_number.toUpperCase(), row as CanonicalProductRow);
      }
    }

    return products.map((p, idx) => {
      let enriched = { ...p };

      for (const code of productModels[idx].codes) {
        const canonical = canonicalMap.get(code);
        if (canonical) {
          const slug = identityKeyToSlug(canonical.tps_identity_key || '');
          // Link the identity for dedup, but DON'T claim a comparison here — a model-code match
          // doesn't prove >=2 live store offers. Verified compare CTAs come only from
          // searchTPSCanonical (gated on >=2 distinct stores). Prevents false "قارن الأسعار" CTAs.
          enriched = {
            ...enriched,
            tps_identity_key: canonical.tps_identity_key,
            product_id: enriched.product_id || canonical.id,
          } as GroupedSearchProduct;
          break;
        }
      }
      return enriched;
    });
  } catch (err) {
    console.error('[TPS Enrichment] failed:', err);
    return products;
  }
}
// ─────────────────────────────────────────────────────────────

// ── TPS Canonical Search ──────────────────────────────────────
async function searchTPSCanonical(
  words: string[],
  supabase: ReturnType<typeof createServerClient>,
  categories: string[],
): Promise<GroupedSearchProduct[]> {
  try {
    if (!words.length || !categories.length) return [];
    const { data: prods } = await supabase
      .from('canonical_products')
      .select('id, name_ar, name_en, brand, image_url, tps_identity_key, model_number, category')
      .in('category', categories)
      .eq('is_active', true);

    if (!prods?.length) return [];

    const wordTermsList = words.map(expandWordTerms).filter((t) => t.length > 0);
    const matched = prods.filter((p) => {
      const hay = (normalizeArabic(p.name_ar || '') + ' ' + normalizeArabic(p.name_en || '') + ' ' + normalizeArabic(p.brand || '')).toLowerCase();
      return wordTermsList.every((terms) => terms.some((t) => hay.includes(t)));
    });
    if (!matched.length) return [];

    // MEASURED DEFECT (2026-07-29): this was ONE query over every matched id, and
    // PostgREST caps a response at 1000 rows by default. A broad category query — bare
    // `laptop` matches ~300 canonicals — filled that window with the newest rows of a few
    // high-churn products, so the comparable ones were never seen and the query returned
    // ZERO comparisons. Narrow queries hid it completely: `laptop vivobook` returned 4
    // multi-store cards while `laptop` returned 0, on the same data.
    //
    // Chunk the ids so every candidate gets a window of its own. Each chunk is an indexed
    // lookup, so the extra round trips are cheap and only a broad query pays for them.
    const ids = matched.slice(0, 400).map((p) => p.id);
    const CHUNK = 40;
    type PriceRow = { canonical_product_id: string; store_name: string; price: number | string; observed_at: string; tps_observation_id: string };
    const priceChunks = await Promise.all(
      Array.from({ length: Math.ceil(ids.length / CHUNK) }, (_, i) =>
        supabase
          .from('price_history')
          .select('canonical_product_id, store_name, price, observed_at, tps_observation_id')
          .in('canonical_product_id', ids.slice(i * CHUNK, (i + 1) * CHUNK))
          .order('observed_at', { ascending: false })
          .limit(4000),
      ),
    );
    const prices = priceChunks.flatMap((c) => (c.data ?? []) as unknown as PriceRow[]);

    // ADR-194 — TRUE per-store observation recency. price_history is append-only on CHANGED
    // prices, so its observed_at is when the price last MOVED; a stable price reads days
    // stale while the pipeline observes it daily. normalized_product_observations has a row
    // per observation, so its newest row per (canonical, store) is the honest «آخر رصد».
    type ObsRow = { canonical_product_id: string; store_id: string | null; observed_at: string };
    const obsChunks = await Promise.all(
      Array.from({ length: Math.ceil(ids.length / CHUNK) }, (_, i) =>
        supabase
          .from('normalized_product_observations')
          .select('canonical_product_id, store_id, observed_at')
          .in('canonical_product_id', ids.slice(i * CHUNK, (i + 1) * CHUNK))
          .order('observed_at', { ascending: false })
          .limit(4000),
      ),
    );
    // First (newest) row per (canonical, resolved retailer) wins — same windowing trade-off
    // as the price chunks above.
    const trueObserved = new Map<string, string>();
    for (const r of obsChunks.flatMap((c) => (c.data ?? []) as unknown as ObsRow[])) {
      const slug = resolveApprovedSlug(r.store_id ?? '');
      if (!slug || !isDisplayableRetailer(slug) || !r.observed_at) continue;
      const key = `${r.canonical_product_id}|${slug}`;
      if (!trueObserved.has(key)) trueObserved.set(key, r.observed_at);
    }

    // ADR-196: offers measured GONE (404 on their own page) are excluded — a dead offer
    // must not win best-price. The table is small by construction (signals heal on the
    // next successful observation), so one unfiltered read covers every candidate.
    const { data: delistRows } = await supabase
      .from('tps_offer_delist_signals')
      .select('canonical_product_id, store_slug')
      .limit(10000);
    const delisted = new Set((delistRows ?? []).map((d) => `${(d as { canonical_product_id: string }).canonical_product_id}|${(d as { store_slug: string }).store_slug}`));

    const latest = new Map<string, Map<string, { price: number; obsId: string; observedAt: string }>>();
    for (const r of prices ?? []) {
      // Approved scope gate + ONE KEY PER RETAILER. This map used to be keyed on the raw
      // `price_history.store_name`, which is not an identity: the same retailer appears
      // there under a display name AND a numeric id. Measured live 2026-07-30 on
      // `غسالة صحون` — the card listed "اكسترا, شاكر, 7, المنيع, سامسونج السعودية", where
      // 7 IS شاكر. That is a fabricated fifth store and a raw internal id rendered to a
      // customer, i.e. both halves of what ADR-132 and ADR-135 exist to prevent.
      // Keyed on the resolved slug, the retailer can only be counted once.
      const slug = resolveApprovedSlug(r.store_name);
      // isDisplayableRetailer, not resolveApprovedSlug alone: a store can be approved for
      // INGESTION while still display-excluded (F3). Fixed alongside get-comparison.ts
      // (2026-08-06) — both surfaces ADR-135 requires to derive from the same source were
      // using the ingestion gate here, letting a display-excluded retailer's price_history
      // row (blackbox/lulu/sharafdg) render the moment normalize wrote it.
      if (!slug || !isDisplayableRetailer(slug)) continue;
      if (delisted.has(`${r.canonical_product_id}|${slug}`)) continue; // ADR-196
      if (!latest.has(r.canonical_product_id)) latest.set(r.canonical_product_id, new Map());
      const m = latest.get(r.canonical_product_id)!;
      if (!m.has(slug)) m.set(slug, { price: Number(r.price), obsId: r.tps_observation_id, observedAt: r.observed_at });
    }

    const out: GroupedSearchProduct[] = [];
    for (const p of matched) {
      const byStore = latest.get(p.id);
      if (!byStore || byStore.size === 0) continue;
      const slug = identityKeyToSlug(p.tps_identity_key ?? '');
      // The map is keyed by SLUG now, so render the retailer's display name — never the key,
      // and never a raw store id.
      const storeEntries: SearchProduct[] = [...byStore.entries()].map(([storeSlug, v]) => {
        const storeName = retailerDisplayName(storeSlug, 'ar') ?? storeSlug;
        return ({
        name_ar: p.name_ar, 
        name_en: p.name_en || '', 
        brand: p.brand || '', 
        model: '', 
        sku: null,
        current_price: v.price, 
        original_price: null,
        availability: 'in_stock' as const,
        // An exit is rendered ONLY when we hold the observation id it needs. This emitted
        // `/go/undefined` / `/go/null` whenever the latest price row for a retailer carried a
        // NULL `tps_observation_id` — a button that looks healthy and lands nowhere.
        //
        // MEASURED 2026-07-31 across the harness query sets: 18 of 590 EN exits (3.05%) and
        // 3 of 754 AR exits (0.40%). The EN concentration is 13 malformed exits on the single
        // query "air conditioner", all from Extra — which is most of the reported AR/EN
        // journey gap, and is a locale-INDEPENDENT defect that the EN query set happens to hit.
        //
        // We do NOT substitute an older row that does have an id: that would show a price we
        // are not currently observing. Keep the true latest price, omit the exit. This mirrors
        // src/lib/compare/get-comparison.ts:183, which already got this right, and the compare
        // page's honest «رابط المتجر غير متاح لهذا العرض».
        product_url: v.obsId ? `/go/${v.obsId}` : '',
        // The observation's own time, carried to the surface: Master Book §31.5 — the
        // observation time is visible, or the claim is not made (ADR-193). The newest
        // TRUE observation (ADR-194) wins over the price-change date; the price-change
        // date remains the floor so the field is never younger than real evidence.
        observed_at: trueObserved.get(`${p.id}|${storeSlug}`) ?? v.observedAt ?? null,
        image_urls: p.image_url ? [p.image_url] : [],
        specifications: {} as Record<string, unknown>,
        // Per-canonical now that more than one category can be searched at once. The UI
        // plane calls a mobile a "smartphone"; everything else passes through unchanged.
        category: ((p as { category?: string }).category === 'mobile'
          ? 'smartphone'
          : (p as { category?: string }).category ?? '') as ProductCategory,
        description_ar: null,
        description_en: null,
        is_free_delivery: false, 
        delivery_time_days: null, 
        delivery_cost: 0,
        is_deal: false, 
        coupon_code: null,
        store: storeSlug,
        store_name: storeName,
        rating: null,
        review_count: null,
      });
      });
      const ps2 = storeEntries.map((e) => e.current_price).filter((n) => n > 0);
      const bestPrice = ps2.length ? Math.min(...ps2) : 0;
      const rep = storeEntries[0];
      out.push({
        ...rep,
        current_price: bestPrice,
        stores: storeEntries,
        best_price: bestPrice,
        store_count: byStore.size,
        product_id: p.id,
        product_slug: slug,
        // Only claim a price COMPARISON when the product genuinely has >=2 distinct store offers.
        // Single-store products get no compare CTA (the UI shows an honest single-store action instead).
        tps_compare_url: byStore.size >= 2 ? `/ar/compare/${encodeURIComponent(p.tps_identity_key || '')}` : null,
        tps_identity_key: p.tps_identity_key,
        has_tps_comparison: byStore.size >= 2,
      } as GroupedSearchProduct);
    }
    return out;
  } catch (e) {
    console.error('[TPS Search] failed:', e);
    return [];
  }
}
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const started = Date.now();
  const body: SearchBody = await request.json().catch(() => ({} as SearchBody));
  const typedQuery = typeof body.query === 'string' ? body.query.trim() : '';

  // ── Comparison intent, detected BEFORE retrieval ────────────────────────────────────
  // MEASURED DEFECT (2026-08-01): the marker words destroy the search. «قارن أسعار ايفون 16»
  // returned 99 products of which **ZERO** carried a canonical identity, while «ايفون 16»
  // returned 157 with 10. Same for English: "compare prices iphone 16" → 0 with identity,
  // "iphone 16" → 12. The shopper who most wants a comparison was getting the results least
  // able to support one, because «قارن» and «أسعار» were being matched against product text.
  //
  // So retrieval runs on the SUBJECT of the request, not on the sentence wrapping it. The
  // typed query is still what gets echoed back and displayed — we search for what they
  // meant, and show them what they asked.
  //
  // ONE TAWVEERI BRAIN (2026-08-09): comparison intent used to be detected here
  // independently (a direct `detectCompareIntent()` call), while `routeQuery()` separately
  // decided retrieval-vs-advisory client-side — two uncoordinated classifiers reading the
  // same sentence. `routeQuery()` now classifies comparison intent too (same underlying
  // `detectCompareIntent`, just called from the one shared place), so this route consumes
  // its verdict instead of re-deriving it. Nothing downstream changes: `compareIntent` is
  // the identical `CompareIntent` value it always was, still passed to
  // `resolveComparisonRoute` and used to extract the search subject exactly as before.
  const queryRoute = routeQuery(typedQuery);
  const compareIntent: CompareIntent = queryRoute.mode === 'comparison' ? queryRoute.compareIntent : { kind: 'none', reason: queryRoute.reason };
  const rawQuery =
    compareIntent.kind === 'single' ? compareIntent.subject
    : compareIntent.kind === 'pair' ? compareIntent.subjects.join(' ')
    : typedQuery;
  const queryIsMainProduct = isMainProductTypeQuery(rawQuery);
  // Structured constraints, parsed ONCE by the same deterministic parser the advisor uses.
  // A budget or quantity NUMBER is a constraint VALUE, not a product token: «5000» in
  // «بميزانيتي 5000 ريال» must not retrieve products whose titles contain 5000, and «3»
  // must not rank. (Measured 2026-08-04 — these tokens flooded retrieval with unrelated
  // categories while the stated category sat unenforced; see the baseline directory.)
  const constraintTask = rawQuery ? parseShoppingTask(rawQuery) : null;
  const constraintNumbers = new Set<string>(
    [constraintTask?.budget_total, constraintTask?.quantity, constraintTask?.room_size_m2]
      .filter((n): n is number => typeof n === 'number')
      .map(String),
  );
  // Need-shaped = an explicit category PLUS at least one parsed constraint. Only this
  // shape gets the strict category gate below — model queries keep today's fallback.
  const needShapedWithCategory = !!constraintTask?.category &&
    (constraintNumbers.size > 0 || typeof constraintTask?.room_size_m2 === 'number');

  // A parsed budget was stripped from RELEVANCE (2026-08-09 fix, above) so «تحت 4000»
  // stops zeroing the query — but stripping alone left the browse grid showing products
  // above the stated budget as if they matched it, which is a confident-wrong result the
  // Constitution forbids just as much as a false zero. When the sentence names an explicit
  // category AND a high-confidence budget, and the caller did not already choose a price
  // filter via the sidebar (never override an explicit user filter), apply the parsed
  // budget as a REAL retrieval-level ceiling — same mechanism `applyCommonFilters` already
  // uses for the filter sidebar, just fed from the sentence instead of a slider. Recorded
  // on the response as `inferredMaxPrice` (never silent) so the client can disclose it.
  const inferredMaxPrice =
    needShapedWithCategory && typeof constraintTask?.budget_total === 'number' && typeof body.max_price !== 'number'
      ? constraintTask.budget_total
      : null;
  if (inferredMaxPrice !== null) body.max_price = inferredMaxPrice;

  const supabase = createServerClient();

  // `slug` is REQUIRED here: the card links to /products/<product_slug>, and the product page
  // resolves with .eq('slug', …). This clause omitted it, so the route fell back to emitting
  // the row's UUID as the slug and every one of those links resolved to nothing.
  const selectClause = `
    id, slug, name_ar, name_en, brand, category, image_url,
    product_stores!inner (
      id, store_name, current_price, original_price, availability, product_url, coupon_code,
      stores ( name )
    )
  `;

  const hasPostFilters =
    typeof body.discount === 'number' ||
    (body.specs !== undefined && Object.keys(body.specs).length > 0);

  let currentPage: number;
  let currentPageSize: number;
  let offsetStart: number;
  let offsetEnd: number;

  if (typeof body.page === 'number' || typeof body.pageSize === 'number') {
    currentPage = Math.max(1, body.page ?? 1);
    currentPageSize = Math.min(100, Math.max(1, body.pageSize ?? 25));
    offsetStart = (currentPage - 1) * currentPageSize;
    offsetEnd = currentPage * currentPageSize - 1;
  } else {
    const pages = body.pages ?? 1;
    currentPage = 1;
    currentPageSize = Math.max(pages, 1) * 48;
    offsetStart = 0;
    offsetEnd = currentPageSize - 1;
  }

  let rows: ProductRow[] = [];
  let totalCount = 0;
  let dbError: string | null = null;
  let relaxedResults = false; // true when we fell back to nearby/related products (no exact all-words match)

  let algoliaProducts: GroupedSearchProduct[] | null = null;
  if (rawQuery && isAlgoliaConfigured()) {
    console.log('[Algolia] search started:', rawQuery);
    try {
      // Inject the Arabic→English expansion so Algolia (primary path) surfaces the many
      // English-named appliances (292 refrigerators, 246 washers…) for Arabic queries like ثلاجة/غسالة.
      // The expansion tokens are OPTIONAL words: a record matching any one (e.g. "refrigerator") returns.
      const aqWords = normalizeArabic(rawQuery).split(/\s+/).filter((w) => w && !isWrapperWord(w) && !constraintNumbers.has(w));
      const englishExp = [...new Set(aqWords.flatMap((w) => lookupArToEn(w) || []).flatMap((m) => m.split(/\s+/)).filter((t) => t.length >= 2 && !GENERIC_EXPANSION_STOPWORDS.has(t)))];
      // Use the NORMALIZED (ة→ه folded) query so every query token matches an optionalWords entry —
      // otherwise the unfolded "ثلاجة" is treated as REQUIRED, matches nothing, and returns 0/junk
      // even though the index holds 260 refrigerators. (Verified against the live index.)
      // …AND THE MIRROR OF IT, which was missing. The block above expands Arabic → English so an
      // Arabic query reaches English-titled records. Nothing expanded English → Arabic, so an
      // English query could never reach Arabic-titled records — and most of the catalogue is
      // Arabic-titled. That asymmetry, not the exit layer, is what produced the EN/AR gap.
      //
      // Measured 2026-07-31 (total results, English vs its Arabic equivalent):
      //   air conditioner 14 vs 500 · washing machine 58 vs 404 · headphones 166 vs 290
      //   refrigerator 362 vs 362 · vacuum 230 vs 233
      // Single-word English was fine because `lookupArToEn` is word-level; multi-word English
      // collapsed because the PHRASE ("air conditioner" → مكيف) was never consulted.
      //
      // Added as OPTIONAL words, exactly like the English expansion: recall widens, nothing is
      // required, and a record still has to match the query to rank.
      const arVariant = expandQueriesForRetailSearch(rawQuery).find((v) => v !== rawQuery.trim());
      // `!constraintNumbers` here too: the variant keeps the sentence's numbers, and without
      // this they re-entered the engine query through the expansion after being stripped
      // from aqWords (measured on the EN basket sentence, 2026-08-04 after-run).
      const arabicExp = arVariant
        ? [...new Set(normalizeArabic(arVariant).split(/\s+/).filter((w) => w && !isWrapperWord(w) && !constraintNumbers.has(w) && !aqWords.includes(w)))]
        : [];
      const expansions = [...englishExp, ...arabicExp];
      // The SUBJECT of the request, not the sentence wrapping it (same rule as compare
      // intent above): stopwords, budget-wrapper words and constraint numbers are stripped
      // from the engine query so they can never act as matching or ranking terms. A query
      // word absent from optionalWords is effectively REQUIRED-and-ranked by the engine —
      // measured 2026-08-04: «want»/«with» left in the EN basket sentence outranked every
      // Arabic-titled AC with English junk titles containing those function words. Ordinary
      // product queries carry none of these tokens and are unchanged.
      const subjectWords = normalizeArabic(rawQuery).split(/\s+/)
        .filter((w) => w && !isWrapperWord(w) && !constraintNumbers.has(w));
      const subject = subjectWords.length ? subjectWords.join(' ') : normalizeArabic(rawQuery);
      const algoliaQuery = expansions.length ? `${subject} ${expansions.join(' ')}` : subject;
      const algoliaRes = await searchAlgolia({
        query: algoliaQuery,
        optionalWords: expansions.length ? [...aqWords, ...expansions] : undefined,
        brands: body.brands,
        stores: body.stores,
        minPrice: body.min_price,
        maxPrice: body.max_price,
        inStockOnly: body.in_stock_only,
        dealsOnly: body.deals_only,
        hitsPerPage: 100,
      });
      console.log('[Algolia] hits count:', algoliaRes?.hits?.length ?? 'null');
      if (algoliaRes?.hits?.length) {
        const mapped = algoliaRes.hits
          .map(algoliaHitToGrouped)
          .filter((p): p is GroupedSearchProduct => p !== null);
        if (mapped.length > 0) {
          algoliaProducts = mapped;
          console.log('[Algolia] using Algolia results:', mapped.length);
        }
      }
    } catch (e) {
      console.error('[Algolia] error:', e);
    }
    if (!algoliaProducts) console.log('[Algolia] falling back to Supabase');
  }

  if (rawQuery && !algoliaProducts) {
    const normalized = normalizeArabic(rawQuery);
    const allWords = normalized.split(/\s+/).filter(Boolean);
    const meaningful = allWords.filter((w) => !isWrapperWord(w) && !constraintNumbers.has(w));
    const words = meaningful.length > 0 ? meaningful : allWords;
    // The Arabic equivalent must widen the CANDIDATE POOL too, not only the post-filter: if
    // Arabic-titled products never enter the pool, no amount of matching afterwards can surface
    // them. This is why the fix touches buildOrPool as well as the predicate.
    const altTermsList = arabicVariantTerms(rawQuery);
    const poolWords = [...words, ...altTermsList.flat()];
    let q = supabase.from('products').select(selectClause, { count: 'exact' }).eq('is_active', true);
    const orPool = buildOrPool(poolWords);
    if (orPool) q = q.or(orPool);
    q = applyCommonFilters(q, body);
    q = q.range(0, 1500);
    const { data, error } = await q;
    if (error) { console.error('[search:pool]', error.message); dbError = error.message; }
    const orCandidates = (data ?? []) as ProductRow[];
    const wordTermsList = words.map(expandWordTerms).filter((t) => t.length > 0);
    let candidateRows = orCandidates;
    if (wordTermsList.length > 0) {
      const strict = orCandidates.filter((row) => productMatchesAllWords(row, wordTermsList, altTermsList));
      if (strict.length > 0) {
        candidateRows = strict;
      } else if (wordTermsList.length > 1) {
        // No product matches ALL words (e.g. "ثلاجة صغيرة", "مكيف لغرفة 30 متر"). Rather than a silent
        // zero, surface the closest products — those matching the MOST query words — flagged as related.
        const scored = orCandidates
          .map((row) => ({ row, hits: wordTermsList.filter((terms) => productMatchesAllWords(row, [terms])).length }))
          .filter((x) => x.hits > 0);
        const maxHits = scored.reduce((m, x) => Math.max(m, x.hits), 0);
        candidateRows = scored.filter((x) => x.hits === maxHits).map((x) => x.row);
        relaxedResults = candidateRows.length > 0;
      } else {
        candidateRows = [];
      }
    }
    rows = candidateRows;
    totalCount = candidateRows.length;
  } else if (!rawQuery) {
    let q = supabase.from('products').select(selectClause, { count: 'exact' }).eq('is_active', true);
    q = applyCommonFilters(q, body);
    q = q.range(hasPostFilters ? 0 : offsetStart, hasPostFilters ? 4999 : offsetEnd);
    const { data, error, count } = await q;
    if (error) {
      console.error('[search] error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    rows = (data ?? []) as ProductRow[];
    totalCount = count ?? rows.length;
  }

  let products: GroupedSearchProduct[] = algoliaProducts
    ? algoliaProducts
    : rows
        .map(toGroupedSearchProduct)
        .filter((p): p is GroupedSearchProduct => p !== null);

  // TPS Canonical Search — the categories the query is actually about (ADR-138). This was
  // hard-limited to mobile + air_conditioner, which hid 323 of our 459 comparable products.
  const tpsCategories = rawQuery ? detectCanonicalCategories(rawQuery) : null;
  if (rawQuery && tpsCategories) {
    const nq = normalizeArabic(rawQuery);
    const aw = nq.split(/\s+/).filter(Boolean);
    const mw = aw.filter((w) => !isWrapperWord(w) && !constraintNumbers.has(w));
    const tpsProducts = await searchTPSCanonical(mw.length ? mw : aw, supabase, tpsCategories);
    if (tpsProducts.length) {
      products = [...tpsProducts, ...products];
      console.log('[TPS Search] injected:', tpsProducts.length, '(', tpsCategories.join('+'), ')');
    }
  }

  // Deduplication after TPS merge
  products = deduplicateProducts(products);

  // Relevance groups (hoisted): used by BOTH the gate (filter) and scoreProduct (rank) so the query's
  // product noun must be present. Generic tokens can't satisfy relevance on their own.
  // NOTE: 'apple'/'samsung' are deliberately NOT generic — a brand-only word (ابل, سامسونج) needs its
  // English brand token to match English-named products (Apple Watch, Samsung Galaxy). Substitution is
  // prevented by (a) the multi-group AND gate and (b) the accessory penalty, not by stripping the brand.
  const GENERIC = new Set(['machine', 'electric', 'smart', 'digital', 'pro', 'max',
    'plus', 'mini', 'air', 'ultra', 'كهربائيه', 'كهربائي', 'ذكي', 'ذكيه', 'رقمي', 'هوائيه', 'hd', '4k']);
  // MEASURED DEFECT (2026-07-29): GENERIC was applied to each expansion TERM, so the
  // Arabic word برو expanded to ['برو','pro'], lost 'pro' as generic, and was left able to
  // match ONLY the Arabic spelling. Canonical products are named in Latin ("apple iPhone
  // 16 Pro Max 256GB"), so the relevance gate then DROPPED the very product the customer
  // asked for. Reproduced on production: `ايفون 16 256` → 3 stores; add `برو` → 1 store.
  // It hit every Arabic query naming a Pro / Max / Plus / Mini / Air / Ultra model —
  // iPhone Pro/Max, MacBook Air/Pro, iPad Air/Mini, Galaxy Ultra — i.e. the flagships.
  //
  // GENERIC belongs at the WORD level: a word that carries NO relevance signal in any
  // script contributes no group at all. A word that does carry one keeps every spelling
  // it can be written in, so Arabic and Latin catalogue names stay reachable from either
  // language. This is the same class of bug as the ة/ى folding one above.
  const relevanceGroups: string[][] = queryIsMainProduct
    ? normalizeArabic(rawQuery).split(/\s+/).filter(Boolean)
        .filter((w) => !isWrapperWord(w) && !constraintNumbers.has(w))
        .map((w) => expandWordTerms(w).filter((t) => t.length >= 2))
        .filter((g) => g.length > 0 && !g.every((t) => GENERIC.has(t)))
    : [];
  const isAcQuery = !!rawQuery && (detectCanonicalCategories(rawQuery) ?? []).includes('air_conditioner');
  const isMonitorQuery = !!rawQuery && (detectCanonicalCategories(rawQuery) ?? []).includes('monitor');
  const isWatchQuery = !!rawQuery && (detectCanonicalCategories(rawQuery) ?? []).includes('smartwatch');

  // Relevance gate (2026-07-27): for a clear product-TYPE query, drop results whose title matches NONE
  // of a query word-group. AND across groups: "ايفون 16" requires the iPhone noun and rejects "Gree AC
  // 16000 BTU". Only applies when it leaves results (never wipes the page).
  //
  // MEASURED DEFECT (2026-08-10, D→E mission Section 11 refrigerator re-verification): a
  // sentence-shaped need description that ALSO happens to contain a bare category noun
  // («ابي ثلاجة كبيرة للعائلة موفرة للكهرباء وميزانيتي 3000 ريال» — "ثلاجة" is in
  // MAIN_PRODUCT_TYPES) took THIS branch (`queryIsMainProduct=true`) instead of the
  // sentence-shaped elif below, and its own relevance-gate is weaker: the descriptive words
  // («كبيرة»/«للعائلة»/«موفرة»/«للكهرباء») never literally appear in real product titles, so
  // `gated` came back empty, `needShapedWithCategory` did not zero it either, and `products`
  // was left as the full unfiltered 324-item category pool — never wrong-category (every
  // result was a genuine refrigerator), but never the honest zero this query deserved either.
  // The AC-phrased twin of this exact query ("مكيف" is ALSO in MAIN_PRODUCT_TYPES) happened
  // to zero correctly through this same branch, which is exactly the fragility Section 6
  // warns about — a "real product search is almost never 6+ words" fix must not depend on
  // which specific descriptive words a given category's catalog titles happen to contain.
  // `looksLikeSentenceNotProductQuery` now takes priority over a bare category-noun match:
  // a 9-word natural-language description is not a literal product-name search regardless of
  // which recognized noun it happens to contain.
  let categoryEnforcedZero = false;
  if (rawQuery && queryIsMainProduct && !looksLikeSentenceNotProductQuery(rawQuery)) {
    const wordGroups = relevanceGroups;
    if (wordGroups.length) {
      const gated = products.filter((p) => {
        const hay = (normalizeArabic(p.name_ar || '') + ' ' + (p.name_en || '') + ' ' + (p.brand || '')).toLowerCase();
        return wordGroups.every((group) => group.some((t) => hay.includes(t)));
      });
      if (gated.length > 0) products = gated;
      else if (needShapedWithCategory) {
        // Master Book category enforcement (measured 2026-08-04): a need-shaped query with
        // an EXPLICIT category («ابي 3 مكيفات بميزانيتي 5000 ريال») must never fall back to
        // unrelated products. Fewer or zero relevant results beat confident wrong ones.
        // Model queries (no parsed category constraint shape) keep the soft fallback.
        products = [];
        categoryEnforcedZero = true;
        console.warn(`[category-enforced-zero] "${rawQuery.slice(0, 60)}" — category "${constraintTask?.category}" matched nothing; returning honest zero instead of unrelated results`);
      }
    }
  } else if (rawQuery && looksLikeSentenceNotProductQuery(rawQuery)) {
    // GENERIC candidate-eligibility floor (Section 6): sentence-shaped — whether or not it
    // also contains a recognized product-type noun — is not a product-name search. Same
    // "zero beats wrong" rule as above, now applied unconditionally for this shape rather
    // than only when `queryIsMainProduct` happened to be false.
    products = [];
    categoryEnforcedZero = true;
    console.warn(`[category-enforced-zero] "${rawQuery.slice(0, 60)}" — sentence-shaped query; returning honest zero instead of unfiltered results`);
  }

  // Product principle (official 2026-07-27): every comparable card shows its stores auto-sorted from
  // cheapest to most expensive, so the customer never compares manually. Enforce it for every product.
  for (const p of products) {
    if (Array.isArray(p.stores) && p.stores.length > 1) {
      p.stores.sort((a, b) => (Number(a.current_price) || Infinity) - (Number(b.current_price) || Infinity));
      p.best_price = Number(p.stores[0]?.current_price) || p.best_price;
    }
  }

  products = applyPostFilters(products, body);

  // Part B eligibility hardening — see `excludeIneligibleCandidates`'s own doc comment for
  // the full measured evidence and reasoning. Gated the same way as every other eligibility
  // rule in this file: only for a confirmed device-type query that does NOT itself signal
  // accessory intent.
  if (rawQuery && queryIsMainProduct && !isAccessoryShapedQuery(rawQuery)) {
    const beforeCount = products.length;
    products = excludeIneligibleCandidates(products, isAcQuery, isMonitorQuery, isWatchQuery);
    if (products.length !== beforeCount) {
      console.warn(`[candidate-eligibility] "${rawQuery.slice(0, 60)}" — excluded ${beforeCount - products.length} ineligible candidate(s) (accessory hint and/or statistical price-floor outlier)`);
    }
  }

  if (rawQuery) {
    const prices = products.map((p) => p.best_price).filter((n) => n > 0);
    const pMin = prices.length ? Math.min(...prices) : 0;
    const pMax = prices.length ? Math.max(...prices) : 0;
    const requestedSort = body.sort && body.sort !== 'relevance';
    if (requestedSort) products.sort(compareBySort(body.sort!));
    else products.sort((a, b) => scoreProduct(b, pMin, pMax, queryIsMainProduct, relevanceGroups, isAcQuery) - scoreProduct(a, pMin, pMax, queryIsMainProduct, relevanceGroups, isAcQuery));
  } else {
    products.sort(compareBySort(body.sort || 'relevance'));
  }

  const decision = buildDecisionLayer(products, queryIsMainProduct, relevanceGroups, isAcQuery);

  // ✅ تم تصحيح حساب total بعد دمج TPS
  const total = rawQuery
    ? products.length
    : hasPostFilters
    ? products.length
    : totalCount;

  // MEASURED DEFECT (2026-08-10, D→E mission Part F — founder follow-up on the "مكيف"
  // pagination check): `products.slice(0, currentPageSize)` ignored `offsetStart` whenever
  // `hasPostFilters` was false (i.e. no discount/specs sidebar filter applied) — the common
  // case for almost every search. `offsetStart`/`offsetEnd` are ALREADY correctly computed
  // from `body.page` above regardless of `hasPostFilters` (lines 1334-1345: they default to
  // 0/currentPageSize-1 when no page is requested, identical to the old unconditional slice
  // for page 1), so using them unconditionally fixes every page > 1 request without changing
  // page-1/no-page behavior at all. Confirmed live: requesting page 2/3 of a plain "مكيف"
  // search returned the EXACT SAME first-25 items as page 1, verified via direct API calls
  // with different `page` values returning byte-identical product lists.
  const pageProducts = products.slice(offsetStart, offsetEnd + 1);

  // TPS Enrichment
  const enrichedProducts = await enrichWithTPS(pageProducts, supabase);

  const prices = enrichedProducts.map((p) => p.best_price).filter((n) => n > 0);
  const result: ScrapedSearchResult & {
    total: number;
    page: number;
    pageSize: number;
    decisionCard: DecisionLayer['decisionCard'];
    topMatches: DecisionTopMatch[];
    relaxed: boolean;
    categoryEnforcedZero: boolean;
    inferredMaxPrice: number | null;
  } = {
    products:          enrichedProducts,
    count:             enrichedProducts.length,
    total,
    relaxed:           relaxedResults,
    // Observability for the honest-zero path (never silent): true when an explicit-category
    // need query matched nothing and unrelated results were withheld rather than shown.
    categoryEnforcedZero,
    // Never silent (2026-08-09): a budget PARSED FROM THE SENTENCE, not chosen via the
    // filter sidebar, that is now acting as a real retrieval ceiling. The client must
    // disclose this ("طبّقنا ميزانيتك ≤ N ريال"), never apply it invisibly.
    inferredMaxPrice,
    page:              currentPage,
    pageSize:          currentPageSize,
    query:             typedQuery,
    storeResults:      computeStoreResults(enrichedProducts),
    priceStats: {
      min: prices.length ? Math.min(...prices) : null,
      max: prices.length ? Math.max(...prices) : null,
      avg: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
    },
    searchTime:        (Date.now() - started) / 1000,
    errors:            dbError ? { search: dbError } : null,
    totalStores:       computeUniqueStores(enrichedProducts),
    successfulStores:  computeUniqueStores(enrichedProducts),
    decisionCard:      decision.decisionCard,
    topMatches:        decision.topMatches,
  };

  // UNIFIED SEARCH → "Comparison requests may generate structured comparisons", under the
  // rule that comparison intent must NEVER route to a comparison that cannot be delivered.
  //
  // Computed HERE, server-side, and only when the query actually carries comparison intent —
  // so an ordinary search pays nothing for it. `resolveComparisonRoute` verifies every
  // condition against `getComparison()`, the page's own loader, before a comparison link is
  // allowed to exist. It fails soft: a broken verification returns ordinary results rather
  // than an unverified comparison, because the failure direction that matters is never
  // offering a comparison we cannot honour.
  let compareRoute: Awaited<ReturnType<typeof resolveComparisonRoute>> | null = null;
  if (compareIntent.kind !== 'none') {
    try {
      const identityKeys = enrichedProducts
        .map((p) => (p as { tps_identity_key?: string | null }).tps_identity_key)
        .filter((k): k is string => !!k);
      compareRoute = await resolveComparisonRoute(createServerClient(), typedQuery, compareIntent, identityKeys);
    } catch {
      compareRoute = null;
    }
  }

  return NextResponse.json({ ...result, compareRoute });
}

function applyPostFilters(products: GroupedSearchProduct[], body: SearchBody): GroupedSearchProduct[] {
  let result = products;
  // MEASURED GAP (2026-08-09): `applyCommonFilters`/Algolia apply min/max_price at the
  // DB/index level, but TPS-injected canonical products (`searchTPSCanonical`, merged in
  // AFTER those calls) never pass through either — so a query-parsed budget could still let
  // an over-budget TPS product into the grid while the UI told the shopper their budget was
  // applied. Enforced here too so every product in the response, from either source, obeys
  // the same price bound.
  if (typeof body.min_price === 'number') {
    result = result.filter((product) => product.best_price >= body.min_price!);
  }
  if (typeof body.max_price === 'number') {
    result = result.filter((product) => product.best_price <= body.max_price!);
  }
  if (body.deals_only) {
    result = result.filter((product) =>
      product.stores.some((s) => s.original_price && s.current_price && s.original_price > s.current_price)
    );
  }
  if (typeof body.discount === 'number') {
    result = result.filter((product) =>
      product.stores.some((store) => {
        if (!store.original_price || !store.current_price) return false;
        const discount = ((store.original_price - store.current_price) / store.original_price) * 100;
        return discount >= body.discount!;
      })
    );
  }
  if (body.specs && Object.keys(body.specs).length > 0) {
    result = result.filter((product) => {
      const fallbackSpecs = extractSpecsFromTitle(product.name_en || product.name_ar || '');
      return Object.entries(body.specs!).every(([key, values]) => {
        if (!values || values.length === 0) return true;
        const value = fallbackSpecs?.[key] ?? '';
        return values.map((item) => item.toLowerCase()).includes(value);
      });
    });
  }
  return result;
}

function toGroupedSearchProduct(row: ProductRow): GroupedSearchProduct | null {
  // Approved-27 scope gate: drop offers from non-approved retailers (e.g. shaker, samsung_ksa).
  const productStores = (row.product_stores || []).filter(
    (ps) => ps && ps.current_price != null && isDisplayableRetailer(ps.store_name || ps.stores?.name),
  );
  if (productStores.length === 0) return null;
  const storeEntries: SearchProduct[] = productStores.map((ps) => ({
    name_ar: row.name_ar,
    name_en: row.name_en,
    brand: row.brand || '',
    model: '',
    sku: null,
    current_price: Number(ps.current_price),
    original_price: ps.original_price !== null && ps.original_price !== undefined ? Number(ps.original_price) : null,
    availability: ps.availability || 'in_stock',
    product_url: normalizeExitUrl(ps.product_url) || '',
    image_urls: row.image_url ? [row.image_url] : [],
    specifications: {} as Record<string, unknown>,
    category: (row.category || '') as ProductCategory,
    description_ar: null,
    description_en: null,
    is_free_delivery: false,
    delivery_time_days: null,
    delivery_cost: 0,
    is_deal: !!(ps.original_price && ps.current_price && ps.original_price > ps.current_price),
    coupon_code: ps.coupon_code ?? null,
    store: ps.store_name || ps.stores?.name || 'unknown',
    store_name: ps.store_name || ps.stores?.name || '',
    rating: null,
    review_count: null,
  }));
  const prices = storeEntries.map((e) => e.current_price).filter((n) => n > 0);
  const bestPrice = prices.length ? Math.min(...prices) : 0;
  const anyInStock = storeEntries.some((e) => e.availability === 'in_stock');
  const uniqueStores = new Set(storeEntries.map((e) => e.store)).size;
  const rep = storeEntries[0];
  return {
    ...rep,
    current_price: bestPrice,
    availability: anyInStock ? 'in_stock' : rep.availability,
    stores: storeEntries,
    best_price: bestPrice,
    store_count: uniqueStores,
    product_id: row.id,
    // MEASURED 2026-07-30: this was `row.id`. The product page resolves by `products.slug`,
    // so emitting the UUID produced a link that matched nothing — the page rendered its
    // "not found" state at HTTP 200 for BOTH the shopper and the crawler. 38 of 48 cards on
    // `iphone 15` carried a UUID here. Fall back to the id only if a row somehow has no
    // slug; the page now accepts either.
    product_slug: (row as { slug?: string | null }).slug || row.id,
  } as GroupedSearchProduct;
}

function computeStoreResults(products: GroupedSearchProduct[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of products) for (const s of p.stores) counts[s.store] = (counts[s.store] || 0) + 1;
  return counts;
}

function computeUniqueStores(products: GroupedSearchProduct[]): number {
  const set = new Set<string>();
  for (const p of products) for (const s of p.stores) set.add(s.store);
  return set.size;
}

function compareBySort(sort: string): (a: GroupedSearchProduct, b: GroupedSearchProduct) => number {
  // الإكسسوارات تنزل لذيل النتائج دائماً — حتى مع الفرز السعري
  // (يمنع كفر بـ119 ريال من تصدّر بحث "ايفون 17" ولبس شارة أفضل سعر)
  const acc = (p: GroupedSearchProduct) =>
    hasAccessoryHint(p.name_ar || '', p.name_en || '') ? 1 : 0;

  if (sort === 'price_asc' || sort === 'price_low')
    return (a, b) => acc(a) - acc(b) || a.best_price - b.best_price;
  if (sort === 'price_desc' || sort === 'price_high')
    return (a, b) => acc(a) - acc(b) || b.best_price - a.best_price;
  return (a, b) => {
    if (acc(a) !== acc(b)) return acc(a) - acc(b);
    if (b.store_count !== a.store_count) return b.store_count - a.store_count;
    return a.best_price - b.best_price;
  };
}

export async function GET() {
  return NextResponse.json({ status: 'ok', engine: 'algolia+db', arabic: true, store: 'inline-name', v: 'v9-algolia-tps-canonical' });
}