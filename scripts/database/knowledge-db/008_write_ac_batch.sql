-- 008_write_ac_batch.sql
-- Atomic AC persistence RPC (E6 / ADR-023). Category-specific mirror of the
-- verified write_mobile_batch, using existing schema only. Single transaction:
--   canonical_products  — upsert by deterministic id
--   normalized_product_observations — upsert by deterministic id
--   product_matches — delete only for the batch's canonical ids, then insert
--   price_history — append (matcher pre-filters to changed prices; append-only)
-- Isolation: touches only rows for p_canonical_ids. Atomicity verified by an
-- intentional rollback test (bad price -> whole tx rolls back, 0 residue).
-- Permissions: service_role/postgres only; anon/authenticated cannot execute.
-- NOTE: ac_identity_state and conflict_review do NOT exist in this DB; a future
-- version may add identity_resolution_events append + those tables once created.
-- Owner-applied (DDL). Kept here for version control; the live function was
-- created directly over the direct connection.

create or replace function public.write_ac_batch(
  p_canonical jsonb, p_normalized jsonb, p_matches jsonb, p_prices jsonb, p_canonical_ids uuid[]
) returns jsonb language plpgsql security invoker as $fn$
declare v_c int:=0; v_n int:=0; v_m int:=0; v_p int:=0;
begin
  insert into canonical_products (id,name_ar,name_en,brand,model_number,category,image_url,attributes,is_active,created_at,data_quality_score,identity_confidence,variant_key,data_updated_at,tps_identity_key,tps_version)
  select (r->>'id')::uuid, r->>'name_ar', r->>'name_en', r->>'brand', r->>'model_number', r->>'category', r->>'image_url', r->'attributes',
    (r->>'is_active')::boolean, (r->>'created_at')::timestamptz, (r->>'data_quality_score')::smallint, (r->>'identity_confidence')::smallint,
    r->>'variant_key', (r->>'data_updated_at')::timestamptz, r->>'tps_identity_key', r->>'tps_version'
  from jsonb_array_elements(p_canonical) r
  on conflict (id) do update set name_ar=excluded.name_ar,name_en=excluded.name_en,brand=excluded.brand,category=excluded.category,
    image_url=excluded.image_url,attributes=excluded.attributes,is_active=excluded.is_active,data_quality_score=excluded.data_quality_score,
    identity_confidence=excluded.identity_confidence,variant_key=excluded.variant_key,data_updated_at=excluded.data_updated_at,
    tps_identity_key=excluded.tps_identity_key,tps_version=excluded.tps_version;
  get diagnostics v_c=row_count;

  insert into normalized_product_observations (id,source_table,source_record_id,store_id,canonical_product_id,raw_name,detected_category,language,brand,model_number,color,identity_key,identity_key_status,normalized_payload,confidence,missing_critical,ambiguity_flags,needs_llm,ignored_terms,normalizer_version,tps_version,observed_at,plugin_version)
  select (r->>'id')::uuid, r->>'source_table', (r->>'source_record_id')::uuid, r->>'store_id', (r->>'canonical_product_id')::uuid, r->>'raw_name',
    r->>'detected_category', r->>'language', r->>'brand', r->>'model_number', r->>'color', r->>'identity_key', r->>'identity_key_status', r->'normalized_payload', (r->>'confidence')::int,
    array(select jsonb_array_elements_text(r->'missing_critical')), array(select jsonb_array_elements_text(r->'ambiguity_flags')), (r->>'needs_llm')::boolean,
    array(select jsonb_array_elements_text(r->'ignored_terms')), r->>'normalizer_version', r->>'tps_version', (r->>'observed_at')::timestamptz, r->>'plugin_version'
  from jsonb_array_elements(p_normalized) r
  on conflict (id) do update set canonical_product_id=excluded.canonical_product_id,identity_key=excluded.identity_key,identity_key_status=excluded.identity_key_status,
    normalized_payload=excluded.normalized_payload,confidence=excluded.confidence,color=excluded.color,observed_at=excluded.observed_at;
  get diagnostics v_n=row_count;

  delete from product_matches where canonical_product_id = any(p_canonical_ids);
  insert into product_matches (raw_observation_id,canonical_product_id,match_method,confidence,is_verified,matched_at,identity_resolution_event_id)
  select (r->>'raw_observation_id')::uuid, (r->>'canonical_product_id')::uuid, r->>'match_method', (r->>'confidence')::smallint, (r->>'is_verified')::boolean, (r->>'matched_at')::timestamptz,
    case when r->>'identity_resolution_event_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (r->>'identity_resolution_event_id')::uuid else null end
  from jsonb_array_elements(p_matches) r;
  get diagnostics v_m=row_count;

  insert into price_history (canonical_product_id,store_name,price,tps_observation_id,raw_observation_id,observed_at)
  select (r->>'canonical_product_id')::uuid, r->>'store_name', (r->>'price')::numeric, (r->>'tps_observation_id')::uuid, null, (r->>'observed_at')::timestamptz
  from jsonb_array_elements(p_prices) r;
  get diagnostics v_p=row_count;

  return jsonb_build_object('canonical',v_c,'normalized',v_n,'matches',v_m,'prices',v_p);
end $fn$;

revoke all on function public.write_ac_batch(jsonb,jsonb,jsonb,jsonb,uuid[]) from public, anon, authenticated;
grant execute on function public.write_ac_batch(jsonb,jsonb,jsonb,jsonb,uuid[]) to service_role;
