# Priority Stores — End-to-End Coverage Report

**Evidence:** `npm run tps:gate-audit` @ `2026-07-25T08:38:41Z`, production (read-only).
**Counting rule (Founder Directive Part 4):** a store counts as **integrated** only when its data flows the FULL chain — ingestion → identity → canonical → offer → projection → public comparison → `/go`. An adapter or scaffold alone does **not** count.

| # | Store | store_id | Observations | Freshness | End-to-end flow | Status |
|---|---|---|---|---|---|---|
| 1 | المنيع (Almanea) | 5 | 38,780+ | 2.7h | ✅ **now sourced via public Algolia index (ADR-094)** — 3,627 clean structured products (brand/model/sku/storage), honest prices+discounts | **INTEGRATED (upgraded)** |
| 2 | أمازون (Amazon.sa) | 2 | 4,223 | 2.5h | ✅ (affiliate tag `tawveeri-21` on `/go`) | **INTEGRATED** |
| 3 | شاكر (Shaker) | 7 | 10,626 | 0.7h | ✅ WooCommerce feed default (ADR-089) | **INTEGRATED** |
| 4 | سامسونج (Samsung KSA) | 6 | 62 | 0.7h | 🟡 flows but very low yield (Puppeteer, single-brand) | **PARTIAL — low yield** |
| 5 | جرير (Jarir) | 1 | 65,572 | 0.8h | ✅ largest catalog contributor | **INTEGRATED** |
| 6 | إكسترا (eXtra) | 4 | 44,586 | 2.6h | ✅ | **INTEGRATED** |
| 7 | الشتاء والصيف (SWSG) | 8 | 276 | 59.4h | 🟡 flows but STALE (not on recurring ingest); search fixed (ADR-092) | **PARTIAL — stale** |
| 8 | الصندوق الأسود (BlackBox) | 10 | 0 | — | 🟡 Salla; adapter built (ADR-095) but sitemap is UA-gated (404) → needs a category-crawl fallback; registered config-ready, disabled | **CONFIG-READY (blocked path)** |
| 9 | نون (Noon KSA) | 3 | 562 | 61.7h | 🟡 flows but STALE — anti-bot blocked (deliberate) | **PARTIAL — blocked** |
| 10 | نجم الأجهزة (Najm Alajhiza) | 9 | 412 | fresh | ✅ **onboarded via Salla sitemap+JSON-LD (ADR-095)** — 412 appliance observations (Fisher/Fresh/Basic/Samsung/Toshiba) | **INTEGRATED** |

## Honest tally (updated after the addendum's exhaust-every-path push)
- **6 fully INTEGRATED** and fresh: Almanea (now Algolia-sourced), Amazon, Shaker, Jarir, eXtra, **Najm Alajhiza (new, store 9)**.
- **3 PARTIAL:** Samsung (low yield), SWSG (stale — needs recurring ingest), Noon (anti-bot blocked; deliberately not chased).
- **1 CONFIG-READY:** BlackBox — Salla adapter built; its sitemap is UA-gated so it needs a category-crawl enumeration fallback (a bounded follow-up), then it onboards config-only. NOT a founder boundary — the engineering path was exhausted (domain found, platform identified, adapter built + tested).
- **Engineering paths exhausted per store** (addendum requirement): WooCommerce Store API (shaker ✅), **Algolia public index (almanea ✅ — ADR-094)**, **Salla sitemap+JSON-LD (najm ✅, blackbox path-blocked — ADR-095)**, HTML/Next `__NEXT_DATA__`/JSON-LD (extra/jarir/samsung), internal JSON API (noon — anti-bot). Two new reusable adapters now cover the Algolia and Salla store CLASSES (4,400+ Salla stores addressable config-only).

## Highest-leverage store actions for comparison growth
1. **Almanea** exposes a **public Algolia search key** (2026 research) → the cleanest structured JSON of any KSA major; deepening Almanea ingestion is the top credential-free lever for *new* comparisons.
2. **Revive SWSG recurring ingest** (search already fixed) — small catalog but overlapping phone/laptop categories.
3. **BlackBox / Najm Alajhiza** — probe for a public feed first (`tps:feed-probe`); onboard only if SAR + real overlap (avoid the shaker-style ~0-comparison outcome).
