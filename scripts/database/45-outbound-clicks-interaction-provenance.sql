-- 45-outbound-clicks-interaction-provenance.sql
-- NOT APPLIED TO PRODUCTION. Prepared per the 2026-09-03 /go redirect-flood incident
-- investigation (Section 8/18/19 of that mission) — DO NOT run until the founder reviews
-- src/lib/analytics/go-token.ts and src/app/go/[offerId]/route.ts's ENABLE_GO_INTERACTION_PROVENANCE
-- gate and explicitly decides to activate it.
--
-- PURPOSE. outbound_clicks currently answers "was a /go request made and what did it point
-- at" — a REQUEST/REDIRECT ledger, not a customer-interaction ledger (session_id is a
-- correlation signal from a separate cookie, not proof this specific row was a deliberate
-- click). This column adds an explicit, honestly-scoped classification for the ONE thing this
-- incident's root fix can actually prove: whether the request carried a valid, unexpired,
-- server-issued token bound to the exact offer being redirected (src/lib/analytics/go-token.ts)
-- — evidence the link came from our own rendering, not a guessed/scraped/replayed ID.
--
-- RENAMED 2026-09-03 (adversarial-test correction, same-day gate): the original name for this
-- value was `first_party_ui_interaction`, which OVERCLAIMED what a token proves. CODE-TRACED
-- adversarial test: any client that fetches a public API/page response (curl, a crawler, no
-- click, no JS, no session) receives an identically valid token for every offer in that
-- response — following it directly, with zero interaction, would have been misclassified as
-- a confirmed first-party interaction under the old name. A valid token proves ORIGIN/
-- AUTHENTICITY only (our own server minted this exact link, recently) — never INTERACTION/
-- INTENT. `render_token_valid` says exactly that and nothing more. A true interaction-proven
-- classification needs a SEPARATE, read-time correlation against a matching
-- `usage_events.go_click` row (same session_id, close timestamps — the shape ADR-214's
-- campaign-attribution join already uses) — not implemented by this column, scoped as
-- explicit follow-up, never silently assumed.
--
-- ADDITIVE AND SAFE: nullable-equivalent default, no existing row touched, no read/write path
-- that already queries outbound_clicks needs to change to keep working — every current SELECT
-- of specific columns is unaffected; only a SELECT * would see a new column.
alter table public.outbound_clicks
  add column if not exists interaction_provenance text not null default 'unknown'
  check (interaction_provenance in ('render_token_valid', 'raw_request', 'unknown'));

comment on column public.outbound_clicks.interaction_provenance is
  'render_token_valid = the request carried a valid go-token for this exact offer, i.e. our own server rendered this link recently (ORIGIN/AUTHENTICITY only — NOT proof of a deliberate click; a crawler/scraper that fetches the same rendered response gets an equally valid token); raw_request = no/invalid/expired token — a bare GET, exactly the /go-flood incident shape; unknown = pre-cutover row, written before this column existed. Never gates or delays the redirect (see go-token.ts) — classification only. True interaction/intent evidence requires a separate read-time join against usage_events.go_click, not this column alone.';

create index if not exists outbound_clicks_interaction_provenance_idx
  on public.outbound_clicks (interaction_provenance)
  where interaction_provenance <> 'unknown';

-- ROLLBACK (safe, additive-only — nothing else depends on this column):
--   alter table public.outbound_clicks drop column if exists interaction_provenance;
