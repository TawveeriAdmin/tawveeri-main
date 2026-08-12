-- 026_price_history_store_id_stamp.sql
-- Completes ADR-004 (canonical store identity is stores.id) on the TPS price
-- write path (ADR-242 mission).
--
-- Measured 2026-08-12: 100% of TPS-written price_history rows in the last 7 days
-- (tps_observation_id NOT NULL) carry store_id = NULL — migration 006 backfilled
-- store_id once on 2026-07-20 and nothing has stamped it since, because
-- write_ac_batch's price insert never included the column. The customer-facing
-- price-history chart joins on (canonical_product_id, store_id) (ADR-241), so a
-- TPS-keyed price row without store_id is invisible to the product page.
--
-- Three parts, all idempotent:
--   1. write_ac_batch learns to stamp store_id (NULL-safe: a caller that does not
--      send it produces exactly today's behaviour).
--   2. store_name_resolution learns the labels of stores onboarded after
--      migration 006 (ids 9–24) — the Arabic TPS_STORES display names written by
--      corroboratePass into price_history.store_name, plus slugs.
--   3. The 006 backfill re-runs for price_history rows written since (store_id
--      IS NULL only — never touches a populated value).
--
-- ROLLBACK: re-apply 008_write_ac_batch.sql (the prior function body).
-- store_name remains on every row as provenance (ADR-004), so the stamp adds
-- information and drops none.

-- ── 1. write_ac_batch with store_id stamping ─────────────────────────────────
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
  from jsonb_array_elements(p_matches) r
  on conflict (raw_observation_id, canonical_product_id) do nothing;
  get diagnostics v_m=row_count;

  -- The ONE change from 008: store_id travels with the price event. NULL-safe —
  -- a price row without the field behaves exactly as before.
  insert into price_history (canonical_product_id,store_name,store_id,price,tps_observation_id,raw_observation_id,observed_at)
  select (r->>'canonical_product_id')::uuid, r->>'store_name', (r->>'store_id')::int, (r->>'price')::numeric, (r->>'tps_observation_id')::uuid, null, (r->>'observed_at')::timestamptz
  from jsonb_array_elements(p_prices) r;
  get diagnostics v_p=row_count;

  return jsonb_build_object('canonical',v_c,'normalized',v_n,'matches',v_m,'prices',v_p);
end $fn$;

revoke all on function public.write_ac_batch(jsonb,jsonb,jsonb,jsonb,uuid[]) from public, anon, authenticated;
grant execute on function public.write_ac_batch(jsonb,jsonb,jsonb,jsonb,uuid[]) to service_role;

-- ── 2. Resolution map: labels for stores onboarded after migration 006 ───────
-- The Arabic labels are the exact TPS_STORES display names corroboratePass has
-- been writing into price_history.store_name (scripts/tps-core/category-registry.ts).
INSERT INTO store_name_resolution (observed_label, store_id, note)
SELECT v.label, s.id, v.note
FROM (VALUES
  ('نجم الأجهزة',        'najm',          'TPS display name'),
  ('najm',               'najm',          'latin slug'),
  ('الصندوق الأسود',     'blackbox',      'TPS display name'),
  ('blackbox',           'blackbox',      'latin slug'),
  ('اتش دي اف',          'hdf',           'TPS display name'),
  ('hdf',                'hdf',           'latin slug'),
  ('جولدن ستور',         'goldenstore99', 'TPS display name'),
  ('goldenstore99',      'goldenstore99', 'latin slug'),
  ('محزم',               'mhzm',          'TPS display name'),
  ('mhzm',               'mhzm',          'latin slug'),
  ('التاوية',            'aletawik',      'TPS display name'),
  ('aletawik',           'aletawik',      'latin slug'),
  ('بي سي بالاس',        'pcpalace',      'TPS display name'),
  ('pcpalace',           'pcpalace',      'latin slug'),
  ('سوني وورلد',         'sonyworld',     'TPS display name'),
  ('sonyworld',          'sonyworld',     'latin slug'),
  ('امن كوم',            'amnkwm',        'TPS display name'),
  ('amnkwm',             'amnkwm',        'latin slug'),
  ('متجر النخيل',        'alnakheelk',    'TPS display name'),
  ('alnakheelk',         'alnakheelk',    'latin slug'),
  ('السفير زون',         'alsfeerzone',   'TPS display name'),
  ('alsfeerzone',        'alsfeerzone',   'latin slug'),
  ('الهويش للأجهزة',     'alhowaish',     'TPS display name'),
  ('alhowaish',          'alhowaish',     'latin slug'),
  ('الضوء البارق',       'alduaalbarq',   'TPS display name'),
  ('alduaalbarq',        'alduaalbarq',   'latin slug'),
  ('إيزي وورلد',         'eazyworld',     'TPS display name'),
  ('eazyworld',          'eazyworld',     'latin slug'),
  ('لولو هايبر ماركت',   'lulu',          'TPS display name'),
  ('lulu',               'lulu',          'latin slug'),
  ('شرف دي جي',          'sharafdg',      'TPS display name'),
  ('sharafdg',           'sharafdg',      'latin slug')
) AS v(label, slug, note)
JOIN stores s ON s.slug = v.slug
ON CONFLICT (observed_label) DO NOTHING;

-- ── 3. Re-run the 006 backfill for rows written since (idempotent) ───────────
UPDATE price_history p
   SET store_id = r.store_id
  FROM store_name_resolution r
 WHERE p.store_id IS NULL
   AND p.store_name = r.observed_label;
