-- 46-first-party-interactions.sql — the actual decision-grade interaction ledger.
-- NOT APPLIED TO PRODUCTION. Prepared per the 2026-09-03 /go incident's explicit-interaction
-- contract (ADR-286, second correction pass). Requires migration 45 to already exist
-- (outbound_clicks.interaction_provenance) but does not alter it further.
--
-- WHY A NEW TABLE, NOT A COLUMN ON outbound_clicks. A render-time token (migration 45,
-- `render_token_valid`) proves ORIGIN only — a crawler that fetches a public API response
-- receives an identical token to a real shopper. This table proves something a token
-- structurally cannot: that a CLIENT-SIDE onClick handler actually executed, because
-- `interaction_id` is generated in the browser at the moment of the click
-- (crypto.randomUUID(), src/lib/analytics/interaction.ts) and NEVER appears anywhere in a
-- server-rendered page or API response — there is nothing for a page-fetcher to extract and
-- replay. A row here can only exist because a real click fired a real POST.
--
-- WHY NOT A NEAREST-TIMESTAMP/SESSION JOIN AGAINST usage_events.go_click. Rejected as the
-- primary decision-grade mechanism (evaluated, not assumed): a temporal/session join is
-- correlation, not identity, and provably conflates retries, duplicate events, two genuine
-- clicks on the same offer in the same session, multiple open tabs, and — the exact failure
-- this incident is about — a crawler's /go GET landing inside the same fuzzy time window as
-- unrelated real activity in the same session. `interaction_id` is an exact-match primary key
-- minted per click: two clicks always produce two different IDs (correctly TWO interactions,
-- never merged), a retried POST for the same click is a no-op upsert on the same ID (correctly
-- ONE), and nothing about session_id or timestamp proximity is load-bearing. A time-based join
-- remains available separately for LEGACY analytical reconstruction only (pre-cutover rows that
-- never had an interaction_id) — never as the decision-grade contract going forward.
--
-- IDEMPOTENCY. `interaction_id` is the primary key: `insert ... on conflict (interaction_id)
-- do nothing` in the API route makes a retried beacon/fetch a true no-op, not a second row.
create table if not exists public.first_party_interactions (
  interaction_id        text primary key,
  -- The raw /go path segment this interaction targets (an offer UUID or `ps_<uuid>`) — same
  -- id space /go/[offerId]/route.ts already uses. Nullable: some future provenance classes
  -- (e.g. a non-/go explicit action) may not have one.
  go_id                  text,
  canonical_product_id   uuid,
  session_id             text,
  -- Where the CTA lives: 'advisor' | 'product_page' | 'checkout' | 'home_mission' |
  -- 'home_mission_checklist' | 'home_mission_retailer_cta' | … — free text, not an enum,
  -- because new surfaces are expected to be added over time (see src/lib/analytics/interaction.ts
  -- for the current call sites).
  surface                text not null,
  -- Extensible per the Agent-Era access model (ADR-286): today only 'first_party_ui_interaction'
  -- is ever written (a real onClick in Tawveeri's own UI). 'agent_user_directed' is reserved for
  -- a FUTURE explicit user-directed-agent action with its own real evidence — never assumed or
  -- inferred from a UA string. 'internal_test' covers the harness/QA safety net below.
  provenance             text not null default 'first_party_ui_interaction'
    check (provenance in ('first_party_ui_interaction', 'agent_user_directed', 'internal_test')),
  -- Same convention as every other table in this codebase: real customer counts always filter
  -- is_test = false. Derived server-side from the SAME tw_test/tw_admin cookie logic /go already
  -- uses — never trusted from a client-supplied flag.
  is_test                boolean not null default false,
  created_at             timestamptz not null default now()
);

create index if not exists first_party_interactions_go_id_idx on public.first_party_interactions (go_id);
create index if not exists first_party_interactions_created_at_idx on public.first_party_interactions (created_at);
create index if not exists first_party_interactions_session_idx on public.first_party_interactions (session_id) where session_id is not null;

alter table public.first_party_interactions enable row level security;
revoke all on public.first_party_interactions from public, anon, authenticated;
grant select, insert on public.first_party_interactions to service_role;

-- The exact-match correlation key on the request-evidence side. Nullable, additive — every
-- existing row (including every incident row) is NULL, exactly as it should be: none of them
-- ever carried a client-generated interaction_id, so none of them can ever be correlated to a
-- proven interaction after the fact. No index needed beyond the implicit one a small nullable
-- text column doesn't require; add scripts/database/47-*.sql later if query volume warrants it.
alter table public.outbound_clicks
  add column if not exists interaction_id text;

comment on column public.outbound_clicks.interaction_id is
  'Client-generated id (src/lib/analytics/interaction.ts), stored VERBATIM and UNVALIDATED by /go — the redirect never blocks on checking it. Decision-grade "was this navigation tied to a proven interaction" is answered at READ time by an exact join against first_party_interactions.interaction_id (WHERE is_test = false), never by trusting this column alone.';

-- ROLLBACK (safe, additive-only):
--   alter table public.outbound_clicks drop column if exists interaction_id;
--   drop table if exists public.first_party_interactions;
