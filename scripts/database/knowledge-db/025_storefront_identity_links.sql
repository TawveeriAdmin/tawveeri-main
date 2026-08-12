-- 025_storefront_identity_links.sql
-- Provenance ledger for the storefront identity projection (Canonical Identity
-- Convergence mission, ADR-242). Every products.canonical_product_id value the
-- projection job writes is recorded here with the evidence that justified it:
-- which listing-equality lane matched (url_exact | asin_exact), the exact matched
-- value on both sides, the TPS normalized observation that carries the identity,
-- the identity key and its tier, and the rule version. This is what makes the
-- projection auditable, drift-detectable, and reversible:
--   rollback = set products.canonical_product_id = NULL for exactly the
--   product_ids this table names, where the current value still equals what we
--   wrote, then mark the rows rolled_back. No other writer is touched.
--
-- The projection NEVER merges or edits canonical_products (ADR-176 territory is
-- untouched); it only binds a storefront listing row to the canonical the TPS
-- engine already assigned to that same listing (same store + same listing URL /
-- same ASIN). Master Book Appendix B "دليل يُولَّد ولا يُنشَر" names the failure
-- class this table exists to prevent: a nullable FK populated with no record of
-- why.
--
-- Owner-applied (DDL over the direct/pooler connection). Kept here for version
-- control, same convention as 006/008/022.

create table if not exists public.storefront_identity_links (
  id bigint generated always as identity primary key,
  product_id uuid not null,
  canonical_product_id uuid not null,
  store_id int,
  evidence_class text not null check (evidence_class in ('url_exact','asin_exact')),
  -- The normalized value that matched on BOTH sides (normalized URL or ASIN).
  matched_value text not null,
  -- The storefront offer URL as stored (pre-normalization), for audit.
  storefront_url text,
  -- The TPS normalized observation whose identity this link inherits.
  tps_npo_id uuid,
  tps_identity_key text,
  identity_key_status text,
  rule_version text not null,
  status text not null default 'active' check (status in ('active','drift','rolled_back')),
  linked_at timestamptz not null default now(),
  drift_detected_at timestamptz,
  note text
);

-- One ACTIVE link per storefront product. History (drift / rolled_back) may accumulate.
create unique index if not exists storefront_identity_links_active_product_uidx
  on public.storefront_identity_links (product_id) where status = 'active';
create index if not exists storefront_identity_links_canonical_idx
  on public.storefront_identity_links (canonical_product_id);

-- Constitution: every table enables RLS in its schema definition; this is an
-- internal provenance ledger — no anon/authenticated access at all.
alter table public.storefront_identity_links enable row level security;
revoke all on public.storefront_identity_links from public, anon, authenticated;
grant select, insert, update on public.storefront_identity_links to service_role;
