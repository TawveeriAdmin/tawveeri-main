# Architecture Reconciliation Report

**Milestone:** M1 final deliverable.
**Method:** Read-only introspection of both Supabase projects and both live deployments, plus repository evidence. No writes, no schema changes, no migration.
**Date of evidence:** 2026-07-20.

---

## URGENT — Live PII exposure on System B

Verified with the **public anon key** (embedded in the mobile app binary and the web bundle):

| Table | Rows readable by any anonymous client |
|---|---|
| `phone_otps` | **94** — phone numbers and OTP codes |
| `login_sessions` | **12** — user ids and device fingerprints |
| `mv_user_analytics` | **400** — user ids with activity counts |

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

**Consolidate onto System B's database, migrating the TPS graph into it.**

Rationale, from evidence only:

1. **Irreplaceable vs reproducible.** System B holds `users`, authentication, `phone_otps`, `login_sessions`, wishlists, alerts, and transactions — data tied to real customer identities that cannot be regenerated. System A's TPS graph is large (123,925 observations) but is *derived*, and Blueprint principle P14 requires it to be rebuildable from raw evidence. Moving derived data is safer than moving identity data.
2. **Mobile is already there.** Mobile targets System B exclusively. Consolidating onto A would require a coordinated app release before customers could function; consolidating onto B does not.
3. **Catalog mass.** B holds 94,921 products and 106,108 price rows versus A's 4,817 and 59,818.
4. **Migration direction is additive.** TPS tables have no name collisions in B (`canonical_products`, `raw_observations`, etc. are all absent there), so they can be created alongside without touching B's existing schema. The reverse — creating `users`, auth, wishlists, coupons, transactions in A — collides with A's reduced `products`/`product_stores`/`stores` shapes and would require reshaping tables that TPS depends on.
5. **The repository already describes B.** `types.ts` and the 27 migrations in `scripts/database/` are B's contract. Consolidating onto B makes the repository correct rather than requiring it to be rewritten.
6. **A's own bridge already points this way.** `products.canonical_product_id` exists in A specifically to relate a legacy catalog to canonical identity — the same mechanism applies when the canonical layer lands in B.

**What must move:** the six TPS tables plus `outbound_clicks`, `tps_product_projection`, `waffar_conversations`, A's `schema_migrations` history, and the Algolia integration.
**What must be rebuilt in place rather than moved:** the projection and the search index — both are reproducible from canonical data.
**What must be added afterwards:** the embedding infrastructure (`vector`, `pgmq`, `util`, `products.embedding`), which exists in neither system today.

**Counter-consideration, stated honestly:** the deployed code on System A is current and TPS-aware, while System B runs an older build. Consolidating onto B's *database* therefore also requires deploying current code against it. That is a deployment step, not a data risk, and it is smaller than migrating customer identity data.

---

## 9. What remains a Product Owner decision

Only one question is genuinely open: **confirm the destination database.** The evidence points to System B, but the decision carries business consequences — customer-facing downtime windows, the mobile release cycle, and which domain becomes canonical — that are not determinable from repository or runtime evidence.

Subsidiary decisions that follow from it: which domain is retired, whether `tawveeri.etlaq.sa` or `tawveeri.com` becomes the public host, and the acceptable maintenance window.
