# Tawveeri — Founder Product Review, September 2026
**Prepared:** 2026-09-06 · **Companion to:** `docs/social/product-truth/2026-09-06/` (the social/marketing pack this review's evidence base was built alongside).
**Scope:** the real shopper experience today, not engineering sophistication in the abstract. Evidence: 3 live production journeys run this session (refrigerator, air conditioner, smartphone) + full-text mining of ADR-290 through ADR-300 + `docs/CAPABILITY-CONTRACT.md` + `docs/report/AUGUST-2026-FOUNDER-REVIEW.md` (most recent accepted founder review, dated 2026-09-01) + `docs/report/SEPTEMBER-2026-EXECUTION-BASELINE.md`.
**Explicit scope limit:** only 3 of the ~8 priority categories the founder's broader mission named were live-tested this pass (refrigerator, air conditioner, smartphone). TV, laptop, tablet, washer, and Home Mission are reported from existing ADRs/docs only, not re-tested live — marked accordingly below. No production behavior was changed to produce this review.

---

## A. What Tawveeri can reliably do today

- Parse a maximum budget, in natural Arabic/English phrasing, and apply it as a hard ceiling — across every category tested (ADR-291, re-verified live 2026-09-06).
- Recognize a "small" refrigerator preference using a real, catalog-derived size threshold (ADR-290, re-verified live).
- Match a stated room size to the correct AC BTU capacity (verified live 2026-09-06 — not previously documented as its own capability).
- Prioritize a smartphone recommendation by camera quality within budget, with a plain-language reason shown per pick (re-verified live 2026-09-06).
- Disclose, rather than silently drop or fabricate, a requirement it cannot verify (refrigerator lock, cross-store storage-capacity ambiguity) — this is the single most repeatedly-proven behavior across ADR-290, ADR-298, ADR-299, ADR-300, and this session's live tests.
- Flag a merchant's advertised "before" price as never-actually-observed when the price-history data disagrees — confirmed live across all 3 tested categories.
- Hand a shopper off to the real merchant product page with the correct affiliate tag attached — confirmed live (Amazon.sa).
- Keep ranking free of commercial influence, restated as a standing disclosure on every results page.

## B. What Tawveeri can partially do

- Smartphone battery-priority, performance-priority, and free-form "my phone is slow" search: reported working at original publication (founder-cited) but not independently re-verified since, and not re-tested this pass.
- Condition (new/renewed/used) disclosure: works at the storefront-listing layer (title text), but the canonical/identity layer strips condition markers, and the internal Amazon×Noon shadow-comparison engine can safely resolve condition on only 3 of 50 real overlap pairs — 47 correctly default to "unknown" rather than guess (ADR-298/299/300).
- Data freshness: typically 1-2 hours under normal operation, but not proven immune to a redeploy killing an in-flight refresh (ADR-296) — a real, disclosed residual risk, not a solved problem.
- AC as a category: the room-size matching itself works well, but Amazon contributes zero real AC listings, so cross-merchant AC comparison is structurally thinner than the matching intelligence alone would suggest (ADR-295).

## C. What Tawveeri still cannot do

- Compare two named brands/products in an open-ended way ("iPhone vs Samsung, which is better?").
- Give a buy-now-vs-wait-for-a-price-drop verdict.
- Automatically discover and add a product that isn't in the catalog yet when a shopper searches for it — a safety mechanism exists and is proven not to fabricate, but no genuinely new product has ever been proven added this way (ADR-291/292/293).
- Act on its own follow-up suggestions: clicking "what if I raise my budget by 500?" on a real results page produced **zero change** in a live test this session — a newly-discovered defect, not a documented limitation until now.
- Offer an official, branded partnership with any merchant — Noon's is explicitly unresolved on legal consent grounds (ADR-284/294).
- Prove a single dollar/riyal of confirmed affiliate revenue — the reconciliation infrastructure is built and tested, but `affiliate_reports`/`affiliate_conversions` both have 0 rows; nothing has ever been imported (`SEPTEMBER-2026-EXECUTION-BASELINE.md`).

## D. Strongest 5 end-to-end shopper journeys (evidence-ranked)

1. **Small fridge + lock matters** — the flagship honesty story; a real, previously-broken production incident, now fixed and re-confirmed live.
2. **AC by room size + budget** — a genuinely strong, previously-undocumented capability, confirmed live this session.
3. **Phone by camera priority + budget** — re-verified live, with a written reason per recommendation.
4. **Fake-discount detection on any of the above** — recurring across categories, a strong trust signal with no known failure case this pass.
5. **Merchant exit hand-off** — a single live test succeeded cleanly (real product, real price, correct affiliate tag); treat as strong-but-thin evidence (n=1), not exhaustively proven across all 8 merchants.

## E. Weakest / most fragile journeys

1. **The "continue with Tawveeri" follow-up quick-actions** — visually present, functionally inert. This is the most fragile thing found this pass because it actively misleads a shopper into thinking a real feature exists.
2. **Repeated searches via the homepage search box** — a third rapid search silently bounced back to the homepage instead of erroring or completing; not root-caused, reproducible enough to matter for live demos.
3. **The secondary "Hot Deals" grid on every search-results page** — generic, unfiltered inventory shown directly below a genuinely relevant primary result list; undermines the polish of an otherwise strong page.
4. **Smartphone battery/performance/pain-point search** — unknown current reliability; last confirmed only by founder citation, not independent testing, for over a day now.
5. **AC as a comparison category** (not as a matching capability) — the single highest-demand search category has zero Amazon-side inventory, meaning the "compare across merchants" promise is thinnest exactly where demand is highest.

## F. Top product gaps discovered during live reproduction

See `docs/social/product-truth/2026-09-06/PRODUCT_GAPS_FOR_SOCIAL.md` for full detail. Summary:
1. Follow-up quick-action buttons render but do not function (new, high severity for trust).
2. Homepage search-box submission is not reliably reproducible on repeated rapid use (new, medium severity, not root-caused).
3. The "Hot Deals" secondary grid is not filtered by search relevance (new, medium severity, cosmetic/perception risk).
4-6. Refrigerator lock evidence gap, AC Amazon-catalog gap, and unverified phone sub-claims — all previously documented in ADRs, carried forward here as still-open.

## G. Features/systems that exist in code but do not yet create clear shopper value

- The internal Amazon×Noon "shadow commerce" condition/product-type engine (ADR-294–300): rigorous, well-tested, entirely invisible to a real shopper today — it gates 47 of 50 real overlap pairs to "unknown" rather than surface a wrong comparison. This is engineering discipline with zero current customer-facing payoff, by design (SHADOW_ONLY, ADR-298).
- The async catalog-recovery pipeline (ADR-292/293): built, safe, and unproven — no shopper has ever benefited from a genuinely new product being added this way.
- The "continue with Tawveeri" follow-up UI (GAP-1): exists in the interface, creates negative value right now because it implies a capability that isn't wired up.

## H. Features strong enough to market now

The honesty/disclosure pattern (refrigerator lock, storage ambiguity, fake-discount detection), budget-ceiling understanding, AC room-size matching, and camera-priority phone search — all GREEN, all re-verified or freshly verified live this pass. See the social pack's Quick Start for the exact ranked list.

## I. Features that should NOT receive more engineering investment yet

- The shadow Amazon×Noon condition engine: already over-engineered relative to its current zero customer-facing exposure; further investment here should wait until a founder decision to actually activate any category publicly (none currently pass all quality gates per ADR-298).
- The async catalog-recovery pipeline: safe but unproven; more investment without first proving one real recovered product live would be compounding unproven complexity.
- Any new "Home Mission" feature work: this review found no live evidence this pass either way (not tested) — investing further before a dedicated verification pass would be guessing, not deciding.

## J. Top 5 product priorities if the goal is: visitor → useful decision → merchant → measurable commercial action

1. **Fix or remove the follow-up quick-action buttons (GAP-1).** A visible, non-functional affordance actively erodes the "we don't fake anything" claim that is Tawveeri's strongest asset — this is a trust bug, not a cosmetic one.
2. **Close the affiliate-report import gap.** Zero confirmed revenue exists not because there's no traffic (64 sessions/month reach a merchant) but because no one has ever downloaded an Amazon Associates or Noon report. This is a founder action, not an engineering one, and it is the single missing link between "real traffic" and "known business."
3. **Investigate the search-box reproducibility issue (GAP-2).** If real shoppers are hitting the same silent bounce-back this session hit on a third rapid search, it is invisibly costing completed searches with no error signal to diagnose it.
4. **Extend the AC room-size-matching win into a registered, permanent capability entry** (currently undocumented outside this pass) — and separately, treat AC's Amazon-catalog gap as a merchant-acquisition priority given it's the single highest-demand category.
5. **Re-verify smartphone battery/performance/pain-point search live**, and either promote them to a documented GREEN or explicitly correct the record — a day-old "not yet re-verified" caveat should not persist indefinitely.

## K. Current product maturity score /10 (evidence, not sentiment)

| Dimension | Score | Evidence |
|---|--:|---|
| Shopper-facing honesty/trust behavior | 8/10 | Repeatedly, independently proven across 5 ADRs and 3 fresh live tests; the strongest dimension by far |
| Constraint understanding (budget/size/room/priority) | 7/10 | Confirmed live for budget, fridge size, AC room-size, phone camera; not yet confirmed for several phone sub-claims |
| Decision-support breadth (comparisons, timing guidance) | 2/10 | Explicitly unsupported (A-vs-B, buy-now-vs-wait) |
| Interface follow-through (does the UI's own affordances work) | 4/10 | New defect found live this pass (GAP-1); search submission itself showed a reproducibility gap (GAP-2) |
| Catalog/merchant breadth | 4/10 | Only 8 of 24 registry stores serve; AC has zero Amazon coverage; only 1,384 of 7,112 products are actually comparable |
| Commercial proof | 1/10 | Zero confirmed affiliate revenue despite real traffic reaching merchants — a founder-action gap, not an engineering one |
| Engineering rigor behind the scenes | 8/10 | The Amazon×Noon condition/product-type engine (ADR-294–300) is more disciplined than anything found in competing Saudi products per the existing global study |
| **Overall product maturity** | **4.5/10** | A genuinely honest, well-engineered decision layer sitting on top of thin catalog breadth, thin interface follow-through, and zero proven commercial outcome |

This is consistent with, and does not contradict, August's independently-scored **Overall 4/10** (`AUGUST-2026-FOUNDER-REVIEW.md` §22) — see §M below for what specifically changed.

## L. Current category readiness table

| Category | Shopper journey readiness | Product Truth reliability | Merchant depth | Social readiness | Paid-traffic readiness | Overall |
|---|---|---|---|---|---|---|
| Refrigerator | 🟢 tested live, strong | 🟢 (honest disclosure proven) | 🟡 (thin — 8 merchants overall) | 🟢 (flagship honesty story) | 🟡 (thin catalog breadth) | **GREEN for content, YELLOW for scale claims** |
| Air conditioner | 🟢 tested live, strong matching | 🟢 (capacity-matching + fake-discount proven) | 🔴 (zero Amazon offers, highest-demand category) | 🟢 (matching story) | 🔴 (merchant-breadth gap undermines "compare everywhere" framing) | **YELLOW — strong story, weak breadth** |
| Smartphone (camera) | 🟢 tested live, strong | 🟢 | 🟡 | 🟢 | 🟡 | **GREEN for camera-priority specifically** |
| Smartphone (battery/performance/pain-point) | 🟡 not re-tested this pass | 🟡 | 🟡 | 🔴 (do not publish until re-verified) | 🔴 | **YELLOW/UNKNOWN — re-verify before any claim** |
| TV | UNKNOWN (not tested this pass) | UNKNOWN | 🟡 (Amazon-strong per ADR-295's shadow data) | 🔴 (no fresh evidence to build content on) | UNKNOWN | **UNKNOWN this pass** |
| Laptop | UNKNOWN (not tested this pass) | UNKNOWN | 🟡 (BALANCED per ADR-295) | 🔴 | UNKNOWN | **UNKNOWN this pass** |
| Tablet | UNKNOWN (not tested this pass) | UNKNOWN | UNKNOWN | 🔴 | UNKNOWN | **UNKNOWN this pass** |
| Washer | UNKNOWN (not tested this pass) | UNKNOWN | UNKNOWN | 🔴 | UNKNOWN | **UNKNOWN this pass** |
| Home Mission | UNKNOWN (not tested this pass; August review scored real engagement, 0 completions) | UNKNOWN | UNKNOWN | 🔴 | UNKNOWN | **UNKNOWN this pass — last known state was "early engagement, 0 completions" (August)** |

## M. What changed since the most recent accepted founder review (August, `AUGUST-2026-FOUNDER-REVIEW.md`, 2026-09-01)

Only comparisons the current evidence actually supports are made; everything else is left as "no defensible comparison this pass."

- **Session/traffic scale:** August ended at 391-419 post-baseline sessions, 64 reaching a merchant (16%). The September baseline doc (read this session) reports the same order of magnitude (419 sessions, 64/16.4% reaching a merchant) — **no material change in scale is evidenced**; this is the same reporting period's numbers carried forward, not fresh September growth data.
- **Commercial proof:** unchanged — August found 0 confirmed affiliate orders/commission with no import pathway; this review confirms the same 0-row state in `affiliate_reports`/`affiliate_conversions` as of the September baseline doc. **This is the single largest unclosed gap across both reviews.**
- **New, since August:** the shopper-constraint honesty engine (ADR-290/291) did not exist in this form in August — it was built 2026-09-05, directly in response to a real founder-reported incident. This is a genuine, dated product improvement not reflected in August's scorecard, and it is the strongest thing this review found.
- **New, since August:** the internal Amazon×Noon shadow-commerce condition/product-type engine (ADR-294–300) is entirely new since August and was SHADOW_ONLY (not customer-facing) as of August; it remains SHADOW_ONLY today (ADR-298, confirmed not reopened).
- **New defect, found only in this review:** the follow-up quick-action buttons (GAP-1) — no prior review mentions or tests this UI element; it is unclear whether this is a new regression or a long-standing untested gap. Flag as unknown-duration, not necessarily new-since-August.
- **Retention:** August could not properly measure platform-level retention (5 registered accounts all month). The September baseline doc reports "6.1% of post-baseline sessions active on ≥2 distinct days" — a genuine measurement improvement over August's near-total gap, though still described as an early signal, not proof.
- **No defensible comparison possible this pass for:** Home Mission completion rate, category-by-category demand ranking (August's own numbers were partly inflated by a now-fixed bug, per August §23 item 5), and TV/laptop/tablet/washer readiness (not re-tested in either review's live-journey sense).

**Bottom line:** the product got measurably more honest and more rigorous under the hood since August, without yet closing August's two headline gaps — proven commercial revenue and broad category-by-category live verification. The overall maturity score has not meaningfully moved (4/10 → 4.5/10, and that quarter-point is mostly the honesty-engine credit, partially offset by the newly-found interface-follow-through defect).
