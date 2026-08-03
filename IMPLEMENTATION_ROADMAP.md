# IMPLEMENTATION ROADMAP — Post-Master-Book Phase
**2026-08-03 · Governed by `docs/TAWVEERI_MASTER_BOOK.md` v1.2 (ch. 33–35) · Authority order: production evidence › Master Book › HANDOVER**

> **The governing rule of this phase: products are inventory. Comparable products are the product.**
> Every unit below is classified by ch. 35's question — *does it add inventory, or does it add
> comparison/trust?* — and ordered by measured cost per comparison or per removed trust defect.

---

## 0 · The evidence baseline (measured 2026-08-03, queries named — re-measure before quoting)

| Question | Figure | Method / definition |
|---|---:|---|
| Products visible to a customer (knowledge layer) | **5,426** | `tps_product_projection` row count — what TPS search/compare surfaces serve |
| Products visible to a customer (storefront layer) | **9,754** (9,557 with an in-stock offer) | `products` / `product_stores.availability='in_stock'` — product detail pages |
| ≥2 approved retailers | **922** (displayable: **912**) | `scripts/tps-analysis/comparable-count.sql` — `price_history` → active canonicals → `resolveApprovedSlug`, ≥2 distinct slugs; displayable removes `COMPARISON_DISPLAY_EXCLUDED` (lulu · sharafdg · blackbox) |
| ≥3 approved retailers | **236** (displayable: **229**) | same query, ≥3 |
| True comparison rate | **16.8%** of projection (912/5,426) · **12.2%** of canonicals-with-offer (912/7,572) | both denominators stated; projection's own `has_comparison` flag reads 949 — flag and SQL differ by 27 (flag method predates display gating; do not mix them) |
| Reachable in AR + EN | **54/54 PASS**, live production run 2026-08-03 | `unified-search-verify.js --base https://tawveeri.com` — need/named/browse/comparison intents, both locales |
| Mobile journey | measured at session end (one deliberate full `tps:ui-journey` run per Standing Directive §0.10) | last known: comparison 45/48 = 93.8%, overall 77/80 = 96.3% (`docs/ui-journey-after-adr138.log`) |

**The amendment's "~9,300" is the storefront layer.** The comparison product a customer can
actually act on is **912**. Reporting 9,754 as an achievement is exactly what ch. 34.3 forbids.

**The defect the baseline exposed (new, measured):** for the 912 displayable comparables, the
**median freshest observation is 103.6h (~4.3 days)**; only 250 (27%) observed within 24h; 384
(42%) older than 7 days. p90 = 264h. Query: max(`observed_at`) per comparable canonical vs now.
Our own engine grades >72h freshness "weak" — so **71% of our comparison evidence currently sits
below our own freshness standard.** This is ch. 33.3's "rate, not state" failure, on exactly the
products that are the product.

---

## 1 · Unit order (highest leverage first)

### U1 — Observation time at the point of claim + freshness-conditioned pick label · **THIS SESSION**
*Class: trust · Founder-ordered (ADR-192 left it open) · Master Book §31.5 «وقت الرصد ظاهر — أو لا ادعاء», T1, §34.2*
- Search Smart Pick (`اختيار توفيري`) today renders **no observation time at all** while claiming
  "best price at X" — the search route reads `observed_at` and drops it (`search/route.ts` `latest` map).
- Fix: carry `observed_at` → `decisionCard`; render «آخر رصد …» on the card; **withhold the pick
  label when the price evidence is older than 168h** (the evidence engine's own floor band) — the
  product stays in the grid, no dead end (P3). Advisor `الاختيار الأنسب`: price-age disclosure at
  the point of claim; same 168h label gate on the price-claim badge.
- External evidence (verified 2026-08-03): **no incumbent** (idealo, Geizhals, PriceSpy, Google
  Shopping) shows per-offer freshness to consumers — Google suppresses stale offers silently,
  idealo validates merchant-side. Showing the observation time is differentiation consistent with
  our thesis («رقمنا مرصود»), not imitation.
- Measure: count of picks withheld by the gate (log, not guess) · zero unsupported best-price
  claims older than 168h in served HTML.

### U2 — Comparable-first observation cadence
*Class: trust + root cause of U1's gate · ch. 33.3 (quality is a rate) · §12.2 (the تخفيضات season, 1 Aug–31 Oct, is a high-signal window — every observation compounds)*
- **Sharper measurement (2026-08-03): 685/912 (75.1%) of comparables' CHEAPEST offers are older
  than 7 days** (vs 42% for freshest-any-store). A stale low price stays "cheapest" precisely
  because it aged without re-observation — **the best-price claim is structurally biased toward
  stale evidence.** Re-observation must start with the cheapest offer per comparable, not the
  freshest.
- The 912 comparables are ~2,100 store-listings. Re-observing them daily is small against the
  scheduler's existing volume, and it empties the >168h band that forces U1's label gate.
- Mechanism: priority tier in the dispatcher (`scraping_schedules` coverage config) keyed on
  `has_comparison`, not a new pipeline. ADR-099 serialization rules apply unchanged.
- Measure: median freshest-age for displayable comparables **103.6h → <24h**; U1 gate hit-rate → ~0;
  verified-drop count trend during the season.

### U3 — Objective 1: next comparison lever, decided on cost per comparison
*Class: comparison · HANDOVER #60/#68*
- Candidates: complete a small retailer's catalogue (measured 5× cheaper per comparison, #60) vs
  ~900 remaining Amazon seed targets at a **measured 7.1%** hit rate (~60 observations).
- Decision rule (ch. 35): the candidate must intersect the **4,477 single-store products**, not add
  new single-store SKUs. Run `tps:feed-probe` overlap prediction before any engineering.

### U4 — 55 refused duplicate pairs · **BLOCKED, unblock event stated**
*Class: trust (customer sees one product twice)* — ADR-184 merged 73; the 55 need a **second
evidence source** (both sides must show the same model literally; one side cannot). Unblocks when
a second identity authority exists (image-hash or spec-complete equality with measured precision).
Do not weaken the gate to clear the queue.

### U5 — Arabic storefront ingestion (7,155 rows with no Arabic evidence)
*Class: trust/experience (Arabic-first market, §5)* — governed by ADR-089's URL-vs-SKU
double-count hazard; needs the feed adapter's SKU dedup path per store. Sized after U2.

### U6 — ACs mis-filed under `category='accessories'`
*Class: correctness* — currently worked around in the composer. Fix at classification with a
measured before/after on AC search reachability; remove the workaround in the same unit.

### U7 — Machine-readable evidence layer (agentic lane) · **SCOPE ONLY**
*Class: strategic (Master Book ch. 21–22)* — verified 2026-08-03: post-Instant-Checkout the
surviving pattern is **"discover in AI, buy on site"**, and **no comparison platform anywhere
exposes a first-party evidence-cited price API** (only third-party scrapers of idealo/Geizhals).
The lane is open and is exactly our data shape. Prerequisite stands (HANDOVER #66): re-measure
indexation in ~2 weeks before building anything.

### Closed / carried status (founder's list)
| Item | Status |
|---|---|
| Railway preview domain indexed | **FIXED** — ADR-190, verified live (`noindex, follow` on preview; canonical clean) |
| 59 audio canonicals store-name-as-brand | Guard shipped (ADR-191); cleanup refused at a **measured ≤2-comparison ceiling** |
| Amazon seed targets | ~900 remain at measured 7.1% (#68 corrected the published 30%); 31 obs from the 350-run normalized (922 vs 918 at close) |
| Smart Pick freshness | U1, this session |
| 137 duplicates | 73 merged, 55 refused → U4 |
| 7,155 no-Arabic rows | U5 |
| AC misfiling | U6 |

---

## 2 · What the world taught that the book did not know (verified 2026-08-03; candidate book amendments)

1. **Kanbkam** (kanbkam.com) runs consumer price-history for amazon.sa, noon, extra, jarir —
   "no one in Saudi has price history" claims must be qualified before external use. Verify its
   depth directly, then amend EXECUTIVE_DIRECTIVE §2.1's table and any public copy.
2. **No incumbent shows per-offer freshness to users** — our observation-timestamp surface is a
   genuine differentiator (supports U1; strengthens Master Book §1.1 with external evidence).
3. **"Discover in AI, buy on site" is the settled 2026 pattern** (OpenAI retreat measured:
   ~3× worse conversion in-chat per reports; Google UCP scaling; Rufus folded into Alexa) —
   confirms ch. 21.3's v1 boundary and makes U7's lane concrete.

---

*Every figure above is dated and carries its query. Re-measure before reuse (Master Book §0.1).*
