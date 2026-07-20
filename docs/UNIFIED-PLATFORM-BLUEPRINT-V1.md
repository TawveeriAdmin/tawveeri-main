# Tawveeri Unified Platform Blueprint v1

**Status:** Constitutional architecture. Supersedes the Architecture Blueprint's assumption of a single production system.
**Basis:** Architecture Reconciliation Report (`ARCHITECTURE-RECONCILIATION.md`), verified against both live systems 2026-07-20.
**Confidence:** ≥95%. Residual unknowns are listed in §9 and none block the plan.

---

## 1. Target state in one statement

> One platform on System A's database (`vyceqrzttspyycdpojtn`), running one codebase on Railway, serving Web, Mobile, API and agents through one API surface, with one canonical product identity, one decision layer, one scheduler, one search index, and one measured commercial exit.

---

## 2. Component classification

**A — Canonical (survives as-is)**

| Component | Location | Why |
|---|---|---|
| `canonical_products`, `product_matches`, `identity_resolution_events` | System A | The identity graph. Irreproducible decision history. |
| `raw_observations` (124,387) | System A | Immutable evidence; rebuild source for every derived layer. |
| `price_history` (59,911) | System A | Append-only temporal truth. Non-reproducible. |
| `normalized_product_observations` | System A | Offer identity; resolved by `/go`. |
| `outbound_clicks` | System A | Attribution spine; live traffic. |
| Adapter contract (`adapters/`) | Repo | Registration-based store extension. |
| Category plugin contract (`tps-core`, `tps-plugins`) | Repo | Registration-based category extension. |
| Decision engines (`getDeals`, `getPriceIntelligence`, `buildDecisionLayer`) | Repo | Deterministic judgement. |
| `/go/[offerId]` | Repo + System A | The only measured exit. |
| Waffar (`/api/ai-assistant`) | Repo | LLM phrases, engine decides. |
| SEO layer (sitemap from `canonical_products`, JSON-LD) | Repo | Already canonical-only. |
| Railway deployment | System A | Managed, current code. |

**B — Temporary (bridge, with a defined exit)**

| Component | Exit condition |
|---|---|
| System A `products` / `product_stores` / `stores` (reduced shapes) | Retire when all ingestion flows through `raw_observations` and canonical identity |
| `products.canonical_product_id` bridge | Retire with the above |
| `/api/cron/discover-products` (legacy scraper path) | Retire when adapters cover all 8 stores |
| Algolia `products` index | Retire when `tawveeri_tps_products` reaches parity and is switched |
| System B, entire | Retire after user data is inventoried and migrated |

**C — Duplicate (one survivor must be chosen — see §6)**

Catalog tables (both systems) · scraping pipelines (`discover-products` vs `discover-firecrawl`) · Algolia indexes · deployments (Railway vs VPS) · schedulers (PM2 vs GitHub Actions vs Railway-side) · Arabic↔English dictionaries (`/api/search`, `/api/match`) · saved-search and spec modules (web vs mobile) · design systems (web vs mobile) · migration histories (`schema_migrations` vs `scripts/database/`).

**D — Deprecated (remove, no replacement needed)**

`docker-compose.yml` (provisions retired Flask) · `railway.json` (superseded by `railway.toml`) · `scripts/scraping/` Python/Flask · `flask:*` npm scripts · `canonical_products_backup`, `products_category_backup_20260626`, `tmp_ac_matches`, `tmp_matches` · System B's stale catalog data.

**E — Missing (exists nowhere in working form)**

Recommendation RPCs on System A · `products.embedding` + `vector`/`pgmq`/`util` schemas · deployed `embed` Edge Function · analytics materialised views on System A · run logging for the active scrapers (`scraping_runs` = 0) · TPS pipeline automation · decision-layer rendering on any client · mobile attribution.

**F — Requires migration**

System B → System A: `users`, `user_wishlists`, `price_alerts`, `saved_searches`, `product_views`, `user_preferences`, `notifications`, `coupons`, `transactions`, `admin_logs`, `product_reviews`, `store_reviews`, `phone_otps`, `login_sessions`. Schema creation is additive (none of these exist in A); data volume is small but **unverified** pending B's service-role key.

**G — Requires redesign**

TPS normalization trigger model (124,387 observations pending, never consumed) · scraper orchestration (two uncoordinated paths, no run logging) · `types.ts` (describes neither system correctly once consolidation completes) · mobile data access (45 direct catalog reads must become platform contracts) · Algolia sync (original code exists in git history but must target the canonical projection).

---

## 3. Infrastructure topology (target)

```
                        ┌─────────────────────────────┐
                        │  Railway (railway-hikari)   │
                        │  Next.js, current codebase  │
                        │  domain: tawveeri.com       │
                        └──────────────┬──────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │  Supabase vyceqrzttspyycdpojtn      │
                    │  - canonical graph + price history  │
                    │  - raw observations                 │
                    │  - user/auth/commerce (migrated in) │
                    │  - pg_cron, pg_net, vault, storage  │
                    │  - Edge Function: embed             │
                    └──────────────────┬──────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │  Algolia C5QNKN5OHS                 │
                    │  index: tawveeri_tps_products       │
                    └─────────────────────────────────────┘

  RETIRED: VPS (nginx/Ubuntu) · tawveeri.etlaq.sa · Supabase ffpsjjazsluolysgithg
```

## 4. Runtime & scheduler topology (target)

One scheduler owns all recurring work. Candidates today are PM2 (repo config, VPS-oriented), GitHub Actions (6 h, one store), and an unidentified Railway-side trigger. **Survivor: a single scheduler tick against Railway**, driving `/api/cron/dispatch`, which reads `scraping_schedules` and fans out with claim-locking and run logging. The GitHub Action is retired; PM2 is retired with the VPS.

## 5. Data topology (target)

```
merchants ──► adapters (8/8) ──► raw_observations  [immutable]
                                       │ event
                                       ▼
                     normalized_product_observations
                                       │
                            identity_resolution_events ──► review queue
                                       ▼
                       canonical_products + product_matches
                                       ▼
                              price_history [append-only]
                                       ▼
                          tps_product_projection
                                       ▼
                        Algolia tawveeri_tps_products
                                       ▼
        search · product page · deals · Waffar · recommendations
                                       ▼
                    /go/{offerId} ──► outbound_clicks ──► transactions

  user state (migrated from B): users · wishlists · alerts · saved searches
                · product_views · preferences · notifications · coupons
```

## 6. Duplicated responsibilities — survivor decisions

| Duplication | Why it exists | Superior implementation | Migration cost | Operational risk | **Survivor** |
|---|---|---|---|---|---|
| Catalog tables in both DBs | Two systems evolved separately | System A — live pipeline, canonical linkage | Low (B's data is stale, not migrated) | Low | **System A** |
| Scraping: `discover-products` vs `discover-firecrawl` | Legacy scrapers predate the adapter contract | `discover-firecrawl` — adapter contract, paging state, raw observations, registration-based | Medium — 6 adapters to write | Medium — per-store parity needed before each cutover | **`discover-firecrawl` / adapters** |
| Algolia `products` vs `tawveeri_tps_products` | Sync script was overwritten (`d386ede`); TPS index built but never wired | TPS index — canonical-keyed, AR/EN configured, savings-ranked | Low — rebuild from projection | Low — flag-reversible | **`tawveeri_tps_products`** |
| Deployments: Railway vs VPS | Two generations of the product | Railway — managed, current code, live traffic | Low | Low | **Railway** |
| Schedulers: PM2 / GitHub Actions / Railway-side | Accreted | Single tick → `/api/cron/dispatch` with claim-locking and run logging | Low | Medium — must not double-run | **One Railway-side scheduler** |
| AR↔EN dictionaries (`/api/search`, `/api/match`) | Copy-paste | Neither — extract to a shared service | Low | Low | **New shared service** |
| Saved-search / spec modules (web vs mobile) | Client duplication | Web implementation, promoted to platform contract | Low | Low | **Platform service** |
| Design systems (web vs mobile) | Platform-native rendering | Neither — shared semantic tokens, native renderers | Medium | Low | **Shared token source** |
| Migration histories | Two databases | `schema_migrations` in-database, extended to cover the migrated app schema | Low | Low | **In-database `schema_migrations`** |

No survivor was chosen for existing merely because it exists: the adapter path wins on contract quality, the TPS index wins on design, Railway wins on managed currency, and in three cases the survivor is **neither** existing implementation.

## 7. Failure modes and rollback per subsystem

| Subsystem | Primary failure mode | Rollback |
|---|---|---|
| Acquisition | Merchant HTML change → parse failure | Per-store isolation; failure counters; other stores unaffected |
| Normalization | Plugin bug → wrong attributes | Reprocess from `raw_observations` by plugin version |
| Identity | Wrong merge → conflated products | Supersession record, never deletion; rebuild from resolution events |
| Price history | Duplicate append | Idempotency key (match id, observed_at) |
| Projection / index | Stale or partial | Full rebuild from projection; flag back to prior index |
| Decision layer | Insufficient evidence | Returns `insufficient`; never a weaker guess |
| Commerce | Click log failure | Redirect still proceeds; failure alarms |
| Auth (post-migration) | Session mismatch | Keep B readable during the window; revert client env |
| Mobile | Bad release | Staged rollout; server contracts unchanged |

## 8. Migration complexity ranking

| Item | Complexity | Reversibility |
|---|---|---|
| RLS fix on System B | Trivial | Full |
| Algolia sync restoration | Low | Full |
| Scheduler consolidation | Low | Full |
| Decision-layer rendering | Low | Full |
| App schema creation in A | Medium | Full (additive) |
| User data migration | Medium — volume unverified | Full while B is retained |
| TPS pipeline automation | High | Full (shadow first) |
| Mobile re-pointing + contracts | High | Staged rollout |
| Adapter completion (6 stores) | High | Per-store |
| Embedding infrastructure | Medium | Full |

## 9. Residual unknowns (none blocking)

1. Total registered users on System B — requires B's service-role key.
2. What triggers `/api/cron/discover-firecrawl` on Railway.
3. Whether the shipped mobile build matches repository source.
4. Provenance of the nine database-only tables (F6 in the reconciliation report).
5. Whether any customer traffic still reaches `tawveeri.etlaq.sa` directly.
