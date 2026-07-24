# Session Handover — 2026-07-25

**Purpose:** resume Tawveeri engineering in a fresh Claude Code session without losing context. Everything below is evidence-based and verified at session end. **Read `docs/DECISIONS.md` (ADRs 072–088) for full rationale; this is the operational snapshot.**

> ⚠️ **Do NOT reopen completed work.** ADRs 072–088 are DONE, committed, pushed, and (where noted) production-verified. Re-verify with the commands in §18 before touching anything. Treat "identity/parser/appliance-identity for more comparisons" and "the automation is broken" as SOLVED — see §14 for why.

---

## 1. Exact project state at session end
- **Branch:** `main`. **HEAD = `24f5cd8`.** Working tree **clean** (`git status` empty). 0 temp files in `scripts/tps-test/`.
- **All commits pushed to `origin/main`** through `24f5cd8`.
- **Production LIVE on `24f5cd8`** (verified: `/en` → 200; `/api/v1/agent/decide` → `trust=true, freshness_status=ok, "last observed 69h ago"` — ADR-088 freshness is live).
- **Automation self-refreshing hourly** on Railway (ADR-078), pooler-routed, verified.
- **Tests: 628 passing, 45 suites, 0 failures.** Production build passes (0 compile errors, 39/39 static pages).

## 2. Everything implemented this session (ADRs 072–088)
Earlier segment: 072 laptop parser (64.7→88.8%), 073 audio (69.2→83.0%), 074 monitor registered (93.6%), 075 printer registered (86.5%), 076 appliance false-merge fix, 077 AC LG design-series, 078 **automation fixed+verified**, 079 AC NO_TECH (58.9→83.1%), 080 mobile parser (86.2→87.5%).
**Phase-2 / recent 8 ADRs (081–088):**
- **081** — storage-optional `NO_STORAGE` mobile canonical → identification **87.5→98.3%** (single-store, so +0 comparisons; honest).
- **082** — merchant coverage: recurring shaker+samsung_ksa ingestion (in-scheduler loop); fixed a CRITICAL `write-resolved-single` chain-abort + dispatch-502; `TPS_STORES` +6/+7; projection read-time store_name collapse.
- **083** — E15.5 appliance identity-normalization measured & closed **FAIL** (no code) — merchant-overlap-bound, not identity.
- **084** — `NO_STORAGE` sentinel leak fix ("NO_STORAGEGB" in titles); 47 canonicals remediated.
- **085** — **Affiliate & Official Feed Framework** (`src/lib/providers/`), Amazon reference live.
- **086** — **WooCommerce Store-API feed adapter** (credential-free) + `/api/debug/scheduler` secured (CRON_SECRET-gated, 404).
- **087** — **Trust & Evidence Engine** (`src/lib/intelligence/evidence-engine.ts`), unified across all surfaces.
- **088** — **real per-product freshness** (`last_observed_at`).

## 3. Trust & Evidence Engine — architecture + production integration (ADR-087/088)
- **File:** `src/lib/intelligence/evidence-engine.ts`. **Pure, deterministic, no LLM in the score path.**
- **`assessTrust(EvidenceInput)` → `{ score 0–100, tier high|medium|low, factors[], caveats_ar/en }`.** 6 weighted factors (sum 1.0): corroboration **0.32** (single store sc=1→0.2, can't be price-compared), identity **0.22** (capped ≤0.55 when a price-determining spec unstated, e.g. NO_STORAGE), price-history depth **0.20** (from `price-intelligence.ts` verdict), freshness **0.14** (from `last_observed_at`), price consistency **0.08** (low cross-store spread = verification), discount integrity **0.04**. Score = Σ contributions (no hidden terms). **Missing signal NEVER inflates trust** (unknown = conservative + flagged caveat).
- **Helpers:** `productTrust(row, extra?)` (convenience over a projection row; auto-derives `data_age_hours` from `last_observed_at`), `specsIncompleteFromKey(key)`, `hoursSince(iso)`, `EVIDENCE_ENGINE_VERSION="trust-v1"`.
- **It COMPOSES existing primitives** (`price-intelligence.ts` computePriceVerdict, `merchant-trust.ts` computeStoreTrust, discount integrity, product-edges) — do NOT re-derive them.
- **Production integration (LIVE):** `decision-engine.ts` (`baseTrust`, `Recommendation.trust`, `confidence = trust.score`); the decide route enriches with price verdict + freshness; **`/api/v1/agent/decide`, `/api/v1/tps/search`, `/api/v1/tps/recommendations`, `/api/v1/protocol/ucp/feed`** all compute trust one way via `productTrust`. Replaced the old ad-hoc `((identity_confidence??70)+store_count*8)/1.2` heuristic everywhere.

## 4. Files changed this session (by area)
- **Providers (new, `src/lib/providers/`):** `types.ts`, `link.ts`, `registry.ts`, `index.ts`, `networks/{amazon,param,direct}.ts`, `sourcing/{types,router,scraper-adapter,feed-adapter,woocommerce-feed-adapter}.ts`.
- **Intelligence (new):** `src/lib/intelligence/evidence-engine.ts`.
- **Routes changed:** `src/app/go/[offerId]/route.ts` (framework exit), `src/app/api/debug/scheduler/route.ts` (secured), `src/app/api/v1/agent/decide/route.ts`, `.../tps/search/route.ts`, `.../tps/recommendations/route.ts`, `.../protocol/ucp/feed/route.ts` (trust).
- **Engine:** `src/lib/agent/decision-engine.ts` (trust).
- **Plugins (parser/identity):** `scripts/tps-plugins/mobile/{parser,detector,identity,validator}.ts`; `scripts/tps-core/category-registry.ts` (TPS_STORES 6/7, mobile names/attrs NO_STORAGE, provider feedUrl); ac/refrigerator/washing_machine/monitor/printer/appliance touched earlier.
- **Pipeline scripts:** `scripts/build-tps-projection.ts` (store-name collapse + `last_observed_at`), `scripts/tps-matcher/write-resolved-single.ts` (skip-existing fix), `scripts/tps-core/{scheduler.js (ingestion loop),pooler-url.js,ingest-via-provider.ts}`, `src/app/api/cron/dispatch/route.ts` (502 fix).
- **SQL migrations:** `scripts/database/19-outbound-clicks-subid.sql`, `20-projection-last-observed.sql` (both applied to prod, additive/idempotent).
- **Tests (new):** `tests/providers/affiliate-framework.test.ts` (17), `tests/intelligence/evidence-engine.test.ts` (8), `tests/catalog/mobile-display-name.test.ts` (3); updated mobile identity tests.
- **Docs:** `docs/DECISIONS.md` (ADRs 078–088), `docs/AFFILIATE-FRAMEWORK.md` (new), `docs/ROADMAP.md` (Phase 2 row), this handover.

## 5. ADRs created/updated
**Created 072–088** in `docs/DECISIONS.md`. ADR-078 was also **corrected** (the launcher approach 502'd and was reverted; the verified solution is instrumentation-spawn + IPv4 pooler + require-path + guard fixes).

## 6. Build & test results (exact)
- `npx jest` → **Test Suites: 45 passed / 45; Tests: 628 passed / 628; 0 failures.**
- `npm run build` → exit 0, **0 compile errors**, "✓ Generating static pages (39/39)". (Pre-existing non-fatal webpack warnings for `child_process`/`fs`/`path` come from `src/instrumentation.ts` — expected, guarded, ignore.)

## 7. Production-verification results
- `GET /en` → **200**. `POST /api/v1/agent/decide` → **200**, returns `smart_pick.trust` with 6 factors + caveats; `confidence == trust.score`; **freshness factor live** ("last observed 69h ago", status ok).
- `/go/<amazon offer>` → 302 → `amazon.sa/dp/<ASIN>?tag=tawveeri-21&ascsubtag=<subid>`; `outbound_clicks` row records `program/tag/sub_id/source` (ADR-085).
- `/api/debug/scheduler` → **404** unauthorized (secured, ADR-086).
- Automation: scheduler heartbeat fresh, hourly refresh `status=ok`, projection auto-advances (ADR-078). `tps:health` last run **0 FAIL** (WARNs pre-existing: store staleness, noon block, dispatcher-idle).

## 8. Evidence projection status
`tps_product_projection` **rebuilt** at session end: **2927 rows written**, **2927/2927 carry `last_observed_at`** (newest observation 0.2h old). Store-name collapse active (numeric legacy → Arabic name; no double-count). Column `last_observed_at` exists (migration 20).

## 9. Current catalog & comparable-product measurements
- Canonicals ~4600+; **projection 2927 rows; comparable (≥2 stores) = 266** (was 254 at start of the Phase-2 window; grew via ongoing ingestion). ~89% of products are single-store (merchant-overlap-bound — see §14/§15).
- Mobile identification **98.3%** where comparison possible (ADR-081); AC 83.1%; tv/tablet/smartwatch/monitor/printer 86–95%.

## 10. Ingestion & freshness status
- Recurring in-scheduler ingestion **live** for shaker(7)+samsung_ksa(6) (ADR-082): discovery 12h / prices 6h. shaker ~1800+ obs; samsung_ksa low-yield (Puppeteer).
- **WooCommerce feed path works** (`npm run tps:ingest-provider shaker --feed`) — credential-free, cleaner than HTML scrape; NOT yet the default (flag `PROVIDER_SHAKER_SOURCING=api`).
- Freshness: newest projection observation 0.2h; some categories (AC) ~69h (their stores scrape less often).
- **noon (store 3) is BLOCKED** (anti-bot, HTTP 000/timeout everywhere incl. production) — stale ~2 days; deliberately NOT chased.

## 11. Deployment status
**`24f5cd8` is DEPLOYED and LIVE** (verified §7). Railway auto-deploys on push; automation self-refreshes hourly.

## 12. All commit hashes created this session (newest→oldest)
`24f5cd8`(088) `181082e`(roadmap) `e347fd5`(087 unify) `8c8b478`(087) `b08993f`(086 feed-ingest) `e752fdc`(086) `bc35ab7`(085) `29e5659`(084) `b31faf7`(083) `eeec955`(082) `012f5c0`(081) `189218b`(cleanup) `5e8e187`(080) `1480cab`·`9aec76e`·`c5b5b96`·`d5c0983`·`0420ca6`·`dafcd21`·`e9b6561`·`fb483c3`·`3fd9d78`·`423442f`·`0f2043a`·`5da0f15`(078) `0327a6a`(079) `f18c698`(077) `8d149d1`(076) `0f0d007`(075) `ed25caa`(074) `200207c`(073) `e33dfd9`(072).

## 13. Push confirmation
**ALL commits above are pushed to `origin/main`.** `git log origin/main..HEAD` is empty. (Plus this handover commit — see final report.)

## 14. Known gaps, risks, limitations, unfinished work
- **Comparison count is merchant-overlap-bound, NOT identity/parser-bound** (proven repeatedly): 89% of products are single-store; identity work (mobile 98.3%, ADR-081/083) and a whole overlapping merchant (shaker, ADR-082) each added ~0–5 comparisons. **Do not invest more in parsers/identity expecting comparison growth.**
- **High-overlap Saudi retailers block scraping** (Noon/Lulu/Carrefour/HNAK/Axiom/Danzaastore = 403/SPA/Cloudflare). Clean scrape = WooCommerce shops (niche overlap).
- WooCommerce feed adapter is proven but **not yet the default sourcing** (opt-in flag); wiring it into the scheduler auto-loop after a full-catalog equivalence check is a safe follow-up.
- Trust Engine **discount factor** is minor/mostly-default; enriching it + surfacing trust in the customer UI are open (UI needs design direction).
- Legacy `product_stores` transaction path still uses `transactions/affiliate-config.ts`; should migrate to the provider framework later. `normalizeStoreUrl`'s Amazon tag is now redundant (framework owns tagging) — harmless.
- noon block (§10) — low-ROI, do not chase.

## 15. Genuine Founder Approval Boundaries (do NOT proceed without)
1. **LLM credentials + role decision** for agent reasoning/planning (Constitution: LLM only *phrases* supplied facts; deterministic decides). `GOOGLE_AI_API_KEY` exists for embeddings only.
2. **Compatibility/Knowledge Graph data strategy** — accessories are deliberately detector-rejected; building product↔accessory compatibility needs a decision to ingest accessory catalogues.
3. **Affiliate/feed credentials** for high-overlap retailers (Amazon PA-API needs qualifying sales; Jarir/eXtra/Noon affiliate signups; Salla OAuth/Partner). Framework plugs each in **config-only** once credentials land.
4. Any legal/commercial/billing/ownership/contract decision.

## 16. Exact E15.5 status
**E15.5 = OPEN (in progress).** The Decision-Agent track continues; **Phase 2 is its active extension** (Trust Engine etc.). The **appliance-identity-normalization sub-milestone within E15.5 is CLOSED = FAIL** (ADR-083, evidence: merchant-overlap-bound, no code shipped). Roadmap `docs/ROADMAP.md` reflects this (E15.5 🟢 + a Phase 2 row).

## 17. Single highest-value next engineering action
**Wire the WooCommerce feed as the default sourcing for shaker (and generalize the pattern), then research + onboard 1–2 clean WooCommerce/Salla-public Saudi retailers with real cross-store SKU overlap via the feed adapter.** Rationale: it's the only credential-free lever that can add REAL comparisons + it hardens the universal onboarding framework. (Everything higher-overlap needs a Founder credential — §15.) Alternatively, if the Founder unblocks §15.1 or §15.2, execute LLM-phrased explainability or the compatibility graph.

## 18. Commands the next session should run FIRST
```bash
git log --oneline -5                 # confirm HEAD=24f5cd8 (or newer), tree clean
git status --short                   # must be empty
npx jest 2>&1 | tail -3              # expect 628 passing
curl -s -o /dev/null -w "%{http_code}\n" https://tawveeri.com/en   # 200
# live trust + freshness proof:
curl -s -X POST https://tawveeri.com/api/v1/agent/decide -H 'content-type: application/json' \
  -d '{"category":"air_conditioner","room_size_m2":30,"budget_total":5000}' | head -c 600
npx tsx scripts/tps-analysis/platform-health.ts 2>&1 | tail -6   # expect 0 FAIL (WARNs pre-existing)
# comparable count / freshness:
#   select count(*) filter(where has_comparison), count(last_observed_at) from tps_product_projection;
```
Note: `SUPABASE_DB_URL` in `.env.local` is the **direct** host (IPv6, sometimes DNS-flaky locally); scripts route it to the **IPv4 pooler** via `scripts/tps-core/pooler-url.js`. Production `vyceqrzttspyycdpojtn` only; legacy `ffpsjjazsluolysgithg` must never be written.

## 19. Important reasoning / architectural decisions to preserve
- **Corroboration = trust** is the platform's core value and dominates the Trust Engine; unknown beats incorrect (missing evidence lowers trust, never inflates).
- **Deterministic decides; LLM only phrases** (ADR-002) — the trust/ranking path has NO LLM.
- **`Canonical Product → Commercial Variant → Offer`** is unchanged; providers emit OFFERS only, never identities.
- **`tps:comparison-value`'s "comparison possible" = multi-merchant BRAND, not multi-store LISTING** — "X lost comparisons" is an upper bound on catalogue, not realizable comparisons. (Burn this in — it corrected multiple over-estimates.)
- Automation root causes (ADR-078): Railway routes to the MAIN process's port (launcher-as-parent 502'd); Supabase direct host is IPv6-only vs Railway IPv4 (→ pooler); `node --check` doesn't catch bad `require` paths; production guards must accept the pooler URL.
- Internal sentinels (NO_STORAGE/NO_TECH/NO_SERIES/NA) must be stripped at EVERY customer render path (ADR-084).
- Memory files (`~/.claude/.../memory/`) carry durable cross-session facts — read `MEMORY.md`, esp. `tawveeri-phase2-intelligence-architecture.md` and `tawveeri-strategic-position.md`.

## 20. Warning
**Do not reopen ADRs 072–088.** They are shipped and (where noted) production-verified. In particular: identity/parser/appliance-identity are NOT the comparison lever; the automation is NOT broken; the debug endpoint is NOT public. Verify with §18 before assuming otherwise.
