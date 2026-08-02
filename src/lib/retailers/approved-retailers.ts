/**
 * SINGLE SOURCE OF TRUTH for Tawveeri's approved retailer scope.
 *
 * Founder Directive (2026-07-27): the public platform may present ONLY these 27
 * retailers (the Rakhys-benchmark portfolio). Every customer-facing surface —
 * the stores directory, search offers, retailer counts, filters — MUST gate
 * through this module. A retailer being present in the `stores` table, having a
 * logo, a legacy config, or historical rows is NOT sufficient to display it.
 *
 * `slug` is Tawveeri's INTERNAL canonical store slug (matches `stores.slug` and
 * the store-config filenames where one exists). Identities/domains are from the
 * lawful public research pass (2026-07-27); `domain: null` = not yet verified
 * (left UNKNOWN rather than guessed).
 *
 * NOTE: Rakhys list #25 (RedSea) and #27 (Abdul Latif Jameel Electronics) are the
 * SAME merchant (redsea.com is ALJ Electronics' consumer storefront) — represented
 * once, as `redsea`. So 27 list entries → 26 distinct merchants.
 */

export interface ApprovedRetailer {
  /** Internal canonical slug (stores.slug). */
  slug: string;
  name_en: string;
  name_ar: string;
  /** Official live Saudi storefront domain, or null if not publicly verified. */
  domain: string | null;
  /** Publicly-observed sourcing viability (see docs/RETAILER-MATRIX.md). */
  source:
    | 'active'            // ingested + customer-visible today
    | 'credential_free'   // lawful public feed/sitemap exists — can be ingested without credentials
    | 'commercial'        // requires official API / affiliate / OAuth (Founder-credential boundary)
    | 'blocked'           // bot-walled / unresolved domain — cannot lawfully auto-ingest now
    | 'not_a_store';      // distributor or placeholder — no consumer storefront
}

export const APPROVED_RETAILERS: ApprovedRetailer[] = [
  { slug: 'noon',          name_en: 'Noon',                        name_ar: 'نون',              domain: 'noon.com',            source: 'commercial' },
  { slug: 'amazon',        name_en: 'Amazon Saudi Arabia',         name_ar: 'أمازون السعودية',  domain: 'amazon.sa',           source: 'active' },
  { slug: 'aliexpress',    name_en: 'AliExpress',                  name_ar: 'علي إكسبريس',      domain: 'aliexpress.com',      source: 'commercial' },
  { slug: 'jarir',         name_en: 'Jarir Bookstore',             name_ar: 'مكتبة جرير',       domain: 'jarir.com',           source: 'active' },
  { slug: 'extra',         name_en: 'eXtra',                       name_ar: 'إكسترا',           domain: 'extra.com',           source: 'active' },
  { slug: 'carrefour',     name_en: 'Carrefour KSA',               name_ar: 'كارفور السعودية',  domain: 'carrefourksa.com',    source: 'commercial' },
  { slug: 'almanea',       name_en: 'Almanea',                     name_ar: 'المنيع',           domain: 'almanea.sa',          source: 'active' },
  { slug: 'swsg',          name_en: 'Sheta & Saif',                name_ar: 'الشتاء والصيف',    domain: 'swsg.co',             source: 'credential_free' },
  { slug: 'lulu',          name_en: 'LuLu Hypermarket',            name_ar: 'لولو هايبر ماركت', domain: 'luluhypermarket.com', source: 'commercial' },
  { slug: 'blackbox',      name_en: 'Black Box',                   name_ar: 'الصندوق الأسود',   domain: 'blackboxksa.com',     source: 'blocked' },
  { slug: 'alsaifgallery', name_en: 'Alsaif Gallery',              name_ar: 'السيف غاليري',     domain: 'alsaifgallery.com',   source: 'credential_free' },
  { slug: 'jehazak',       name_en: 'Jehazak',                     name_ar: 'جهازك',            domain: null,                  source: 'blocked' },
  { slug: 'sharafdg',      name_en: 'Sharaf DG',                   name_ar: 'شرف دي جي',        domain: 'sharafdg.com',        source: 'commercial' },
  { slug: 'ebay',          name_en: 'eBay',                        name_ar: 'إي باي',           domain: 'ebay.com',            source: 'commercial' },
  { slug: 'alkhunaizan',   name_en: 'Alkhunaizan',                 name_ar: 'الخنيزان',         domain: 'alkhunaizan.sa',      source: 'credential_free' },
  { slug: 'aleph',         name_en: 'Aleph',                       name_ar: 'ألف',              domain: 'alephksa.com',        source: 'credential_free' },
  { slug: 'technobest',    name_en: 'Techno Best',                 name_ar: 'تكنو بست',         domain: null,                  source: 'blocked' },
  { slug: 'ashwered',      name_en: 'Ashwered',                    name_ar: 'اشورد',            domain: 'ashwered.com',        source: 'blocked' },
  { slug: 'abdulwahed',    name_en: 'Abdulwahed',                  name_ar: 'عبد الواحد',       domain: null,                  source: 'not_a_store' },
  { slug: 'mestores',      name_en: 'Me Stores',                   name_ar: 'مي ستورز',         domain: 'mestores.com',        source: 'credential_free' },
  { slug: 'nujoomalomran', name_en: 'Nujoom Alomran',              name_ar: 'نجوم العمران',     domain: null,                  source: 'blocked' },
  { slug: 'alesayi',       name_en: 'Alesayi Electronics',         name_ar: 'العيسائي',         domain: null,                  source: 'not_a_store' },
  { slug: 'ghassan',       name_en: 'Ghassan Trading',             name_ar: 'غسان للتجارة',     domain: 'ghassanstore.com',    source: 'credential_free' },
  { slug: 'alrabee',       name_en: 'Al Rabee Al Saif',            name_ar: 'الربيع والصيف',    domain: 'alrabeealsaif.com.sa',source: 'credential_free' },
  // redsea = Rakhys #25 (RedSea) AND #27 (Abdul Latif Jameel Electronics) — one merchant.
  { slug: 'redsea',        name_en: 'RedSea',                      name_ar: 'ردسي',             domain: 'redsea.com',          source: 'commercial' },
  { slug: 'almtkamel',     name_en: 'Almtkamel Store',             name_ar: 'المتكامل',         domain: 'almtkamelstore.sa',   source: 'blocked' },

  // ── Admitted 2026-07-29 (ADR-139) on MEASURED overlap, not on the Rakhys portfolio ──
  // These three were already ingested and sitting in `price_history`, but were excluded
  // here — so `searchTPSCanonical` skipped every one of their observations and their
  // overlap with the majors was unreachable. Measured before admitting:
  //   • +137 canonicals move from single-store to comparable (455 → 592, +30%)
  //   • freshness 3.3–4.7 days, in line with the majors
  //   • link health 9/9 sampled exits return HTTP 200
  // This is acquisition without acquiring: the stock was already paid for and ingested.
  // NOTE FOR THE FOUNDER: this widens the PUBLIC merchant set beyond the 26-merchant
  // Rakhys-benchmark portfolio. If that portfolio framing matters more than the +137
  // comparisons, revert this block — the rest of the file is untouched.
  { slug: 'najm',          name_en: 'Najm Appliances',             name_ar: 'نجم الأجهزة',      domain: 'najm.store',          source: 'active' },
  { slug: 'shaker',        name_en: 'Shaker',                      name_ar: 'شاكر',             domain: 'shakersa.com',        source: 'active' },
  { slug: 'alnakheelk',    name_en: 'Alnakheel Store',             name_ar: 'متجر النخيل',      domain: null,                  source: 'active' },
  // Samsung KSA — admitted 2026-07-30 (ADR-143) after INGESTING it, not before. The old
  // 'single-brand retailers produce nothing' rule was wrong: sonyworld produced zero
  // because Sony has 11 canonicals in the whole catalogue, while Samsung has 432 and is
  // carried by Jarir, Extra, Amazon, Almanea and Noon. Brand ubiquity is the variable.
  { slug: 'samsung_ksa',   name_en: 'Samsung Saudi Arabia',        name_ar: 'سامسونج السعودية', domain: 'samsung.com',         source: 'active' },
];

export const APPROVED_SLUGS: ReadonlySet<string> = new Set(APPROVED_RETAILERS.map((r) => r.slug));

/** Numeric `stores.id` values (production) whose slug is approved. */
/**
 * DISPLAY GATE.
 *
 * STANDING RULE (Founder decision 2026-08-02): **a retailer that cannot be ingested
 * legitimately is inactive AND hidden — never merely un-ingested.** Showing a retailer we
 * can no longer refresh means showing a price that only gets older, which is the failure
 * mode this platform exists to prevent. No proxies and no paid egress are used to
 * circumvent a deliberate block: that is fragile and it is not what a platform built on
 * transparency should do. This rule covers every future case without escalation.
 *
 * Removed 2026-08-02 under that rule, with the measured cost recorded rather than hidden —
 * comparable products carrying >=2 APPROVED offers fell 628 -> 428:
 *   · noon (3)     — HTTP-timeout blocked from our egress (later RECOVERED, ADR-180), so
 *                    re-admitting is a config change if a legitimate data route ever exists
 *   · lulu (23)    — Founder decision 2026-08-02: not important. Was ingesting fine
 *   · sharafdg (24)— HTTP 403 to our egress; no credential-free route exists
 *   · blackbox (10)— bot-walled, ZERO observations ever ingested
 */
export const APPROVED_STORE_IDS: ReadonlySet<number> = new Set([
  1, // jarir
  2, // amazon
  3,  // noon — RECOVERED 2026-08-02 via ADR-180. Its `/_svc/` API is disallowed by
      // noon.com/robots.txt AND blocked from our egress; its listing + product pages are
      // permitted, server-rendered and publish JSON-LD. 24 products verified FROM
      // PRODUCTION. The route was the problem, not the retailer.
  4, // extra
  5, // almanea
  8,  // swsg (الشتاء والصيف) — RECOVERED 2026-08-02 via ADR-179. Its HTML storefront 403s
      // our egress; its Magento GraphQL endpoint is public and answers 4,274 products.
      // Retired on one sourcing mode, recovered on another — the MODE was the difference,
      // not the retailer. 3,000 observations verified.
  7,  // shaker      — ADR-139, admitted on measured overlap 2026-07-29
  9,  // najm        — ADR-139
  18, // alnakheelk  — ADR-139
  6,  // samsung_ksa — ADR-143, admitted 2026-07-30 after ingestion
]);

/**
 * Maps every known internal store-name variant (slug, Arabic display name,
 * English name) seen in production `stores.name` / `product_stores.store_name` /
 * `price_history.store_name` to a canonical approved slug. Anything not present
 * here resolves to null → treated as NON-approved and hidden.
 */
const NAME_TO_SLUG: Record<string, string> = {
  // approved (present in production data today)
  'amazon': 'amazon', 'أمازون': 'amazon', 'أمازون السعودية': 'amazon', 'amazon.sa': 'amazon',
  'noon': 'noon', 'نون': 'noon',
  'jarir': 'jarir', 'جرير': 'jarir', 'مكتبة جرير': 'jarir',
  'extra': 'extra', 'اكسترا': 'extra', 'إكسترا': 'extra',
  'almanea': 'almanea', 'المنيع': 'almanea',
  'swsg': 'swsg', 'الشتاء والصيف': 'swsg', 'شيتا وسيف': 'swsg',
  'blackbox': 'blackbox', 'الصندوق الأسود': 'blackbox', 'بلاك بوكس': 'blackbox',
  'lulu': 'lulu', 'لولو هايبر ماركت': 'lulu', 'لولو': 'lulu', 'lulu hypermarket': 'lulu',
  'sharafdg': 'sharafdg', 'شرف دي جي': 'sharafdg', 'sharaf dg': 'sharafdg',
  // ADR-139 — the exact `price_history.store_name` strings these three write.
  'najm': 'najm', 'نجم الأجهزة': 'najm', 'نجم': 'najm',
  'shaker': 'shaker', 'شاكر': 'shaker', 'ibrahim-shaker': 'shaker',
  'alnakheelk': 'alnakheelk', 'متجر النخيل': 'alnakheelk', 'النخيل': 'alnakheelk',
  'samsung_ksa': 'samsung_ksa', 'سامسونج السعودية': 'samsung_ksa', 'سامسونج': 'samsung_ksa', 'samsung saudi': 'samsung_ksa',
};

function normalizeName(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Numeric `stores.id` → slug. REQUIRED, not a convenience: production stores the same
 * retailer two different ways depending on the table. `price_history.store_name` holds a
 * DISPLAY NAME ("اكسترا"), while `normalized_product_observations.store_id` is TEXT
 * holding a NUMERIC id ("4") in 96.3% of rows. Any code that joins those two namespaces
 * by string equality silently drops the offer — which is exactly how the compare page
 * lost Extra's 840 SAR offer and showed 1,099 while the card showed 840 (ADR-135).
 */
const STORE_ID_TO_SLUG: Record<string, string> = {
  '1': 'jarir', '2': 'amazon', '3': 'noon', '4': 'extra', '5': 'almanea',
  '8': 'swsg', '10': 'blackbox', '23': 'lulu', '24': 'sharafdg',
  // ADR-139 — verified against `stores` (id, name, slug) before adding.
  '7': 'shaker', '9': 'najm', '18': 'alnakheelk', '6': 'samsung_ksa',
};

/**
 * Resolve ANY store identifier — slug, Arabic name, English name, `price_history`
 * store_name, or a numeric `stores.id` (as number or text) — to an approved slug, or null.
 */
export function resolveApprovedSlug(identifier?: string | number | null): string | null {
  if (identifier === null || identifier === undefined) return null;
  const raw = String(identifier).trim();
  if (!raw) return null;
  // Numeric store id (the `normalized_product_observations.store_id` namespace).
  if (/^\d+$/.test(raw)) {
    const bySlug = STORE_ID_TO_SLUG[raw];
    return bySlug && APPROVED_SLUGS.has(bySlug) ? bySlug : null;
  }
  const key = normalizeName(raw);
  const mapped = NAME_TO_SLUG[raw] ?? NAME_TO_SLUG[key];
  if (mapped && APPROVED_SLUGS.has(mapped)) return mapped;
  // direct slug match (future retailers onboarded with their canonical slug)
  if (APPROVED_SLUGS.has(key)) return key;
  return null;
}

/** Customer-facing retailer name for an approved slug, in the requested locale. */
export function retailerDisplayName(slug: string | null, locale: 'ar' | 'en' = 'ar'): string | null {
  if (!slug) return null;
  const r = APPROVED_RETAILERS.find((x) => x.slug === slug);
  return r ? (locale === 'ar' ? r.name_ar : r.name_en) : null;
}

/** True iff the store identifier belongs to an approved retailer. */
export function isApprovedStore(identifier?: string | null): boolean {
  return resolveApprovedSlug(identifier) !== null;
}

/**
 * Approved for INGESTION, but must never be NAMED to a customer as a comparison source.
 *
 * `docs/LAUNCH_VOCABULARY.md` §3 MUST NOT SAY: «ذكر لولو أو شرف دي جي كمصدر مقارنة» /
 * "LuLu or Sharaf DG named as comparison sources." HANDOVER #16 carried the same exclusion as a
 * launch condition.
 *
 * The two gates were doing different jobs and only one of them knew it: `isApprovedStore`
 * governs whether we may INGEST a retailer, and LuLu is legitimately approved for that. Nothing
 * governed whether we may SHOW it. Measured 2026-07-31: LuLu appeared as a store on 3 of 384
 * customer-facing cards while holding ZERO offers in the comparison layer — surfaced through the
 * storefront path, which the ingestion gate correctly allowed.
 *
 * This is Appendix F1: the claim boundary is evidence, not style, and no amount of ingestion
 * makes an unsupported comparison claim acceptable. If either retailer later reaches real
 * comparison depth, amend the vocabulary FIRST with the measurement, then remove it from here.
 */
export const COMPARISON_DISPLAY_EXCLUDED: ReadonlySet<string> = new Set([
  'lulu', 'sharafdg',
  // Added 2026-08-02 under the standing rule that a retailer we cannot refresh is inactive
  // AND hidden. Both are also out of APPROVED_STORE_IDS, so this is belt-and-braces: the
  // ingestion gate and the display gate answer different questions and only one of them
  // knowing is how LuLu once reached 3 customer cards while holding zero comparison offers.
  'blackbox',  // bot-walled, zero observations ever ingested
  // noon and swsg were BOTH here and are both gone (ADR-179/180). Each was retired on a
  // single sourcing mode and recovered on another: swsg via Magento's public GraphQL,
  // noon via its robots-PERMITTED listing+JSON-LD pages after we stopped calling the
  // `/_svc/` endpoint its own robots.txt disallows. "Cannot be ingested" was never true of
  // either retailer — it was true of the one route each happened to be configured with.
]);

/** True iff this retailer may be shown to a customer as a source of a price/comparison. */
export function isDisplayableRetailer(identifier?: string | number | null): boolean {
  const slug = resolveApprovedSlug(identifier);
  return slug !== null && !COMPARISON_DISPLAY_EXCLUDED.has(slug);
}

/** True iff the numeric stores.id is approved. */
export function isApprovedStoreId(id?: number | null): boolean {
  return id != null && APPROVED_STORE_IDS.has(id);
}
