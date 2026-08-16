# AUDIT_REPORT_HOME.md — Tawveeri Home Decision Intelligence: Global Frontier Research + Production Readiness Audit

**Date:** 2026-08-15 · **Mission:** Home Decision Intelligence (Part A) · **Mode:** READ-ONLY (verified: every production query ran with `default_transaction_read_only = on` against `vyceqrzttspyycdpojtn`; env contains no legacy project ref)
**ADRs checked before analysis:** ADR-002, ADR-083 (appliance identity ≠ comparisons), ADR-099, ADR-125, ADR-133, ADR-139, ADR-143, ADR-162, ADR-193 (168h pick gate), ADR-199 (AC reclassification), ADR-218, ADR-221/222/223, ADR-230→238 (One Brain/DecisionState/Waffar), ADR-240, ADR-242/243, ADR-244/245, ADR-247/248 (closed, untouched).

---

## 1. Executive decision

**GATE: GO_HOME — four categories (air_conditioner, refrigerator, washing_machine, tv), oven EXCLUDED, under a strict honesty contract (§19–20).**

The evidence supports a credible multi-category home mission: every one of the four categories has fresh decision-eligible depth (70–157 products at ≤7d), near-complete decision attributes (AC/fridge/washer ~100%; TV size 91% recoverable), price-band spread with brand diversity, defensible externally-researched decision logic, live destinations, and all three founder scenarios resolve **honestly** on real production data (A and C complete within budget; B correctly abstains). What the evidence does NOT support is a comparison-breadth promise: comparison-grade-now is 23–37 products per category at 72h (46–66 at the platform's own 168h bar), and matching defects were found in the comparison-grade populations. Therefore the pilot's promise is **decision quality with per-item evidence disclosure** — comparison is evidence when present, never the headline claim. Findings are NOT fixed in this phase (Phase-1 rule); the ones that gate pilot claims are carried into the Part B scope as claim-guards, and the rest are handed to the founder as a remediation ledger.

## 2. Global frontier research lessons (all first-party/dated; full notes in session research files)

1. **The market converged on Tawveeri's architecture, not the other way round.** OpenAI killed Instant Checkout (~Mar 5, 2026) and retreated to discovery; Walmart measured agent-checkout converting ~3× WORSE than click-through and killed it too. Discovery in the assistant, transaction on the merchant — Tawveeri's `/go` exit is the proven shape.
2. **The incumbent weakness is exactly our doctrine's strength.** OpenAI's own published figure: **52% product accuracy on multi-constraint queries** — an LLM-decides architecture ceiling. Anthropic/OpenAI/CaMeL guidance all converge on: LLM converts language→schema-constrained state, deterministic code decides, LLM phrases from supplied facts. That is ADR-002, verbatim.
3. **Mission framing is validated but nobody does budgets.** Amazon ships multi-category "shopping guides", Walmart ships occasion planning, Google's Universal Cart does cross-item compatibility — **no one, anywhere, does cross-retailer multi-category planning under one binding shared budget with dimension-based sizing.** The slot is open (research: Walmart/Wayfair/IKEA/Best Buy/Samsung/LG all checked).
4. **Price history is now a headline consumer feature at Amazon** (365-day visible charts) — our append-only observation history is the same asset class, with provenance Amazon's sellers dispute.
5. **Lowe's "digital twin" is really an appliance registry**; its shipped minimal context = budget + location + owned items (+2× conversion). Home Depot's value = plan decomposition + missing-item detection + inventory grounding. Room scanning/AR is vapor even at their scale.
6. **Google teaches:** mission reasoning lives in a persistent PLAN layer above per-SKU ranking; compatibility is a fact type; price truth = position-in-distribution + history, never prediction; monitoring (track→alert) is the agentic wedge before any checkout.
7. **Saudi market:** Kanbkam is the closest analogue (per-listing price history, "real discount" math) but has no cross-store canonical identity, no AI layer, no verdicts. **No Arabic conversational shopping product exists; no regional mission/home-planning player exists.** The differentiation vs "everyone adds a chat box tomorrow": longitudinal provenance-kept history, deterministic evidence-cited verdicts, cross-category constraint solving over structured offers, honest cross-store identity — none replicable by bolting an LLM onto listings.
8. **Agent-engineering frontier verdict on our runtime** (parse → DecisionState → clarify → deterministic eligibility → rank → LLM-explain → typed mutation): "not behind the frontier; it's the shape the frontier converged on." Single agent + tools; structured state, not conversation memory; untrusted scraped text never enters a tool-using context; evals graded on outcome AND transcript, reported as pass^k.

## 3. Tawveeri strategic differentiation (the §78 test)

If every Saudi comparison site launches a generic AI chat box tomorrow, Tawveeri Home still uniquely combines: home context → typed DecisionState (exists, ADR-230) + deterministic category contracts (ADR-231) + Saudi product identity + observed multi-retailer evidence + shared-budget allocation (nobody has it) + stateful counterfactual refinement (ADR-232/233) + provenance-gated prose (answer-guard/published-evidence). **Test: PASS** — provided the pilot never claims comparison where corroboration doesn't exist.

## 4. Production category truth

Query lineage: all numbers below from read-only SQL against production on 2026-08-15 (runner: session scratchpad `q.js`; core query shapes in Appendix). "Offer" = latest observation per (canonical, store) in `normalized_product_observations` restricted to the 11 displayable store ids {1,2,3,4,5,6,7,8,9,10,18} (`approved-retailers.ts` display gate). `price_history` was proven change-only (a product observed 109× shows 1 row) and is NOT a freshness source.

| Category | Canonicals (active) | Any displayable offer ever | Historical ≥2 stores | Eligible ≤72h (≥1 fresh offer) | Eligible ≤7d | Comparison-grade ≤72h (≥2 fresh) | Comparison-grade ≤7d |
|---|---|---|---|---|---|---|---|
| air_conditioner | 1,280 | 832 | 150 | 70 | 114 | 26 | 47 |
| tv | 864 | 741 | 158 | 88 | 157 | 30 | 66 |
| refrigerator | 402 | 388 | 87 | 73 | 93 | 23 | 46 |
| washing_machine | 385 | 369 | 123 | 77 | 94 | 37 | 60 |
| oven | 92 | 85 | 7 | 6 | 13 | 2 | 5 |

**Oven fails the pilot-grade bar** (7 historical comparables, 2 fresh) → excluded, per the do-not-force-five-categories rule.

## 5–6. Decision-eligible vs comparison-grade — the gap that matters

"LOOKS comparable historically" vs "IS comparable now": AC 150→26 (72h), TV 158→30, fridge 87→23, washer 123→37. **A whole-home pilot claiming comparison breadth would be lying by a factor of ~4–6.** The honest product: recommend from the decision-eligible set with per-item store-count disclosure («متاح لدينا حاليًا من متجر واحد» when true).

## 7. Freshness (offer-level)

- Offers fresh ≤24h / ≤72h / ≤7d out of all latest offers: AC 57/107/179 of 1,058 · TV 73/123/239 of 994 · fridge 58/103/150 of 540 · washer 62/127/184 of 610. **80–90% of latest offers are >7d old** — the pipeline reobserves a fresh core (concentrated on comparables) and lets the tail age.
- Products with offer #1 fresh (≤72h) but every partner offer stale: AC 31, TV 40, fridge 26, washer 18 — the §24 "fresh headline, stale comparison" trap; any two-store claim must check BOTH offers' timestamps (machinery exists: `STALE_CAVEAT_HOURS=72`, ADR-221 disclosure).
- Defensible threshold: the platform already enforces **168h** for the pick badge (ADR-193) and 72h for stale caveats. Recommendation: pilot uses ≤168h as eligibility evidence with age always displayed, ≤72h for any two-store "compare" claim.
- **Operational red flag (not fixed, per Phase-1 rule):** daily observation volume fell ~10× in 7 days (Aug 8: 8,509 → Aug 14: 828; runs/day ~230→~61) while the TPS scheduler heartbeat is alive (tick <2min old, refresh ok). If this trend holds, every freshness number above degrades. Cause not diagnosed in this read-only phase.

## 8. Matching quality (stratified, manually inspected, per-store raw names)

Populations inspected = the FULL fresh (≤7d) comparison-grade sets for AC (47 groups), refrigerator (46), washing_machine (60); TV sampled 20 of 66 (model-keyed population).

- **AC — 1 CRITICAL of 47:** `lg|split|NO_SERIES|18000|NO_TECH|hot_cold` merges LG Jet Cool (LC182H0), LG Smart (NS182H2), and LG Victory AI (LA182H0) — three different commercial models presented as one 4-store product. Borderline (4): Gree GWC18AVDXE vs GWC18AWDXE; GWC12AVCXB vs AVCXD (i-Pro vs AI-Plus); LG LO182C0 vs NJ182C0; LG NT382C2 suffix variants. Everything else corroborates on model numbers across stores.
- **Refrigerator — 2 CRITICAL of 46:** `haam|top_mount|250` merges HM310WRF-O24INV (8.7 cu ft, inverter) with HM280WRF-O23DF (8.9 cu ft, defrost); `lg|side_by_side|800` merges LS32HJBVL with LS32CBBSIV (different series). Variant-level (~4): color merges (e.g., LT11CBB**S**IVN + **W**IV; Samsung RT47CG64**42**S9 + **22**WWH). One SPLIT: LD141BBSIT lives under two canonicals (380 vs 390 L), fragmenting its own corroboration.
- **Washing machine — ≥3 CRITICAL of 60:** `lg|front_load|8|washer` merges THREE different LG models (WSN1308BST / WF0814MB / WFV0812WH); `lg|front_load|12|washer` and `lg|front_load|21|washer` each merge a washer-DRYER with a washer-only; plus a condenser **dryer** keyed as `front_load|8|combo` (dryer sold as washer), and a brand-script split (`أريستون` vs `ariston` — same Ariston combos under two canonicals → duplicate cards possible).
- **TV — 0 critical in 20 sampled:** model-number identity keys (`brand|MODEL:x`) hold exactly across stores (e.g., QA65LS03HE across Extra/Almanea/Samsung-shop). Residual risk confined to the minority of spec-keyed groups (`tcl|65|4k|qled|60` class).

**Mechanism (consistent with the identity-key-integrity memory):** keys of the form `brand|type|capacity|tech` with `NO_SERIES`/`NO_TECH` merge different commercial models at the same capacity. Model-number-bearing keys don't. `tps_model_corroboration` exists but covers only AC (16 rows) — it is not a ready gate for other categories. Per §25 discipline: these are sample counts, not population rates.

## 9. Contamination

Boundary-corrected accessory-vocabulary scan + manual verification: the four categories are clean of the classic accessory classes (all regex "hits" were false positives: "top mount" fridge type, "Magic Remote", portable-AC «مع ريموت») — consistent with ADR-199 and the 2026-08-10 category sweeps. **Except one live class: 6 Samsung `VG-SC*` The-Frame BEZELS sit in `category='tv'`** and surface as the two cheapest "65-inch TVs" at 299 SAR in a naive cheapest-eligible query (found by Scenario A). The Waffar cheapest-gate's 15%-of-median floor would usually catch this, but any budget-constrained mission path that doesn't share that floor would recommend a picture frame as a television.

## 10. Destination health

14 random fresh-offer destinations across 8 retailers, browser-UA HTTP: **11 LIVE (200)** — Extra ×4, Almanea ×2, Amazon ×2, najm, alnakheelk, samsung.com; **1 BOT_BLOCKED_UNKNOWN** (blackbox.com.sa 403 to curl; its sitemap ingestion works, so block ≠ dead); **2 connection-fail to this egress** (noon — known egress behavior, robots-permitted pages; not classified dead). **0 DEAD / MALFORMED / WRONG_PRODUCT at HTTP level.** Consistent with ADR-139's 9/9 and the 0.3% dead-link baseline. Affiliate configuration not inspected (out of scope).

## 11. Decision-DATA readiness (structured fields, fresh populations; title-only facts not counted)

| Category | Field | Eligible ≤7d | Comparison-grade ≤7d |
|---|---|---|---|
| AC | capacity_btu / ac_type / cooling_mode | **100%** (67+47 of 114) | **100%** |
| AC | technology (inverter/standard) | 46% elig / 64% cmp | — `NO_TECH` on the rest |
| AC | energy label (EER/SEER/SASO stars) | **0% — zero fields exist in the category** | 0% |
| AC | noise dB | 0% (contract: unknown) | 0% |
| Fridge | capacity_liters / fridge_type | **100%** | **100%** |
| Washer | capacity_kg / washer_type / has_dryer | **100%** | **100%** |
| TV | screen_size/resolution/panel structured | **11–14% only** | 14% |
| TV | screen size recoverable from title/model text | **91%** (143/157) | — needs structuring at pilot time |

## 12. Decision-LOGIC readiness

**Exists in production (decision-engine.ts):** `requiredBtuForRoom` — 700 BTU/m² KSA heuristic, min 18,000, rounds UP to standard sizes; fit tolerance 12%; AC clarify question (room size 15/25/40 m²); budget question from real price percentiles; category contracts for AC (capacity verified; electricity cost INFERRED-modelled; install INFERRED flat 350 SAR; noise UNKNOWN).
**External research verdict (manufacturer/standards sources; full citations in session research):** the 700 BTU/m² sits inside the GCC retail consensus band (600–800: 600 shaded / 800 sun-exposed) but is HEURISTIC-grade — LG SA and YORK KSA deliberately publish no per-m² number; material adjusters are sun exposure (+10–15%), top floor, ceiling >3m, occupancy, kitchen; **abstain above ~30–40 m² single-unit / multi-zone → professional sizing**; oversizing has real harms (short-cycling). **SASO 2663 is the only defensible efficiency signal (T3 = 46 °C testing, stars/EER/SEER); "inverter" is confirmed NOT an efficiency proxy.** Fridge: 200–380 L (1–2 ppl) / 380–500 L (3–4) per LG; Samsung ~110–170 L/person; NET capacity; physical fit needs user-measured space. Washer: 1–2 ppl 6–7 kg / 3–4 ppl 7–9 kg / 5+ 10 kg+; front-vs-top objective trade-offs documented. TV: SMPTE 30°/THX 36° → size range from seating distance; at majlis distances size dominates resolution; 8K claims are folklore.
**Gaps:** washer/fridge/TV have NO category contracts yet (must be added before cross-category claims); sun-exposure/floor factors are not currently asked (room size only); no multi-space state.

## 13. All-in-cost readiness

**Device price: PROVABLE** (observed, provenance-kept). **All-in cost: NOT provable.** Installation evidence in observations: ~1 mention in 30 days of AC observations; the 350 SAR split-install figure is a modelled estimate already labeled `inferred` in the AC contract. Delivery/fees: no structured evidence. Verdict: totals must be device-only with the explicit line «سعر الجهاز معروف؛ التكلفة النهائية بعد التركيب غير مثبتة لدينا». Never render "Total Home = X" as if all-in.

## 14. Price distribution / depth (fresh eligible ≤7d, displayable stores)

AC: 1,000–2,000 (34 elig/11 cmp/12 brands) · 2,000–3,500 (49/24/10) · 3,500–6,000 (25/9/12) · 6,000+ (6/3/3); no sub-1,000 fresh AC.
Fridge: <1,000 (12/6/7) · 1–2k (26/11/9) · 2–3.5k (34/17/10) · 3.5–6k (16/8/6) · 6k+ (5/4/3).
TV: <1k (20/2/7) · 1–2k (41/11/11) · 2–3.5k (36/17/8) · 3.5–6k (27/15/4) · 6k+ (33/21/3).
Washer: <1k (10/5/8) · 1–2k (28/19/13) · 2–3.5k (36/20/11) · 3.5–6k (15/12/6) · 6k+ (5/4/1).
**A consumer can meaningfully trade price against suitability in every category.**

## 15. Shared-budget feasibility

Feasible and differentiating. The per-band depth above + basket.ts precedent (`per_unit_ceiling`) support deterministic allocation with marginal-gain explanations (e.g., in Scenario A, +300 SAR moves the washer from a single-store 7 kg top-load at 599 to a 5-store-corroborated LG front-load at 900 — an explainable, evidence-cited upgrade). No new ranking math needed; an allocator above N `decide()` calls.

## 16. Scenario simulations (real production data, no UI)

- **A (apartment, family 4, rooms 14/18/28 m², SAR 20k):** COMPLETES. BTU needs 18k/18k/24k; cheapest-viable basket ≈ 6.7k SAR; quality basket (inverter splits, LG 440 L fridge, LG front 7 kg, brand 55″ TV) ≈ 11–13k — inside budget with headroom for trade-up narratives. Caveats which MUST render: several cheapest picks are single-store; TV pick required excluding the 299-SAR bezel trap; totals are device-only.
- **B (villa, family 6, living 45 m², efficiency priority):** FAILS HONESTLY, exactly as designed. 45 m² → ~31.5k BTU → crosses the professional-sizing abstain line; only 5 fresh 36k-BTU units (from 4,180 SAR); **zero energy-label evidence in the entire category** → the efficiency priority must be answered with "we cannot rank by measured efficiency; SASO label data is not in our evidence; inverter is a compressor technology, not an efficiency measurement."
- **C (couple, 16/22 m², SAR 12k):** COMPLETES easily. 2× 18k BTU; 33 fresh fridges 200–380 L from 899; 9 washers 6–7.5 kg from 599; TV optional. Smallest useful mission confirmed viable.

## 17. Demo hygiene

Public surface healthy: `/ar`, `/ar/search?q=مكيف`, `/ar/categories`, `/ar/stores`, `/ar/deals` all HTTP 200 at 1.0–2.3 s. Category purity of «مكيف»/«غسالة»/«ثلاجة»/«تلفزيون» result sets was live-verified as recently as 2026-08-10 (ADR-238 sweeps). Risk items for a partner demo: the Frame-bezel TVs (would appear in cheapest-TV sorts), and any two-store card whose second offer is stale (§7). No broad SEO cleanup performed or needed for the gate.

## 18. THINGS THAT WOULD EMBARRASS US

1. **A "4-store comparison" that is three different LG models** (AC 18000 hot/cold merge) — wrong-model comparison claim on a flagship brand.
2. **A washer-dryer merged with a washer-only** (LG 12 kg, 21 kg) — a customer buying "the cheaper one" gets a different machine class.
3. **A condenser DRYER recommended as a washing machine** (haam front_load|8|combo).
4. **A 299-SAR picture-frame bezel recommended as the cheapest 65″ TV** (6 such rows live in category='tv').
5. **Implying energy efficiency from "inverter"** — zero SASO label evidence exists; any efficiency ranking would be fabricated.
6. **"Total home = X SAR" without installation** — install evidence is absent; only a modelled 350-SAR estimate exists.
7. **A fresh headline price next to a stale partner offer** presented as a live comparison (31 AC / 40 TV / 26 fridge / 18 washer products in exactly that state).
8. **The same Ariston machine appearing as two different products** (brand-script split أريستون/ariston).
9. **Color-variant merges rendering a color premium as a "saving"** (LG/Samsung fridges).
10. **Freshness collapse:** observation volume down ~10× in the last week; if unaddressed, every "current price" in the pilot ages toward falsehood.
11. **Oven inclusion** — 7 historical comparables would make "whole kitchen" a fake claim (excluded).

## 19. Gate decision

**GO_HOME**, four categories (AC, refrigerator, washing_machine, TV), under this binding honesty contract derived from the findings:
1. **Comparison claims** («قارنّا عبر N متاجر») only when ≥2 displayable offers are each ≤72h AND the group is model-corroborated (model number present and matching across stores, or model-keyed identity). Degraded-key groups (NO_SERIES/NO_TECH merges) render as single evidence lines, never as cross-store comparisons.
2. **Single-store default disclosure:** «متاح لدينا حاليًا من متجر واحد» — expected on the majority of picks.
3. **No energy-efficiency ranking or claim**; inverter shown as compressor technology with an explicit not-an-efficiency-measure note; efficiency priorities get the honest abstention.
4. **Device-price-only totals** with the install/delivery unknown line; AC install estimate shown only as labeled estimate (existing contract).
5. **TV advice limited to evidenced dimensions** (size from verified fields or deterministic title extraction; panel/resolution only where structured).
6. **Accessory guard on every mission path** (the 15%-of-median floor or equivalent must gate ALL candidate sets, incl. the bezel class).
7. **Freshness rendered on every price** (existing `observedAgoLabel`); >168h products are not decision-eligible for the mission.
8. **Oven excluded**; any category whose fresh-eligible set drops below a floor at runtime degrades to partial-plan honesty («بيانات هذه الفئة غير كافية حاليًا»).

## 20. Exact recommended Pilot scope (Part B input)

**«جهّز بيتك بذكاء» — a home-mission layer on the existing One Brain.** Natural-language home description (spaces, household, budget, priorities) → mission parse into a HomeMission state that ORCHESTRATES the existing single-category DecisionState/decide() per leg (the designed seam: `decisionStateToAdvisorBody(categoryOverride)` + N `decide()` calls + basket.ts allocation precedent) → at most one high-information clarification per turn (room sizes and budget dominate) → deterministic eligibility (BTU fit / liters / kg / size, budget gate, accessory floor) → shared-budget allocation with marginal-gain trade-offs → plan of ≤4 decisions, each with WHY, price evidence + age, store-count truth, one alternative, and what ±money buys → typed mutations (budget delta, category removal, rejection) via existing mutation-turn/counterfactual machinery → `/go` exits. New prose fields registered in answer-guard PROSE_FIELDS; new figures registered in published-evidence; one new usage-event type for the mission funnel; session-scoped state (no home dossier, no login gate). NOT building: checkout, digital twin, AR, NHC anything, energy claims, oven, multi-agent runtime.

**Non-blocking remediation ledger handed to the founder (NOT executed in this mission):** ingestion-volume decline root-cause; degraded-key merge repairs (LG/Gree/haam cases above); Frame-bezel recategorization; Ariston brand-script unification; TV spec structuring beyond size; SASO label acquisition as a future evidence lever.

---

### Appendix — query lineage (representative)

- Offer = `SELECT DISTINCT ON (canonical_product_id, store_id) … FROM normalized_product_observations JOIN canonical_products … WHERE category IN (…) AND is_active AND store_id IN ('1','2','3','4','5','6','7','8','9','10','18') ORDER BY …, observed_at DESC`; grades from per-product counts of offers within 24h/72h/7d windows.
- price_history proven change-only: product with 109 najm observations (latest same-day) has 1 price_history row (2026-08-03).
- Attribute completeness from `canonical_products.attributes` (sentinels NO_TECH/NO_PANEL/NA counted as missing); TV text-recoverable size via `(32|40|43|48|50|55|58|60|65|70|75|77|85|98)` boundary regex over names/model.
- Matching inspection: per-group per-store `raw_name` dumps for the full fresh comparison-grade populations (AC 47, fridge 46, washer 60) and 20-of-66 TVs, manually verified.
- Scenario A/C: category pools filtered by BTU (±12% band)/liters/kg/size with projection `lowest_price`, ranked ascending.
- Destination health: 14 random fresh `normalized_payload->>'_url'` targets, curl -L with browser UA.
- Ingestion trend: daily `count(*)` on `normalized_product_observations` (14 days) + `scraping_runs` per-day status + `tps_scheduler_heartbeat`.

---

## ADDENDUM — 2026-08-16 re-measurement (post ADR-251/252)

The §4/§7 numbers above were measured on 2026-08-15 while the ADR-251 ingestion collapse
(PostgREST 1,000-row truncation) was suppressing observation counts — they understated
reality. Re-measured 2026-08-16 (read-only, same query shapes, same 11-store display gate,
`default_transaction_read_only = on` against `vyceqrzttspyycdpojtn`):

| Category | Eligible ≤72h (old→new) | Eligible ≤7d | Comparison-grade ≤72h (old→new) | Comparison-grade ≤7d (old→new) |
|---|---|---|---|---|
| air_conditioner | 70 → **529** | 549 | 26 → **69** | 47 → **96** |
| tv | 88 → **374** | 402 | 30 → **62** | 66 → **80** |
| refrigerator | 73 → **289** | 295 | 23 → **35** | 46 → **58** |
| washing_machine | 77 → **264** | 267 | 37 → **83** | 60 → **93** |
| oven | 6 → 57 | 57 | 2 → **4** | 5 → 6 |

- **Offer-level freshness inverted.** Fresh ≤72h out of all latest offers: AC 622/1,052
  (59%, was 10%) · TV 448/1,007 (44%, was 12%) · fridge 332/535 (62%, was 19%) · washer
  380/625 (61%, was 21%). The §7 claim "80–90% of latest offers are >7d old" no longer
  holds — stale-tail is now 31–50% per category.
- **§7 operational red flag CLOSED.** The ~10× daily-volume decline was the ADR-251 defect;
  after the fix + ADR-252 forward-only architecture, daily volume recovered (trough Aug 14
  ≈3.5k → Aug 15 ≈9.1k; trailing 24h on Aug 16 = 10,386 rows) and ingestion is continuous.
- **Oven exclusion stands:** decision-eligible depth jumped (6→57) but comparison-grade ≤72h
  is still 4 — below the pilot bar. No category-set change.
- **Consequences for Home:** the honesty contract is unchanged (disclosure machinery is
  category-independent), but the workspace now has ~2–7× the eligible depth and ~1.2–2.7×
  the comparison-grade depth the gate was accepted on. §8 matching-defect rates were
  measured on the smaller comparison-grade populations and have NOT been re-inspected on
  the larger ones — the ADR-249 remediation ledger items remain open founder decisions.
