-- 030_ac_rescue_pilot_links.sql
-- Physically isolated pilot ledger for the AC Rescue Lab (ADR-319 through ADR-324).
-- Records ONLY explicitly founder-approved rescue-candidate links, kept deliberately
-- separate from:
--   - storefront_identity_links (025) — the ADR-312 exact-URL/ASIN-match ledger. That
--     table's evidence_class is CHECK-constrained to ('url_exact','asin_exact') and is
--     structurally incompatible with attribute-fingerprint-based rescue candidates
--     (ADR-322 Part 3). A query against one can never accidentally include the other.
--   - product_matches / canonical_products — this table never writes to either. It only
--     ever writes products.canonical_product_id, exactly like storefront_identity_links
--     does, through the SAME kind of optimistic-locked, single-column UPDATE.
--
-- No foreign keys to products/canonical_products — deliberate. Referential validity is
-- checked at APPLY time by application logic (a live lookup against an explicit,
-- hardcoded, founder-approved allowlist — see scripts/experiments/ac-rescue-lab/pilot/
-- ledger-logic.ts), not by a DB constraint. This keeps the ledger physically decoupled
-- from Products 2's own tables (nothing here can be pulled in by a cascade, a join, or
-- an ORM relation defined against products/canonical_products) and lets the mechanism's
-- own safety logic be exercised end-to-end against safe synthetic fixtures without ever
-- needing a row that satisfies a real FK.
--
-- rollback = set products.canonical_product_id back to before_state->>'canonical_product_id'
-- (always NULL, since every candidate audited by this lab was confirmed unlinked before
-- proposal) for exactly the amazon_product_id this row names, ONLY if the current value
-- still equals target_canonical_id (i.e. still exactly what THIS pilot wrote — never a
-- later, unrelated legitimate link), then mark the row rolled_back. No other row, no
-- other table, is touched.

create table if not exists public.ac_rescue_pilot_links (
  id bigint generated always as identity primary key,
  pilot_batch_id text not null,
  amazon_product_id uuid not null,
  target_canonical_id uuid not null,
  -- Snapshot of products.canonical_product_id at proposal time and the value apply()
  -- would write — both captured explicitly so drift is a plain equality check, not a
  -- re-derivation.
  before_state jsonb not null,
  after_state jsonb not null,
  evidence_reference text not null,
  rule_version text not null default 'ac-rescue-lab-pilot-v1',
  status text not null default 'proposed' check (status in ('proposed','active','rolled_back','drift','rejected')),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  rolled_back_at timestamptz,
  note text
);

-- At most one OPEN (proposed or active) ledger row per product — the DB-level backstop
-- behind evaluateProposal()'s own double-write check.
create unique index if not exists ac_rescue_pilot_links_open_product_uidx
  on public.ac_rescue_pilot_links (amazon_product_id) where status in ('proposed', 'active');
create index if not exists ac_rescue_pilot_links_canonical_idx
  on public.ac_rescue_pilot_links (target_canonical_id);

-- Constitution: every table enables RLS in its schema definition; this is an internal
-- provenance ledger — no anon/authenticated access at all, same convention as 025.
alter table public.ac_rescue_pilot_links enable row level security;
revoke all on public.ac_rescue_pilot_links from public, anon, authenticated;
grant select, insert, update on public.ac_rescue_pilot_links to service_role;
