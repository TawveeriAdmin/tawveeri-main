-- 56-shadow-commerce-condition.sql — Amazon × Noon internal commerce, condition truth
-- (founder mission, 2026-09-05, §1/§2/§8). Purely additive columns on the existing
-- shadow_commerce_events table (migration 52) — no new table (mission's own "no duplicate
-- analytics system" instruction).
--
-- shopper_equivalence_state and selection_reason are unconstrained-enough already
-- (selection_reason has no CHECK at all; the new CONDITION_MISMATCH/CONDITION_UNKNOWN/
-- CATEGORY_MISMATCH reason codes need no schema change there) — only the per-merchant
-- condition values and the category-mismatch flag are genuinely new information to store.
alter table public.shadow_commerce_events
  add column if not exists amazon_condition text,
  add column if not exists noon_condition text,
  add column if not exists category_mismatch boolean not null default false;

comment on column public.shadow_commerce_events.amazon_condition is
  'NEW | RENEWED | USED | UNKNOWN, from condition.ts''s classifyCondition() applied to the Amazon offer''s own raw title. Null when no Amazon offer existed to evaluate.';
comment on column public.shadow_commerce_events.noon_condition is
  'Same as amazon_condition, for the Noon offer.';
comment on column public.shadow_commerce_events.category_mismatch is
  'True when product-type-guard.ts''s looksLikeCategoryMismatch() flagged either offer''s title as inconsistent with the canonical category (e.g. an accessory or component sold as the main product) — the tie-break was not evaluated in this case.';
