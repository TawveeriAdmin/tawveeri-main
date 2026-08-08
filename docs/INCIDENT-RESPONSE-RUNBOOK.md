# Incident Response Runbook

Practical "what do I actually do" doc for a production incident on tawveeri.com. Written from the
2026-08-08 security/resilience audit — see `docs/DECISIONS.md` for the full findings this draws on.

**Known constraint:** Railway has no contractual uptime SLA on our plan (Pro). There is currently
no independent (non-Railway) uptime monitor and no edge CDN — see Open Items at the end. Until
those exist, the first signal of an outage will usually be a user report or the founder noticing.

## 1. First 5 minutes — is it us or them?

1. Check `https://tawveeri.com/api/health` directly (`curl -sI https://tawveeri.com/api/health`). If
   it responds, the app is up — the reported problem is narrower than "site is down."
2. Check Railway's own status page: https://status.railway.app (not authoritative on our uptime,
   but tells you if it's a platform-wide incident vs. something specific to our deployment).
3. `railway status` (from a machine with the Railway CLI logged in as `info@tawveeri.com`) — shows
   whether the `tawveeri-main` service is `Online`/`Crashed`/`Deploying` and the current deployment ID.
4. `railway logs --service tawveeri-main` — tail recent logs for the actual error. Cross-reference
   the deployment ID against `git log` on `main` to see what shipped right before the incident.
5. Check Supabase directly: `curl -sI https://vyceqrzttspyycdpojtn.supabase.co/rest/v1/` — if this
   fails, the outage is the database/Supabase, not Railway or our app code.

## 2. Common root causes, in probability order (from this codebase's history)

- **Bad deploy.** `railway status` shows the current commit — compare against `git log main`. Roll
  back via the Railway dashboard (redeploy a previous successful deployment) rather than a
  panic-revert commit.
- **PGRST002 / PostgREST schema-cache loop** (ADR-099). Symptom: REST-backed endpoints (most
  customer pages) go dark while direct-pg scripts still work. A bare `NOTIFY pgrst 'reload'` does
  **not** fix this — it re-introspects without reconnecting. Fix: restart the Supabase project
  (dashboard → Settings → General → Restart project), which forces a real reconnect. If it recurs
  immediately, the authenticator role's `statement_timeout` may need raising (currently 30s) —
  see ADR-099 in `docs/DECISIONS.md`.
- **Concurrent heavy pipeline jobs** (ADR-099). Never run `normalize` / `build-tps-projection` /
  `refresh-intelligence` manually while the hourly scheduler is also running — this is what
  triggers the PGRST002 loop above. Check `scraping_runs` for overlapping `running` rows.
- **IPv6/IPv4 mismatch on direct DB scripts.** If a manually-run script fails with `ENETUNREACH`,
  it's connecting to Supabase's direct host instead of the IPv4 pooler. Every DB script must route
  through `scripts/tps-core/pooler-url.js`. `scripts/run-migration.js` is a known exception — it
  does **not** use the pooler and will only fail if ever run from Railway's own runtime rather than
  a developer machine with IPv6 (see 2026-08-08 audit finding).
- **Rate limiter false-positive.** The in-process limiter in `src/middleware.ts` is halved (to
  15–30 req/min depending on route) because PM2 runs 2 cluster instances. A legitimate burst of
  traffic (e.g. a marketing push) can trip this. There is no edge-level WAF or rate limiter as of
  this audit — Cloudflare is not in front of the site.

## 3. Database export / recovery, independent of either dashboard

Verified working 2026-08-08: you do **not** need the Railway or Supabase dashboard to pull data out.
From a machine with the Railway CLI authenticated and this repo checked out:

```bash
railway run --service tawveeri-main node -e "
const { Client } = require('pg');
const { toPoolerDbUrl } = require('./scripts/tps-core/pooler-url.js');
(async () => {
  const client = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false } });
  await client.connect();
  // adapt the query — this is the connectivity/export path, not a full pg_dump
})();
"
```

This proves the pooler connection works independent of both dashboards being reachable. It is
**not** a substitute for a real `pg_dump`-based backup — see Open Items below (no `pg_dump` binary
is currently available on the founder's machine, and Supabase's own backup/PITR configuration was
**not verifiable** from this audit — no Supabase management API token was available; the founder
needs to confirm the plan tier and backup settings directly in the Supabase dashboard).

## 4. Communicating an outage

No status page or customer-communication channel currently exists for this. Until one does:
- Post to whatever social accounts are live (X/Instagram/TikTok) with a short, honest note — "we're
  aware of an issue and working on it," update when resolved.
- If the outage is DB-side and Search/Compare/Product pages are down but nothing can be done
  quickly, prioritize getting `/api/health` and the homepage back before full functionality.

## 5. Who/what to check, in order

1. Railway dashboard (project "welcoming-nurturing") — service status, recent deploys, resource graphs.
2. Supabase dashboard (project `vyceqrzttspyycdpojtn`) — API status, DB status, logs.
3. Sentry — **live in production as of 2026-08-08.** `NEXT_PUBLIC_SENTRY_DSN` is set on
   `tawveeri-main` and a test event was confirmed delivered before the DSN was wired in. Check the
   Sentry dashboard first for anything that isn't a hard process crash (a hard OOM kill, like the
   2026-08-08 incident in the section below, generally happens too abruptly for Sentry to flush the
   event — `railway logs` is still the source of truth for those).
4. `git log origin/main` — confirm what's actually deployed vs. what's in the repo.

## 6. 2026-08-08 incident — OOM kill during Amazon discovery

**What happened.** `tawveeri-main` was killed and auto-restarted by Railway's `ON_FAILURE` policy
after a burst of Chromium/Puppeteer failures — `Zygote could not fork`, repeated
`pthread_create: Resource temporarily unavailable (11)`, and a `FATAL:check.cc` — logged at
08:30:36Z, immediately followed by silence until a clean cold boot at 09:14:22Z
(`✓ Ready in 213ms`). This is the classic signature of a container hitting its memory/thread
ceiling while Puppeteer tried to launch a Chromium instance for the Amazon product-page scraper
(`fetchPageWithJS()` in `src/lib/scraping/base/base-scraper.ts`). Confirmed via `railway logs
--service tawveeri-main --deployment`; unrelated to any code change in this repo — the deployed
commit at the time of the crash was unchanged from the prior deploy.

**Root cause — structural, not a bug in one file.** Per ADR-078, the intelligence scheduler
(`scripts/scheduler.js`, which runs discovery/price-check jobs including the Puppeteer-based
Amazon path) is spawned as a **child process of the main web-server process** so it works within
Railway's single-process-per-container model. That means the customer-facing Next.js server and
the scraper share one container's memory budget — a heavy scrape (especially anything that
launches headless Chromium) can starve or kill the web server along with itself. This is flagged
here as a tracked architectural item, **not fixed in this pass** — see the note below.

## Open items this runbook depends on (from the 2026-08-08 audit — not yet done)

- No independent uptime monitor exists (no alert fires before a human notices).
- No CDN/edge layer (Cloudflare or equivalent) in front of Railway — a Railway platform outage is a
  full outage with no cached fallback.
- Supabase backup/PITR configuration unverified — confirm in the dashboard and record the result
  here.
- No `pg_dump` binary available for a full logical backup test; the connectivity test in §3 is a
  partial substitute only.
- **Puppeteer runs inside the main server process (see §6).** Flagged, not implemented. The
  current-best-practice direction for running a headless browser in a production Node.js service is
  to isolate it from the request-serving process entirely — e.g. a separate Railway service (its own
  container, its own memory ceiling, so a scraper OOM can't take the website down with it), or at
  minimum a worker process with its own `--max-old-space-size` and a hard concurrency cap on
  simultaneous Chromium instances. Scoping the actual redesign (queue vs. separate service vs.
  external scraping API) needs a founder decision on cost/complexity trade-offs — this note exists so
  the finding isn't lost, not to pre-select a solution. Do not implement without a separate,
  dedicated session: this touches `scripts/scheduler.js`, `src/lib/scraping/base/base-scraper.ts`,
  and every store scraper that calls `fetchPageWithJS()`.
