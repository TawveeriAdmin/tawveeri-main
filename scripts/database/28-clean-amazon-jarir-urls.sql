-- Migration 28 — Outbound URL repair for Amazon + Jarir (Founder Directive 2026-07-27).
-- Fixes two CONFIRMED outbound-quality defects in product_stores so every stored link opens the
-- exact matching LIVE product on the Saudi storefront. READ-VERIFIED before writing:
--   * Amazon: 2004/2005 rows already carry /dp/<ASIN> but are bloated with stale search-referral
--     params (keywords=, sr=, dib=, qid=). Collapse to the canonical /dp/<ASIN>?tag=tawveeri-21 —
--     always resolves, drops the stale search context, preserves the affiliate tag.
--   * Jarir: 692/3959 rows point to NON-Saudi GCC markets (qa/ae/bh/kw) → wrong price/availability
--     for KSA. Jarir shares the product slug + SKU across markets (only the prefix + price differ);
--     the sa-en page resolves to the exact same product at the KSA price (verified live on 3 SKUs).
--     Rewrite the market prefix to sa-en, preserving the path + ?childSku (exact variant).
-- Idempotent: re-running is a no-op (guarded by the WHERE clauses / already-canonical forms).

BEGIN;

-- ── Amazon: canonicalize to /dp/<ASIN>?tag=tawveeri-21 ────────────────────────────────
UPDATE public.product_stores ps
SET product_url = 'https://www.amazon.sa/dp/' || m.asin || '?tag=tawveeri-21',
    updated_at = now()
FROM (
  SELECT id, upper((regexp_match(product_url, '/(?:dp|gp/product)/([A-Z0-9]{10})', 'i'))[1]) AS asin
  FROM public.product_stores
  WHERE store_id = 2
    AND product_url ~* '/(?:dp|gp/product)/[A-Z0-9]{10}'
) m
WHERE ps.id = m.id
  AND m.asin IS NOT NULL
  AND ps.product_url <> 'https://www.amazon.sa/dp/' || m.asin || '?tag=tawveeri-21';

-- ── Jarir: normalize non-Saudi GCC market → sa-en (keep path + childSku) ───────────────
UPDATE public.product_stores ps
SET product_url = 'https://www.jarir.com/sa-en/' || j.rest
                  || CASE WHEN j.child_sku IS NOT NULL THEN '?childSku=' || j.child_sku ELSE '' END,
    updated_at = now()
FROM (
  SELECT id,
         (regexp_match(product_url, 'jarir\.com/[a-z]{2}-[a-z]{2}/([^?#]+)', 'i'))[1] AS rest,
         (regexp_match(product_url, '[?&]childSku=([0-9]+)'))[1] AS child_sku
  FROM public.product_stores
  WHERE store_id = 1
    AND product_url ~* 'jarir\.com/(qa|ae|bh|kw)-[a-z]{2}/'
) j
WHERE ps.id = j.id
  AND j.rest IS NOT NULL;

COMMIT;
