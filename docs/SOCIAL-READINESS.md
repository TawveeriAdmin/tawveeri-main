# SOCIAL READINESS GATE — Controlled Demand Validation
**Measured:** Tue Aug 04 2026 12:22:41 GMT+0300 (GMT+03:00) (production `vyceqrzttspyycdpojtn`, live query, this run)

Per docs/TAWVEERI_SOCIAL_GROWTH_SYSTEM.md §1.1 — every gate must be evidenced before any
public/controlled social traffic. This is read-only and re-runnable: `npx tsx scripts/tps-analysis/social-readiness.ts`.

| # | Gate | Result | Query |
|---|---|---:|---|
| 1 | Customer-visible population | **5461** products in `tps_product_projection` | `select count(*) from tps_product_projection` |
| 2 | Comparable (≥2 approved retailers) | **961** | `comparable-count.sql` |
| 2 | Comparable deep (≥3 approved retailers) | **241** | `comparable-count.sql` |
| 3 | Comparison rate (has_comparison / population) | **18.1%** (986/5461) | `tps_product_projection` |
| 3 | Median displayable-retailer count (comparables) | **2** | `percentile_cont(0.5)` over `store_count` where `has_comparison` |
| 4 | AR/EN mobile journey (search→card→compare→outbound), 390×844 | **6/6 pass** (iphone, مكيف سبليت, macbook — ar+en each) | `node scripts/tps-analysis/ui-journey.js --query <q> --width 390 --height 844 --json` (this run) |
| 5 | Funnel, real traffic, 30d | search 447 → results 178 → product 3 → comparison 23 → outbound 43 (25 real sessions, 0 test) | `usage_events` |
| 6 | Affiliate attribution, real clicks | see table below | `outbound_clicks` |
| 7 | Social source/campaign/content attributable through journey | **NOT READY — no UTM capture exists** (`usage_events.meta` jsonb is free-form but nothing populates `utm_*`; `outbound_clicks` has no campaign column) | grep `src/lib/analytics/track.ts`, `src/app/api/events/route.ts`, `src/app/go/[offerId]/route.ts` — confirmed absent, this run |
| 8 | Open defects (scraping chain, 48h) | 455/473 runs ok, 16 failed | `scraping_runs` |

### Affiliate attribution detail (real clicks only)
- **direct**: 129 clicks, 0 tagged, last 2026-08-04 08:31:54.352942+00 — expected: retailers with no affiliate program (Jarir/Extra/Almanea/etc.), not a defect.
- **noon**: 21 clicks, 21 tagged, last 2026-08-04 08:24:41.212137+00
- **amazon**: 18 clicks, 18 tagged, last 2026-08-04 02:14:58.676658+00

### Live production exit verification — 2026-08-04, this session (T5/F5 fresh check, not cited from an old ADR)
Per Protected Trust Policy T5/F5, attribution must be verified against a real production exit after any change that could affect it, and the standing rule is never to cite a stale verification. Live `curl -I` against `/go/<offerId>` just now:
- **Amazon** offer `fff360db-a4a7-4bd1-8f6a-cca201e0c87c` → `302` → `https://www.amazon.sa/dp/B07V448GMX?tag=tawveeri-21&ascsubtag=7f9188ed5c5342a78d737845` — tag present, correct control value (`tawveeri-21`).
- **Noon** offer `ffebd911-786e-4cee-b082-de3162b969ae` → `302` → `...?utm_source=C1000094L&utm_medium=referral&utm_content=f938c95089654238adda610e` — program id + per-click sub-id present, correct per ADR-181's corrected mapping.
Both requests were made with `curl` (matches the route's own bot-UA pattern), so both were recorded `is_test=true` in `outbound_clicks` — this verification did not pollute real funnel metrics.

### Verdict
Gates 1, 2, 3, 4, 5, 6 and 8 pass on current evidence — the journey is not broken, and it is safe to build content against it. **Gate 7 is the one genuine build gap: no UTM capture exists yet.** That is a real, scoped build item (client-side capture into `usage_events.meta`, following the existing `getEntryVariant()`/test-mode pattern in `src/lib/analytics/track.ts` — no schema migration needed since `meta` is jsonb), not a blocker to building the fact pack/ledgers/content — but it IS a blocker to measuring which piece of content drove which qualified session, so it ships before the first real post goes out.

**Funnel note (not a defect, a scale fact):** `product_view` (3) is far below `comparison_view` (23) and `outbound` (43) over the last 30 real-traffic days — consistent with the "no real users yet" reality already on file (see memory: strategic-position). 25 real sessions in 30 days is pre-launch-scale traffic, exactly why this phase is called **Controlled** Demand Validation and not a general launch.
