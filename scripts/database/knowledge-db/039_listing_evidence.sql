-- 039_listing_evidence.sql — page-captured manufacturer-model evidence (Evidence-First closure, 2026-10-04).
-- APPEND-ONLY and DERIVED FROM PUBLIC PRODUCT PAGES. It never alters raw_observations (immutable) or any key: it is an extra evidence
-- source read ONLY by the identity evidence layer (flag TPS_IDENTITY_EVIDENCE). Dropping the table is a complete rollback.
-- One capture of a listing = one captured_at shared by all its rows; readers take the newest capture per (store_id, url).
create table if not exists tps_listing_evidence (
  id               bigint generated always as identity primary key,
  store_id         integer     not null,
  merchant         text        not null,
  url              text        not null,          -- the listing URL as stored in tps_current_offers
  fetch_url        text,
  http_status      integer,
  field            text        not null,          -- page.jsonld.mpn | page.label.manufacturer_no | page.script.modelNumber | page.table.* | page.jsonld.gtin …
  raw_value        text        not null,
  normalized_value text        not null,
  captured_at      timestamptz not null,
  unique (store_id, url, captured_at, field, normalized_value)
);
create index if not exists tps_listing_evidence_lookup on tps_listing_evidence (store_id, url, captured_at desc);
alter table tps_listing_evidence enable row level security;
-- service role only: credential-adjacent scraping provenance is never exposed to anon/authenticated.
revoke all on tps_listing_evidence from anon, authenticated;
