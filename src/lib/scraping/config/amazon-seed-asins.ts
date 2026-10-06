// src/lib/scraping/config/amazon-seed-asins.ts
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Targeted Amazon.sa listings the generic discovery queries do not reach (external review 2026-10-06, item 7).
//
// WHY: Amazon discovery walks 26 broad queries × 2 result pages (~50 tiles each), i.e. the first ~2,500 tiles of a catalogue of tens of thousands. A model that is not on those
// pages is never created, however strong its offer. Re-checked live on 2026-10-06 with the production detail-page reader (`AmazonScraper.updateProductPrice`): each ASIN
// below is on amazon.sa, in stock, with a buy-box price — and has NO storefront row (`product_stores`) in production.
//
// HOW IT IS USED: `/api/cron/discover-firecrawl` (Amazon gate) reads the detail page of every seed that has no storefront row yet (bounded per run), and persists it through the
// SAME path as a discovered ASIN — canonical `/dp/ASIN` URL, page price only, `external_id = ASIN`, price-truth gate, raw observation. A seed whose row exists is skipped, so the
// list is idempotent and can only ever ADD a listing; it never reprices, merges or links anything (identity stays with the normalizer/projection).
//
// ADDING ONE: a seed needs an ASIN that was read live (evidence line = what was read and when). `brand` is optional but recommended: the detail-page reader returns 'Unknown'
// for many brands, and an Unknown brand is the first thing the identity layer cannot recover from. Extra ASINs can also be supplied without a deploy through the
// `AMAZON_SEED_ASINS` env var (comma-separated).
// ─────────────────────────────────────────────────────────────────────────────────────────────────
export interface AmazonSeed {
  asin: string;
  brand?: string;
  /** Free text, for people: what this listing is. */
  note: string;
  /** What was read, where and when. */
  evidence: string;
}

export const AMAZON_SEED_ASINS: AmazonSeed[] = [
  { asin: 'B0FB3TL22Z', brand: 'Midea', note: 'Midea double-door refrigerator MDRT765FGU46DO (English listing)', evidence: 'amazon.sa/dp read 2026-10-06 by AmazonScraper: SAR 2,899 (list 6,000), in stock' },
  { asin: 'B0FBKQ28T5', brand: 'Midea', note: 'Midea double-door refrigerator MDRT765FGU46DO (Arabic listing, 576 L)', evidence: 'amazon.sa/dp read 2026-10-06 by AmazonScraper: SAR 3,280, in stock' },
  { asin: 'B0FR3917PN', brand: 'LG', note: 'LG 75" QNED evo QNED9M MiniLED 4K 144Hz (75QNED9MA6A family)', evidence: 'amazon.sa/dp read 2026-10-06 by AmazonScraper: SAR 4,649 (list 12,199), limited stock' },
  { asin: 'B0F4WL1YKB', brand: 'ECOVACS', note: 'ECOVACS DEEBOT T50 PRO OMNI robot vacuum', evidence: 'amazon.sa/dp read 2026-10-06 by AmazonScraper: SAR 1,931 (list 4,799), in stock' },
];

const ASIN = /^[A-Z0-9]{10}$/;

/** Code seeds plus any ASINs in `AMAZON_SEED_ASINS` (comma-separated), de-duplicated by ASIN, order preserved. */
export function allAmazonSeeds(envValue: string | undefined = process.env.AMAZON_SEED_ASINS): AmazonSeed[] {
  const out = new Map<string, AmazonSeed>();
  for (const s of AMAZON_SEED_ASINS) out.set(s.asin.toUpperCase(), s);
  for (const raw of (envValue ?? '').split(',')) {
    const asin = raw.trim().toUpperCase();
    if (ASIN.test(asin) && !out.has(asin)) out.set(asin, { asin, note: 'from AMAZON_SEED_ASINS', evidence: 'env override' });
  }
  return [...out.values()];
}
