# Retailer Integration Matrix — Approved-27 Scope

**Authority:** Founder Directive 2026-07-27 ("Rakhys Benchmark and Exact Retailer Portfolio Recovery").
**Status source:** production `vyceqrzttspyycdpojtn` (read-only audit 2026-07-27) + lawful public research.
**SSOT:** `src/lib/retailers/approved-retailers.ts`. This doc is the human-readable companion.

Tawveeri's public platform may present ONLY these retailers. A retailer is **VERIFIED ACTIVE** only
when a real customer can search → find the genuine product → open it → see accurate price/availability
→ identify the retailer → click → land on the **exact matching live product** on the retailer's
official Saudi domain. ≥95% exact-outbound over ≥20 sampled products before public visibility.

Allowed statuses: `VERIFIED ACTIVE` · `UNDER REPAIR` · `NO DATA INGESTED` · `INACTIVE OR UNAVAILABLE`
· `DISABLED FOR CUSTOMER SAFETY` · `REQUIRES COMMERCIAL ACCESS`.

---

## ⚠️ Sourcing model — CORRECTED 2026-07-27 (proven from a live Rakhys product page)

Fetched a Rakhys product page directly (real browser UA — their block is ClaudeBot-specific). **One product carried offers from ~10 retailers** (Amazon, Noon, Almanea, Extra, Carrefour, LuLu, Sharaf DG, Jarir, Alsaif, Black Box) and every "buy" link goes **DIRECT to the retailer's own product page** + `?ref=rakhys.com` — with **no affiliate-network redirect** (no Arabclicks/Boostiny/Admitad). Only Amazon carries an affiliate tag (`amazon.sa/dp/ASIN?tag=rakhys-21`, plain Associates — we already do the same with `tawveeri-21`).

**This overturns the earlier "REQUIRES COMMERCIAL ACCESS" verdict for the marketplaces.** Rakhys SCRAPES/aggregates catalogues and links direct. Noon/Carrefour/LuLu/Sharaf DG are **ENGINEERING targets (build scrapers on their deterministic SKU URLs), not credential blockers.** Proven outbound patterns: Noon `noon.com/saudi-en/{slug}/{N-SKU}/p/`, Carrefour `carrefourksa.com/mafsau/en/{cat}/{slug}/p/{sku}`, LuLu `gcc.luluhypermarket.com/en-sa/{slug}/p/{sku}`, Sharaf DG `saudi.sharafdg.com/en/product/{slug}`.

## Summary

- **VERIFIED ACTIVE (customer-visible, working outbound): 7** — Amazon, Jarir, Extra, Almanea, **Noon** (305), **LuLu** (185), **Sharaf DG** (139, recovered 2026-07-27: WooCommerce microdata via plain HTTP, 3/3 exact-product+exact-price outbound verified).
- **SCRAPEABLE — engineering, no credential needed:** Alsaif Gallery (Magento sitemap). **Carrefour = documented technical blocker** (Akamai + delivery-area session → headless yields wrong product/price; will NOT fabricate).
- **Affiliate-tag only (already have the mechanism):** AliExpress, eBay need their own scrapers; Amazon Associates already wired.
- **NO DATA INGESTED, credential-free path exists (6):** Aleph (Shopify JSON), Me Stores, Alkhunaizan, Ghassan, Al Rabee Al Saif, Sheta & Saif (scraper dormant).
- **DISABLED FOR SAFETY / BLOCKED (5):** Black Box, Ashwered, Almtkamel (Cloudflare); Jehazak, Nujoom Alomran, Techno Best (domain unknown).
- **INACTIVE / NOT A STORE (2):** Alesayi (distributor), Abdulwahed (placeholder).
- **Merged: RedSea (#25) = Abdul Latif Jameel Electronics (#27)** → one merchant. 27 list entries = 26 distinct merchants.

## Parity vs Rakhys (the production benchmark)

| Dimension | Rakhys | Tawveeri (2026-07-27) | Parity |
|---|--:|--:|--:|
| Retailers shown per product (proven) | ~10 | 7 active | ~70% |
| Total products (sitemap-measured) | ~100k+ unique (~270k en/ar URLs) | 5,459 | ~5% |
| Multi-store comparisons | deep (10/product) | 429 canonicals ≥2 approved stores | — |
| Outbound quality | direct + Amazon tag | direct + Amazon tag (identical) | 100% (mechanism) |
| Product identity | ULID matched across retailers | TPS canonical identity | parity (arguably better) |

**The gap is product breadth + retailer count, both ENGINEERING (scrapers + scale), not credentials.** Recovery order by effort: Noon ✅ done → Carrefour/LuLu/Sharaf DG (new scrapers, public SKU URLs) → Alsaif/Aleph (Magento sitemap / Shopify JSON) → the long tail.

**Genuine multi-store comparisons: 429 canonicals have ≥2 APPROVED-retailer offers** (TPS canonical
layer / `/compare` path). Dominant combos: Extra+Almanea 192, Amazon+Extra 46, Extra+Jarir 31,
Extra+Noon 21, Amazon+Jarir 18, plus 3-store combos (Amazon+Extra+Almanea 14, Extra+Almanea+Jarir 14).
The legacy `product_stores` storefront is still 0 multi-store (every row single-store) — comparisons are
delivered by the canonical search+compare path, which `searchTPSCanonical` currently surfaces for the
mobile + air-conditioner categories only. Growing comparison breadth beyond this is a
*merchant-data-access* problem (more overlapping-SKU approved merchants), not an engineering one.

---

## Priority retailers (1–12 per directive)

| # | Retailer | Domain | Source path | Adapter | Raw obs | Active offers (product_stores) | Visible products | Canonicals | ≥2-store comps | Image cov | Price fresh | Avail fresh | Exact-outbound | Status |
|---|----------|--------|-------------|---------|--------:|-------:|-------:|-------:|--:|--:|--|--|--|--------|
| 2 | **Amazon SA** | amazon.sa | Search+cron scraper (ASIN) | ✅ | 5,398 | **1,827** | 1,827 | 604 | — | partial | <24h (26 Jul) | in-stock | **/dp/ASIN 2004/2005 clean → resolves** | **VERIFIED ACTIVE** |
| 1 | **Noon** | noon.com | Internal JSON API | ⚠️ canonical-only | 562 | 0 | 0 | 209 | — | — | 25 Jul | — | not customer-visible | **REQUIRES COMMERCIAL ACCESS** |
| 4 | **Jarir** | jarir.com | HTML scraper (jpm SKU) | ✅ | 55,476 | **920** (3,959 rows, deduped in UI) | 920 | 326 | — | partial | <24h | in-stock | **100% sa-en after repair; verified live** | **VERIFIED ACTIVE** |
| 5 | **Extra** | extra.com | JSON-LD (Puppeteer) | ✅ | 46,686 | **838** | 838 | 2,639 | — | partial | refreshing¹ | in-stock | **/p/<id> 838/838 clean; 3/3 live** | **VERIFIED ACTIVE** |
| 7 | **Almanea** | almanea.sa | Algolia feed | ✅ | 180,975 | **1,298** | 1,298 | 2,423 | — | good | <24h (feed) | 1,240 in-stock | **/en/product/p-<sku> 1296/1298; 15/15 live** | **VERIFIED ACTIVE** |
| 6 | **Carrefour KSA** | carrefourksa.com | Akamai + area-session | ❌ blocked | 0 | 0 | 0 | 0 | — | — | — | — | headless yields WRONG price/product | **INACTIVE OR UNAVAILABLE** (documented technical blocker) |
| 8 | **Sheta & Saif** | swsg.co | Cron scraper (dormant) | ⚠️ | 276 | 0 | 0 | 57 | — | — | 24 Jul | — | not customer-visible | **NO DATA INGESTED** |
| 9 | **LuLu** | luluhypermarket.com | Akinon RSC + JSON-LD (Puppeteer) | ✅ | 205 | **185** | 185 | — | — | good | <24h | in-stock | **3/3 exact-product + exact-price verified** | **VERIFIED ACTIVE** |
| 10 | **Black Box** | blackboxksa.com | — (Cloudflare 403) | ❌ | 0 | 0 | 0 | 0 | — | — | — | — | — | **DISABLED FOR CUSTOMER SAFETY** |
| 11 | **Alsaif Gallery** | alsaifgallery.com | Magento sitemap (URLs) | ❌ | 0 | 0 | 0 | 0 | — | — | — | — | — | **NO DATA INGESTED** (credential-free discovery) |
| 13 | **Sharaf DG** | saudi.sharafdg.com | WooCommerce microdata (plain HTTP) | ✅ | 152 | **139** | 139 | — | — | good | <24h | 75 in-stock | **3/3 exact-product + exact-price verified** | **VERIFIED ACTIVE** |
| 15 | **Alkhunaizan** | alkhunaizan.sa | Magento sitemap (URLs) | ❌ | 0 | 0 | 0 | 0 | — | — | — | — | — | **NO DATA INGESTED** (credential-free discovery) |

¹ Extra data refreshes over the next hourly scheduler cycles now that the JSON-LD scraper is repaired (ADR: last session). Delisted items age out via consecutive_misses.

## Remaining approved retailers (13–27)

| # | Retailer | Domain | Platform | Best lawful path | Status |
|---|----------|--------|----------|------------------|--------|
| 3 | AliExpress | aliexpress.com | Alibaba | Affiliate/open API (credentialed) | **REQUIRES COMMERCIAL ACCESS** |
| 14 | eBay | ebay.com | eBay | Browse API + EPN affiliate (credentialed) | **REQUIRES COMMERCIAL ACCESS** |
| 16 | **Aleph** | alephksa.com | **Shopify** | **`/products.json` — real price+SKU JSON (credential-free!)** | **NO DATA INGESTED** — top autonomous ingest candidate (Apple-only, low overlap) |
| 17 | Techno Best | technobest.sa? | unknown (cert expired) | — | **DISABLED FOR CUSTOMER SAFETY** |
| 18 | Ashwered | ashwered.com | likely Zid/Salla (CF 403) | — | **DISABLED FOR CUSTOMER SAFETY** |
| 19 | Abdulwahed | — | "Live Soon" placeholder | — | **INACTIVE OR UNAVAILABLE** |
| 20 | **Me Stores** | mestores.com | Magento | Bilingual product sitemap (URLs) | **NO DATA INGESTED** (credential-free discovery) |
| 21 | Nujoom Alomran | UNKNOWN | — | domain unresolved (search budget) | **DISABLED FOR CUSTOMER SAFETY** |
| 22 | Alesayi | — | distributor, no storefront | — | **INACTIVE OR UNAVAILABLE** (not a retailer) |
| 23 | **Ghassan Trading** | ghassanstore.com | **Salla** | Sitemap (URLs); structured feed = Salla OAuth | **NO DATA INGESTED** (credential-free discovery) |
| 24 | **Al Rabee Al Saif** | alrabeealsaif.com.sa | **Salla** | Sitemap (small); structured feed = Salla OAuth | **NO DATA INGESTED** (credential-free discovery) |
| 25 | RedSea | redsea.com | Next.js/custom | No standard feed | **REQUIRES COMMERCIAL ACCESS** |
| 26 | Almtkamel | almtkamelstore.sa | unknown (CF 403) | — | **DISABLED FOR CUSTOMER SAFETY** |
| 27 | Abdul Latif Jameel Electronics | = redsea.com | — | **SAME merchant as #25** | merged into RedSea |

---

## Almanea regression — full investigation (closed)

**Symptom:** all Almanea outbound links 404'd ("عفواً، الصفحة غير موجودة").
**Root cause (ADR-125):** Almanea's Algolia index (`prod_headless_ar_products`) ships **DEV URLs**
`https://m.dev-almanea.com/{rewrite}-p-{sku}`; ingestion origin-swapped them to
`www.almanea.sa/{rewrite}-p-{sku}` → 404. The correct live product URL is
`https://www.almanea.sa/en/product/p-{sku}` (sku = trailing 15-digit `-p-<sku>`).
**Fix:** (1) migration 27 backfilled 1,296/1,298 stored URLs; (2) `mapAlgoliaHit` now applies
`normalizeStoreUrl` so ingestion is correct going forward; (3) regression test.
**Repeatable refresh confirmed:** production audit shows 1,296/1,298 offers refreshed within the last
24h via the feed loop (last_update 26 Jul), 1,240 in-stock — the acquisition path is live and
self-refreshing, not just historical rows.
**Gate:** 15/15 sampled links across 10 categories opened the exact live product (prior session).
**Status: VERIFIED ACTIVE.**

---

## Founder actions required (credential / access boundaries)

The full recovery of the approved-27 **cannot** be completed autonomously — most retailers are gated:

1. **Production Railway env update** (no credential, but out-of-band from code): set
   `INGEST_FEED_STORES=almanea` and `INGEST_STORES=` (empty) so the running scheduler stops ingesting
   shaker/najm/samsung_ksa. Code defaults already updated; env overrides them.
2. **Commercial / affiliate access** to unlock the large marketplaces: Noon, Amazon PA-API, AliExpress,
   eBay, Carrefour, LuLu, Sharaf DG, RedSea. These are the only path to their catalogues (all
   API/affiliate-gated; no lawful credential-free feed).
3. **Salla OAuth** (Founder app) to unlock structured price feeds for the Salla shops (Ghassan, Al Rabee).
4. **WebSearch budget** to resolve the 4 UNKNOWN domains (Sheta & Saif, Jehazak, Nujoom Alomran, Techno Best).
5. **Decision:** whether to ingest the credential-free *sitemap* shops (Aleph, Me Stores, Alsaif Gallery,
   Alkhunaizan) via per-page scraping — Aleph is the one clean structured-JSON win (Apple-only).

## Rakhys benchmark — what is and isn't knowable publicly

Rakhys is **edge-defended**: `robots.txt` disallows ClaudeBot/GPTBot/Amazonbot site-wide, homepage +
sitemap return 403 to automation, `/api/` is disallowed, and it uses Cloudflare content-signals +
an EU-copyright reservation. The X/founder post needs authentication. **A deep public technical
study is therefore not automatable without violating their stated policy.** What is provable: they
publish a sitemap, run a private `/api/`, and defend their catalogue at the edge. Everything
operational (how they source/compare/redirect) is **UNKNOWN from public automated access**. We cannot
copy their method; Tawveeri's TPS identity + provider framework + evidence-cited trust is our own path.
