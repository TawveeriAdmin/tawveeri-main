# Handoff — TPS Category Expansion + Roadmap Through E15

**Updated:** 2026-07-22 · **HEAD:** `5d728ea` (main, pushed) · production `vyceqrzttspyycdpojtn` (Railway/tawveeri.com).

This handoff lets any session resume without state loss (founder continuity directive). It records what is done + verified, exact production evidence, and the next executable actions in priority order.

---

## 1. Done & production-verified this cycle

**6 live TPS categories** (evidence-backed corroborating sweep complete). Owned index `tawveeri_tps_products` + projection = **74 corroborated canonicals**. Every category: read-only audit → identity contract → plugin (`scripts/tps-plugins/<cat>/`) → matcher (`scripts/tps-matcher/<cat>-matcher-v1-dry.ts`) → unit tests → bounded ≤500 dry-run → precision review → bounded write → projection rebuild → index sync → live AR/EN search → measured exit → regression → ADR.

| Category | Canonicals | ADR |
|---|---|---|
| mobile | 38 | (E6) |
| air_conditioner | 10 | 022/023 |
| tv | 8 | 034 |
| tablet | 8 | 035 |
| audio | 7 | 037 |
| camera | 3 | 038 |
| **laptop** | **0 (correct)** | 032 — built+precise; 0 catalog corroboration |
| appliance | deferred | 033 — single-store |

**Cross-cutting fix (ADR-036):** measured-exit URL robustness — `scripts/tps-core/url-util.ts` `pickBestUrl` (prefer absolute `productUrl` over Extra's relative `urlAr`) in all matchers; backfilled tv/tablet/ac (0 relative URLs); `/go` hardened (`force-dynamic` + guard). All measured exits 302 across stores/categories.

**Tests:** full suite `tests/scraping/` = **120/120** (7 category suites + scheduler/security/smart-pick/routing).

**Verification commands (reproduce):**
- Live search: `GET https://tawveeri.com/api/v1/tps/search?q=<كاميرا|سماعة|تابلت|تلفزيون|ايفون|مكيف>&limit=3`
- Measured exit: `GET https://tawveeri.com/go/<offer_id>?source=test` → 302 → store URL
- Coverage metrics: see `docs/CATALOG-COMPLETENESS-GATE.md` §1 (queries inline)

---

## 2. Key architectural truths (evidence-established)

- **Cross-store corroboration is small.** 74 corroborated of 132,316 observations. Most Saudi retail products are **structurally single-store** (laptop 0, appliances 0). Raw counts ≠ corroboration.
- **→ E14 must be HYBRID**, not a sole-index cutover (would collapse search to 74). Founder-defined layered authority: canonical+SmartPick for corroborated, labelled discovery for single-store, accessories separated, Platform API v1 authoritative.
- **Milestone 7 / TPS is intact and is the permanent foundation.** Every write is ≥2-store, price-band-guarded, parser-versioned, provenance-complete.

---

## 2b. Progress update (2026-07-22, later)

- **Progressive batching SHIPPED + saturated** (ADR-039): all 133,447 obs processed; 812 products resolved; **94 corroborated** (TV/tablet doubled 8→16, AC 10→14); 0 duplicates. Engine: `progressive-engine.ts` (sweep) + `bulk-backfill.ts` (initial saturation) + durable cursor.
- **E14 hybrid SHIPPED + production-verified** (ADR-040, build 0d001ac): `/api/v1/tps/search` = Layer 1 comparison + Layer 2 resolved-single discovery (labelled, measured exits, 0 false-comparison). Owned index **394** (94 comparison + 300 resolved-single). Layer 2 written by `write-resolved-single.ts`.
- **E15 gate ASSESSED** (`docs/E15-RETIREMENT-GATE.md`): gates 1–10 met; System B has no runtime dependency / required data. **Blockers:** E11 mobile (credential-free), E14 full cutover (credential-free), **System B archive needs System B's DB/service-role credential — ABSENT (external blocker)**, ownership decision (founder).

## 3. Next executable actions (priority order)

### A. Progressive batching (top coverage enabler) — `CATALOG-COMPLETENESS-GATE.md` §4
Matchers fetch `order by id limit perStore` — the **same first slice** every run (idempotent, not progressive). Full-catalog audits show more corroboration exists than captured (TV ≈39 pairs vs 8 written; tablet ≈13 vs 8). **Implement a cursor / `processing_status`-aware fetch** so repeated bounded batches advance. Design note: marking non-matches `done` loses future re-corroboration — prefer a per-category id cursor, or a periodic pending-rescan. Expected: grow 74 → low hundreds (most products stay single-store). This is shared logic across 6 matchers — factor into `tps-core`.

### B. E14 hybrid search authority (roadmap-completing)
Design + implement layered search: (1) TPS canonical/SmartPick for corroborated, (2) discovery results labelled "single-store · comparison unavailable", (3) accessories separated, (4) no false comparison. Shadow-test vs current search (AR/EN, brands, model numbers, typos, facets, empty states, latency, zero-result rate, no catalog disappearance); staged cutover; rollback-tested. Do NOT collapse to indexed-canonical-only.

### C. E11 mobile convergence (parallel)
Replace remaining mobile direct catalog reads with `platformApi` (`mobile/src/lib/api/platform.ts`) so in-app items carry `canonical_id`/`offer_id`/`go_url`; render decision objects; remove raw-URL exits where `go_url` exists; mobile type-check + release build; app-store release candidate + runbook. External store review may lag — document, don't let it block E14/E15.

### D. E15 legacy retirement (after E14 authoritative + stable)
Prove the retirement gate (System A authoritative, TPS canonical, no required System B dependency, measured exits + attribution, owned search live + rollback-tested, schedulers/adapters on A, backups exist, single-store products still discoverable). Archive before any irreversible retirement.

### E. Data hygiene (minor)
Unify Jarir `store_name` labels (`جرير` 50,856 + `jarir` 4,111) — `store_id` joins are correct, text label isn't. Non-blocking.

---

## 4. How to run a category batch (pattern)

```
# dry-run (no writes), inspect proposed keys for over-merge:
DRY_RUN=true <CAT>_TOTAL_LIMIT=500 DUMP_IDS=/tmp/x.json npx tsx scripts/tps-matcher/<cat>-matcher-v1-dry.ts
# write (bounded, idempotent, rollback via canonical_ids in write_ac_batch):
DRY_RUN=false <CAT>_TOTAL_LIMIT=500 npx tsx scripts/tps-matcher/<cat>-matcher-v1-dry.ts
# then always:
npx tsx scripts/build-tps-projection.ts && npx tsx scripts/tps-algolia-sync.ts
```
Precision gate before any write: dry-run → inspect high-offer keys' titles (`scripts/tps-test/<cat>-overmerge-check.ts`) → confirm no sibling/variant/generation over-merge → only then write. `write_ac_batch` is category-agnostic (category from JSON) and upserts (idempotent); it is the single atomic write path for all categories.

---

## 5. Stop conditions (unchanged from founder directive)
Continue autonomously. Stop only for: a genuinely missing external credential with no approved alternative, billing/paid-service approval, legal/ownership, external account access unobtainable from project access, irreversible deletion without a verified archive, or a change to the Constitution itself. Never stop for category selection, code, migrations, batches, deploys, docs, scope, sessions, low yield, or a plugin correctly writing 0.
