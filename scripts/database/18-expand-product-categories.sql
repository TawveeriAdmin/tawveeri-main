-- Migration 18: Extend product_category enum to cover "all electronics"
-- PostgreSQL requires each ADDVALUE to be its own statement outside a
-- transaction block — if running inside a migration runner wrapped in BEGIN,
-- split these across separate runs.

ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'monitor';
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'printer';
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'networking';
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'smart_home';
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'wearable';
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'appliance';
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'kitchen';
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'personal_care';
