-- 55-growth-content-platform-object-id.sql — Grok × Claude shared operating loop
-- (founder mission, 2026-09-05, Track 1). Track 1's own audit found `growth_content`
-- (migration 31, ADR-244) is ALREADY the correct "one canonical identity for growth
-- experiments/content" — the only real gap is that it has no column for the platform's
-- OWN concrete object id (an X post id, a TikTok video id), so a Grok-originated post
-- has zero Tawveeri-side record beyond whatever fits in the free-text `utm` jsonb.
--
-- Purely additive: one nullable column, no new table (a new table would duplicate
-- growth_content, which this mission's own instructions forbid — "no duplicate analytics
-- platform"). Nullable because most existing rows (founder/script-authored, not yet
-- platform-published) have no object id yet.
alter table public.growth_content
  add column if not exists platform_object_id text;

comment on column public.growth_content.platform_object_id is
  'The platform''s own concrete content identifier (e.g. an X post id, a TikTok video id) — distinct from content_id, which is Tawveeri''s own internal identifier. Populated once real content is published on the platform; null for draft/unpublished rows.';

create index if not exists growth_content_platform_object_id_idx
  on public.growth_content (platform_object_id)
  where platform_object_id is not null;
