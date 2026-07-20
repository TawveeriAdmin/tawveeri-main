# Architecture Reconciliation Report

**Milestone:** M1 final deliverable.
**Method:** Read-only introspection of both Supabase projects and both live deployments, plus repository evidence. No writes, no schema changes, no migration.
**Date of evidence:** 2026-07-20.

---

## URGENT — Live PII exposure on System B

> **Correction (verified twice).** An earlier draft of this report listed 400 rows for each
> analytics view. That was a probe parsing error — HTTP status 400 was misread as a row count.
> The corrected, re-verified figures are below. The `phone_otps` and `login_sessions` findings
> were correct and are unchanged.

Verified with the **public anon key** (embedded in the mobile app binary and the web bundle):

| Table | Rows readable by any anonymous client |
|---|---|
| `phone_otps` | **94** — phone numbers and OTP codes |
| `login_sessions` | **12** — user ids and device fingerprints |
| `mv_user_analytics` | **2** |
| `mv_store_analytics` | **5** |
| `mv_product_analytics` | **7** |

User-owned tables (`users`, `user_wishlists`, `price_alerts`, `notifications`, `transactions`,
`coupons`, `admin_logs`, `saved_searches`, `product_views`) are correctly RLS-protected —
they return HTTP 200 with zero rows to an anonymous client.

RLS is not protecting these tables. Anyone holding the anon key — which is public by design — can read them. Not remediated here: modifying System B is outside the authorised scope of this report.

---

## 1. System identification

| | **System A — Knowledge Platform** | **System B — Application Platform** |
|---|---|---|
| Supabase project | `vyceqrzttspyycdpojtn` | `ffpsjjazsluolysgithg` |
| Deployment | `https://tawveeri.com` | `https://tawveeri.etlaq.sa` |
| Code lineage | Current repository (`main`) | Older build of the same repository |
| Uptime at probe | 0 s (cold/restarting) | 934,779 s (~10.8 days) |
| Health payload | `status, uptime, timestamp` | `status, uptime, timestamp, db, responseTime` |

The health difference is explained by repository history: `31c14a0 Update route.ts` simplified the health route after System B was deployed. System B is therefore an **older build of this repository**, not a fork.

---

## 2. Responsibility matrix

| Dimension | System A (tawveeri.com) | System B (tawveeri.etlaq.sa) |
|---|---|---|
| **Responsibility** | Product knowledge: observation → identity → canonical graph → price history → projection | Customer application: auth, accounts, wishlists, alerts, coupons, notifications, transactions |
| **Database** | 25 public tables + 1 view (`current_prices`) | Full application schema per `scripts/database/` (27 migrations) |
| **Runtime** | Next.js, current code | Next.js, older code |
| **Search engine** | `engine: "algolia+db"`, Arabic-aware, TPS-enriched, returns `decisionCard` + `topMatches` | `engine: "db"` — no Algolia, no decision layer |
| **TPS** | ✅ Full: `raw_observations` 123,925 · `normalized_product_observations` · `identity_resolution_events` · `canonical_products` 2,168 · `product_matches` · `price_history` 59,818 · `tps_product_projection` | ❌ Absent entirely |
| **Authentication** | Email provider enabled, **but no `users` table** — auth is non-functional at application level | ✅ Functional — `users`, `phone_otps` (94), `login_sessions` (12) |
| **User state** | ❌ No `user_wishlists`, `price_alerts`, `saved_searches`, `product_views`, `user_preferences`, `notifications` | ✅ All present |
| **Coupons** | ❌ `/api/coupons` returns **500 — table does not exist** | ✅ `/api/coupons` returns 200 |
| **Comparison** | ✅ `/api/compare` present, canonical-backed | ❌ Route absent from build |
| **Recommendation** | ❌ `get_recommendations` RPC absent; `products.embedding` column absent; no `pgmq`/`util` schema | ✅ `get_recommendations` present and returning data; `match_similar_products` absent (semantic tier never deployed) |
| **AI assistant** | ✅ `/api/ai-assistant` present; `waffar_conversations` table exists (0 rows) | ❌ Route absent |
| **Identity matching** | ✅ `/api/match` present (`v1.7-fixed`) | ❌ Route absent |
| **Scraping — data** | ✅ Live: 2,179 price rows in 24 h · 14,036 in 7 d · 43,301 in 30 d. Sample store distribution: 100 % المنيع (Almanea) | Catalog present: `products` 94,921 · `product_stores` 95,029 · `price_history` 106,108. Freshness unverifiable (statement timeouts on ordered queries) |
| **Scraping — orchestration** | `scraping_runs` **0** · `scraping_schedules` **0** — the dispatcher has never recorded a run here | Tables exist; counts RLS-blocked |
| **Cron routes** | ✅ dispatch, update-prices present | ✅ dispatch, update-prices present |
| **External scheduler** | GitHub Actions `tps-heartbeat.yml`, every 6 h → `tawveeri.com/api/cron/discover-products` (Jarir only) | None found |
| **Edge Functions** | `embed` exists in repo; **cannot run** — no `products.embedding`, no `pgmq`, no `util` schema | Not verifiable with anon key |
| **Extensions** | `cron`, `net`, `vault`, `realtime`, `storage` present. **No `pgmq`, no `util`, no `vector`** | Not enumerable with anon key |
| **Storage** | 0 buckets | 0 buckets |
| **Realtime** | Schema present, unused | Not verifiable |
| **Analytics** | ❌ No materialised views | ✅ `mv_product_analytics`, `mv_store_analytics`, `mv_user_analytics` — all anon-readable |
| **Attribution** | ✅ `outbound_clicks` — 31 rows, newest 2026-07-19 (real user traffic) | ❌ Table absent |
| **Mobile** | Not targeted | ✅ **Mobile targets this system** (`EXPO_PUBLIC_API_BASE_URL` = `tawveeri.etlaq.sa`, Supabase = `ffpsj…`) |
| **Web** | Public web traffic (proven by outbound clicks) | Serves the older web build |
| **Migration history** | Own `schema_migrations` table — 6 entries, all 2026-06-26, all TPS | The 27 numbered files in `scripts/database/` |

---

## 3. Shared components

Identical or near-identical on both:

- Next.js App Router runtime; same repository lineage.
- Cron route surface (`/api/cron/dispatch`, `/api/cron/update-prices`) and `CRON_SECRET` auth.
- Admin guard behaviour (`/api/admin/scraping/health` → 403 on both).
- `/api/products/ensure`, `/api/transactions/conversion`, `/api/push/web/subscribe` (405 on GET = present on both).
- Table *names* `products`, `product_stores`, `stores`, `price_history` — **same names, incompatible shapes** (see §4).
- Supabase auth configuration: email provider enabled, signup open, no autoconfirm.
- Bilingual `_ar`/`_en` convention where columns exist.

---

## 4. Duplicated components — the core problem

Four table names exist in both databases with **different schemas and different data**:

| Table | System A | System B |
|---|---|---|
| `products` | 4,817 rows. **No `embedding`** | 94,921 rows |
| `product_stores` | 7,124 rows. **No `affiliate_url`** | 95,029 rows |
| `stores` | 8 rows, 7 columns: `id, name, offer, coupon_code, link, category, slug` | 8 rows, full schema: `name_ar`, `name_en`, `status`, `is_featured`, … |
| `price_history` | 59,818 rows, canonical-keyed (`canonical_product_id`) | 106,108 rows, product-store-keyed |

Also duplicated: the entire scraping pipeline exists in both codebases, and both deployments expose cron routes — meaning **both can scrape**, into different catalogs, with no coordination.

`types.ts` describes System B's schema. This is why 28 tests fail against System A: the tests are correct for B and wrong for A.

---

## 5. Missing components

**Missing from System A (blocks it from being the whole product):** `users`, `user_wishlists`, `price_alerts`, `saved_searches`, `product_views`, `user_preferences`, `notifications`, `coupons`, `transactions`, `admin_logs`, `product_reviews`, `store_reviews`, `phone_otps`, `login_sessions`, analytics MVs, `get_recommendations` and all recommendation RPCs, `products.embedding`, `product_stores.affiliate_url`, and the `pgmq`/`util`/`vector` embedding infrastructure.

**Missing from System B:** the entire TPS graph — `raw_observations`, `normalized_product_observations`, `identity_resolution_events`, `canonical_products`, `product_matches`, `tps_product_projection` — plus `outbound_clicks`, `waffar_conversations`, Algolia integration, the decision layer, and the `/api/compare`, `/api/match`, `/api/ai-assistant`, `/api/search/diag` routes.

**Missing from both:** the semantic recommendation tier (`match_similar_products` absent on both; embeddings absent on A, unverified on B), and a functioning scraping scheduler with run logging (A: 0 runs recorded).

---

## 6. Production risks

| # | Risk | Severity | Evidence |
|---|---|---|---|
| P1 | **PII readable with the public anon key on System B** — `phone_otps` (94), `login_sessions` (12), `mv_user_analytics` (400) | **Critical** | Direct anon-key reads |
| P2 | **Two systems scrape into two catalogs with no coordination**; both expose cron routes | **Critical** | Cron routes live on both |
| P3 | **Attribution split** — `outbound_clicks` exists only on A; mobile exits on B are unmeasured and unmeasurable | **Critical** | Table absent on B; mobile targets B |
| P4 | **System A serves 500s on commerce endpoints** to real users | High | `/api/coupons` → 500 |
| P5 | **Users cannot authenticate on System A** — no `users` table, yet auth is enabled | High | Schema introspection |
| P6 | **Price truth diverges** — 59,818 canonical-keyed rows on A vs 106,108 product-store-keyed rows on B for the same market | High | Row counts and keying |
| P7 | **Only one store (Almanea) is feeding System A** — 100 % of a 1,000-row sample | High | Store distribution |
| P8 | **A's scraping is unlogged** — `scraping_runs` = 0 while 2,179 rows/day arrive | High | Counts vs volume |
| P9 | **System B is slow and under-indexed** — statement timeouts (57014) on ordered queries over `product_stores` and `refresh_analytics_views` | Medium | Query failures |
| P10 | **Repository does not describe either system completely** — `types.ts` matches B; `scripts/database/` matches B; deployed A code matches the repo but its database does not | Medium | Cross-comparison |
| P11 | **Mobile is entirely on B** — no TPS, no decision layer, no attribution; a mobile release cannot fix this without a backend decision | High | `eas.json` + route probes |
| P12 | **The embedding pipeline cannot run anywhere** — infrastructure absent on A, semantic RPC absent on B | Medium | Extension and RPC probes |

---

## 7. Safe consolidation strategy

Ordered by dependency. No step is destructive; no step deletes a source system.

**Stage 0 — Contain (independent of the consolidation decision)**
Fix RLS on System B's `phone_otps`, `login_sessions`, and the analytics views. This is a security fix, not an architectural one, and should not wait for the target-architecture decision.

**Stage 1 — Freeze divergence**
Stop new writes from creating further divergence: confirm which deployment owns scraping, and disable the cron surface on the other. Nothing is migrated.

**Stage 2 — Establish the join key**
The two catalogs must be relatable before anything moves. System A already contains the mechanism: `products.canonical_product_id` (migration `003_bridge`, `005_link_products`). The same bridge must be computed for System B's catalog so that every B product resolves to an A canonical identity. Output is a mapping table, not a migration.

**Stage 3 — Choose the destination (owner decision — see §8)**

**Stage 4 — Expand, never move**
Create the missing schema in the destination alongside existing data. No drops, no renames.

**Stage 5 — Backfill under shadow**
Copy data into the destination while both systems continue serving. Verify row counts, key integrity, and provenance completeness before any traffic changes.

**Stage 6 — Cut over one capability at a time**
Auth first (it gates everything user-owned), then user state, then commerce, then search. Each capability has an independent revert.

**Stage 7 — Preserve, do not delete**
The source project remains readable throughout and is retired only after an observation period with zero readers. `price_history` on both sides is append-only and must be preserved in full — it is the platform's irreproducible asset.

---

## 8. Recommended target architecture

> **This recommendation was reversed after further evidence.** An earlier draft recommended
> consolidating onto System B on the assumption that it held irreplaceable customer data.
> Deeper probing showed System B holds almost no customer activity and a catalog that has
> received no price updates in over 30 days. The corrected recommendation follows.

**Consolidate onto System A (`vyceqrzttspyycdpojtn`), migrating System B's user, auth and commerce schema into it.**

Evidence for the reversal:

| Measure | System A | System B |
|---|---|---|
| Price observations in last 24 h | **2,179** | **0** |
| Price observations in last 30 d | **43,301** | **0** |
| `product_stores.last_checked_at` in last 30 d | active | **0** |
| Users with any recorded activity | n/a (no user schema) | **2**, all activity counters zero |
| Outbound clicks in last 30 d | **31** (real traffic) | table absent |
| Deployed code | current `main` | older build |
| Hosting | Railway (`railway-hikari`) | self-hosted nginx/Ubuntu |

1. **System B is dormant.** Zero price activity in 30 days, two users with zero wishlists, zero searches, zero price alerts, zero comparisons. Its 94,921 products carry stale prices, which for a price-comparison platform is a liability rather than an asset.
2. **System A is the live product.** It scrapes continuously, serves real users, records real outbound clicks, and runs the current codebase on managed infrastructure.
3. **Migration volume favours A decisively.** Moving user/auth/commerce data into A means moving a handful of accounts and their (currently empty) owned records. Moving TPS into B would mean relocating 124,387 raw observations, 59,911 price rows, and the canonical graph — and then rebuilding the live scraping pipeline that already runs on A.
4. **Schema collision is manageable in this direction.** `users`, `user_wishlists`, `price_alerts`, `notifications`, `coupons`, `transactions`, `saved_searches`, `product_views`, `user_preferences`, `phone_otps`, `login_sessions`, `admin_logs`, `product_reviews`, `store_reviews` and the analytics views are all **absent from A** and can be created additively. Only `stores`, `products` and `product_stores` differ in shape, and those are A's own tables which TPS already depends on — they stay as they are.
5. **Mobile must be released regardless.** Roadmap M3 already requires a mobile release to restore attribution. Re-pointing Mobile to System A can ride that same release rather than constituting extra cost.

**What must move into A:** the application schema listed above, plus whatever user records exist in B (full inventory pending — see §9).
**What must be created new in A:** the recommendation RPCs, the analytics materialised views, and the embedding infrastructure (`vector`, `pgmq`, `util`, `products.embedding`) — none of which exist in either system today in working form.
**What must not move:** System B's catalog data (`products`, `product_stores`, `price_history`). It is stale and superseded by A's live pipeline.

**Counter-consideration, stated honestly:** `types.ts` and the 27 migrations in `scripts/database/` describe System B's schema. Choosing A means those migrations become the specification for *what to create in A*, not a description of what exists. That is additional work, but it is schema creation rather than data migration, and it is reversible.

---

## 9. Late findings (added after the first draft)

**F1 — The Algolia index producer is identified and recoverable.** `scripts/algolia-sync.ts` at commits `11fb4b9` and `7cc92ad` contained the real sync (`INDEX_NAME = 'products'`, reads `products`, calls `saveObjects`). At `d386ede` ("Fix algolia sync script") its contents were replaced with identity-resolution logic while the filename and the `algolia:sync` npm script were kept. This explains the orphaned index, its stale state, and why `npm run algolia:sync` performs identity resolution. The original code is retrievable from git history.

**F2 — Algolia index state.** `products`: 859 records, last updated 2026-07-07 (stale). `tawveeri_tps_products`: **3 records**, last updated 2026-06-29, correctly configured for Arabic/English but effectively empty.

**F3 — The TPS pipeline is stalled, quantified.** `raw_observations` 124,387 with **100 % of sampled rows in `processing_status = 'pending'`** — normalization has never consumed them in production. Downstream: `normalized_product_observations` 2,939 · `identity_resolution_events` 37 · `product_matches` 76 · `tps_product_projection` 3. The 80.4 % canonical linkage on `price_history` came from bulk migration `005_link_products` (name + brand matching), not from the TPS matcher.

**F4 — Two uncoordinated ingestion paths run on System A.** `/api/cron/discover-firecrawl` (adapters: Extra, Almanea) writes `raw_observations` + `price_history` + `store_sync_status`; `/api/cron/discover-products` (legacy scrapers, e.g. Jarir, driven by the GitHub Action) writes `product_stores` + `price_history` directly with no raw observation. Last 24 h `price_history` by store: Jarir 646, Extra 354. Neither path logs to `scraping_runs` (0 rows).

**F5 — What triggers `/api/cron/discover-firecrawl` is unknown.** `store_sync_status` shows regular runs (12:00, 12:03 on the probe date) but the only workflow in the repository targets `discover-products`. A Railway-side scheduler or external caller is implied and could not be verified from the repository.

**F6 — Nine production tables exist in no repository file:** `waffar_conversations`, `current_prices` (a view), `deals`, `extracted_facts`, `quality_issues`, `parser_improvement_queue`, `schema_migrations`, `canonical_products_backup`, `products_category_backup_20260626`.

**F7 — The `embed` Edge Function is not deployed** on System A (`404 NOT_FOUND`), and the `vector`, `pgmq` and `util` schemas are absent. The embedding pipeline exists only as repository code.

---

## 10. What remains a Product Owner decision

1. **Confirm the destination: System A.** The technical evidence is now one-sided, but the choice carries business consequences — the mobile release cycle, which domain becomes canonical, and any maintenance window — that are not determinable from repository or runtime evidence.
2. **Provide System B's service-role key,** or run a counted inventory of its user-owned tables. With anon access only, `users` and all user-owned tables are correctly RLS-blocked, so the true number of registered accounts cannot be established. Two users show recorded activity; the total is unverified and must be known before any account migration.
3. **Authorise the RLS fix on System B** for `phone_otps`, `login_sessions`, and the three analytics views — independent of the consolidation decision.
4. **Decide the public domain:** `tawveeri.com` (Railway, current code) or `tawveeri.etlaq.sa` (VPS, older build). Mobile currently points at the latter.
