# X → Tawveeri attribution contract

**Status:** implemented helpers + existing capture path (ADR-244)  
**Date:** 2026-09-04

## Capture path (already in production)

1. Landing URL carries `utm_*`
2. `CampaignCapture` → `initCampaignFromUrl()` stores sessionStorage + `tw_campaign` cookie
3. Client `track()` attaches campaign into `usage_events.meta`
4. `/go/[offerId]` reads `tw_sid` + `tw_campaign` and stamps `outbound_clicks`

## Locked UTM convention for Tawveeri-owned X links

| Param | Value |
|---|---|
| utm_source | `x` |
| utm_medium | `organic_social` (use `social_reply` only if a reply itself carries the link) |
| utm_campaign | `profile` \| `profile_pin_v2` \| `organic_post` \| `intent_desk` \| `intent_desk_reactive` \| `home_mission` \| `content_bank` \| … |
| utm_content | stable human-readable content_id |
| utm_term | optional intent family (COMPARISON, HOME_MISSION, …) |

Builder: `src/lib/analytics/x-attribution.ts` → `buildXAttributionUrl()`.

## Linkless Intent Desk replies

Most proactive replies **should not** include tawveeri.com links (trust first).

**Measurable:** profile visits → pin/site clicks with UTMs; selective direct-link replies.  
**Not honestly measurable:** author saw reply → later typed tawveeri.com with no UTM/referrer. Do not invent user-level identity matching.

## Funnel events (reuse existing — do not duplicate)

| Desired label | Existing primary event | Notes |
|---|---|---|
| x_attributed_session | any `usage_events` / session with meta.utm_source=x | diagnostic filter, not new event type |
| x_search | `search` / `advisor_query` | filter by campaign |
| x_home_mission_start | Home Mission client events if present | filter by campaign/path |
| x_product_view | `product_view` | filter |
| x_compare | `comparison_view` | filter |
| qualified_outbound_click | `outbound_clicks` with session + non-bot + non-test + preferably interaction provenance | primary |

Bot/test exclusion: `tw_test`, bot UA, admin cookie — already on `/go`.

## Founder view (7/30d)

Filter existing founder/growth queries where `utm_source=x` (events meta + outbound_clicks.campaign JSON). No second dashboard required for MVP.
