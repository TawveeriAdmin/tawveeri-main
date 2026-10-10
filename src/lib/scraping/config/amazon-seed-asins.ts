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
  // Exact-part-number harvest, 2026-10-10 (scripts/tps-analysis/amazon-mpn-candidates.ts): comparable models (>= 2 stores) with no Amazon offer whose part number appears as a whole
  // token in an amazon.sa listing title that also passed a detail-page read (price, not out of stock). 200 models checked, 21 candidates, 20 verified.
  { asin: "B0HFNNPV3N", brand: "Samsung", note: "samsung QA77S85HAEXSA (tv)", evidence: "amazon.sa/dp read 2026-10-10 by AmazonScraper: SAR 9999; exact part number in the title; the model had no Amazon offer (other stores 9999-9999 SAR)" },
  { asin: "B0HD8ZN4M9", brand: "Samsung", note: "samsung UA100M90HUXSA (tv)", evidence: "amazon.sa/dp read 2026-10-10 by AmazonScraper: SAR 8999; exact part number in the title; the model had no Amazon offer (other stores 9999-9999 SAR)" },
  { asin: "B09B7B56ZC", brand: "ASUS", note: "asus UX8406CA-QL078W (laptop)", evidence: "amazon.sa/dp read 2026-10-10 by AmazonScraper: SAR 8799; exact part number in the title; the model had no Amazon offer (other stores 8799-8999 SAR)" },
  { asin: "B0HFX9SBNX", brand: "ASUS", note: "asus UX8406CA-QL078W (laptop)", evidence: "amazon.sa/dp read 2026-10-10 by AmazonScraper: SAR 9158; exact part number in the title; the model had no Amazon offer (other stores 8799-8999 SAR)" },
  { asin: "B0GZKVZW9K", brand: "Samsung", note: "samsung MRA75R85HAUXSA (tv)", evidence: "amazon.sa/dp read 2026-10-10 by AmazonScraper: SAR 7499 (list 10499); exact part number in the title; the model had no Amazon offer (other stores 7999-7999 SAR)" },
  { asin: "B0D8Q1XJ87", brand: "Samsung", note: "samsung WD21B6400KE/YL (washing_machine)", evidence: "amazon.sa/dp read 2026-10-10 by AmazonScraper: SAR 8899; exact part number in the title; the model had no Amazon offer (other stores 3942-7609.55 SAR)" },
  { asin: "B0D1V7VTS4", brand: "Samsung", note: "samsung UA98DU9000UXSA (tv)", evidence: "amazon.sa/dp read 2026-10-10 by AmazonScraper: SAR 7016 (list 7999); exact part number in the title; the model had no Amazon offer (other stores 6999-6999 SAR)" },
  { asin: "B0GZKXNNTT", brand: "Samsung", note: "samsung QA75LS03HEUXSA (tv)", evidence: "amazon.sa/dp read 2026-10-10 by AmazonScraper: SAR 5997 (list 6299); exact part number in the title; the model had no Amazon offer (other stores 6299-6299 SAR)" },
  { asin: "B0BXLX5YCN", brand: "Samsung", note: "samsung DW60BG830FSLYL (dishwasher)", evidence: "amazon.sa/dp read 2026-10-10 by AmazonScraper: SAR 3099; exact part number in the title; the model had no Amazon offer (other stores 3599-6038.65 SAR)" },
  { asin: "B0D1V9YW8C", brand: "Samsung", note: "samsung QA75Q60DAUXSA (tv)", evidence: "amazon.sa/dp read 2026-10-10 by AmazonScraper: SAR 6099; exact part number in the title; the model had no Amazon offer (other stores 4498.8-6013.01 SAR)" },
  { asin: "B0HD9CYJLD", brand: "Samsung", note: "samsung UA85M80HAUXSA (tv)", evidence: "amazon.sa/dp read 2026-10-10 by AmazonScraper: SAR 5999; exact part number in the title; the model had no Amazon offer (other stores 5999-5999 SAR)" },
  { asin: "B09TBGPGR4", brand: "Samsung", note: "samsung DV16T8740BV/YL (washing_machine)", evidence: "amazon.sa/dp read 2026-10-10 by AmazonScraper: SAR 4799 (list 9199); exact part number in the title; the model had no Amazon offer (other stores 5221-5999 SAR)" },
  { asin: "B0GZKRS8JW", brand: "Samsung", note: "samsung QA65LS03HEUXSA (tv)", evidence: "amazon.sa/dp read 2026-10-10 by AmazonScraper: SAR 4398 (list 4799); exact part number in the title; the model had no Amazon offer (other stores 4799-4799 SAR)" },
  { asin: "B0GWHXRFLW", brand: "Samsung", note: "samsung UA85U8000HUXSA (tv)", evidence: "amazon.sa/dp read 2026-10-10 by AmazonScraper: SAR 3999 (list 4499); exact part number in the title; the model had no Amazon offer (other stores 2999-4499 SAR)" },
  { asin: "B0GZLBNWK9", brand: "Samsung", note: "samsung QA65QN80HAUXSA (tv)", evidence: "amazon.sa/dp read 2026-10-10 by AmazonScraper: SAR 4299; exact part number in the title; the model had no Amazon offer (other stores 4299-4299 SAR)" },
  { asin: "B0F7LBK9T1", brand: "KRUPS", note: "krups EA872BM0 (coffee_maker)", evidence: "amazon.sa/dp read 2026-10-10 by AmazonScraper: SAR 5999; exact part number in the title; the model had no Amazon offer (other stores 4199-4199 SAR)" },
  { asin: "B0HFSJ51QW", brand: "HP", note: "hp C22JMEA (laptop)", evidence: "amazon.sa/dp read 2026-10-10 by AmazonScraper: SAR 4699; exact part number in the title; the model had no Amazon offer (other stores 4199-4199 SAR)" },
  { asin: "B0HD9BM4H6", brand: "Samsung", note: "samsung QA65QN70HAUXSA (tv)", evidence: "amazon.sa/dp read 2026-10-10 by AmazonScraper: SAR 3599; exact part number in the title; the model had no Amazon offer (other stores 3399-3599.01 SAR)" },
  { asin: "B0BXLTTZDF", brand: "Samsung", note: "samsung WW11BBA046AEYL (washing_machine)", evidence: "amazon.sa/dp read 2026-10-10 by AmazonScraper: SAR 2599 (list 5299); exact part number in the title; the model had no Amazon offer (other stores 2699-3499 SAR)" },
  { asin: "B0HG7RG76M", brand: "Samsung", note: "samsung RR40H39G1TZA (refrigerator)", evidence: "amazon.sa/dp read 2026-10-10 by AmazonScraper: SAR 3499; exact part number in the title; the model had no Amazon offer (other stores 3499-3499 SAR)" },
  // ADR-408 recovery, 2026-10-10: the variant each quarantined offer actually described. Each ASIN selects itself on amazon.sa/dp, in stock, with a buy-box price, and the title matches the quarantined row's identity.
  { asin: "B0GR6P1VP1", brand: "Apple", note: "MacBook Neo 13-inch A18 Pro 8GB/256GB (was stored under B0GR6H82M1)", evidence: "amazon.sa/dp read 2026-10-10 by the ASIN-guard check: selects itself, SAR 3,055 (stored 3,060)" },
  { asin: "B0DLHG1PK8", brand: "Apple", note: "MacBook Pro 16-inch M4 Max 16-core CPU 40-core GPU (was stored under B0DLJF6B54)", evidence: "amazon.sa/dp read 2026-10-10 by the ASIN-guard check: selects itself, SAR 17,485.67" },
  { asin: "B0FWDBBGC4", brand: "Apple", note: "MacBook Pro 14.2-inch M5 24GB/1TB (was stored under B0FWD6T5TW)", evidence: "amazon.sa/dp read 2026-10-10 by the ASIN-guard check: selects itself, SAR 10,499 (stored 10,499)" },
  { asin: "B0D47TVCFK", brand: "AOC", note: "AOC 24G4E 23.8-inch FHD 180Hz IPS monitor (was stored under B0D3LVH7PM)", evidence: "amazon.sa/dp read 2026-10-10 by the ASIN-guard check: selects itself, SAR 419 (stored 419)" },
  { asin: "B0CWM7KF1L", brand: "Haier", note: "Haier side-by-side refrigerator 11.1 cu.ft + 4.2 cu.ft twin inverter (was stored under B0GS2QXW4Z)", evidence: "amazon.sa/dp read 2026-10-10 by the ASIN-guard check: selects itself, SAR 3,499 (stored 3,499)" },
  { asin: "B0FWD6SM91", brand: "Apple", note: "iPad Pro 11-inch (M5) 1TB Wi-Fi Nano-Texture (was stored under B0FWD6C866)", evidence: "amazon.sa/dp read 2026-10-10 by the ASIN-guard check: selects itself, SAR 8,749 (stored 8,749)" },
  { asin: "B0F8W1L48Q", brand: "Samsung", note: "Samsung 65-inch Neo QLED QN1EF (QA65QN1EFAUXSA) (was stored under B0F8VXRFYT)", evidence: "amazon.sa/dp read 2026-10-10 by the ASIN-guard check: selects itself, SAR 2,749 (stored 2,749)" },
  { asin: "B0F8VY1F91", brand: "Samsung", note: "Samsung 75-inch Crystal UHD U8000F (UA75U8000FUXSA) (was stored under B0F9KSYSP2)", evidence: "amazon.sa/dp read 2026-10-10 by the ASIN-guard check: selects itself, SAR 2,599 (stored 2,599)" },
  { asin: "B0GX6NBQ58", brand: "TCL", note: "TCL 55T61D 55-inch 4K QLED (was stored under B0GMX1Q2D1)", evidence: "amazon.sa/dp read 2026-10-10 by the ASIN-guard check: selects itself, SAR 1,699 (stored 1,719)" },
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
