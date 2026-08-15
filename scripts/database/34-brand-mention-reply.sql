-- 34-brand-mention-reply.sql — suggested reply + status vocabulary (ADR-248 addendum)
ALTER TABLE brand_mentions ADD COLUMN IF NOT EXISTS suggested_reply text;
-- statuses now: new | reviewed | replied_manually | dismissed
