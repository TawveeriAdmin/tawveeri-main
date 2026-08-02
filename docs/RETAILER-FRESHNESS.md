# Retailer Ingestion Freshness — diagnosis and standing classification

**Measured 2026-08-02 on production `vyceqrzttspyycdpojtn`.** Companion to
`docs/RETAILER-MATRIX.md` (which governs *scope*); this file governs *freshness*.

**SLO** (`scripts/tps-analysis/platform-health.ts`): a retailer is **OK** ≤26h since its last
observation, **WARN** >26h, **FAIL** >48h.

**Instruments:** `npx tsx scripts/tps-analysis/ingestion-diagnosis.ts` (per-retailer: enabled,
scheduled, last attempt, last success, failing layer) and
`npx tsx scripts/tps-analysis/comparison-freshness.ts` (the customer-facing question: how fresh
are the prices *behind the comparisons*).

---

## THE RULE THIS FILE EXISTS TO RECORD

> **Freshness of the catalogue is not freshness of the comparison.**

Store-level ingestion freshness was GREEN for five retailers while only **6 of 801** comparable
products carried a price inside the 26h SLO (median **173.6h**). The health check asks "did this
store produce *any* row recently" — discovery keeps that green by finding *new* products. It does
not ask "are the products we actually SHOW being re-priced", which is the question a customer's
trust depends on. Both checks now exist; the second one is the launch metric.

---

## Classification (do not restart a retailer without reading its class)

| Retailer | Class | Freshness | Evidence |
|---|---|---|---|
| **jarir, amazon, extra, almanea, lulu** | **production-deep** | 0.1–3.3h | schedule-driven; untouched by this work |
| **noon** | **blocked at the retailer** | 78h | discovery runs **229 s** and returns 0. An independent datacenter IP also times out on noon.com. Not our code — both scrapers work from a Saudi IP (29 products in 2.5s) |
| **sharafdg** | **blocked at the retailer** | 78h | **HTTP 403 Forbidden** to our production egress, on search *and* product pages (8/8). Same URLs serve fine from a Saudi IP and from a different datacenter, so it is our egress range specifically. No credential-free API: `wp-json/wc/store/*` returns `rest_no_route`, sitemap 404s |
| **shaker, najm, samsung_ksa** | **intentionally paused** | 84–152h | dropped from the ingestion set by Founder Directive 2026-07-27 (approved-27 scope cut). **Not failures.** They stopped ingesting on exactly that date |
| **alnakheelk** | **approved, never scheduled** | 175h | in `APPROVED_STORE_IDS` (ADR-139) but never in the ingest set |
| **swsg** | **approved, dormant** | 258h | approved `credential_free`; scraper dormant since 2026-07-22 |
| **hdf, goldenstore99, mhzm, aletawik, pcpalace, sonyworld, amnkwm, alsfeerzone, alhowaish, alduaalbarq, eazyworld** | **not approved** | 170–196h | acquisition-engine onboarding probes, never in the ingest set and not customer-visible. **Not failures** |
| **blackbox** | **blocked, never ingested** | never | bot-walled; documented ADR-148 known gap |

---

## Root causes found and fixed (2026-08-02)

1. **A run that fetched nothing reported `success`.** `sharafdg-scraper.ts` and `noon-scraper.ts`
   both caught a fetch failure and returned `[]`, so the orchestrator saw 0 products / 0 errors.
   Sharaf DG was dark for three days with every signal green. A failure that produced NOTHING now
   throws; a failure after partial collection still keeps what it collected.
2. **Failures were mute.** The reason existed only in container stdout. `DiscoveryResult.error_messages`
   now reaches `scraping_runs.error_summary` — which is how the `HTTP 403` above was finally read.
3. **60 runs stuck in `running` forever** (oldest 266h) made `hasActiveRun` treat corpses as live
   runs and made the stuck-run health check meaningless. `reapStaleRuns` closes them, and runs
   BEFORE the overlap check.
4. **The price-update queue had never advanced.** Selection is
   `order by last_checked_at asc nulls first limit N` and **nothing ever wrote `last_checked_at`**,
   so every run picked the same rows — a head full of delisted offers (Extra's oldest URLs 404).
   Every attempt now stamps it; success resets `consecutive_misses`, failure increments it.
   *Proof:* Extra went from 0/20 updated to **25/25 with zero errors** once the cursor moved past
   the dead head. No schema change — an earlier attempt disabled itself looking for
   `consecutive_failures`; production has `consecutive_misses`/`scrape_status` (migration 17).
5. **A refreshed price was not an observation.** `ingestBatch` ran only in discovery, so the price
   loop updated the storefront row and wrote nothing the knowledge layer could see — and the
   knowledge layer is what serves comparisons. *Proof:* an Extra price run now writes 12 products
   and 12 new `raw_observations`.

## Still open — needs a Founder decision, not more engineering

- **noon** and **sharafdg** are refused at the retailer from our production egress. Every
  credential-free route was checked and none exists. Restoring them requires egress from a Saudi
  or residential IP (a paid proxy) — a commercial commitment, deliberately not taken.
- **shaker / najm / samsung_ksa / alnakheelk** are approved for *display* while excluded from
  *ingestion*, so they can show prices 4–8 days old. That contradiction is a scope decision.
