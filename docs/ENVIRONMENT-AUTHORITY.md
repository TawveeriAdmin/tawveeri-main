# Environment Authority & Credential Inventory

**Status:** Authoritative. Established by roadmap milestone M0.
**Rule:** No Supabase URL, key, or other credential may be hardcoded in source. The environment is the only authority for which project a process talks to.

---

## 1. Supabase project authority

> **M1 CORRECTION — VERIFIED AGAINST LIVE SYSTEMS.**
> The two projects are not "production" and "legacy". They are **two halves of one product,
> each serving live traffic through its own deployment.** Neither is currently a complete
> production database. Resolution is an open Product Owner decision; see §1.1.

| Project ref | What it actually contains (verified) | Deployment serving it |
|---|---|---|
| `vyceqrzttspyycdpojtn` | **Knowledge / TPS platform.** 26 tables: `raw_observations` (123,925), `canonical_products` (2,168), `price_history` (59,818), `normalized_product_observations`, `product_matches`, `identity_resolution_events`, `tps_product_projection`, `outbound_clicks` (31), plus `products` (4,817), `product_stores` (7,124), `stores` (8). **No user, auth, or commerce schema.** | `https://tawveeri.com` — runs current repository code (returns `decisionCard` / `topMatches`) |
| `ffpsjjazsluolysgithg` | **Application platform.** Full user/commerce schema: `users`, `user_wishlists`, `price_alerts`, `notifications`, `coupons`, `saved_searches`, `product_views`, `transactions`, plus `products`, `product_stores`, `stores`, `price_history`. **No `canonical_products` — no TPS.** | `https://tawveeri.etlaq.sa` — runs older code (no decision layer; health route reports `db: connected`). **Mobile targets this system.** |

### 1.1 Verified consequence

Each deployment is functional only for its own half:

| Capability | `tawveeri.com` (TPS DB) | `tawveeri.etlaq.sa` (App DB) |
|---|---|---|
| Search | ✅ 200, TPS-enriched, decision layer present | ✅ 200, legacy catalog, no decision layer |
| `/api/compare` (canonical) | ✅ route present, TPS-backed | ❌ route absent in that build |
| `/api/coupons` | ❌ **500 — table does not exist** | ✅ 200 |
| Users / auth / wishlists / alerts / transactions | ❌ **schema absent** | ✅ present |

**This is an open architectural decision.** Until it is resolved, `types.ts`, application code, tests, and migrations must NOT be aligned to either database alone — doing so would delete the contract for whichever half is not chosen.

### 1.2 Migration history divergence

`vyceqrzttspyycdpojtn` tracks its own migrations in a `schema_migrations` table — six entries, all dated 2026-06-26, all TPS-focused (`001A_foundation`, `001B_align_runs`, `002_price_history`, `003_bridge`, `004_dedup_canonical`, `005_link_products`). This history is unrelated to the 27 numbered files in `scripts/database/`, which describe the application schema present in `ffpsjjazsluolysgithg`.

### 1.3 Scheduler status

`scraping_runs` = 0 and `scraping_schedules` = 0 in `vyceqrzttspyycdpojtn`. The PM2 dispatcher has never recorded a run against the TPS project.

---

## 2. Deployment

| Item | Value | Evidence |
|---|---|---|
| Web production host | `https://tawveeri.com` | `.github/workflows/tps-heartbeat.yml` posts cron jobs to it; application defaults reference it |
| Build/runtime platform | Railway | `railway.toml` (RAILPACK, `npm run start`); `RAILWAY_GIT_COMMIT_SHA` read at runtime |
| Mobile API base URL | `https://tawveeri.etlaq.sa` | Set in all three `mobile/eas.json` build profiles |

**Open item:** the Mobile API base URL differs from the Web production host. It was left unchanged in M0 because changing the backend a shipped app calls is a functional change requiring runtime confirmation, not an environment-alignment change. Resolve before milestone M3.

**Legacy / transitional deployment configuration:** `railway.json` (superseded by `railway.toml`), `docker-compose.yml` (still provisions the retired Flask scraper).

---

## 3. Automation hosts

Three independent schedulers currently run:

| Host | Cadence | Scope |
|---|---|---|
| PM2 `scheduler` app | 60s | `POST /api/cron/dispatch` — all stores, claim-locked |
| GitHub Actions `tps-heartbeat.yml` | Every 6h | `POST /api/cron/discover-products` — Jarir only. Despite its name it triggers store discovery, not TPS knowledge construction. Duplicates work the PM2 dispatcher already owns, with no shared claim-locking. |
| Supabase `pg_cron` | 10s | Embedding queue processing |

---

## 4. Credential inventory

Values are never recorded here — only names, locations, and consumers.

| Credential | Configured in | Consumers |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, deployment env | Browser + server clients, all scripts |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local`, deployment env | Web browser client |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local`, deployment env (never in source) | `createServerClient`, all API routes, all TPS scripts, `embed` Edge Function |
| `SUPABASE_DB_URL` | **Not configured** | `db:*` npm scripts, `run-migration.js` — migration tooling is currently non-functional |
| `CRON_SECRET` | `.env.local`, deployment env, **GitHub repository secrets** | PM2 scheduler, 8 cron routes, `/api/match` fallback |
| `MATCH_SECRET` | Not configured (falls back to `CRON_SECRET`) | `/api/match` |
| `ALGOLIA_APP_ID` / `ALGOLIA_ADMIN_KEY` | `.env.local` | TPS index sync, cleanup and inspection scripts |
| `NEXT_PUBLIC_ALGOLIA_APP_ID` / `NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY` | `.env.local` | Search client |
| `ALGOLIA_INDEX_NAME` | Not configured — defaults to `products` | `lib/algolia/search.ts`, 2 scripts |
| `ANTHROPIC_API_KEY` | `.env.local` | Waffar assistant, `/api/match` |
| `GOOGLE_AI_API_KEY` | Supabase secret (not local) | `embed` Edge Function |
| `SENDGRID_API_KEY` | **Not configured** | Email notifications |
| `AUTHENTICA_API_KEY` | **Not configured** | Phone OTP delivery |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_CONTACT_EMAIL` | **Not configured** | Web push |
| `ADMIN_EMAILS` / `ADMIN_EMAIL` | **Not configured** | Bootstrap admin promotion (3 modules) |
| `NEXT_PUBLIC_APP_URL` | **Not configured** | Scheduler base URL, schedule dispatcher, SEO, assistant |
| `NEXT_PUBLIC_SENTRY_DSN` | **Not configured** | Error monitoring |
| `EXPO_PUBLIC_SUPABASE_URL` | `mobile/eas.json` (non-secret) | Mobile client |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | **EAS secret** — removed from source in M0 | Mobile client |
| `EXPO_PUBLIC_API_BASE_URL` | `mobile/eas.json` | Mobile API client |

**Standardised names (M0).** `SUPABASE_SERVICE_KEY` and `ALGOLIA_ADMIN_API_KEY` were alternate names read by some scripts but never set. They have been removed; `SUPABASE_SERVICE_ROLE_KEY` and `ALGOLIA_ADMIN_KEY` are the only accepted names.

**Third-party public keys in source.** `src/lib/scraping/adapters/almanea.ts` and `src/lib/scraping/stores/almanea-scraper.ts` contain Almanea's own public Algolia client keys. These belong to a scraping target, not to Tawveeri, and are intentionally retained.

---

## 5. Security follow-ups

Recorded, not executed in M0. Rotation was not technically necessary to complete M0 safely.

1. **Legacy project anon key** — was committed in `mobile/eas.json`; removed from source. It belongs to the legacy project, which Mobile no longer targets. Rotate or disable the legacy project when it is formally retired.
2. **Production anon key** — was committed in `src/lib/database/supabase.ts`; removed from source. It remains in git history. Anon keys are designed to be public and are protected by RLS, so this is low severity, but rotation should be scheduled.
3. **`CRON_SECRET` exists in two independent stores** (deployment env and GitHub secrets). Rotation must update both together.
4. **Scripts load `.env.local` directly** and instantiate service-role clients, bypassing application auth and RLS. This is expected for operational tooling but means local `.env.local` holds production write credentials.

---

## 6. Configuration gaps affecting later milestones

| Gap | Impact | Milestone |
|---|---|---|
| `SUPABASE_DB_URL` unset | `db:*` migration scripts cannot run | M1 |
| `NEXT_PUBLIC_APP_URL` unset | Scheduler and dispatcher fall back to localhost | M4/M5 |
| `ALGOLIA_INDEX_NAME` unset | Search silently defaults to the legacy `products` index | M6/M7 |
| `GOOGLE_AI_API_KEY` provisioning unverified | Embedding pipeline state unknown | M10 |
| `SENDGRID_API_KEY`, `AUTHENTICA_API_KEY`, VAPID keys unset locally | Email, OTP, and push do not function in this environment | Operational |
