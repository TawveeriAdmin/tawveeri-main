# UTM CONVENTION — Controlled Demand Validation
**Authority:** docs/TAWVEERI_SOCIAL_GROWTH_SYSTEM.md §23 (this file operationalizes it — the
Growth System is the definition, this is the working reference and current implementation state)

## The contract (unchanged from §23)
```
utm_source   = x | tiktok | instagram | snapchat | youtube
utm_medium   = organic_social | paid_social | social_reply
utm_campaign = controlled_demand_validation_<wave>       e.g. controlled_demand_validation_wave1
utm_content  = <content_id>                              e.g. cdv-w1-video-01
```
**Rule (§23, unchanged):** UTM never replaces the affiliate parameter. Both must be verified
independently on a real production exit. UTM measures which *piece of content* drove a session;
the affiliate tag (`tawveeri-21` / `C1000094L`) is what actually earns revenue — they answer
different questions and neither substitutes for the other.

## Where every link points
Every social post links to an internal Tawveeri URL that already exists — never a new landing
page. Pick the URL that matches the content:
- A specific product: `https://tawveeri.com/ar/products/<slug>?utm_source=...&utm_medium=...&utm_campaign=...&utm_content=...`
- A comparison: `https://tawveeri.com/ar/compare/<key>?utm_source=...`
- A search result / category: `https://tawveeri.com/ar/search?q=<query>&utm_source=...`
Always the `/ar/` path as the primary link (Arabic is default, per CLAUDE.md); an `/en/` variant
only when the specific platform/audience is English-first.

## Implementation status (built this session, 2026-08-04)
**Before this session: zero UTM capture existed anywhere** — confirmed by grep across
`src/lib/analytics/track.ts`, `src/app/api/events/route.ts`, `src/app/go/[offerId]/route.ts`
and the `usage_events`/`outbound_clicks` schemas (see docs/SOCIAL-READINESS.md gate 7). A link
carrying `?utm_source=tiktok` would have landed, been silently dropped, and left no trace.

**Built:**
- `src/lib/analytics/campaign.ts` — `initCampaignFromUrl()` captures `utm_*` from the landing
  URL into `sessionStorage` (per-tab-session scope: a new social click in the same tab
  re-attributes; an unrelated later session never inherits a stale campaign). `getCampaign()`
  reads it back.
- `src/lib/analytics/track.ts` — every `track()` call now merges the session's captured
  campaign into `meta`, alongside the existing entry-variant tag. No schema migration: `meta`
  is `jsonb` on `usage_events`.
- Wired into the three existing client mount points that already call `initTestModeFromUrl()`:
  `src/components/public/beta-landing.tsx`, `product-detail-client.tsx`, `search-client.tsx`.
- Net effect: `landing_view`, `search`, `results`, `product_view`, `comparison_view`, and
  critically **`go_click`** (fired client-side at the moment of the real outbound click, see
  `advisor-answer.tsx`/`product-detail-client.tsx`) now all carry `meta.utm_source`,
  `meta.utm_medium`, `meta.utm_campaign`, `meta.utm_content` when the session arrived via a
  tagged link. The existing `usage_events` funnel query (`tps:usage`) can filter/group by these
  the moment real campaign traffic exists.

**Deliberately NOT built (scope discipline):** `outbound_clicks.session_id` (the column exists,
unused) is not wired to the client session id. That would let a campaign be joined to the
*revenue-side* click ledger directly, but it means touching `src/app/go/[offerId]/route.ts` —
the Protected Trust Policy T5/F5 surface — for a nice-to-have when the `usage_events.go_click`
row (which already carries session_id + campaign meta, fired at the same moment) answers the
"did this campaign drive an exit" question without touching that route. Revisit only if a
real campaign needs same-click-exact revenue join and the existing signal proves insufficient.

## Verification owed before the first real campaign link goes out
Load `https://tawveeri.com/ar/products/<any-slug>?utm_source=tiktok&utm_medium=organic_social&utm_campaign=controlled_demand_validation_wave1&utm_content=test-000`
in a browser, click through to a comparison and an outbound link, then query:
```sql
select event_type, meta->>'utm_source' src, meta->>'utm_campaign' camp, created_at
from usage_events where meta->>'utm_content' = 'test-000' order by created_at;
```
Expect one row per funnel step, is_test should read false unless `?test=1` was also set — run
this as a real (non-bot) browser session before Wave 1 ships, not with curl (curl's UA marks
`/go` clicks as test, which is correct for /go but this smoke test is about `usage_events`,
which does NOT bot-detect on UA the same way — check `src/app/api/events/route.ts`'s `BOT_UA`
regex if the result looks wrong).
