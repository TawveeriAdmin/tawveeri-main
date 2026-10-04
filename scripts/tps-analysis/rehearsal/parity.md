# Rehearsal replica — PARITY REPORT

Generated 2026-10-04T03:18:16.770Z by `parity.ts` (production read-only; local = PostgreSQL embedded 17.6 + PostgREST v13.0.8, `db-max-rows=1000`).
Source catalog: PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 13.2.0, 64-bit

## 1. Catalog parity (local vs production, live comparison)

| Object class | Production | Local | Result |
|---|---:|---:|---|
| Tables (replicated set) | 13 | 13 | MATCH |
| Columns (name, type, NOT NULL, identity, default) | 181 | 181 | MATCH |
| PK / UNIQUE / CHECK constraints | 19 | 19 | MATCH |
| Indexes (incl. constraint-backing; full indexdef) | 49 | 49 | MATCH |
| Foreign keys (all, incl. to non-replicated tables) | 13 | 9 | KEPT 9/13 (see §3) |
| Functions on the write path (write_ac_batch) — name + md5(pg_get_functiondef) | 1 | 1 | MATCH |
| RLS enabled per table | 13 | 13 | MATCH (no policies replicated — see §4) |

`select proname from pg_proc` (public) — production (filtered to replicated functions): **write_ac_batch**; local (entire public schema): **write_ac_batch**.

### Foreign keys present in production but not local (deliberate, §3)

- `price_history|price_history_raw_observation_id_fkey`
- `price_history|price_history_scraping_run_id_fkey`
- `product_matches|product_matches_identity_resolution_event_id_fkey`
- `raw_observations|raw_observations_scraping_run_id_fkey`

## 2. Replicated objects

| Table | Columns | Prod rows (estimate) | Local rows loaded | Scope |
|---|---:|---:|---:|---|
| `stores` | 21 | -1 | 24 | all rows |
| `canonical_products` | 16 | 21224 | 21225 | all rows |
| `normalized_product_observations` | 24 | 788317 | 164341 | canonicals of categories [mobile, tv] only |
| `product_matches` | 8 | 9927 | 1860 | canonicals of categories [mobile, tv] only |
| `price_history` | 14 | 285350 | 41925 | canonicals of categories [mobile, tv] only |
| `raw_observations` | 18 | 3158872 | 106385 | last 3 days per TPS store (cap 60000/store) |
| `tps_identity_staging` | 12 | 1394817 | 0 | EMPTY (hot path never reads it) |
| `tps_current_offers` | 12 | 10968 | 10968 | all rows |
| `tps_progress_cursors` | 4 | 34 | 34 | all rows |
| `tps_price_implausibility_signals` | 7 | 249 | 249 | all rows |
| `tps_offer_delist_signals` | 7 | 13 | 13 | all rows |
| `tps_product_projection` | 26 | 9405 | 9405 | all rows |
| `samsung_official_url_baseline` | 12 | 3189 | 3189 | all rows |

Functions copied verbatim (`pg_get_functiondef`): `write_ac_batch(jsonb,jsonb,jsonb,jsonb,uuid[])`.

Constraints (19): `canonical_products.canonical_products_pkey`, `canonical_products.canonical_products_data_quality_score_check`, `canonical_products.canonical_products_identity_confidence_check`, `normalized_product_observations.normalized_product_observations_pkey`, `normalized_product_observations.normalized_product_observations_confidence_check`, `normalized_product_observations.normalized_product_observations_identity_key_status_check`, `price_history.price_history_pkey`, `product_matches.product_matches_pkey`, `raw_observations.raw_observations_pkey`, `raw_observations.raw_observations_processing_status_check`, `samsung_official_url_baseline.samsung_official_url_baseline_pkey`, `stores.stores_pkey`, `tps_current_offers.tps_current_offers_pkey`, `tps_identity_staging.tps_identity_staging_pkey`, `tps_offer_delist_signals.tps_offer_delist_signals_pkey`, `tps_price_implausibility_signals.tps_price_implausibility_signals_pkey`, `tps_product_projection.tps_product_projection_pkey`, `tps_product_projection.tps_product_projection_tps_identity_key_key`, `tps_progress_cursors.tps_progress_cursors_pkey`

Indexes (non-constraint, created post-load, 35): `canonical_products_brand_model_number_idx`, `canonical_products_tps_identity_key_uidx`, `idx_canonical_products_model_number`, `idx_canonical_products_name_brand_unique`, `idx_canonical_products_variant_key`, `idx_cp_tps_identity_key`, `idx_npo_canonical`, `idx_npo_category_confidence`, `idx_npo_identity_key`, `idx_npo_observed_at`, `idx_npo_payload`, `idx_npo_payload_url`, `idx_npo_source`, `idx_price_history_product_store`, `idx_price_history_product_time`, `idx_price_history_scraping_run`, `idx_price_history_store_name`, `price_history_canonical_product_id_observed_at_idx`, `idx_pm_resolution_event`, `product_matches_canonical_product_id_idx`, `product_matches_raw_canonical_uidx`, `idx_raw_obs_external_id`, `idx_raw_obs_payload_hash_unique`, `idx_raw_obs_processing_status`, `idx_raw_obs_scraper_run`, `raw_observations_store_id_id_idx`, `raw_observations_store_name_scraped_at_idx`, `samsung_official_url_baseline_identity_idx`, `samsung_official_url_baseline_lifecycle_idx`, `tps_current_offers_key_idx`, `idx_tps_staging_cat_key`, `idx_tps_proj_brand`, `idx_tps_proj_category`, `idx_tps_proj_has_comparison`, `idx_tps_proj_lowest_price`

Sequences recreated: `stores_id_seq`; identity columns keep GENERATED ALWAYS AS IDENTITY (loaded with OVERRIDING SYSTEM VALUE, sequences re-seeded to max+1).

## 3. Foreign keys

| Table | Constraint | Kept locally | Reason if dropped |
|---|---|---|---|
| `normalized_product_observations` | `normalized_product_observations_canonical_product_id_fkey` | yes |  |
| `price_history` | `price_history_canonical_product_id_fkey` | yes |  |
| `price_history` | `price_history_raw_observation_id_fkey` | NO | raw_observations is a 3-day sample; copied price_history rows reference older raw rows (engine writes NULL here) |
| `price_history` | `price_history_scraping_run_id_fkey` | NO | references scraping_runs, not replicated |
| `price_history` | `price_history_store_id_fkey` | yes |  |
| `product_matches` | `product_matches_canonical_product_id_fkey` | yes |  |
| `product_matches` | `product_matches_identity_resolution_event_id_fkey` | NO | references identity_resolution_events, not replicated |
| `product_matches` | `product_matches_raw_observation_id_fkey` | yes |  |
| `raw_observations` | `raw_observations_scraping_run_id_fkey` | NO | references scraping_runs, not replicated |
| `raw_observations` | `raw_observations_store_id_fkey` | yes |  |
| `tps_offer_delist_signals` | `tps_offer_delist_signals_canonical_product_id_fkey` | yes |  |
| `tps_price_implausibility_signals` | `tps_price_implausibility_signals_canonical_product_id_fkey` | yes |  |
| `tps_product_projection` | `tps_product_projection_canonical_id_fkey` | yes |  |

## 4. Deliberate omissions and deviations

- RLS **policies** and per-role GRANTs other than `service_role ALL` are not replicated (RLS is ENABLED on every replicated table; `service_role` has BYPASSRLS like Supabase; `anon`/`authenticated` have no table grants). The engine only uses the service-role key.
- Extensions (pg_cron, pgmq/vector, pg_net, supabase_vault, pg_trgm, ...) are not installed; none of the replicated tables use them (no triggers, no vector/trgm columns — verified from the catalog).
- Database collation is `C` (initdb --locale=C); production uses the Supabase default. Affects only text ORDER BY on non-ASCII data; the engine's keyset reads order by integer/uuid keys.
- Postgres durability settings are relaxed (fsync=off, synchronous_commit=off, full_page_writes=off) — disposable instance. Time zone forced to UTC to match production.
- PostgREST v13.0.8 (Windows build) with `db-max-rows=1000`, `db-pool=10`, role statement timeouts copied from production (authenticator 30s, anon/authenticated/service_role 20s). Production's exact PostgREST/Supabase gateway version is not queryable from SQL; supabase-js reaches it through a 40-line reverse proxy that strips `/rest/v1` (see proxy.cjs).
- `tps_identity_staging` is EMPTY. The sweep still WRITES to it (`normalizeSweep` upserts staging rows) and the trailing gap re-scan reads it (`.in('raw_obs_id', ids)`); both are exercised against the empty table.
- Sampling bounds: normalized_product_observations / product_matches / price_history only for sampled categories; raw_observations only the recent window. Engine behaviour for OTHER categories' existing canonicals (their history rows are absent) is exercised for the canonical/current-offer write paths only.

| Kind | Object | Detail |
|---|---|---|
| foreign key | `price_history.price_history_raw_observation_id_fkey` | FOREIGN KEY (raw_observation_id) REFERENCES raw_observations(id) ON DELETE SET NULL — raw_observations is a 3-day sample; copied price_history rows reference older raw rows (engine writes NULL here) |
| foreign key | `price_history.price_history_scraping_run_id_fkey` | FOREIGN KEY (scraping_run_id) REFERENCES scraping_runs(id) ON DELETE SET NULL — references scraping_runs, not replicated |
| foreign key | `product_matches.product_matches_identity_resolution_event_id_fkey` | FOREIGN KEY (identity_resolution_event_id) REFERENCES identity_resolution_events(id) — references identity_resolution_events, not replicated |
| foreign key | `raw_observations.raw_observations_scraping_run_id_fkey` | FOREIGN KEY (scraping_run_id) REFERENCES scraping_runs(id) ON DELETE SET NULL — references scraping_runs, not replicated |
| inbound FK / dependent table | `outbound_clicks` | outbound_clicks_canonical_product_id_fkey: FOREIGN KEY (canonical_product_id) REFERENCES canonical_products(id) (table not replicated) |
| inbound FK / dependent table | `product_stores` | product_stores_store_id_fkey: FOREIGN KEY (store_id) REFERENCES stores(id) (table not replicated) |
| inbound FK / dependent table | `product_links` | product_links_primary_product_id_fkey: FOREIGN KEY (primary_product_id) REFERENCES canonical_products(id) (table not replicated) |
| inbound FK / dependent table | `product_links` | product_links_linked_product_id_fkey: FOREIGN KEY (linked_product_id) REFERENCES canonical_products(id) (table not replicated) |
| inbound FK / dependent table | `extracted_facts` | extracted_facts_raw_observation_id_fkey: FOREIGN KEY (raw_observation_id) REFERENCES raw_observations(id) ON DELETE CASCADE (table not replicated) |
| inbound FK / dependent table | `scraping_runs` | scraping_runs_store_id_fkey: FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL (table not replicated) |
| inbound FK / dependent table | `scraping_schedules` | scraping_schedules_store_id_fkey: FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE (table not replicated) |
| inbound FK / dependent table | `products` | products_canonical_product_id_fkey: FOREIGN KEY (canonical_product_id) REFERENCES canonical_products(id) ON DELETE SET NULL (table not replicated) |
| inbound FK / dependent table | `identity_resolution_events` | identity_resolution_events_canonical_product_id_fkey: FOREIGN KEY (canonical_product_id) REFERENCES canonical_products(id) ON DELETE SET NULL (table not replicated) |
| inbound FK / dependent table | `parser_improvement_queue` | parser_improvement_queue_observation_id_fkey: FOREIGN KEY (observation_id) REFERENCES normalized_product_observations(id) (table not replicated) |
| inbound FK / dependent table | `store_sync_status` | store_sync_status_store_id_fkey: FOREIGN KEY (store_id) REFERENCES stores(id) (table not replicated) |
| inbound FK / dependent table | `store_name_resolution` | store_name_resolution_store_id_fkey: FOREIGN KEY (store_id) REFERENCES stores(id) (table not replicated) |
| inbound FK / dependent table | `store_reviews` | store_reviews_store_id_fkey: FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE (table not replicated) |
| inbound FK / dependent table | `coupons` | coupons_store_id_fkey: FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE (table not replicated) |
| function (not copied) | `get_category_coverage_matrix()` | references replicated tables but is not on the engine write path (runSweepUnit only calls write_ac_batch) |
| function (not copied) | `get_tps_active_store_counts()` | references replicated tables but is not on the engine write path (runSweepUnit only calls write_ac_batch) |
| function (not copied) | `smart_search(text,numeric,integer)` | references replicated tables but is not on the engine write path (runSweepUnit only calls write_ac_batch) |
| function (not copied) | `write_mobile_batch(jsonb,jsonb,jsonb,jsonb,uuid[])` | references replicated tables but is not on the engine write path (runSweepUnit only calls write_ac_batch) |

## 5. Load details

- local database size after load: 390 MiB

| TPS store id | raw rows copied | min id | max id | capped | cursor set to |
|---:|---:|---:|---:|---|---:|
| 1 | 166 | 3152031 | 3242636 | no | 3152030 |
| 2 | 2002 | 3151736 | 3242626 | no | 3151735 |
| 3 | 202 | 3151928 | 3242195 | no | 3151927 |
| 4 | 4512 | 3151729 | 3242565 | no | 3151728 |
| 5 | 42690 | 3153575 | 3247688 | no | 3153574 |
| 6 | 18892 | 3151817 | 3244183 | no | 3151816 |
| 7 | 5280 | 3157728 | 3248168 | no | 3157727 |
| 8 | 1 | 1231249 | 1231249 | no | 1231248 |
| 9 | 5923 | 3158208 | 3248707 | no | 3158207 |
| 10 | 4846 | 3165085 | 3250377 | no | 3165084 |
| 11 | 772 | 189220 | 189991 | no | 189219 |
| 12 | 390 | 188829 | 189218 | no | 188828 |
| 13 | 1341 | 187487 | 188827 | no | 187486 |
| 14 | 796 | 189993 | 190788 | no | 189992 |
| 15 | 796 | 190790 | 191585 | no | 190789 |
| 16 | 235 | 238761 | 238995 | no | 238760 |
| 17 | 223 | 243567 | 243789 | no | 243566 |
| 18 | 11729 | 3163915 | 3249882 | no | 3163914 |
| 19 | 459 | 248972 | 249430 | no | 248971 |
| 20 | 238 | 258700 | 258937 | no | 258699 |
| 21 | 538 | 258939 | 259476 | no | 258938 |
| 22 | 399 | 301784 | 302182 | no | 301783 |
| 23 | 2586 | 3151550 | 3241535 | no | 3151549 |
| 24 | 1369 | 429772 | 649856 | no | 429771 |
