# PRODUCT IDENTITY × AMAZON — ENGINEERING CLOSURE (PHASE 3B/3C)

**Date:** 2026-10-03 · **Governance:** ADR-403 (policy), building on ADR-402 and the Phase 1 → 2 → 3A reports · **Production state at closure:** code shipped with both identity flags **OFF** (no user-visible change; v1 parity proven by test) · **Production database:** read-only throughout (shadow = offline replay; no write, no re-key, no migration).

**Labels used:** OBSERVED (production tables/logs) · VERIFIED (reproduced on the Phase-3A labelled set, 459 pairs, reviewer-1 labels after a blind reviewer-2 pass) · SIMULATED (rules replayed on real titles) · SHADOW (7-day offline replay of production observations, `docs/evidence/amazon-diagnostic-2026-10-03/phase3b/shadow-7d.json`) · ESTIMATED · UNKNOWN · NOT VERIFIED.

**Evidence folder:** [`docs/evidence/amazon-diagnostic-2026-10-03/phase3b/`](../evidence/amazon-diagnostic-2026-10-03/phase3b/) — `shadow-7d.json` (full ledger incl. per-category table, per-class examples, lost/changed titles), `labelled-set-results-final.json`, `reviewer-agreement.json`, `blind-slice.json`, `blind-labels-reviewer2.json`. Fixtures: `tests/fixtures/identity/`. Harness: `scripts/experiments/identity-phase3a/harness.ts gen|score`. Shadow: `npx tsx scripts/tps-analysis/identity-shadow.ts 7`.

---

## A. Executive answers

**1. Is Amazon's under-representation an identity problem or a ranking/affiliate problem?** Identity. Ranking is corroboration-then-price with no store or commission term (ADR-002/304, re-read, untouched); the affiliate true-tie rule has never fired. Amazon listings fail to *share an identity* with a control store because (i) the mobile detector rejected 146 of 286 Amazon phone titles on feature vocabulary ("camera", "AMOLED"), (ii) generation suffixes and the Plus sign were dropped from the key (7 production keys merge different models — X7c/X7e, Note 15/15C, S26/S26+), (iii) Amazon never supplies a model field, so appliance/TV keys are spec tuples on the Amazon side and `MODEL:` codes on the control side. OBSERVED/VERIFIED (Phase 2 §3–§9, Phase 3A §2–§3).

**2. How precise is production's identity assertion today?** **65.2%** on the labelled set (58 TP / 31 false merges) — VERIFIED on the labelled evaluation set, never "production precision". The 31: 14 refurbished-vs-new, 6 LTE-vs-5G, 4 RAM, 2 Enterprise Edition, 5 cross-model appliance/tablet merges.

**3. What was built?** A deterministic **verifier** (`scripts/tps-core/identity-verifier.ts`): key equality proposes, stated attributes decide (`match` / `review` / `reject`, machine-readable reasons, evidence recorded, absence never evidence); a **group resolver** (`resolveGroup`) that decides which side of a symmetric conflict leaves (anchor = the page's own identity name + the key's `MODEL:` code; largest consistent set; evidence-pointed review); gated **v2 plugin rules** (mobile parser/detector, TV detector); the **compare-page gate**; a **read-only shadow job**; four test suites (56 tests) including a 459-pair regression fixture and a byte-level v1 parity snapshot.

**4. Does it work on the ground truth?** Scenario F on the labelled set: **175 asserted — 170 TP, 0 FP, 5 AMBIGUOUS**; recall **92.9%** of 183 SAME pairs; 35 pairs to review (17 AMBIGUOUS, 14 INSUFFICIENT_EVIDENCE, 3 SAME, 1 DIFFERENT). VERIFIED on the labelled set. Per category: mobile 153 TP / 0 FP / 4 AMB (of 158 SAME); TV 6/0/0; tablet 2/0/0 (of 4); refrigerator 2/0/0 (of 5); washer 1/0/0; AC 2/0/0; vacuum 2/0/1; microwave 1/0/0; smartwatch 1/0/0; dishwasher, monitor, laptop 0 asserted.

**5. Did an independent reviewer agree?** Blind reviewer-2 on a 60-pair stratified slice + the 24 review-tier pairs: **84.5% exact agreement (71/84)**; 13 disagreements, of which 10 are SAME→ABSTAIN (reviewer-2 abstained where the Amazon title was truncated at the region tag — those 9 pairs were relabelled AMBIGUOUS and are routed to review, not merged); 2 DIFF→ABSTAIN; 1 ABSTAIN→DIFF. **F on the slice vs reviewer-2: 17 TP, 0 FP, 5 abstain-labelled.** The founder's own blind pass (brief condition C1) has **not** happened — NOT VERIFIED; it is the gate for Stage 1.

**6. What does the shadow say about production?** 7 days, 17 stores, 18,133 newest observations (SHADOW): identity unchanged 6,818; key changed 197 (24 v1 keys split into 2–3 real models, 5 pairs merge where eXtra's "S26+" was keyed Standard); 30 new identities from the detector; **0 lost**; shared identities 699 (v1) → 706 proposed → **560 verified**; +18 newly shared verified (Amazon↔eXtra/Almanea/LuLu phones: iPhone 17e, HONOR 600 Lite, X5c, X7e Plus…); member verdicts **match 1,419 / review 213 / reject 85**; **11 false best prices removed** (the deployed cheapest offer was a listing the verifier rejects — refurbished iPhone 11/12 under the new-price key, etc.).

**7. What does Amazon gain and lose?** SHADOW: valid Amazon identities 798 → 821; normalized Amazon observations 869 → 898; Amazon↔eXtra shared 123 → **96 verified** (27 fewer: conflicting or unverifiable pairs that today are shown as comparisons); Amazon↔Almanea 68 → 63. In shared groups Amazon is shown 184 times and is the cheapest eligible 141 times; excluded 11 by identity conflict, 33 by review, 10 no price, 6 availability. Amazon's loss is **identity honesty, not freshness or availability** — those two account for 16 of 60 exclusions.

**8. Which categories can be cut over?** See §C. Phones and TVs pass; tablets, vacuums, audio, smartwatches, monitors, ACs pass with conditions; washers/refrigerators/dishwashers/microwaves are review-heavy because the verifier sees titles only and eXtra/Almanea titles carry no code (97 of their 183 review members have the code in the source payload — a wiring task); laptops NO-GO by doctrine; everything with n ≤ 6 is INSUFFICIENT EVIDENCE.

**9. Is it reversible?** Yes for everything shipped: flags unset ⇒ byte-identical v1 keys (parity test, 704 phone + 167 TV titles) and an untouched compare page (gate test). Stage 1 (`TPS_IDENTITY_GATE`) holds no state. Stage 2 (`TPS_IDENTITY_V2`, plugins write keys) re-keys re-observed listings on the next sweep when turned off, but canonical rows created under v2 keys are **not** un-written by the flag — NOT VERIFIED; a rehearsal is a precondition (§E).

**10. Closure verdict?** **PARTIAL CLOSE** — the engineering is complete, tested, shadowed and reversible; nothing is cut over because the founder gate (C1) and the write-path rollback rehearsal are open, and because the appliance review tier needs source-explicit codes before it is commercially acceptable. §F.

---

## B. Before / after

| Measure | Before (v1, production rules) | After (v2 rules + verifier) | Label |
|---|---:|---:|---|
| Identity-assertion precision, labelled set (459 pairs) | 65.2% (58 TP / 31 FP) | **100%** (170 TP / 0 FP / 5 AMB asserted) | VERIFIED (labelled set) |
| Recall of labelled SAME pairs (183) | 30.2% | **92.9%** | VERIFIED (labelled set) |
| Pairs abstained to review | — | 35 (17 AMB, 14 INSUFF, 3 SAME, 1 DIFF) | VERIFIED |
| Amazon phone titles accepted by the detector (286) | 140 | 247 | SIMULATED |
| Amazon↔control shared phone identities (harness) | 37 | 66 | SIMULATED |
| Never-normalized Amazon PDP rows made valid (2,009 / week) | 60 | 247 | SIMULATED (Phase 3A) |
| Production phone keys that merge different models | 7 (24 in the 7-day shadow) | 0 (split) | VERIFIED / SHADOW |
| Shared identities, all stores, 7 d | 699 | 706 proposed → 560 verified | SHADOW |
| Newly shared (verified) identities, 7 d | — | +18 | SHADOW |
| False best price (cheapest = rejected listing), 7 d | 11 live | 0 | SHADOW |
| Amazon valid identities / normalized observations, 7 d | 798 / 869 | 821 / 898 | SHADOW |
| Amazon↔eXtra / Amazon↔Almanea shared, 7 d | 123 / 68 | 96 / 63 (verified) | SHADOW |
| Lost identities under v2 | — | 0 (22 wearables were lost in run 4; detector boundary fixed, re-run) | SHADOW |
| Blind reviewer agreement | — | 84.5% exact (71/84); F vs r2: 17 TP / 0 FP | VERIFIED |
| User-visible change at closure | — | none (flags OFF) | OBSERVED |

---

## C. Category decision matrix

Columns (SHADOW, 7 d): shared keys v1 → verified v2 · members match / review / reject · reviews resolvable by a payload model code · labelled-set TP/FP (VERIFIED) · reviewer-2 agreement · commercial note. Verdict ∈ GO · GO WITH CONDITIONS · NO-GO · INSUFFICIENT EVIDENCE. **No category is averaged into another.**

| Category | Shared v1 → v2 verified | Members M / R / X | Payload-code reviews | Labelled TP / FP (SAME n) | r2 agreement | Commercial (shadow) | Verdict |
|---|---:|---:|---:|---:|---:|---|---|
| **mobile** | 88 → 86 (+18 new, −11 false merges split) | 223 / 7 / 15 | 3 | 153 / 0 (158) | 41/50 | +38 comparisons created, +30 best-price opportunities, 5 false best prices removed, 7 comparisons lost, +92 merchant rows | **GO WITH CONDITIONS** — C1 founder blind gate; Stage 1 gate first; Stage 2 after rollback rehearsal |
| **tv** | 118 → 118 | 311 / 0 / 0 | 0 | 6 / 0 (6) | 6/8 | 0 identity-caused change (the 13 cheapest changes are freshness drift = the noise floor of this method) | **GO** (gate + FHD cue; detector adds 3 identities) |
| **tablet** | 80 → 76 | 174 / 1 / 4 | 1 | 2 / 0 (4) | 6/6 | 4 comparisons lost (MatePad 10.4 vs 11.5 class — correct rejects) | **GO WITH CONDITIONS** — small labelled n (4) |
| **vacuum** | 44 → 43 | 89 / 0 / 1 | 0 | 2 / 0 (2) | 2/3 | 1 lost (CV-930F vs CV-940Y — different models) | **GO** |
| **audio** | 39 → 34 | 70 / 8 / 1 | 8 | — (0 labelled) | — | 8 best-price opportunities recovered, 2 lost | **GO WITH CONDITIONS** — no labelled pairs; 8 reviews resolvable by payload code |
| **smartwatch** | 24 → 23 | 57 / 4 / 2 | 3 | 1 / 0 (2) | — | 3 recovered, 0 lost | **GO WITH CONDITIONS** — small n |
| **monitor** | 26 → 21 | 45 / 6 / 2 | 3 | 0 / 0 (1) | — | 5 recovered, 4 lost | **GO WITH CONDITIONS** — 1 labelled SAME not asserted (recall unknown) |
| **air_conditioner** | 9 → 8 | 24 / 2 / 0 | 0 | 2 / 0 (2) | — | 3 recovered, 1 lost | **GO WITH CONDITIONS** — small n |
| **washing_machine** | 114 → 46 | 167 / 113 / 36 | 65 | 1 / 0 (1; 9 INSUFF) | 4/4 | 61 comparisons lost, 3 false best prices removed, 124 merchant rows removed | **NO-GO today** — doctrine says abstain on unverifiable family keys, but 60% of comparisons would become reference rows; precondition: feed eXtra/Almanea model codes (65 of 113 reviews resolve) then re-shadow |
| **refrigerator** | 71 → 40 | 108 / 46 / 10 | 28 | 2 / 0 (5) | 4/5 | 29 lost, 1 false best price removed | **NO-GO today** — same precondition (28 of 46) |
| **dishwasher** | 29 → 21 | 48 / 19 / 2 | 2 | 0 / 0 (1) | 2/2 | 9 lost, 1 false best price removed | **NO-GO today** — same class; only 2 of 19 resolvable by payload |
| **microwave** | 9 → 5 | 14 / 5 / 1 | 2 | 1 / 0 (1) | 2/2 | 1 lost | **INSUFFICIENT EVIDENCE** |
| **laptop** | 17 → 13 | 30 / 0 / 4 | 0 | 0 / 0 (0) | 4/4 | 3 lost (RAM/screen conflicts) | **NO-GO** (doctrine: exact MPN both sides or abstain) |
| air_fryer, kettle, blender, cooker, printer, coffee_maker, oven, toaster, tracker | ≤ 6 each | — | — | — | — | — | **INSUFFICIENT EVIDENCE** |

**Precision across categories is not pooled.** The 100%/0-FP figure is the labelled set's figure; washers' and dishwashers' labelled coverage (1 SAME pair each) is too thin to claim anything beyond "no false merge observed".

---

## D. Commercial outcome (SHADOW; method and its confound stated)

Method: for every v2 key shared by ≥ 2 stores, the deployed composition (`tps_current_offers`, status valid, eligible = price > 0 ∧ not out_of_stock ∧ ≤ 168 h) is compared with the shadow composition (newest raw observation per store, verifier-kept members, same eligibility). **Confound:** the two sides are observed at different times, so `cheapest_price_changed` / `cheapest_merchant_changed` / `saving_changed` include price drift and freshness, not only identity. TV — 0 reject, 0 review — shows the noise floor: 13 cheapest-merchant changes with zero identity change.

| Outcome (7 d, all stores) | Count | Identity-caused? |
|---|---:|---|
| Comparisons created (1 → ≥ 2 eligible merchants) | 53 | yes (38 of them phones) |
| Best-price opportunities recovered (a cheaper merchant that was not comparable) | 55 | yes |
| False best prices removed (deployed cheapest = rejected listing) | 11 | yes — refurbished/renewed under new-price keys, bundle, 4G/5G |
| Merchant rows added | 145 | yes |
| Comparisons lost (≥ 2 → < 2 eligible) | 131 | partly — 61 washers + 29 refrigerators + 9 dishwashers are review-tier abstentions (unverifiable family keys), 7 phones are rejects/splits, the rest mixed with drift |
| Merchant rows removed | 261 | partly (same split) |
| Cheapest merchant changed | 127 | mixed with drift (see TV noise floor) |

**Amazon specifically (SHADOW, shared groups):** shown 184 · cheapest when eligible 141 · excluded — identity conflict 11, identity review 33, no price source 10, availability 6, freshness 0. The affiliate exit path, `/go`, ranking and the true-tie rule are untouched; Amazon is never favoured.

**Not measurable here:** real click/exit effect (no user-visible change shipped); search-card effect (projection not gated — §E).

---

## E. Residual risks and open preconditions

| # | Risk / gap | Status | Mitigation |
|---|---|---|---|
| E1 | Founder blind gate (C1: 60-pair slice + 24 review-tier) not done | OPEN — NOT VERIFIED | Stage 1 waits for it; reviewer-2 (84.5%) is a proxy, not the gate |
| E2 | Write-path rollback: canonical rows created under v2 keys survive a flag-off | OPEN — NOT VERIFIED | rehearse on a non-production copy before Stage 2; until then only the read gate (`TPS_IDENTITY_GATE`) may be enabled |
| E3 | Projection builder (`scripts/build-tps-projection.ts`) has no per-store listing names → search cards and `tps_product_projection` are not gated | OPEN | extend the CTE with the per-store `name`; gate at build time; until then the compare page is the only gated surface |
| E4 | Appliance review tier is large because the verifier reads titles + the key's `MODEL:` only; eXtra/Almanea codes live in the payload (97 of 183 appliance review members) | OPEN | wire `modelNumber`/`model` from the normalized payload into `CompareOffer`/shadow as `structured.model`; re-shadow; re-decide washers/fridges/dishwashers |
| E5 | Commercial-impact confound (drift vs identity) | STATED | read per-category with the TV noise floor; a same-time A/B (shadow both sides from the same observation set) is the clean follow-up |
| E6 | Labelled set is Amazon-centric (Amazon × control pairs) and single-reviewer for 375 of 459 labels | STATED | fixture is permanent; add control×control pairs when a category cuts over |
| E7 | Verifier false rejects on exotic codes (regional pairs such as `LS32DG800SNXZA` vs `LS32DG802SMXUE`, series names vs full codes `WD6300T` vs `WD80T634DBE`) | KNOWN | these stay rejects (recall loss, never a false merge); every such class found in the shadow is a named test |
| E8 | `tests/compare/partition-offers-by-eligibility.test.ts` is date-bound (hard-coded NOW 2026-09-26 while `deriveComparisonSummary` reads `Date.now()`) and now fails on every run | PRE-EXISTING (commit 8fb4fd9d), not caused here | separate fix (inject `nowMs`); reported, not touched under this task's scope |
| E9 | Compliance: scraping amazon.sa while an Associate remains non-compliant with the Program Policies (Phase 1 §compliance); Creators API not eligible (2/10 qualifying sales) | UNCHANGED | founder boundary; no API use here |

---

## F. Final recommendation — **PARTIAL CLOSE**

**Closed:** the diagnosis (identity, not ranking); the precision defect classes and their generic fixes; the verifier and group resolver as the single identity authority after key equality; the permanent regression suite and parity proof; the shadow instrument with per-category ledger; the policy (ADR-403); rollback for everything shipped; monitoring hooks (shadow JSON is re-runnable on demand; the compare page attaches `identity_verdict` reasons to every review row).

**Not closed, by evidence:** (1) no category is cut over until the founder's blind gate passes (E1); (2) Stage 2 (writing v2 keys) until the write-path rollback is rehearsed (E2); (3) appliances until source-explicit codes reach the verifier (E4); (4) laptops — permanently, by doctrine.

**Recommended sequence:** founder blind gate → `TPS_IDENTITY_GATE=mobile,tv` on Railway (read path only; watch `identity_verdict` reasons and the compare-page eligible counts for 48 h) → rollback rehearsal → `TPS_IDENTITY_V2=mobile,tv` → wire payload codes → re-shadow appliances → re-decide.

**Founder policy decisions (Option A / B, consequence, recommendation):**
1. *Samsung Galaxy A/M network axis.* **A — in the key** (+4.6 points precision on the labelled set, but every listing that does not state a network splits into a `NO_NETWORK` key; eXtra/Almanea often omit it) · **B — verified, not keyed** (reject only when both sides state it; absence never splits). **Recommend B** (implemented).
2. *Region-tagged listings* ("International/Global/UK/US Version"). **A — same item** (merges a different warranty/plug/firmware variant into the KSA price) · **B — review tier** (reference row, never the cheapest claim) — 18 pairs/week in the shadow. **Recommend B** (implemented) until a warranty/return statement exists on the product page.
3. *Refurbished / renewed.* **A — separate comparison row with a condition label** · **B — excluded from the new-price page entirely**. The verifier rejects the pair either way (never one row); the UX choice is whether a labelled "مجدّد" row is ever rendered. **Recommend A later, B now** (no renderer exists; nothing fabricated).

---

## Task ledger (brief items)

| Item | Status |
|---|---|
| Production-quality implementation behind a default-OFF flag | DONE (`TPS_IDENTITY_V2`, `TPS_IDENTITY_GATE`; both OFF) |
| Verifier module with machine-readable reasons + evidence | DONE |
| Regression suite from the 459 pairs + named failures | DONE (`identity-regression.test.ts`, 56 tests across 4 suites) |
| v1 parity proof | DONE (`identity-v1-parity.test.ts`, snapshot fixture) |
| Independent blind review gate (60 + 24) | DONE for reviewer-2 (84.5%); founder pass NOT DONE (open gate) |
| Shadow deployment (v1 vs candidate, identity diff, commercial impact, Amazon breakdown) | DONE as offline read-only replay (SHADOW label); not a live dual-write job — no production write was authorised |
| Category-by-category decision matrix | DONE (§C) |
| Rollback proof | DONE for read path + plugins (tests); write-path canonical clean-up NOT VERIFIED (E2) |
| Minimal monitoring | DONE minimal (re-runnable shadow; `identity_verdict` reasons on the page); no dashboard metric wired (would need a write) |
| Founder-policy escalations (A/B + recommendation) | DONE (§F) |
| ADR-level identity policy | DONE (ADR-403) |
| Category cutover | NOT DONE — gated (E1/E2/E4), by design |
| Search-card / projection gate | NOT DONE — precondition E3 |
| Deploy code with no user-visible effect | DONE on commit/push (flags unset) |
