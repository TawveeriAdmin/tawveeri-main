# LAUNCH-READINESS BRIEF — FROZEN RECORD
**2026-07-31 · Closed at `8de58e8`. Do not reopen unless new production evidence invalidates a
recorded conclusion.**

---

## 1. RANKING — THE CORRECTED RECORD (read before any ranking work)

**Two surfaces. Two different rules. They must never inherit each other's.**

### Source-brief check
`REDESIGN_BRIEF.md` §7.1 is titled *"Ranking — not absolute saving alone"* and is referenced
**only** from structure item 4, «عروض موثّقة» (verified deals). **The source brief is already
scoped to deals and does not conflict with the founder decision below.** The risk was the
generic title, not the text.

### ⚠ CORRECTION TO CHECKPOINT #22
That checkpoint listed *"§7.1 explainable deal score — ranking is currently cheapest-first; the
brief calls that a bug."* **The clause "ranking is currently cheapest-first" is wrong for
search.** Measured: `search-client.tsx:196` defaults to `popularity`, mapped to `relevance` at
`:656`. The cheapest-first concern came from `STANDING_DIRECTIVE` §3.3 and was about the **Smart
Pick**, not the result list. Corrected here so no future session inherits the error.

### RULE A — SEARCH / COMPARISON RESULTS
- **Lowest genuinely comparable TOTAL cost first.**
- Include mandatory delivery or unavoidable fees **when available**.
- **Never compare totals across different commercial variants as if identical.**
- **Sponsorship and affiliate economics must never purchase ranking** (Constitution: commercial
  interest never enters ranking).
- **State the ordering rule to the customer in one readable line.**

> A lower sticker price is **not** "cheapest" when mandatory costs or a different variant make
> the comparison unequal.

**Current state, measured:** default is relevance, not total cost. `/api/search` emits
`delivery_cost: 0` and `is_free_delivery: false` as **hardcoded literals**
(`route.ts:542,544,766,768`) — an unknown cost asserted as zero, which §7.2 forbids. Total-cost
ordering is **not implemented**.

### RULE B — DEALS SURFACE
- **Never rank by absolute saving alone.**
- A large nominal discount on an expensive product must not automatically outrank a stronger
  relative or historically unusual deal on a cheaper one.
- A future model may use percentage saving · absolute saving · verified price history · current
  market position · confidence and freshness · product relevance.

**Current state, measured:** `home-verified-deals.ts:90` sorts by **absolute saving descending**,
with accessories deprioritised and a ≥50 SAR floor. This is exactly the pattern §7.1 rules out.

---

## 2. COMPLETED — verified in production

About-page truth fixes · ADR-150 live category rule · homepage IA · journey harness (AR 10/10,
EN 10/10; exits 0 malformed of 1,323) · `/go` fallback · product-page slug + SEO-column fixes ·
observation-time correction at source and display · discovery provenance (269/269 linked) ·
`og:image` · 404 status · dead social links · duplicate sort control.

## 3. DEFERRED
DEBT-1 (`write_ac_batch` provenance) · normalization backfill (Step 4, gated on the match
invariant and the `dell g-series` parser defect) · §2.1 retailer tiers · brand-collision and
competitor research.

## 4. ACCEPTED TECHNICAL DEBT
DEBT-1 with both binding constraints (FK guard is a correctness invariant; render-time
provenance resolution is an architectural dependency — reference case
`/ar/compare/apple|iPhone|15|Standard|128` must render **5, 10, 25**).
35 observations holding two canonicals · `asus|dell g-series` parser defect ·
`processing_status` is vestigial.

## 5. REMAINING CUSTOMER-VISIBLE LIMITATIONS
404 body empty (roadmap unit, prerequisite = root layout must own the HTML shell) · 1,027 offers
with no exit or provenance · EN 90% vs AR 100% card reachability · product body client-rendered ·
coupons page empty.

## 6. ROLLBACK REFERENCES
`cc1fe21` About · `68570df` ADR-150 + IA · `a3a82bc` /go · `0ec8439` harness · `3dfc18a` product
pages · `280b1d9` harness fetch · `461955a` observation time · `f9d7afe` display freshness ·
`94a3756` discovery provenance · `5bc5463` og:image · `31e45d0` 404 status · `4232924` §3.
Pre-brief head: `c1b3486`. Verify range before any revert: `git log --oneline c1b3486..HEAD`.

---

## 7. RECONCILIATION — `PROMPT_RESULTS_AND_WAFFAR.md`

**THE FILE DOES NOT EXIST.** Not at the repo root, not anywhere in the tree. It was never sent.
This matrix reconciles the requirements **as stated inline in the founder message of
2026-07-31**, which are complete enough to act on. Nothing was inferred about the file's
contents.

| # | Requirement | Status | Evidence / recommendation |
|---|---|---|---|
| **A** | Search ordering: lowest comparable total first | **Still valid · not implemented** | Default is relevance (`:196`, `:656`). `delivery_cost`/`is_free_delivery` are hardcoded literals — §7.2 violation. → **Phase 2 unit A** |
| **B** | Compare action only when a real comparison exists | **Largely implemented** | The CTA renders only when `tps_compare_url` is set (`product-card.tsx:487`), which requires `has_comparison` = ≥2 approved retailers. **Minimum evidence rule to record:** ≥2 distinct approved retailers on the SAME canonical variant, each with a live price. Gap: a single-offer canonical's compare page renders an empty shell when reached by direct URL — no card links there. → **Phase 2 unit B (small)** |
| **C** | Variant handling | **Partially implemented · still valid** | TPS identity already separates storage/capacity/generation (`apple\|iPhone\|15\|Standard\|128`), and `product-grouper.ts` explicitly does not merge different storage. Cosmetic colour duplication is NOT collapsed. **Do not merge storage, capacity, generation, size or region.** → **Phase 2 unit C** |
| **D** | Observation-line consistency | **Constitution controlling · design work still valid** | No provenance ⇒ no claim, never estimated — already enforced by `observed-freshness.ts`. Mixed cards remain a list-consistency question. Preferred bounded option: **reserve consistent layout space without making a claim**. → **Phase 2 unit D** |
| **E** | Result-page defects | **Mostly resolved — measured, do not redo** | duplicate sort ✅ fixed (`4232924`) · retailer filter ✅ already gated, depth matches · zero-result categories ✅ camera returns 48 and ADR-150 removed it from nav · unhonourable compare actions ✅ none found · **variant duplication ❌ not measured — the one open item** |

### Requirement D — the rule, recorded
> **No verified provenance ⇒ no freshness claim.** Never estimate, default, infer, or display an
> accidental timestamp. Never use "unknown" to fill space. Never restore an unverifiable
> timestamp for visual consistency. Consistency is solved by **layout**, not by data.

---

## 8. EXTERNAL RESEARCH — how it is to be used
Industry findings (Baymard and comparators) are **evidence for prioritisation and testing, not a
prediction of Tawveeri's conversion or abandonment rate**. They may answer only: what belongs on
a mobile result card · how variants are represented · how sorting is explained · when compare
controls appear · how missing optional evidence is presented consistently.
**Where a benchmark conflicts with measured Tawveeri behaviour, the measurement wins.**
