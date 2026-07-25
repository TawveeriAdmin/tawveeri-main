# Priority Stores — End-to-End Coverage Report

**Evidence:** `npm run tps:gate-audit` @ `2026-07-25T08:38:41Z`, production (read-only).
**Counting rule (Founder Directive Part 4):** a store counts as **integrated** only when its data flows the FULL chain — ingestion → identity → canonical → offer → projection → public comparison → `/go`. An adapter or scaffold alone does **not** count.

| # | Store | store_id | Observations | Freshness | End-to-end flow | Status |
|---|---|---|---|---|---|---|
| 1 | المنيع (Almanea) | 5 | 38,780 | 2.7h | ✅ ingest→canonical→projection→comparable→/go | **INTEGRATED** |
| 2 | أمازون (Amazon.sa) | 2 | 4,223 | 2.5h | ✅ (affiliate tag `tawveeri-21` on `/go`) | **INTEGRATED** |
| 3 | شاكر (Shaker) | 7 | 10,626 | 0.7h | ✅ WooCommerce feed default (ADR-089) | **INTEGRATED** |
| 4 | سامسونج (Samsung KSA) | 6 | 62 | 0.7h | 🟡 flows but very low yield (Puppeteer, single-brand) | **PARTIAL — low yield** |
| 5 | جرير (Jarir) | 1 | 65,572 | 0.8h | ✅ largest catalog contributor | **INTEGRATED** |
| 6 | إكسترا (eXtra) | 4 | 44,586 | 2.6h | ✅ | **INTEGRATED** |
| 7 | الشتاء والصيف (SWSG) | 8 | 276 | 59.4h | 🟡 flows but STALE (not on recurring ingest); search fixed (ADR-092) | **PARTIAL — stale** |
| 8 | الصندوق الأسود (BlackBox) | — | 0 | — | ❌ not integrated (no adapter; platform/data-access unverified) | **NOT STARTED** |
| 9 | نون (Noon KSA) | 3 | 562 | 61.7h | 🟡 flows but STALE — anti-bot blocked (deliberate, ADR-notes) | **PARTIAL — blocked** |
| 10 | نجم الأجهزة (Najm Alajhiza) | — | 0 | — | ❌ not integrated (no adapter; platform/data-access unverified) | **NOT STARTED** |

## Honest tally
- **5 fully INTEGRATED** and fresh: Almanea, Amazon, Shaker, Jarir, eXtra — these carry the bulk of the **295 verified cross-store comparisons** (254 fully `/go`-reachable).
- **3 PARTIAL:** Samsung (low yield), SWSG (stale — needs recurring ingest), Noon (anti-bot blocked; deliberately not chased).
- **2 NOT STARTED:** BlackBox, Najm Alajhiza — new merchants with unverified platforms/data-access. Onboarding path (per the Provider Framework): (1) verify platform + a credential-free structured source (WooCommerce Store API / Salla-Zid JSON-LD / Algolia key / sitemap) using `npm run tps:feed-probe <origin>`; (2) if SAR + real overlap, add a provider registry entry + config; (3) ingest → normalize → corroborate → refresh; (4) verify end-to-end to `/go`. This is a **founder/data-access boundary** (needs the real store domains + a legality/ToS check), not a code-only change — flagged, not fabricated.

## Highest-leverage store actions for comparison growth
1. **Almanea** exposes a **public Algolia search key** (2026 research) → the cleanest structured JSON of any KSA major; deepening Almanea ingestion is the top credential-free lever for *new* comparisons.
2. **Revive SWSG recurring ingest** (search already fixed) — small catalog but overlapping phone/laptop categories.
3. **BlackBox / Najm Alajhiza** — probe for a public feed first (`tps:feed-probe`); onboard only if SAR + real overlap (avoid the shaker-style ~0-comparison outcome).
