-- schema.generated.sql — GENERATED from the production catalog (read-only) by gen-schema.ts
-- source: PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 13.2.0, 64-bit
-- generated: 2026-10-04T03:12:05.449Z
-- Do not edit by hand; re-run `npx tsx scripts/tps-analysis/rehearsal/setup.ts` (or gen-schema.ts).

-- ===== PRE-DATA: tables, primary/unique/check constraints =====
CREATE SEQUENCE IF NOT EXISTS public."stores_id_seq";
CREATE TABLE public."stores" (
  "id" integer DEFAULT nextval('stores_id_seq'::regclass) NOT NULL,
  "name" text NOT NULL,
  "offer" text,
  "coupon_code" text,
  "link" text,
  "category" text,
  "slug" text,
  "name_ar" text,
  "name_en" text,
  "logo_url" text,
  "website_url" text,
  "average_rating" numeric DEFAULT 0,
  "total_reviews" integer DEFAULT 0,
  "description_ar" text,
  "description_en" text,
  "delivery_info_ar" text,
  "delivery_info_en" text,
  "return_policy_ar" text,
  "return_policy_en" text,
  "warranty_info_ar" text,
  "warranty_info_en" text
);
CREATE TABLE public."canonical_products" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name_ar" text NOT NULL,
  "name_en" text,
  "brand" text,
  "model_number" text,
  "category" text,
  "image_url" text,
  "attributes" jsonb DEFAULT '{}'::jsonb,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "data_quality_score" smallint DEFAULT 0.0,
  "identity_confidence" smallint DEFAULT 0.0,
  "variant_key" text,
  "data_updated_at" timestamp with time zone,
  "tps_identity_key" text,
  "tps_version" text DEFAULT '1.0'::text
);
CREATE TABLE public."normalized_product_observations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "source_table" text NOT NULL,
  "source_record_id" uuid NOT NULL,
  "store_id" text,
  "canonical_product_id" uuid,
  "raw_name" text NOT NULL,
  "raw_payload" jsonb,
  "detected_category" text NOT NULL,
  "language" text NOT NULL,
  "brand" text,
  "model_number" text,
  "color" text,
  "identity_key" text,
  "identity_key_status" text NOT NULL,
  "normalized_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "confidence" integer NOT NULL,
  "missing_critical" text[] DEFAULT '{}'::text[] NOT NULL,
  "ambiguity_flags" text[] DEFAULT '{}'::text[] NOT NULL,
  "needs_llm" boolean DEFAULT false NOT NULL,
  "ignored_terms" text[] DEFAULT '{}'::text[] NOT NULL,
  "normalizer_version" text NOT NULL,
  "tps_version" text DEFAULT '1.0'::text NOT NULL,
  "observed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "plugin_version" text
);
CREATE TABLE public."product_matches" (
  "id" bigint GENERATED ALWAYS AS IDENTITY,
  "raw_observation_id" uuid,
  "canonical_product_id" uuid,
  "match_method" text NOT NULL,
  "confidence" smallint NOT NULL,
  "is_verified" boolean DEFAULT false,
  "matched_at" timestamp with time zone DEFAULT now(),
  "identity_resolution_event_id" uuid
);
CREATE TABLE public."price_history" (
  "id" bigint GENERATED ALWAYS AS IDENTITY,
  "canonical_product_id" uuid,
  "store_name" text NOT NULL,
  "price" numeric(12,2) NOT NULL,
  "original_price" numeric(12,2),
  "coupon_code" text,
  "effective_price" numeric(12,2),
  "availability" text,
  "observed_at" timestamp with time zone DEFAULT now(),
  "product_store_id" text,
  "scraping_run_id" bigint,
  "raw_observation_id" bigint,
  "tps_observation_id" uuid,
  "store_id" integer
);
CREATE TABLE public."raw_observations" (
  "id" bigint GENERATED ALWAYS AS IDENTITY,
  "store_name" text NOT NULL,
  "source_method" text DEFAULT 'scraper'::text,
  "raw_name" text NOT NULL,
  "raw_url" text,
  "price" numeric(12,2),
  "original_price" numeric(12,2),
  "availability" text,
  "coupon_code" text,
  "payload" jsonb,
  "scraped_at" timestamp with time zone DEFAULT now(),
  "scraping_run_id" bigint,
  "external_product_id" text,
  "payload_hash" text,
  "parser_version" text DEFAULT '1.0'::text NOT NULL,
  "processing_status" text DEFAULT 'pending'::text,
  "processing_error" text,
  "store_id" integer
);
CREATE TABLE public."tps_identity_staging" (
  "category" text NOT NULL,
  "raw_obs_id" bigint NOT NULL,
  "store_id" integer,
  "identity_key" text,
  "status" text,
  "price" numeric,
  "url" text,
  "name" text,
  "confidence" integer,
  "detected" boolean DEFAULT true NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."tps_current_offers" (
  "category" text NOT NULL,
  "identity_key" text NOT NULL,
  "store_id" integer NOT NULL,
  "raw_obs_id" bigint NOT NULL,
  "status" text NOT NULL,
  "price" numeric,
  "url" text,
  "name" text,
  "confidence" integer,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "observed_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."tps_progress_cursors" (
  "category" text NOT NULL,
  "store_id" integer NOT NULL,
  "last_raw_id" bigint DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."tps_price_implausibility_signals" (
  "canonical_product_id" uuid NOT NULL,
  "store_display_name" text NOT NULL,
  "observed_price" numeric NOT NULL,
  "plausible_floor" numeric NOT NULL,
  "reason" text NOT NULL,
  "detected_at" timestamp with time zone DEFAULT now() NOT NULL,
  "source" text DEFAULT 'price-plausibility-scan'::text NOT NULL
);
CREATE TABLE public."tps_offer_delist_signals" (
  "canonical_product_id" uuid NOT NULL,
  "store_slug" text NOT NULL,
  "store_display_name" text NOT NULL,
  "url" text NOT NULL,
  "status_code" integer NOT NULL,
  "observed_gone_at" timestamp with time zone DEFAULT now() NOT NULL,
  "source" text DEFAULT 'reobserve-comparables'::text NOT NULL
);
CREATE TABLE public."tps_product_projection" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "canonical_id" uuid NOT NULL,
  "tps_identity_key" text NOT NULL,
  "display_name_ar" text,
  "display_name_en" text,
  "brand" text,
  "category" text,
  "lowest_price" numeric(10,2),
  "highest_price" numeric(10,2),
  "saving" numeric(10,2),
  "cheapest_store" text,
  "store_count" smallint DEFAULT 0,
  "compare_url" text,
  "has_comparison" boolean DEFAULT false,
  "image_url" text,
  "identity_confidence" smallint DEFAULT 0,
  "built_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "text_for_search" text,
  "affiliate_best_url" text,
  "price_spread_pct" numeric(5,2),
  "algolia_synced_at" timestamp with time zone,
  "click_count" integer DEFAULT 0,
  "compare_count" integer DEFAULT 0,
  "model_number" text,
  "last_observed_at" timestamp with time zone
);
CREATE TABLE public."samsung_official_url_baseline" (
  "official_url" text NOT NULL,
  "model_code" text,
  "identity_key" text,
  "category" text,
  "classification" text NOT NULL,
  "lifecycle_state" text DEFAULT 'CURRENT'::text NOT NULL,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_validated_at" timestamp with time zone,
  "consecutive_misses" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public."canonical_products" ADD CONSTRAINT "canonical_products_pkey" PRIMARY KEY (id);
ALTER TABLE public."canonical_products" ADD CONSTRAINT "canonical_products_data_quality_score_check" CHECK (((data_quality_score >= 0) AND (data_quality_score <= 100)));
ALTER TABLE public."canonical_products" ADD CONSTRAINT "canonical_products_identity_confidence_check" CHECK (((identity_confidence >= 0) AND (identity_confidence <= 100)));
ALTER TABLE public."normalized_product_observations" ADD CONSTRAINT "normalized_product_observations_pkey" PRIMARY KEY (id);
ALTER TABLE public."normalized_product_observations" ADD CONSTRAINT "normalized_product_observations_confidence_check" CHECK (((confidence >= 0) AND (confidence <= 100)));
ALTER TABLE public."normalized_product_observations" ADD CONSTRAINT "normalized_product_observations_identity_key_status_check" CHECK ((identity_key_status = ANY (ARRAY['valid'::text, 'low_confidence_candidate'::text, 'invalid'::text])));
ALTER TABLE public."price_history" ADD CONSTRAINT "price_history_pkey" PRIMARY KEY (id);
ALTER TABLE public."product_matches" ADD CONSTRAINT "product_matches_pkey" PRIMARY KEY (id);
ALTER TABLE public."raw_observations" ADD CONSTRAINT "raw_observations_pkey" PRIMARY KEY (id);
ALTER TABLE public."raw_observations" ADD CONSTRAINT "raw_observations_processing_status_check" CHECK ((processing_status = ANY (ARRAY['pending'::text, 'processing'::text, 'done'::text, 'failed'::text, 'skipped'::text])));
ALTER TABLE public."samsung_official_url_baseline" ADD CONSTRAINT "samsung_official_url_baseline_pkey" PRIMARY KEY (official_url);
ALTER TABLE public."stores" ADD CONSTRAINT "stores_pkey" PRIMARY KEY (id);
ALTER TABLE public."tps_current_offers" ADD CONSTRAINT "tps_current_offers_pkey" PRIMARY KEY (category, identity_key, store_id);
ALTER TABLE public."tps_identity_staging" ADD CONSTRAINT "tps_identity_staging_pkey" PRIMARY KEY (category, raw_obs_id);
ALTER TABLE public."tps_offer_delist_signals" ADD CONSTRAINT "tps_offer_delist_signals_pkey" PRIMARY KEY (canonical_product_id, store_slug);
ALTER TABLE public."tps_price_implausibility_signals" ADD CONSTRAINT "tps_price_implausibility_signals_pkey" PRIMARY KEY (canonical_product_id, store_display_name);
ALTER TABLE public."tps_product_projection" ADD CONSTRAINT "tps_product_projection_pkey" PRIMARY KEY (id);
ALTER TABLE public."tps_product_projection" ADD CONSTRAINT "tps_product_projection_tps_identity_key_key" UNIQUE (tps_identity_key);
ALTER TABLE public."tps_progress_cursors" ADD CONSTRAINT "tps_progress_cursors_pkey" PRIMARY KEY (category, store_id);

-- ===== FUNCTIONS =====
CREATE OR REPLACE FUNCTION public.write_ac_batch(p_canonical jsonb, p_normalized jsonb, p_matches jsonb, p_prices jsonb, p_canonical_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
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
end $function$;

-- ===== POST-DATA: sequence ownership, non-constraint indexes, foreign keys, RLS, grants =====
ALTER SEQUENCE public."stores_id_seq" OWNED BY public."stores"."id";
CREATE UNIQUE INDEX IF NOT EXISTS canonical_products_brand_model_number_idx ON public.canonical_products USING btree (brand, model_number) WHERE (model_number IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS canonical_products_tps_identity_key_uidx ON public.canonical_products USING btree (tps_identity_key) WHERE (tps_identity_key IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_canonical_products_model_number ON public.canonical_products USING btree (model_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_canonical_products_name_brand_unique ON public.canonical_products USING btree (lower(TRIM(BOTH FROM name_ar)), lower(TRIM(BOTH FROM brand)));
CREATE INDEX IF NOT EXISTS idx_canonical_products_variant_key ON public.canonical_products USING btree (variant_key);
CREATE INDEX IF NOT EXISTS idx_cp_tps_identity_key ON public.canonical_products USING btree (tps_identity_key) WHERE (tps_identity_key IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_npo_canonical ON public.normalized_product_observations USING btree (canonical_product_id) WHERE (canonical_product_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_npo_category_confidence ON public.normalized_product_observations USING btree (detected_category, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_npo_identity_key ON public.normalized_product_observations USING btree (identity_key) WHERE (identity_key_status = 'valid'::text);
CREATE INDEX IF NOT EXISTS idx_npo_observed_at ON public.normalized_product_observations USING btree (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_npo_payload ON public.normalized_product_observations USING gin (normalized_payload);
CREATE INDEX IF NOT EXISTS idx_npo_payload_url ON public.normalized_product_observations USING btree (((normalized_payload ->> '_url'::text)));
CREATE INDEX IF NOT EXISTS idx_npo_source ON public.normalized_product_observations USING btree (source_table, source_record_id);
CREATE INDEX IF NOT EXISTS idx_price_history_product_store ON public.price_history USING btree (product_store_id);
CREATE INDEX IF NOT EXISTS idx_price_history_product_time ON public.price_history USING btree (canonical_product_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_scraping_run ON public.price_history USING btree (scraping_run_id);
CREATE INDEX IF NOT EXISTS idx_price_history_store_name ON public.price_history USING btree (store_name, observed_at DESC);
CREATE INDEX IF NOT EXISTS price_history_canonical_product_id_observed_at_idx ON public.price_history USING btree (canonical_product_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_resolution_event ON public.product_matches USING btree (identity_resolution_event_id);
CREATE INDEX IF NOT EXISTS product_matches_canonical_product_id_idx ON public.product_matches USING btree (canonical_product_id);
CREATE UNIQUE INDEX IF NOT EXISTS product_matches_raw_canonical_uidx ON public.product_matches USING btree (raw_observation_id, canonical_product_id);
CREATE INDEX IF NOT EXISTS idx_raw_obs_external_id ON public.raw_observations USING btree (external_product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_obs_payload_hash_unique ON public.raw_observations USING btree (payload_hash) WHERE (payload_hash IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_raw_obs_processing_status ON public.raw_observations USING btree (processing_status);
CREATE INDEX IF NOT EXISTS idx_raw_obs_scraper_run ON public.raw_observations USING btree (scraping_run_id);
CREATE INDEX IF NOT EXISTS raw_observations_store_id_id_idx ON public.raw_observations USING btree (store_id, id);
CREATE INDEX IF NOT EXISTS raw_observations_store_name_scraped_at_idx ON public.raw_observations USING btree (store_name, scraped_at DESC);
CREATE INDEX IF NOT EXISTS samsung_official_url_baseline_identity_idx ON public.samsung_official_url_baseline USING btree (identity_key);
CREATE INDEX IF NOT EXISTS samsung_official_url_baseline_lifecycle_idx ON public.samsung_official_url_baseline USING btree (lifecycle_state);
CREATE INDEX IF NOT EXISTS tps_current_offers_key_idx ON public.tps_current_offers USING btree (category, identity_key);
CREATE INDEX IF NOT EXISTS idx_tps_staging_cat_key ON public.tps_identity_staging USING btree (category, identity_key) WHERE (identity_key IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_tps_proj_brand ON public.tps_product_projection USING btree (brand);
CREATE INDEX IF NOT EXISTS idx_tps_proj_category ON public.tps_product_projection USING btree (category);
CREATE INDEX IF NOT EXISTS idx_tps_proj_has_comparison ON public.tps_product_projection USING btree (has_comparison) WHERE (has_comparison = true);
CREATE INDEX IF NOT EXISTS idx_tps_proj_lowest_price ON public.tps_product_projection USING btree (lowest_price);
ALTER TABLE public."normalized_product_observations" ADD CONSTRAINT "normalized_product_observations_canonical_product_id_fkey" FOREIGN KEY (canonical_product_id) REFERENCES canonical_products(id) ON DELETE SET NULL;
ALTER TABLE public."price_history" ADD CONSTRAINT "price_history_canonical_product_id_fkey" FOREIGN KEY (canonical_product_id) REFERENCES canonical_products(id);
ALTER TABLE public."price_history" ADD CONSTRAINT "price_history_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id);
ALTER TABLE public."product_matches" ADD CONSTRAINT "product_matches_canonical_product_id_fkey" FOREIGN KEY (canonical_product_id) REFERENCES canonical_products(id);
ALTER TABLE public."product_matches" ADD CONSTRAINT "product_matches_raw_observation_id_fkey" FOREIGN KEY (raw_observation_id) REFERENCES normalized_product_observations(id) ON DELETE CASCADE;
ALTER TABLE public."raw_observations" ADD CONSTRAINT "raw_observations_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id);
ALTER TABLE public."tps_offer_delist_signals" ADD CONSTRAINT "tps_offer_delist_signals_canonical_product_id_fkey" FOREIGN KEY (canonical_product_id) REFERENCES canonical_products(id) ON DELETE CASCADE;
ALTER TABLE public."tps_price_implausibility_signals" ADD CONSTRAINT "tps_price_implausibility_signals_canonical_product_id_fkey" FOREIGN KEY (canonical_product_id) REFERENCES canonical_products(id) ON DELETE CASCADE;
ALTER TABLE public."tps_product_projection" ADD CONSTRAINT "tps_product_projection_canonical_id_fkey" FOREIGN KEY (canonical_id) REFERENCES canonical_products(id) ON DELETE CASCADE;
ALTER TABLE public."stores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."canonical_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."normalized_product_observations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."product_matches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."price_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."raw_observations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tps_identity_staging" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tps_current_offers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tps_progress_cursors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tps_price_implausibility_signals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tps_offer_delist_signals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tps_product_projection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."samsung_official_url_baseline" ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
