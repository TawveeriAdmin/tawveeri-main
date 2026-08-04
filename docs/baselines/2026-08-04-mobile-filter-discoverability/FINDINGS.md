# Mobile filter/sort discoverability — before evidence & measurement truth (ADR-206)

**Captured:** 2026-08-04 ~08:05Z · production `https://tawveeri.com/ar/search?q=مكيف`
· mobile 390×844 (iPhone UA, ar-SA) and desktop 1440×900 · zero-filter and
`&priceMax=3000&stores=jarir` states. Artifacts: `before-*.json` (DOM state),
`before-*-{top,scrolled}.png` (screenshots), `research/probe-results.json` + screenshots.

## Confirmed before-state (production DOM, not props)

| Check | Mobile 390×844 | Desktop 1440×900 |
|---|---|---|
| Filter entry visible text | **"" — icon only, 48×36px** | rail visible, label shown |
| Accessible name | `aria-label="المرشحات"` (≠ sheet title «الفلاتر») | — |
| Sort visible outside panel | **none** | «الأكثر صلة / الأقل سعرًا / الأعلى سعرًا» |
| Active count (2 filters via URL) | badge «2» renders | «المرشحات2» + chips |
| Removable applied chips | 2 render | 2 render |
| Entry in viewport after ~60% scroll | **false** | rail sticky |

Founder's observation confirmed with precision: the defect is the unlabelled, scroll-away
doorway (and hidden sort); the applied-state machinery (badge + chips) already existed.

## Measurement truth (production `usage_events`, is_test=false, 2026-07-25 → 2026-08-04)

- **Filter/sort behavioural baseline: `not previously measurable`.** 0 rows match any
  filter/sort event type or meta key; the event whitelist has no such types.
- Tawveeri's own traffic: **574/867 real events (66%) mobile · 9/16 real sessions mobile ·
  42/42 real `go_click` exits mobile.** Denominator is 16 sessions — record as
  "majority-mobile", not a stable share. No external "Saudi mobile %" admitted as evidence.
- Minimum window before any engagement claim: **≥100 real mobile search sessions after
  filter/sort instrumentation exists** (instrumentation itself deferred — ADR-206).

## Research (live-rendered mobile, before founder compressed the unit)

Verified: Amazon.sa AR (sticky text+icon «جميع عوامل التصفية») · Noon SA AR (fixed,
separate «ترتيب حسب»/«تصنيف حسب») · Extra AR (labelled «الفلاتر»/«ترتيب») · IKEA SA AR
(sticky «ترتيب حسب»/«جميع الفلاتر») · idealo (sticky "Sortieren"/"Filtern") · Baymard
filter-UI guidance (labelled button, chips visible, control visible while scrolling).
Not measurable (recorded, not treated as examined): Jarir, AliExpress, Shein,
Google Shopping, PriceRunner (partial). Dominant pattern: **text label · sort separate ·
persistent placement**; no verified experience is icon-only.

## Shipped (Stage A minimum, founder-compressed)

Visible «الفلاتر» label at every width · accessible name = visible word = sheet title ·
44px touch target · existing count badge + chips kept. Deferred with triggers in ADR-206:
separate visible mobile sort, sticky placement, filter/sort instrumentation.

**Honest completion line:** engineering defect resolved; behavioural impact measurement
pending sufficient production traffic (and pending instrumentation).

## AFTER — production verified post-deploy (2026-08-04 ~08:2xZ, `after-*.json/png`)

| Check | Before (mobile 390×844) | After (mobile 390×844) |
|---|---|---|
| Filter entry visible text | "" (icon only) | **«الفلاتر»** |
| Button size | 48×36px | **96×44px** |
| Accessible name | «المرشحات» (≠ sheet) | **«الفلاتر» = visible label = sheet title** |
| Count + chips (2 filters) | badge «2» + 2 chips | badge «2» + 2 chips (kept) |
| In viewport after ~60% scroll | false | false — **deferred (Stage B, ADR-206)** |

Desktop after: identical to before — sort options visible, chips render, mobile trigger
hidden (`w:0`). **Non-regression confirmed on the rendered DOM.**
