-- 037_offer_identity_signals.sql · ADR-403 identity gate (2026-10-04)
-- A (canonical, store) listing that the identity verifier will NOT let stand as "the same
-- purchasable item" as the rest of its canonical's listings. Verdicts are per listing:
--   reject — the listing conflicts with the group on a stated attribute (network, RAM, size,
--            model code…) or is refurbished in a new-item group: it is a different item and
--            must not count, price or rank in this canonical's comparison;
--   review — a known unknown (region tag on one side, colour-code suffix, code on one side only,
--            unresolved conflict, all-refurbished group): it may be shown as a reference row but
--            never backs a "cheapest" claim or a store count.
-- A match leaves NO row — absence of a signal is "verified or ungated".
--
-- Written ONLY by scripts/tps-core/build-identity-signals.ts, and only for categories enabled by
-- the TPS_IDENTITY_GATE / TPS_IDENTITY_V2 flags (default OFF: with the flags unset the job writes
-- nothing and the table need not even exist). Fully derived: the job recomputes every enabled
-- category's rows each cycle and deletes rows that no longer hold (self-healing, like
-- tps_offer_delist_signals / tps_price_implausibility_signals), and deletes every row of a category
-- whose flag was turned off — that deletion IS the read-path rollback.
-- Read by every surface that groups listings (projection builder, live search, v1 TPS search,
-- UCP feed, mobile product comparison) as an exclusion, exactly like the two signal tables above.
create table if not exists tps_offer_identity_signals (
  canonical_product_id uuid not null references canonical_products(id) on delete cascade,
  store_id             integer not null,
  store_slug           text,
  store_display_name   text,
  category             text not null,
  verdict              text not null check (verdict in ('review', 'reject')),
  reasons              text[] not null default '{}',
  listing_name         text,
  rules_version        text not null,
  computed_at          timestamptz not null default now(),
  primary key (canonical_product_id, store_id)
);

create index if not exists tps_offer_identity_signals_category_idx on tps_offer_identity_signals (category);

alter table tps_offer_identity_signals enable row level security;
-- Service-role only (bypasses RLS). Customer-facing roles are never granted this table.
revoke all on tps_offer_identity_signals from anon, authenticated;
