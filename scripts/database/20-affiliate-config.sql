-- Affiliate configuration for store outbound links.
-- Lets admins update Amazon/Noon affiliate parameters without a code deploy.

ALTER TABLE stores
ADD COLUMN IF NOT EXISTS affiliate_config JSONB DEFAULT NULL;

UPDATE stores
SET affiliate_config = jsonb_build_object(
  'enabled', true,
  'param', 'tag',
  'value', 'tawveeri-21'
)
WHERE slug = 'amazon'
  AND affiliate_config IS NULL;

UPDATE stores
SET affiliate_config = jsonb_build_object(
  'enabled', true,
  'param', 'aff_code',
  'value', 'DNC160'
)
WHERE slug = 'noon'
  AND affiliate_config IS NULL;
