# PRODUCT IDENTITY — FINAL CLOSURE (gates report)

**Prepared:** 2026-10-04 · **Governance:** ADR-403 (policy), ADR-404 (gate, rules, rollback, waves) · **Founder decision implemented:** *Correct Commercial Variant → Fair Merchant Eligibility → Neutral Price Comparison* — the goal is not more Amazon appearances.
**State at this report:** every identity flag **OFF** in production; nothing cut over; production database read-only throughout (shadow, dry-runs, audits); all state-changing rehearsal ran on a **local replica**.

**Labels:** VERIFIED (labelled set) · SHADOW (7-day offline replay of production observations, same observations / prices / eligibility in both worlds) · OBSERVED (production, read-only) · REHEARSED (local replica, real pipeline code) · ESTIMATED · NOT VERIFIED. **Denominators are stated on every figure. "Production precision" is never claimed.**

---

## 1. VERDICT: **PARTIAL CLOSE**

Closed: the three hard engineering gates (rollback rehearsal, search/projection gate, payload-model wiring), the verifier gaps, the shadow, the monitoring and rollback tooling.
**Not closed, by design:** (1) the **founder blind gate** — the sheet is published, no answers yet; it blocks every cutover; (2) **no wave has been executed** — Wave 1 (TV + vacuum) is prepared and waits for (1); (3) appliances, ACs (commercially), monitors (caution) and laptops stay out, for the reasons in §4.

Success criterion restated: *Tawveeri compares the same commercial variant across merchants, rejects or reviews meaningful conflicts, and lets Amazon compete neutrally whenever the evidence proves it is the same product.* Today the code does that behind flags; no customer has seen it.

---

## 2. Gates

| Gate | Status | Evidence |
|---|---|---|
| **G1 Founder blind gate** (60 + 24 pairs, label-free) | **OPEN — awaiting founder** | https://claude.ai/artifact/2A9VaoYbihQowsBWDFWoKL · `phase3b/blind-gate/` (sheet, page, mapping kept apart). Reference labels: reviewer-1 adjudicated, blind reviewer-2 agreed 71/84 (84.5 %). Founder-vs-reference comparison is run when the answers are in. |
| **G2 Write-path rollback rehearsal** (hard blocker) | **DONE — REHEARSED** | §3 |
| **G3 Search / projection gate** (hard blocker) | **DONE in code, REHEARSED on replica, production dry-run OBSERVED** | §5 |
| **G4 Payload model codes wired** | **DONE** | `extractManufacturerModel(payload)` feeds the verifier on every surface that resolves or computes verdicts; result in §4 (appliances stay NO-GO) |
| **G5 Verifier gaps / regressions** | **DONE** | verifier, regression, v1-parity, gate and signals suites green; full jest result recorded in §10 |
| **G6 Shadow re-run, per-category ledger, identity-only commercial impact** | **DONE** | §4, `phase3b/shadow-7d.json` |
| **G7 Date-bound test debt** (item 22) | **DONE, separate commit** `a78a0dfe` | `deriveComparisonSummary(offers, nowMs = Date.now())`; no production behaviour change |
| Wave cutover | **NOT DONE — waits for G1** | §7 |

---

## 3. Write-path rollback rehearsal (REHEARSED, local replica)

**Replica:** Postgres 17.6 + PostgREST 13.0.8 (`db-max-rows = 1000`, so ADR-172 truncation reproduced), schema generated from the **production catalog** (13 tables / 181 columns / 49 indexes / `write_ac_batch` md5-identical; 4 foreign keys to non-replicated tables dropped), data = full small tables + `mobile`/`tv` history + 106,385 raw observations (last 3 days). Production was only read. The REAL `runSweepUnit`, signals job, projection builder and rollback script ran. `scripts/tps-analysis/rehearsal/` (gitignored `.data`, `bin`, `node_modules`); scenario `scenario-v2-rollback.ts`; result `phase3b/rehearsal/scenario-*.json`.

**Scenario** (stores 2, 4, 5; 4 sweeps × 500 observations; `mobile,tv`): v1 steady state → v2 write path on over the same listings → flag off + re-observation → rollback dry / `--go` / idempotency → projection compare.

| Question | Measured answer |
|---|---|
| **What does the v2 write path write?** | In a 2,000-observation replay: **+5 canonicals** (HONOR X5c Plus 128, X7e, X9d, 600 Lite ×2), **+6 current-offer rows**, +19 `price_history`, +5 `normalized_product_observations`, +5 `product_matches`; **133 canonicals stamped** `identity_rules: v2` (40 mobile, 93 TV — most are keys v1 would also produce), 26 offer rows stamped. Existing offer rows re-observed under v2 are overwritten **in place**. |
| **What remains after flag-off alone?** | **A lot — flag-off is NOT a rollback.** After re-observing under v1 the v2-born state was still there: 8 stamped offer rows, 5 active v2-born canonicals, **5 extra rows in the customer projection** (the five HONOR keys). |
| **How are v2 rows isolated / removed?** | Engine stamps (`_identity_rules`, `identity_rules`) and keeps the **first pre-v2 content** of every in-place overwrite (`_identity_prev`). `rollback-identity-v2.ts`: restores overwritten rows **exactly**; retires v2-born rows (`status='invalid'` + `_superseded_by_identity`); restores the v1 row when absent; **deactivates** (never deletes) orphaned v2 canonicals; prunes their projection rows; one transaction; before-state export. |
| **Does rollback restore behaviour and data?** | Current-offer table, v1 snapshot vs after rollback: **2,132 rows before → 2,139 after (+7 = 6 retired v2-born + 1 restored v1 row); 0 missing, 0 differing** — every pre-v2 row restored byte-for-byte. Projection (1,735 rows): same row set, **`store_count` and `has_comparison` identical on all 1,735**; **3 rows differ in price/cheapest store only**, because the append-only `price_history` observations made during the v2 window legitimately remain. (An earlier run, before the pre-image existed, lost a store on 2 TVs — that defect is what `_identity_prev` fixes.) |
| **How long?** | Rollback `--go`: **2.9 s** for 8 stamped rows (**ESTIMATED** linear in stamped rows, one UPDATE each; a production-size run should be dry-run first). v2 sweeps 76 s / 4×500 observations; read-gate on: signals job 3.6 s; read-gate off: 2.4 s. |
| **Idempotent?** | Second `--go`: 0 stamped, 0 changes. Signals job re-run: 0 upserts. |
| **Reconciliation needed?** | Append-only evidence stays by design (`price_history`, `normalized_product_observations`, `product_matches` under deactivated canonicals). The search index entries of pruned rows go at the next Algolia sync — **NOT VERIFIED** (Algolia not replicated). Customer-facing state needs none. |
| **Read-path rollback** | Flag off ⇒ readers stop consulting the table at once; next chain run deletes its rows (153 removed in 2.4 s); projection rebuilt **identical** to the original (0 changed of 1,735). |

**Replica limits (stated):** 3-day raw window; history for `mobile`/`tv` only; `tps_identity_staging` empty at start (gap re-scan not faithfully exercised); no RLS policies, Algolia, or non-write-path RPCs; fsync off; timings are this machine's. Rule kept: **identity-v2 stateful writes stay blocked until the founder gate and a Wave decision**; this rehearsal removes the rollback objection, not the others.

---

## 4. Shadow — per-category ledger (SHADOW, 7 days, 17 stores, 17,901 newest observations)

**Method fix (founder item 20):** both worlds are built from the *same* observations, prices and eligibility rule; only grouping differs (v1 keys vs v2 keys + verifier verdicts). Every difference below is therefore identity-caused by construction (the earlier figure mixed price drift in).

**Headline (all stores):** comparisons **574 → 408**; listings inside comparisons 1,344 → 927; **16 false best prices removed by identity** (the deployed cheapest was a listing the verifier rejects); 132 unverified best prices demoted to reference rows; **13** comparisons whose best price changed because of identity (all upward, total +SAR 4,282.93); 28 listings added to comparisons (19 from new identities, 9 regrouped); 445 removed (**37 rejected, 310 unverified, 93 because the group fell below two stores, 5 regrouped**). Shared identities 699 (v1) → 706 proposed → **531 verified**; +17 newly shared; unsafe v1 identities removed (≥ 1 rejected member): mobile 12, laptop 2, washers 19, tablet 1, refrigerator 3, dishwasher 1, AC 1.

**Per category** (comparisons = groups with ≥ 2 stores with an eligible listing; M/R/X = members verified / review / reject in shared groups; label-set columns are the 459-pair labelled set, VERIFIED):

| Category | Comparisons v1 → v2 | M / R / X | False best prices removed | New shared | Amazon in comparisons v1 → v2 (recovered / removed) | Labelled set: TP / false merges / SAME pairs (false splits) | Production signal share* |
|---|---:|---:|---:|---:|---|---|---:|
| mobile | 80 → 69 | 220 / 11 / 13 | 6 | +17 | 24 → 29 (17 / 12) | 153 / **0** / 158 (5) | 14.1 % |
| tv | 79 → 78 | 307 / 2 / 0 | 0 | 0 | 36 → 37 (2 / 1) | 2 / **0** / 6 (4)† | 6.7 % |
| vacuum | 41 → 39 | 84 / 4 / 0 | 0 | 0 | 5 → 3 (0 / 2) | 2 / 0 / 2 (0) | 8.3 % |
| tablet | 61 → 54 | 163 / 15 / 1 | 0 | 0 | 17 → 12 (0 / 5) | 2 / 0 / 4 (2) | 7.4 % |
| audio | 33 → 27 | 67 / 12 / 0 | 0 | 0 | 20 → 17 (0 / 3) | no labelled pairs | 7.1 % |
| smartwatch | 21 → 16 | 47 / 16 / 0 | 0 | 0 | 14 → 12 (0 / 2) | 1 / 0 / 2 (1) | 8.7 % |
| monitor | 18 → 11 | 35 / 19 / 0 | 0 | 0 | 10 → 6 (0 / 4) | 0 / 0 / 1 (1) | 33.8 % |
| air_conditioner | 6 → 0 | 7 / 17 / 1 | 1 | 0 | 1 → 0 (0 / 1) | 0 / 0 / 2 (2) | 54.5 % |
| washing_machine | 104 → 42 | 144 / 148 / 24 | 7 | 0 | 29 → 13 (0 / 16) | 1 / 0 / 1 (0) | 56.0 % |
| refrigerator | 56 → 19 | 87 / 73 / 4 | 1 | 0 | 16 → 3 (0 / 13) | 2 / 0 / 5 (3) | 36.1 % |
| dishwasher | 22 → 13 | 46 / 21 / 1 | 0 | 0 | 5 → 2 (0 / 3) | 0 / 0 / 1 (1) | 45.7 % |
| microwave | 6 → 5 | 13 / 7 / 0 | 0 | 0 | 5 → 3 (0 / 2) | 1 / 0 / 1 (0) | 41.9 % |
| laptop | 17 → 14 | 30 / 4 / 2 | 1 | 0 | 1 → 0 (0 / 1) | no asserts (doctrine) | 24.5 % |

\* **Production signal share** = review + reject listings ÷ listings in multi-store canonicals, from a read-only dry-run of the signals job over ALL current offers (not only 7 days) — OBSERVED, `build-identity-signals.ts --dry`. † The labelled-set harness feeds titles only; eXtra's declared `modelNumber` (used in production and in the shadow) resolves most TV "code on one side only" reviews there. Overall labelled set: **v2 164 TP / 0 false merges / 5 ambiguous / recall 89.6 % of 183 SAME pairs (19 false splits)**; baseline **64.0 % precision** (55 TP / 31 false merges among 86 labelled asserted) after the label adjudication that moved 3 pairs to AMBIGUOUS (earlier figure 65.2 %, 58 / 31, before adjudication).

**Amazon, in shared groups (SHADOW):** shown in comparison 162, cheapest when eligible 121; excluded: identity conflict 10, unverified 56, no price source 7, availability 6. Over all comparisons Amazon listings in comparisons **196 → 146** (recovered 19 — phones 17, TV 2; removed 69 — **8 rejected, 49 unverified, 10 group below two stores, 2 regrouped**). Amazon loses where the evidence does not prove sameness; it gains where suffix/detector fixes now do. No Amazon-specific logic exists anywhere in the verifier, signals or readers.

---

## 5. Search / projection gate

`tps_offer_identity_signals` (migration 037, RLS on, service-role only) is written by `build-identity-signals.ts` — a new chain step **before** the projection — from the same `resolveGroup` the compare page calls, with the same inputs. It is read as an exclusion by the **projection builder** (search, category cards, Algolia, agents, trust), **live search**, **v1 TPS search**, the **UCP feed** and **Tawveeri Check**; the compare page and agents resolve live. All of it is flag-driven (`TPS_IDENTITY_GATE` read path; `TPS_IDENTITY_V2` also gates), fail-open **and loud** on a read error, and with the flags unset reads and writes nothing (the job's only cost is one catalogue query).
**REHEARSED:** gate on, mobile + TV: 153 signals; **102 of 1,735 projection rows changed** (e.g. iPhone 11: 2 stores → 1, refurbished listing excluded); gate off: signals deleted, projection identical to the original.
**Not covered (stated):** the storefront layer (`products` / `product_stores`), the legacy mobile-only `getProductComparison` helper (sitemap/slug only), the admin win-list, and Algolia removal of pruned rows (next sync).

---

## 6. Category decisions — founder rulings vs evidence

| Category | Founder | Decision now | Why |
|---|---|---|---|
| **TV** | GO | **GO — Wave 1** | 0 rejects, 2 reviews in the shadow; 6.7 % production signal share; Amazon 36 → 37. *Engineering addition:* spec keys are family keys, so a code on one side only → review (cost 37 of 661 listings, 5.6 %). |
| **Vacuum** | GO | **GO — Wave 1** | 0 rejects; 8.3 % share; no new false merge class found. |
| **Phones** | GO w/ conditions | **GO w/ conditions — Wave 2** | 0 false merges / 153 TP of 158; +17 Amazon recovered, 6 false best prices removed. Conditions met in code: storage/RAM/network verified, Samsung A/M verify-not-key. Wave 2 needs the read gate first; the v1→v2 key change (24 splits of merged models) is Stage 2. |
| **Tablets** | GO w/ conditions | **GO w/ conditions — Wave 2** | Wi-Fi vs cellular, storage, size, generation verified; **thin labelled evidence (4 SAME pairs)** — conditioned on the audit sample. |
| **Audio / smartwatch** | GO w/ conditions | **GO w/ conditions — Wave 2** | Wearable boundary stays a permanent regression test; **audio has no labelled pairs** — conditioned on the audit sample; smartwatch size/connectivity verified. |
| **Monitors** | GO w/ conditions, high caution | **GO w/ conditions — LAST in Wave 2, 100 % audit sample** | Verifier rejects code conflicts, refresh-rate, panel, resolution when both state them; spec never beats a code conflict. **33.8 %** of multi-store listings carry a verdict — the loose-identity problem you saw is real and large; comparisons 18 → 11. |
| **Air conditioners** | GO w/ conditions | **Conditions implemented — recommend HOLD (disagree with cutover now)** | Per your rule (no code ⇒ review, never an exact-model claim) **54.5 %** of listings are signalled and the 7-day shadow shows **6 → 0 comparisons**: cutting over today would blank AC comparisons, including the controlled AC Rescue capability. Not a verifier defect — the evidence (codes) is absent. Proceed only after AC code coverage is measured; AC Rescue stays untouched. |
| **Washers / refrigerators / dishwashers** | NO-GO until wiring, then re-decide | **NO-GO re-confirmed after wiring** | Wiring is done and working, and it does not lift the verdict: **96 of 148 washer review members, 52 of 73 refrigerator, 21 of 21 dishwasher carry no model code anywhere** (title or payload). Signal share 56 % / 36 % / 46 %; comparisons 104 → 42, 56 → 19, 22 → 13; the verifier correctly abstains. The lever is merchant data, not engineering. **CORRECTED 2026-10-04 (ADR-405):** that conclusion was drawn from the *review members* only. On the group view (a comparison needs a model on every side) a manufacturer model is present on every listing of 50.7 % of washer groups, 72.5 % of refrigerator groups and 56.5 % of dishwasher groups (`phase3b/merchant-data-quality-2026-10-04.json`). The correct classification is **MIXED EVIDENCE PIPELINE** — source absence, extraction/wiring gaps (206 offers carry a model only in a `specifications` field no lane reads), grouping and verifier abstention all contribute — not "merchant data, not engineering". Appliances stay closed to this mission. |
| **Laptops** | NO-GO | **NO-GO** | Unchanged: MPN on both sides or abstain. |
| **Microwaves, small categories** | insufficient | **INSUFFICIENT EVIDENCE** | ≤ 6 comparisons each; not forced. |
| **Region tags / refurbished** | review / exclude | **Implemented** | Region on one side → review. Refurbished leaves a new-item group; an all-refurbished group is reference rows; no refurbished price can become a "best price" of a new item (production dry-run of the signals job, all categories: 55 refurbished/renewed listings rejected from new-item groups, 20 listings in all-refurbished groups held as reference rows). |

**Where I disagree or deviate, with evidence:** (1) **AC cutover now** — would remove every shadow AC comparison (§6). (2) **TV/monitor family keys** — added a one-side-code review (beyond your brief) because "Samsung 65 OLED 120Hz S85F vs an unnamed 65 OLED 120Hz" is exactly a family-key false-merge shape found in the production audit sample. (3) **No model-code rule for phones/tablets** — part numbers encode colour; your ruling (colour not a variant) makes a code rule a false-reject machine (Apple `MG6J3LL/A` vs `MG6J3LL/A`-colour siblings). (4) **Canonical name no longer an anchor** — it comes from whichever listing founded the canonical; only the key's own model code anchors a group.

---

## 7. Cutover runbook (Waves; each category independent; v1, flags, old keys, version marker and rollback all kept)

**Preconditions (all must hold):** G1 founder blind gate passed · this code pushed with flags unset and the deploy verified · `identity-wave-monitor.ts --save-baseline` taken.

**Wave 1 — TV, vacuum (read path only; no key is rewritten):**
1. Worker: `TPS_IDENTITY_GATE=tv,vacuum`. Next chain run: the `identity-gate` step creates the table and writes the verdicts, then the projection builds gated.
2. `npx tsx scripts/tps-analysis/identity-wave-monitor.ts --categories=tv,vacuum --baseline=<file>` → must be `HEALTHY`; read its 25-group audit sample per category.
3. Web: same variable on `tawveeri-main` (order matters — worker first, so readers never see a missing table). Spot-check compare pages of review rows (wording) and Check.
4. Observe ≥ 48 h before Wave 2.

**Rollback (per category, instant):** remove the category from `TPS_IDENTITY_GATE` on **both** services; readers stop at once, the next chain run deletes its rows. If `TPS_IDENTITY_V2` was on for it: `rollback-identity-v2.ts --categories=<c>` (dry first). **Mechanical triggers** (`identity-wave-monitor`): signals older than 3 h, verdict share > 35 %, projection comparable count down > 40 % with far fewer signals than the drop, **one confirmed false merge in the audit sample**.

**Wave 2 (only categories that proved themselves):** phones (read gate first; `TPS_IDENTITY_V2=mobile` — the key change — only after the read gate has held and the rehearsal has been re-run on a fresh sample), tablets, audio, smartwatches, monitors last. **Wave 3:** appliances only if a re-shadow moves them to GO. **Excluded:** laptops, insufficient-evidence categories.

---

## 8. Residual risks

| # | Risk | Status |
|---|---|---|
| R1 | Founder blind gate not done | **OPEN — blocks every wave** |
| R2 | Rollback timing at production scale is extrapolated from 8 rows | ESTIMATED; dry-run first; per-row UPDATE |
| R3 | Algolia entry removal for pruned rows | NOT VERIFIED locally |
| R4 | Storefront layer (`products`/`product_stores`) and a few admin/legacy readers are not gated | stated |
| R5 | Accessory-bundle contamination of an identity key (a store-12 «بكج» accessory under an iPhone key) is outside the verifier's scope | observed in audit; separate defect |
| R6 | Labelled set is Amazon-centric and thin for tablet/smartwatch/audio/monitor/AC | stated; audit samples are the cutover guard |
| R7 | Signals job reads all current offers (≈ 57 s read-only at full scale); runs in the hourly chain only when a flag is on | measured |
| R8 | Replica is a 3-day sample; history only for mobile/TV | stated |

---

## 9. Task ledger (founder's 23 decisions + cutover authority)

| # | Item | Status |
|---|---|---|
| 1 | Amazon root cause = identity; no ranking/affiliate preference | DONE (nothing Amazon-specific exists) |
| 2 | Verifier architecture; same key ≠ same item | DONE |
| 3 | Metrics wording + denominators | DONE (this report) |
| 4 | Founder blind gate prepared, label-free; compare after | **PREPARED — founder answers NOT DONE** |
| 5 | TV GO candidacy | DONE (Wave 1 candidate) |
| 6 | Vacuum GO candidacy | DONE (Wave 1 candidate) |
| 7 | Phones: suffix, network-as-evidence, verify-not-key | DONE |
| 8 | Tablets conditions | DONE |
| 9 | Audio / smartwatch + wearable fixture | DONE |
| 10 | Monitors high caution | DONE (code); cutover last |
| 11 | ACs exact vs spec | DONE (code); **cutover recommended HOLD** |
| 12 | Wire payload model codes → re-shadow → re-decide | DONE; appliances NO-GO |
| 13 | Laptops NO-GO | DONE |
| 14 | Microwaves / small | DONE (insufficient) |
| 15 | Region tags → review | DONE |
| 16 | Refurbished excluded | DONE |
| 17 | Write-path rollback rehearsal (hard blocker) | **DONE — REHEARSED** |
| 18 | Search/projection gate (hard blocker) | **DONE** |
| 19 | Shadow with per-category ledger | DONE |
| 20 | Identity-isolated commercial impact | DONE |
| 21 | No numeric Amazon target | DONE |
| 22 | Date-bound test debt | DONE, separate commit |
| 23 | Wearable fix as permanent regression | DONE |
| — | Wave 1 / 2 / 3 cutover | **NOT DONE — waits for item 4** |
| — | `PRODUCT-IDENTITY-FINAL-CLOSURE` verdict | **PARTIAL CLOSE** |

---

## 10. Final test run

Full `npx jest` on the final tree: **328 suites passed, 4,355 tests passed, 0 failed** (includes the date-bound test fixed in `a78a0dfe`). ESLint on all touched files: 0 errors.
