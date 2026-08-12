-- 027_links_prior_canonical.sql
-- Legacy re-pointing support (ADR-243). A re-pointed product's previous
-- canonical_product_id must be restorable: rollback for a re-point restores the
-- PRIOR value, never NULL. NULL prior (the convergence-v1 rows) keeps today's
-- rollback semantics (restore NULL).
alter table public.storefront_identity_links
  add column if not exists prior_canonical_product_id uuid;
