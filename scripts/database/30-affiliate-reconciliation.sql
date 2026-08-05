-- 30-affiliate-reconciliation.sql — Affiliate Reconciliation Layer (ADR-213).
-- Additive + idempotent. Matches affiliate-network-reported conversions (Amazon Associates
-- Earnings/Orders report today; any future retailer export via the same shape) against our
-- own outbound_clicks.sub_id. RLS enabled with NO anon/authenticated policies → service-role
-- (server) only, same convention as usage_events (22-usage-events.sql).
-- Design/contract: docs/AFFILIATE_RECONCILIATION_CONTRACT.md.

create table if not exists affiliate_reports (
  id               uuid primary key default gen_random_uuid(),
  source           text not null,              -- e.g. 'amazon_associates'
  report_period_start date,
  report_period_end   date,
  file_checksum    text not null,              -- sha256 of the uploaded file; dedupes re-uploads
  original_filename text,
  column_mapping   jsonb not null,             -- { trackingId: 'Tracking ID', asin: 'ASIN', ... }
  row_count        integer not null default 0,
  imported_rows    integer not null default 0,
  rejected_rows    integer not null default 0,
  uploaded_by      uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  unique (source, file_checksum)
);

create table if not exists affiliate_conversions (
  id               uuid primary key default gen_random_uuid(),
  report_id        uuid not null references affiliate_reports(id) on delete cascade,
  source           text not null,
  tracking_id_raw  text,                       -- report's own tracking/sub-tag column, verbatim
  sub_id           text,                       -- parsed candidate match against outbound_clicks.sub_id
  asin_or_sku      text,
  item_name        text,
  order_date       date,
  ship_date        date,
  quantity         integer,
  price            numeric(12,2),
  commission_amount numeric(12,2),
  currency         text default 'SAR',
  state            text not null,              -- ORDERED | SHIPPED | CANCELLED | RETURNED |
                                                -- COMMISSION_PENDING | COMMISSION_CONFIRMED | PAID
  match_tier       text not null default 'UNMATCHED', -- EXACT | PROBABLE | AGGREGATE_ONLY | UNMATCHED
  matched_click_id bigint,                     -- references outbound_clicks(id) when EXACT/PROBABLE
  created_at       timestamptz not null default now()
);

alter table affiliate_reports enable row level security;
alter table affiliate_conversions enable row level security;
-- (No policies created on purpose: only the service role — the server — may read/write.)

create index if not exists affiliate_reports_source_idx on affiliate_reports (source, created_at desc);
create index if not exists affiliate_conversions_report_idx on affiliate_conversions (report_id);
create index if not exists affiliate_conversions_subid_idx on affiliate_conversions (sub_id);
create index if not exists affiliate_conversions_tier_idx on affiliate_conversions (match_tier);
create index if not exists affiliate_conversions_state_idx on affiliate_conversions (state);
