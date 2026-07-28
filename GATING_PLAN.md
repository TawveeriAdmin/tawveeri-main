# GATING_PLAN — gate served savings claims through Discount Integrity (PLAN ONLY, no code)

> Requires founder approval before any execution (our own rule: plan → approve → execute). Diagnosis/design only.

## Problem (from ANSWERS.md)
All four served surfaces render a discount%/was/savings figure, none gated by Discount Integrity (which lives only in `/api/v1/agent/decide`). Any `aggressive_claims`-store "was" price (Extra = 100% inflated, ADR-051; 4,531 `inflated_reference` facts, ADR-091) can publish an unsupported saving.

**Scope boundary (important):** this plan stops publishing *unverified savings numbers*. It does **not** fix the identity/stock defect found in #1 (served comparisons can still merge a white clearance vs a black mainstream variant, or first-party vs marketplace, or an out-of-stock offer). That is a separate fix (identity + stock), not covered here.

## Scope of the gate
Suppress the discount%/was-price/savings figure on every served surface unless the discount is evidence-supported:
- Search decision card `خصم X%` + `is_deal` (`route.ts` `buildReasonAr`).
- Deals page `-{discountPct}٪` (`deals/page.tsx`).
- Comparison card savings pill (`comparison-card.tsx`).
- Product detail was/original price (`product-detail-client.tsx`).
The **price itself always shows**; only the *savings claim* is gated.

## Per-request cost — the ADR-091 constraint
ADR-091 deliberately kept discount integrity out of hot search/feed paths to avoid a per-request query. So the gate MUST add **zero per-request DB queries**. Two tiers:

- **Tier 1 — store-level, immediate, ~0 cost.** Load `tps_merchant_trust` once (≈7 rows) into an in-memory cache (or bake into the store config). Rule: if an offer's store is `aggressive_claims`, **hide its discount/was/savings** everywhere. Kills the Extra risk today with no per-request query. Coarse (hides even honest Extra discounts) but safe and cheap.
- **Tier 2 — per-offer, precise, ~0 request cost.** Bake the per-canonical/per-offer Discount-Integrity verdict (`verified_drop` vs `inflated_reference` vs none) into the **served layer at build time**: add the flag to the Algolia `products` index records (in `rebuild-products-index.ts`) and to the storefront rows the pages read. Surfaces then read a boolean. `verified_drop` → show savings; `inflated_reference`/unknown → hide. Reuses the existing `getCanonicalDiscountIntegrity` / `tps_listing_price_facts` at build, not per request.

**Recommendation:** ship **Tier 1 first** (immediate, coarse, safe), then **Tier 2** (complete, per-offer honest) as the durable solution.

## Rollback
- Tier 1 is read-side + additive behind an env flag `SAVINGS_GATE=on|off` (default `on`). Rollback = set `off` (instant, no data change).
- Tier 2 changes only the index/projection **build output**; rollback = rebuild without the flag (minutes, reversible, no DB write to storefront tables beyond the additive flag column which is nullable/droppable).
- No parser change, no destructive migration.

## Acceptance criterion (measurable)
A read-only check script (reuse the `search-success.js` harness style) asserts, on a sampled served response set:
1. **Zero** discount%/was/savings rendered for any offer whose store is `aggressive_claims` (Tier 1) or whose canonical verdict is `inflated_reference`/unknown (Tier 2).
2. `verified_drop` offers **still** render their savings.
3. Served-search median latency **unchanged** (no added per-request query) — measured before/after.
4. Manual spot-check: the Extra LG 9kg / Toshiba 15kg families show **no "وفّر" number** (their discount is unverified) — while their prices still display.

## Draft ADR-129
> **ADR-129 — Gate served savings claims through Discount Integrity / merchant-trust, precomputed to preserve the hot-path budget · Proposed (2026-07-28)**
> **Context:** ADR-091 wired Discount Integrity into `decide` only, explicitly sparing hot search/feed paths a per-request query; but all four *served* surfaces (search, deals, comparison card, product page) render an ungated discount%/was/savings (ANSWERS.md), so an inflated `aggressive_claims` "was" (Extra, ADR-051) can publish an unsupported saving. «Unknown beats incorrect» is violated for savings claims.
> **Decision:** gate every served savings figure with **zero per-request DB queries**. Tier 1: hide savings for `aggressive_claims`-store offers via a cached `tps_merchant_trust` lookup. Tier 2: bake the per-canonical Discount-Integrity verdict into the served index/projection at build time; surfaces read a boolean (`verified_drop`→show, else hide). The price always shows; only the *savings claim* is gated. Behind `SAVINGS_GATE` env for instant rollback.
> **Alternatives:** per-request `getCanonicalDiscountIntegrity` on search (rejected — violates ADR-091's hot-path budget); remove all savings UI (rejected — honest `verified_drop` savings are a real differentiator).
> **Consequences:** no unsupported saving reaches users; honest savings survive; no latency regression; reversible. Does NOT address the identity/stock merging defect (separate fix). Commission-blind, no LLM.
> **Acceptance:** the 4 criteria above, green, before rollout.

## Sequence (on approval)
1. Tier 1 behind `SAVINGS_GATE` + check script → verify criteria 1–3 → deploy.
2. Tier 2 (index/projection flag) → verify criterion 4 + per-offer honesty → deploy.
3. Separately (not this plan): identity/stock fix for non-equivalent-listing merges + out-of-stock exclusion.

> No code written. Awaiting approval of this plan and ADR-129.
