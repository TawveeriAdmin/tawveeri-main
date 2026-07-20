# Environment Authority & Credential Inventory

**Status:** Authoritative. Established by roadmap milestone M0.
**Rule:** No Supabase URL, key, or other credential may be hardcoded in source. The environment is the only authority for which project a process talks to.

---

## 1. Supabase project authority

| Role | Project ref | Usage |
|---|---|---|
| **Production — sole authority** | `vyceqrzttspyycdpojtn` | Web, Mobile, all scripts, all tooling, MCP/CLI, migrations, future roadmap execution |
| **Legacy — do not use** | `ffpsjjazsluolysgithg` | Reference only. Do not write to it, migrate from it, or depend on it, except for an explicitly authorized legacy-data comparison. |

Before M0, the Mobile production build profile pointed at the legacy project while Web pointed at production. Mobile is now aligned to production.

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
