# Saudi Retailer Acquisition — Evidence-Backed Classification (35 candidates)

**Date:** 2026-07-26 · **Method:** live `tps:acquire` (platform auto-detect + catalog reconstruction + SAR-gate + overlap score) + direct HTTP verification. Evidence over submitted labels. Full machine output: `docs/acquisition-batch1-intel.csv`.

**Connector-strategy legend:** `config-only` = onboards via an existing reusable adapter (Salla/Zid JSON-LD · Woo Store-API · Shopify products.json · Algolia). `custom-scraper` = needs a bespoke `BaseScraper` (enterprise/JS platform). `enrichment` = manufacturer specs only (no price/stock). `exclude` = duplicate/unverified.
**Cost** = engineering + ongoing maintenance. **Gain** = expected comparable-product contribution given our current catalog.

## A. Already integrated (8)
Noon, Amazon SA, Jarir, eXtra, Almanea, **Shaker (shakersa.com)**, SWSG, Samsung KSA — in production.

## B. Onboarded this batch (1)
| Retailer | Platform | Connector | Category/TPS fit | Expected gain | Cost | Status |
|---|---|---|---|---|---|---|
| **Sony World (sonyworld.sa)** | Shopify | **config-only** (Shopify adapter, ADR-104) | tv · audio · camera (all supported) | **Low–Med** — few audio/camera comparisons vs our 10 Sony canonicals + Sony-TV category depth (single-store until a 2nd Sony source) | **Low** (reused connector) | ✅ **Ingested (236 obs, QA-passed); realization scheduler-owned** |

## C. Config-only accessible but deferred (2)
| Retailer | Platform | Why deferred |
|---|---|---|
| m2telecom.net | Salla/Zid | Tiny catalog (16 products), telecom accessories — negligible gain |
| blackbox.com.sa | unknown | No detectable storefront API; our prior blackboxksa.com reg was UA-gated |

## D. Custom-scraper required — HIGH value (worth a deliberate investment) (3)
| Retailer | Platform | Category fit | Expected gain | Cost | Recommendation |
|---|---|---|---|---|---|
| **SACO (saco.sa)** | enterprise (custom) | tv · appliance · tools · kitchen | **HIGH** — large overlapping electronics/appliance catalog | **HIGH** (bespoke scraper + anti-bot + maintenance) | Top custom-scraper candidate |
| **Xcite (xcite.com.sa)** | enterprise (custom) | tv · mobile · laptop · appliance | **HIGH** — pure electronics retailer, high overlap | **HIGH** | 2nd custom-scraper candidate |
| redsea.com | custom Next.js | gaming · electronics | Med | HIGH (dynamic JS catalog) | Lower priority |

## E. Custom-scraper — LOW ROI, defer (hypermarkets: 8)
Panda, Lulu, Carrefour, BinDawood, Danube, Othaim, Farm, Al-Sadhan — all enterprise platforms (`unknown`). **Electronics/appliances are a small fraction of a grocery catalog**; expected comparable gain does not justify a bespoke scraper each. Defer indefinitely unless a specific high-overlap electronics section is confirmed.

## F. Telecom operators — defer pending a telecom-offer model (7)
stc, Mobily, Zain, Axiom Telecom, Assr Al Jawal, m2telecom, Al Haddad. Enterprise platforms **and** device pricing is contract/installment-bound. Per the three-layer model these need a **Commercial-Variant extension for telecom terms** (cash vs installment · duration · plan · upfront · trade-in) before any offer is safe to compare against cash retail. A shared, reusable capability — not per-store patches — and a real project. Defer until that model exists.

## G. Manufacturer / distributor / corporate — enrichment or feed route (6)
| Entity | Real role | Route |
|---|---|---|
| Zamil (zamilac.com) | Manufacturer (AC) | **Spec enrichment only** — never prices/stock |
| Shaker Group (shaker.com.sa) | Corporate site — **DUPLICATE of integrated shakersa.com** | **EXCLUDE** (would fabricate false 2-store comparisons on identical stock) |
| Zagzoog (zagzoog.com) | Appliance distributor — Woo Store-API **disabled** (`rest_no_route`) | Defer; pursue official feed/partnership |
| Alessa, Al Bassam, Al Khunaizan, Eddy, Abdulwahed | Distributor/corporate, `unknown` platform | Defer; enrichment/feed if a partnership opens |

## H. Excluded (2)
- **shaker.com.sa** — corporate duplicate of shakersa.com (integrity risk).
- **Funtech** — identity/domain unverified; cannot act without a confirmed live domain.

---

# Long-Tail Strategy — Exact External Dataset Specification

The config-only path (cheap, reusable) reaches the Salla/Zid/Woo/Shopify **long-tail**, not the enterprise majors. To feed it, the required dataset is:

| Parameter | Requirement |
|---|---|
| **Required platforms** | **Salla + Zid** (dominant in KSA, our strongest connectors) **+ WooCommerce + Shopify**. Salla/Zid are essential — without them the yield is a small minority. |
| **Required fields** | `domain` (**essential**), `platform`; nice-to-have: `product_count`, `category`, `country`. Nothing else (no contact/marketing fields). |
| **Minimum domains** | **~150–300**, sorted by product count desc. The engine narrows to the HIGH/MEDIUM subset. |
| **Filters** | country = Saudi Arabia · category = Electronics (or none, engine filters) · platform ∈ {salla, zid, woo, shopify} · product_count ≥ 50 · active |
| **Is StoreLeads *Pro* required?** | **No.** Premium suffices — the engine harvests domains from any UI copy or saved results HTML (no CSV/API needed). Pro only saves manual-copy time. |
| **Are Shopify + WooCommerce sufficient?** | **No.** They are a minority of Saudi stores. Salla + Zid carry the majority of the addressable long-tail. |
| **Must Salla/Zid be sourced elsewhere?** | **Conditional — and this is the crux.** If StoreLeads' Technologies filter includes **Salla and Zid**, StoreLeads Premium alone is sufficient. **If it does not** (StoreLeads is historically Shopify-centric), then Salla/Zid must be sourced elsewhere — and free programmatic Salla/Zid discovery is not viable (ADR-103: crt.sh/certspotter/Common Crawl/DuckDuckGo/platform-directories all blocked or thin). In that case a Salla/Zid-specific data source becomes a genuine Founder Approval Boundary. |

**Decision rule for the Founder to check in StoreLeads (one action):** open the Technologies filter and confirm whether **Salla** and **Zid** are listed.
- **If yes** → Premium is enough; export ~150–300 KSA Salla/Zid/Woo/Shopify electronics domains (`domain`,`platform`) → I onboard the HIGH/MEDIUM subset autonomously.
- **If no** → Shopify/Woo-only from StoreLeads is low-yield; we need a Salla/Zid source (paid, or a directory) — I'll specify options at that point.
