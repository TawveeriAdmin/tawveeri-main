# AMAZON IDENTITY — PHASE 3A: PRECISION GATE & ENGINEERING DESIGN

**Date:** 2026-10-03 · **Mode:** offline / read-only on production; local experimental code only · **No deploy, no migration, no production write, no re-key, no ranking or affiliate change.** Live build unchanged (`63d67a9e`).

**Working set (uncommitted, local):** [`scripts/experiments/identity-phase3a/`](../../scripts/experiments/identity-phase3a/) — `harness.ts` (pair generation + scoring), `mobile-parser-v2.ts`, `mobile-detector-v2.ts`, `tv-detector-v2.ts` (patched copies of the production plugins; production files untouched), `replay-unnormalized.ts`, `corpus.json`, `pairs.json`, `labels.json`, `results.json`. Copies of the datasets and results: [`docs/evidence/amazon-diagnostic-2026-10-03/phase3a/`](../evidence/amazon-diagnostic-2026-10-03/phase3a/). Reproduce: `npx tsx scripts/experiments/identity-phase3a/harness.ts gen|score`.

**Phase 2 baseline accepted** (not re-argued). Labels: VERIFIED · PARTIALLY VERIFIED · SIMULATED · ESTIMATED · NOT VERIFIED · UNKNOWN.

---

## Executive Decision

**1. Biggest defect blocking safe Amazon coverage growth?** Not the detector — the **absence of a verification step after key equality**. Measured on the new 459-pair ground truth, production's own key-equality precision is **65.2%** (58 TP / 31 false merges): refurbished-vs-new (14), 4G-vs-5G (6), 8 GB-vs-12 GB RAM (4), Enterprise Edition (2), and five cross-model merges in appliances/tablets where the spec key is a family key (`samsung|front_load|9|washer` merges WW90T754DBX with WW90DG5U34AB). Widening the detector alone (recall 30% → 94%) keeps that 81%-class precision and *multiplies* the false merges (31 → 43). Safe growth needs the key to **propose** and stated attributes to **verify**.

**2. Is the suffix/model-normalization defect generic or category-specific?** **Generic to the mobile plugin's rule table, not to HONOR**: every family rule except Apple captures `\d{1,2}` and discards a trailing letter and a third digit. Survey over 754 phone titles (Amazon + control): **63 titles change identity** when suffixes are kept (honor 32, xiaomi 11, samsung 8, oppo 4, tecno 4, infinix 3, huawei 1), and **7 production keys split into 2** — `Honor X|7` ⇒ 7c/7e/7d, `Honor X|9` ⇒ 9c/9d, `Redmi Note|15` ⇒ 15/15c, `Tecno Spark|30` ⇒ 30/30c, `Galaxy S|S26|Standard` ⇒ Standard/Plus (×2) (VERIFIED by replay). In other categories the analogous loss is **model-code truncation** (`QN900C` vs `QA85QN900CUXSA`, `NIK50MEU` vs `NIK50MEU4STN`) and **colour/region suffixes** (`RT62K7050SLB`/`SLH`, `WA21A8376GV`/`GV/YL`) — the opposite problem: codes that *should* match differ by a suffix. One rule covers both: keep every letter glued to the model token for phones; compare appliance/TV codes on a canonical core with suffix tolerance.

**3. Is the detector redesign safe after the precision fix?** **Yes, only with the verification layer.** Candidate B (detector only): precision 80.8%, recall 90.1%, 41 false merges. Candidate F (detector + suffix + brand + verification + review tier): **precision 97.7%, recall 88.5%**, 4 residual false merges, 24 pairs abstained to review.

**4. Observations recoverable without lowering precision?** On the 2,009 Amazon PDP observations of the last 7 days that never reached `normalized_product_observations` (531 distinct titles; 1,647 rows never normalized under any timestamp — VERIFIED), production rules yield **60** valid identities; the candidate rules yield **247** (+187 SIMULATED on the real titles): phones +77 (14 → 91), TVs +62 (0 → 62; 355 more become low-confidence rows that need a refresh/panel cue), refrigerators +24, vacuums +25, washers +13, air-fryers +7. Per week, store-wide, with no new false merge class (every new identity goes through the same verifier).

**5. Additional shared identities provable?** Phones: **37 → 66** Amazon↔control shared identities with both stores re-keyed (SIMULATED, +29); within the labeled set F asserts 170 true pairs against 58 for production. Non-phone categories gain only +1 (a refrigerator model code) — their gap is source-side (Phase 2 §8–9).

**6. Precision per candidate (459 labeled pairs, reviewer-1 labels):**

| Candidate | Asserted | TP | FP variant | FP different | Precision | Recall (of 192 SAME) | Review tier |
|---|---:|---:|---:|---:|---:|---:|---:|
| Baseline (production) | 110 | 58 | 25 | 6 | **65.2%** | 30.2% | — |
| A suffix/+ fix | 110 | 59 | 25 | 5 | 66.3% | 30.7% | — |
| B A + detector | 239 | 173 | 36 | 5 | 80.8% | 90.1% | — |
| C A + brand ladder | 123 | 67 | 27 | 5 | 67.7% | 34.9% | — |
| D A + detector + brand | 252 | 181 | 38 | 5 | 80.8% | 94.3% | — |
| E D + dual-key alias | 253 | 182 | 38 | 5 | 80.9% | 94.8% | — |
| E+net (network in key, Samsung A/M) | 239 | 182 | 26 | 5 | 85.4% | 94.8% | — |
| **F E + verification + abstention** | **189** | **170** | **1** | **3** | **97.7%** | **88.5%** (≈90% after the harness artefact in §9) | 24 |

**7. Remaining false merges under F (4):** P267 Galaxy A57 12 GB vs 8 GB RAM — Amazon states RAM as "12GB RAM", control as "256GB, 8GB," (comma form not parsed); P373 MatePad 10.4 vs 11.5 — sizes without an inch unit; P404 Samsung 9 kg washers WW90T754DBX vs WW90DG5U34AB — the control code has no three consecutive digits so the code check never fires; P407 Hisense 10.5/7 kg washer-dryer vs 7 kg washer — combo vs washer not verified. All four are verifier-vocabulary gaps, each with an obvious rule; none is a key-design flaw.

**8. What we must not try to match now:** laptops by title (Phase 2 §8: 3 → 8 even with spec tuples on both sides; eXtra names lack CPU/RAM; Amazon lacks MPN) — emit `INSUFFICIENT_IDENTITY_EVIDENCE` unless an MPN matches on both sides; region-tagged listings ("International/Global/UK/US Version") against KSA listings — review tier, not auto-match; refurbished/renewed against new — never the same comparison row; appliance spec keys without a model code on at least one side (9 of 14 washer pairs are INSUFFICIENT_EVIDENCE); any pair where a stated attribute conflicts.

**9. Amazon-specific or generic identity-engine fix?** **Generic.** Every rule below changes `scripts/tps-plugins/mobile|tv` and the engine's match step for all stores; the brand ladder reads a *source-explicit* field first wherever one exists (eXtra `brandEn`, Almanea `brand`, Amazon's page "Brand" row). The only source-specific element is which payload field is source-explicit — that is adapter configuration, not matching logic. Two of the verifier's catches are control-store defects (eXtra's `S26+` keyed Standard; eXtra's duplicate colour-SKU keys).

**10. Ready for Phase 3B?** Technically yes: the rules are implemented as patched plugin copies that run in-process on real titles, the harness is repeatable, and the acceptance thresholds are measurable. What is not ready is **ground-truth authority**: all 459 labels are mine (reviewer-1) with a stated policy; the founder's review of the 24 abstained pairs and of a stratified 60-pair slice is the gate.

### Engineering recommendation: **GO WITH CONDITIONS**
Candidate F raises recall ~3× over production **and** raises precision from 65% to 98% on the labeled set, with no Amazon-specific logic. Conditions: (C1) founder review of a 60-pair stratified slice + the 24 review-tier pairs with inter-rater agreement ≥ 90% on SAME/DIFFERENT; (C2) the four verifier gaps in Q7 closed and re-scored before any key is written; (C3) model-code comparison made suffix-tolerant (§5.4) so the three appliance false rejects disappear; (C4) rollout as **shadow keys** first (new key computed and stored beside the current key for every store, compared, no customer surface reads it) for one full normalize cycle; (C5) two policy decisions taken by the founder (§8): network as a variant axis for Samsung A/M; region tags as review-only. NO-GO for laptops as a category of this programme.

---

## 1. Ground truth — what was built

- **Candidate generation** (harness `gen`): from the Phase-2 corpus (286 Amazon phone titles, 1,653 Amazon offers, 3,820 control offers) — phones: every Amazon title × every control title with the same family and generation digits, kept if (a) same key under production, (b) same key under the candidate rules, or (c) a near miss differing in generation suffix / variant / storage / network (up to 3 per Amazon title); other categories: same stored key, same model code, or a one-/two-segment near miss. **459 pairs**: mobile 322 (78 production-same-key, 140 candidate-same-key, 104 near-miss), tv 27, laptop 19, tablet 20, refrigerator 14, washing_machine 14, air_conditioner 2, vacuum 6, microwave 6, dishwasher 5, monitor 8, smartwatch 8, audio 8. Strata cover exact model, same family/different model, suffix differences (X7e/X7c, X9d/X9c, 15/15C, 16e/16, S26/S26+), storage, capacity (kg/L), region suffixes, colour-only (RT62K7050SLB/SLH), same marketing name/different SKU (A17 LTE/5G, Enterprise Edition), noisy Amazon titles, Unknown brand, likely FPs (knock-off "invens ULTRA S25") and likely FNs ("Expandable to 2TB", Arabic "بلص").
- **Schema:** SAME_EXACT_VARIANT · SAME_PRODUCT_FAMILY_DIFFERENT_VARIANT · DIFFERENT_PRODUCT · AMBIGUOUS · INSUFFICIENT_EVIDENCE. **Policy** (in `labels.json`): variant words (Pro/Plus/Ultra/FE/e/letter suffix) differ ⇒ DIFFERENT_PRODUCT; storage/RAM/network/condition/edition differ ⇒ FAMILY_DIFFERENT_VARIANT; colour ignored; International/Global Version ⇒ AMBIGUOUS; unparseable storage or an unstated network where both network SKUs exist ⇒ INSUFFICIENT_EVIDENCE. Distribution: SAME 192 · FAMILY_DIFF 93 · DIFFERENT 136 · AMBIGUOUS 11 · INSUFFICIENT 27.
- **Limitations:** single reviewer; titles were read at 95 characters, so a region tag beyond the cut was missed on 9 pairs (they are correctly routed to review by F, not merged); 3 pairs (P004, P005, P260) are unreachable in the harness because their ASIN is shared by two storefront rows and the by-ASIN lookup keeps the other title — a harness artefact that depresses every scenario's recall by 3 TP equally.

## 2. The precision defect, analysed before any recall work (VERIFIED)

Where the pipeline loses commercially significant tokens, with the rule and the fix:

| Loss | Where | Mechanism | Generic fix (implemented in v2) |
|---|---|---|---|
| Letter suffix after the model number (X7**c**/X7**e**, Redmi 15**C**, Spark 30**C**, Hot 60**i**, nova 13**i**, Y19**s**) | `mobile/parser.ts` BRAND_FAMILIES, every `gen` except Apple | capture group `(\d{1,2})` | data transform of the same rules: `(\d{1,3}[a-z]?)` + `(?![a-z0-9])` boundary; suffix kept lower-case |
| Third digit (HONOR **600** Lite → `60`, collides with HONOR 60) | same | `\d{1,2}` | `\d{1,3}` |
| Plus **sign** (S23+, S26+, A17+) | `readVariant` reads the word "plus" only | `pro\s*\+` exists, bare `+` does not | plus sign glued to the generation match ⇒ Plus (position-based, so "8+256GB" is never a variant) |
| Arabic "بلص" (Almanea's spelling of Plus) | VARIANTS table | only بلس/بلاس | add بلص |
| "128GB **Expandable to 2TB**" → storage 2048 | `readStorageAndRam` | terabyte rule wins unconditionally | strip expandable/microSD capacity phrases before reading storage |
| Brand inference from a family regex alone ("…ULTRA S25" ⇒ samsung) | `inferBrand` | matches `s\s*\d{2}` with no brand token (dead in production, revived by the brand ladder) | inference requires a word-bounded brand or brand-owned line token |
| Model-code truncation / dimension strings (`111X8X64.7CM`, `1000-NIT`, `TV144H`) | `store-identifiers.ts` title path picks the *longest* token | `.` allowed, unit regex anchored | out of scope here; Phase 3B item (reject tokens with `x`-separated dimensions and unit suffixes) |
| Colour/region code suffixes make equal codes unequal (`…SLB`/`…SLH`, `GV`/`GV/YL`, `-1TWH`) | verifier / `MODEL:` keys | exact comparison | compare on a canonical core (strip `/…` region, trailing colour letter when the rest is ≥ 8 chars) — §5.4 |

None of these is HONOR-specific; HONOR merely has the most suffixed models in the Saudi catalogue (32 of 63 affected titles).

## 3. Category detection redesigned where it conflated "what" with "which features"

- **Mobile** (`mobile-detector-v2.ts`): Latin foreign/accessory signals are now token-bounded (plural-tolerant), so "oled" no longer hits "AMOLED" and "stand" no longer hits "standby"; "camera", "speaker" (and their Arabic forms) are removed from the foreign list because a phone legitimately states them — a standalone camera or speaker still fails the *positive* phone-signal test. Effect on the 286 Amazon titles: detect-rejects **146 → 39** (the 39 are accessories: screen protectors, cases); valid **91 → 181** with the brand ladder.
- **TV** (`tv-detector-v2.ts`): the weak-signal cue set `4k|uhd|8k|qled|oled|…|smart|led` gains `fhd|full hd|hd ready|hd|hdr|crystal|android tv|google tv|webos|tizen|vidaa|roku|fire tv|frameless`; monitors are still rejected first. Effect: Amazon TV titles accepted 200 → 202 of 203 in the corpus; on the never-normalized week, TV rows detected 0 → 629 (62 valid, 355 low-confidence needing a refresh/panel cue, 111 missing size, 101 missing brand).
- **Separation adopted in the design:** (1) category detection = positive evidence minus *category-level* exclusions (accessory, bundle, other device); (2) feature extraction never influences detection; (3) exclusion lists are token-bounded. Alternative tested and rejected: keeping substring semantics and adding exceptions per word — it needed a growing exception list and still rejected "Camera" inside a brand's own tagline.

## 4. Brand resolution — strategy compared on the 4,095 Unknowns (Phase 2 §5) and the corpus

| Source | Coverage of the 4,095 | Precision proxy | Verdict |
|---|---:|---|---|
| Source-explicit field (page "Brand" row for Amazon; `brandEn` eXtra; `brand` Almanea) | 1,833 (44.8%) | spec Brand agrees with the title's first token in 95% of cases where both exist (sample of 573: 57 disagreements, all platform/sub-brand tokens) | **rung 1** |
| Stored structured brand (≠ Unknown) | — | authoritative when present | rung 2 |
| Known-brand dictionary on the title (`detectBrandFromText`, 152 aliases, word-bounded, longest first) | 1,071 (26.2%) first-token hits | high on first token; falls on mid-title mentions ("Compatible with Apple…") | rung 3, title-position-weighted |
| Family-regex inference | — | produced the knock-off FP | **rejected** as a brand source |
| Platform/sub-brand stop-list (Google TV, Android TV, webOS, Apple TV, Alexa, soundcore→Anker) | 17 + 10 split ASINs | — | applied before rung 3 |

Ladder result in the harness (scenario C): Amazon phone identities 91 → 99 valid, +1 shared; TV pairs 3 → 6 asserted (Google-TV brand splits healed). The ladder is cheap to maintain (a dictionary and a stop-list, both already in `brand-map.ts`); a giant static list is not needed because rung 1 covers 45% and rung 3 another 26%. Residual: 537 genuinely unbranded/books stay Unknown — correct.

## 5. Replay / simulation — full results

### 5.1 Coverage (phones, 286 Amazon titles; control re-keyed with the same rules)
| | Baseline | A | B | C | D | E / F |
|---|---:|---:|---:|---:|---:|---:|
| detect-rejected | 146 | 146 | 39 | 146 | 39 | 39 |
| invalid key | 49 | 49 | 74 | 41 | 66 | 66 |
| valid | 91 | 91 | 173 | 99 | 181 | 181 |
| distinct keys | 56 | 57 | 86 | 59 | 88 | 88 |
| **shared with control** | 37 | 37 | 65 | 38 | 66 | 66 |

### 5.2 Observations recovered (2,009 never-normalized Amazon PDP rows, 7 d; `replay-unnormalized-results.json`)
Production: 1,021 detected, **60 valid**. Candidate: 1,088 detected, **247 valid**. Residual not-valid reasons: TV low-confidence (refresh/panel missing) 355, TV size missing 111, TV brand missing 101, monitor size missing 76, dishwasher no discriminator 12. 1,718 of the 2,009 rows are repeat observations of an ASIN seen more than once in the week (the L2 lane refreshing the same listings) — so recovered *identities* are fewer than recovered rows; the 247 valid rows cover ≈ 150 distinct listings (ESTIMATED from the 531 distinct titles).

### 5.3 Precision/recall per category under F (labeled set)
mobile 153 TP / 1 FP / 4 ambiguous (precision 99.4%) · tv 6/0/0 · tablet 2/1/0 · refrigerator 2/0/1 (3 SAME lost to strict code comparison) · washing_machine 0/2/8 · air_conditioner 2/0/0 · vacuum 2/0/1 · microwave 1/0/0 · dishwasher 1/0/1 · monitor 0/0/0 · smartwatch 1/0/0 · laptop 0/0/0 (none asserted — correct abstention).

### 5.4 What the verifier does (scenario F, generic, category-aware)
For a pair proposed by key equality (or alias), extract from **both** titles: condition (refurbished/renewed/مجدد), RAM, network (4G/LTE vs 5G), edition, model code, screen inches, kg, litres, region. A value **stated on both sides that differs ⇒ reject**; condition stated on one side only ⇒ reject (refurbished never joins a new-price comparison); region stated on one side only ⇒ **review tier**; everything else ⇒ accept. Measured: removes 39 of 43 false merges of candidate D; costs 9 SAME pairs to review (region-tagged, all "International/Global Version" listings) and 3 SAME appliance pairs to strict code comparison (`R-V805PS1KV TWH` vs `R-V805PS1KV-1TWH`, `RT62K7050SLB` vs `SLH`, `WA21A8376GV/YL` vs `GV`) — fixed by comparing codes on a canonical core (strip `/…`, strip a single trailing colour letter when the shared prefix is ≥ 8 characters) — Phase 3B condition C3.

### 5.5 Control-group defects surfaced (not Amazon's)
eXtra's "Galaxy S26+" is keyed `Standard` in production (the plus-sign rule); eXtra's same-name listings carry both a spec key and a colour-specific `MODEL:SM-…` key (Phase 2); Almanea's "بلص" is unread; Almanea's "سعة 265 جيجا" (typo) yields no storage. The candidate rules fix the first three for every store.

## 6. Laptops — separate path, NO-GO for title matching
Replay (Phase 2 §8) stands: 3 shared keys now, 8 with spec tuples on both sides, 114/236 control names invalid for missing RAM/CPU, 0 Amazon PDPs with an item model number. The design rule for laptops is **abstain unless an MPN/part number matches on both sides** (`INSUFFICIENT_IDENTITY_EVIDENCE` otherwise) and publish single-store listings honestly. The only coverage levers are data access (manufacturer MPN↔configuration catalogue; Creators API `ItemPartNumber` at eligibility — FUTURE STATE).

## 7. Architecture candidate (E/F) — why this shape and not more

```
observation ──► category detection (positive − category exclusions)        [plugins, token-bounded]
            ──► brand ladder (source-explicit › structured › dictionary › stop-list)
            ──► feature extraction (suffix-preserving model, storage w/o expansion, RAM, network, condition, region)
            ──► identity key (unchanged shape; suffix kept; + = Plus)
            ──► candidate pairs by key equality  +  alias (control MODEL:<SKU> ↔ its own spec key)
            ──► VERIFY: stated-attribute conflict ⇒ reject · region/condition asymmetry ⇒ review · else accept
            ──► outcome: link / possible-link (review queue) / non-link           [Fellegi–Sunter three-way]
```
Deterministic end to end; no LLM, no similarity score, no thresholds to tune (ADR-002). The dual-key alias answers eXtra's over-split without changing eXtra's keys. The review queue is small (24 of 459 here). Not adopted: GTIN rung (no Amazon identifier exists; eXtra `barCode` should still be read — Phase 2 P1-7), probabilistic weights (no gain over the deterministic verifier on this data), embedding candidates (precision bar).

## 8. Founder policy decisions the design cannot make
1. **Network as a variant axis for Samsung Galaxy A/M** (A17 LTE vs A17 5G are distinct SKUs with distinct prices). E+net puts it in the key (+4.6 points precision, −0 recall here, but unstated-network listings would split into `NO_NETWORK` keys). F handles it in verification (reject only when both state it). Recommendation: F's behaviour, i.e. verification not key.
2. **Region tags** ("International/Global/UK/US Version"): review tier (F) or treat as same variant? 11 AMBIGUOUS + 9 SAME-by-reviewer pairs hinge on it. Recommendation: review tier until a warranty/return policy statement exists on the product page.
3. **Refurbished**: never merged (F). Recommendation: keep; show as a separate condition row if ever displayed.

## 9. Evidence matrix

| ID | Finding | Source | Num/den | Label |
|---|---|---|---|---|
| 3A-01 | Production key-equality precision 65.2%, recall 30.2% on 459 labeled pairs | `results.json` Baseline | 58/89 | VERIFIED (labels: reviewer-1) |
| 3A-02 | 31 production false merges: 14 condition, 6 network, 4 RAM, 2 edition, 5 cross-model | `results.json`, pair ids in §Executive 1 | 31 | VERIFIED |
| 3A-03 | Suffix loss is generic: 63 titles change identity, 7 production keys split (honor 32, xiaomi 11, samsung 8…) | harness suffix survey | 63/754 | VERIFIED (replay) |
| 3A-04 | Detector-only widening: recall 90.1%, precision 80.8%, FP 41 | scenario B | — | SIMULATED |
| 3A-05 | Verification layer: precision 97.7%, recall 88.5%, FP 4, review 24 | scenario F | 170/174 | SIMULATED |
| 3A-06 | Never-normalized week: 2,009 rows / 531 titles; 1,647 rows never under any timestamp | `unnormalized-classification.json` | — | VERIFIED |
| 3A-07 | Candidate rules make 247 of those rows valid vs 60 today | `replay-unnormalized-results.json` | 247/2,009 | SIMULATED on real titles |
| 3A-08 | Shared phone identities 37 → 66 with both stores re-keyed | `results.json` phones | — | SIMULATED |
| 3A-09 | Knock-off FP introduced by naive brand inference, caught by ground truth, fixed | P228 | 1 | VERIFIED |
| 3A-10 | "Expandable to 2TB" storage mis-read (production) fixed by phrase stripping | P001/P041/P078 | 3 | VERIFIED |
| 3A-11 | 3 harness lookup collisions (ASIN shared by two storefront rows) depress recall equally in all scenarios | P004/P005/P260 | 3 | VERIFIED (limitation) |
| 3A-12 | Strict model-code comparison false-rejects colour/region suffix pairs | P396/P398/P411 | 3 | VERIFIED |

## 10. Phase 3B — proposed plan (if approved)

1. **Gate (no code):** founder labels 60 stratified pairs + the 24 review-tier pairs blind; compute agreement with reviewer-1; adopt the policy answers in §8. Target ≥ 90% agreement on SAME/DIFFERENT.
2. **Port v2 rules into the plugins** (`mobile/parser.ts`: suffix capture, `\d{1,3}`, plus-sign, بلص, expansion-phrase strip, token-based `inferBrand`; `mobile/detector.ts`: token-bounded signals, feature vocabulary; `tv/detector.ts`: cue set) with the ground-truth pairs as regression fixtures (`tests/tps-plugins/`), plus the 7 split keys and the knock-off title as named tests.
3. **Verifier module** in `scripts/tps-core/` (pure, category-aware; the four Q7 gaps closed; canonical-core model-code comparison), wired at the corroboration step as a *gate on cross-store equality*, writing `review` outcomes to a queue table instead of a canonical link.
4. **Shadow run:** compute v2 keys beside current keys for all stores for one hourly chain cycle; diff: keys that split, keys that merge, review-queue size; publish the diff before any read path changes. Acceptance: 0 new cross-variant merges in the labeled set; split count ≈ the 7 predicted; review queue ≤ 5% of candidate pairs.
5. **Cut-over** per category (phones first, TV second, appliances after C3), with the projection rebuilt from v2 keys; rollback = feature flag back to v1 keys (both stored).
6. **Out of scope for 3B:** laptops (NO-GO), Creators API (FUTURE STATE), ranking/eligibility/affiliate (untouched by design).

---

**Ledger (brief §1–§25 of the Phase 3A prompt):** ground truth — DONE (459 pairs, labeled, policy stated; founder review pending); precision defect first — DONE (§2, generic rule); detector redesign — DONE and tested against alternatives (§3); brand resolution — DONE with a ladder and measured sources (§4); replay A–E (+F) — DONE with precision/recall/FP/ambiguous per candidate and per category (§5); coverage never reported alone — complied; laptops as a separate path — DONE (NO-GO); control group not treated as truth — DONE (§5.5); architecture freedom — exercised (F); Creators API — FUTURE STATE only; STOP — complied: no deploy, no migration, no production write, no re-key, no ranking change. NOT DONE: inter-rater ground truth (single reviewer); the four verifier vocabulary gaps (listed, not implemented); recall on the 3 harness-collision pairs (limitation stated).
