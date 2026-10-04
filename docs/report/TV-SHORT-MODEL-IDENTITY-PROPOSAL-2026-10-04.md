# TV short-model identity — research, independent review, replay and proposal (v2, 2026-10-04)

**Status: research / shadow only. No production behaviour changed by this document. TV stays HOLD (rolled back 2026-10-04 10:15Z). No cutover without a separate approval.**
v2 supersedes the first draft the same day: it adds the independent review of all 22 changed groups, the measured source-field trust matrix, the unified-evidence-function design, per-merchant impact and the scope-extension findings from the Vacuum review.

Evidence: `docs/evidence/amazon-diagnostic-2026-10-03/phase3b/tv-short-model/` (`summary.json`, `token-dataset.json`, `replay-changed-groups.json`) · `phase3b/source-field-trust-2026-10-04.json` · `phase3b/review/` (label-free sheets + blind answers) · code: `src/lib/identity/tv-short-model.ts` (imported by nothing in production) · regression: `tests/identity/tv-short-model.test.ts` (42 cases) · scripts: `scripts/tps-analysis/{tv-short-model-research,source-field-trust,review-sheets-build}.ts` (read-only against production).

## 1. What failed

Wave 1's audit sample held TV groups with two different manufacturer codes — TCL **85T8D** (Amazon) vs **85C6K PRO** (Extra), Hisense **Q71Q** (Jarir) vs **65S7N** (Extra). The cause is an **evidence-access inconsistency**, not a regex length:

| Where | What it reads |
|---|---|
| TV plugin (key builder) `normalize()` | payload → title (ADR-175) → size-prefixed short code (ADR-177, only a *payload* candidate repeated verbatim in the title) |
| Verifier callers (compare page `get-comparison.ts`, signals job, shadow) | `extractManufacturerModel(payload)` only, minimum 6 characters |

So the verifier sees less than the key builder (Samsung 279/422 listings seen vs 395; LG 106/176 vs 153; Skyworth 29/72 vs 54; Nikai 9/50 vs 45; Sony 0/11 vs 10), and **both** miss a short code that sits only in a title (Amazon `TCL 85T8D …`) or only in a structured field (Extra `modelNumber: 85C6K PRO`). Different codes, zero evidence either side → the family key (`tcl|85|4k|mini_led|144`) matches.

## 2. Governing rule for the fix

Do **not** lower a minimum length. Create **one normalized manufacturer-model evidence function**, aware of source semantics, that the key builder, the signals job, the compare page and the shadow script all call. Family/spec key proposes candidates; exact model evidence verifies; a stated conflict rejects; one-sided uncertain evidence stays Review.

### 2.1 Required output of the unified function
`{ normalized, raw, source, trust, reason }` — normalized code (separators removed, manufacturer-significant suffixes such as `PRO` kept), the **raw** string exactly as stated, the **source path** (`payload.modelNumber`, `payload.mpn`, `spec.model_number`, `title.size_prefixed`, `plugin`), a trust class (`HIGH` structured field of a measured-reliable merchant, `MEDIUM` structured field with a measured trap rate, `TITLE` title-derived under the naming-convention test), and a human-readable reason for acceptance or refusal. A refusal is also an output (`null` + reason: retailer id, spec, whole title, technology word, size mismatch, untrusted generic field …) so the monitor can count refusals.

### 2.2 Requirements and how each is met
| Requirement | Mechanism |
|---|---|
| accept trusted source-explicit short codes | lane D: `mpn` / `modelNumber` / `model_number` (+ trusted spec keys, §4) |
| preserve suffixes (`PRO`, `PLUS`…) | one token + variant word kept as part of the code |
| reject retailer / internal SKUs | ASIN `B0…`, Noon `N\d+[A-Z]`, numeric ≥ 5 digits, `isStoreInternalIdentifier` |
| size, refresh rate, panel, series words, whole titles | trap classes `size` `refresh_rate` `resolution` `panel_or_marketing`; title-equals-field; length cap |
| untrusted generic `model` field | never read for short codes (measured traps: amazon 44 %, jarir 63.7 %, alnakheelk 100 %) |
| separators | normalization strips non-alphanumerics; `85C6K PRO` ≡ `85C6KPRO` |
| lane T (title) | ADR-177's three conditions on a *title* token: shape, leading digits = the listing's parsed screen size, not a prefix of a longer token; technology tails (`65QLED`) refused |
| retain evidence and path | `raw` + `source` persisted with the verdict row |

## 3. Taxonomy (live catalogue, 1,110 TV listings, 182 multi-store groups)

Size-prefixed series codes (TCL / Hisense / Haier: `85T8D 65P7L 98C6K 98Q6C 55E8S 65S7N 58A6N 85U7Q 75Q6Q H85M80FUX`), the same with a variant word (`85C6K PRO`, `55E7S PRO`), long manufacturer codes (already handled), notation variants (`85C6K PRO` vs `85C6KPRO`; colour/region suffixes) and **size-less series codes** (Jarir `…, Black, Q71Q`: 12 listings, 4 in multi-store groups — too few to justify a lane; they stay Unknown and make the Jarir side one-sided Review).

## 4. Source-field trust matrix — merchant + field + measured reliability

Measured over 8,920 current valid offers, all categories, by rule and cross-merchant agreement (never by an extractor): `trap` = size / refresh rate / panel word / retailer SKU / whole title / fragment; `confirmed` = a *different* merchant independently states the same whole token (title word or structured field) in the same canonical group.

| merchant.field | declared | trap % | in own title % | confirmed % (n) | trust |
|---|---:|---:|---:|---:|---|
| extra.`modelNumber` | 1,643 | 0.8 | 0 | 80.5 (722) | **HIGH** |
| samsung_ksa.`model` | 1,313 | 0 | 90.9 | 96.4 (473) | **HIGH** |
| almanea.`model` | 1,598 | 0.8 | 65 | 69.5 (583) | **HIGH** |
| noon.spec `model_number` | 361 | 4.2 | 46.3 | 31.1 (180) | MEDIUM |
| noon.spec `model_name` | 296 | 7.1 | 38.9 | 35.2 (142) | MEDIUM |
| noon.`model` | 1,109 | 10.9 | 0 | 4.0 (325) | MEDIUM (title fragments) |
| extra.`model` | 446 | 11.2 | 0 | 9.5 (137) | MEDIUM |
| amazon.spec `model name` | 213 | 8.5 | 21.1 | 21.8 (124) | MEDIUM |
| amazon.spec `item model number` | 66 | 33.3 | 30.3 | 39.5 (38) | LOW |
| amazon.`model` | 1,326 | 44 | 30.2 | 44.6 (121) | **LOW** |
| jarir.`model` | 259 | 63.7 | 1.2 | 0 (23) | **LOW** |
| alnakheelk.`model` | 85 | 100 | 0 | – | **LOW** |

Reliability is a property of the **(merchant, field)** pair, not of a field name: `model` is excellent at Samsung KSA and Almanea and junk at Amazon, Jarir and Alnakheelk. A short explicit `modelNumber` from a HIGH source outweighs a long inferred title token. The matrix is data (regenerated by `source-field-trust.ts`, reviewed by a human), not a hard-coded allowlist, so a merchant changing its feed shows up as a regression.

**Extraction gap, all categories:** 206 offers (2.3 %) carry a model **only** in a spec field no lane reads (Noon `specifications.model_number`, Amazon `item model number`), 101 of them in multi-store groups (laptop 19, audio 17, TV 13, mobile 13, refrigerator 8, washing machine 7, tablet 6). Cheap, engineering-fixable, concentrated where comparisons exist.

## 5. Independent review of ALL 22 changed groups (no sample)

Method: the 22 groups whose verifier outcome changes under the proposal were rendered label-free (merchant, titles, brand, **all** raw source model fields with the generic `model` field labelled as a title fragment, model found in title, size / panel / refresh / resolution, condition / bundle / region hints, URL; **no** verifier verdict, no expected label), group and listing order shuffled with a fixed seed, and put to the founder (`https://claude.ai/artifact/BT3HS2bvgYZDHxUQVnMEvC`, collection `tv22`) **and** to two independent blind AI reviewers (different models, reverse order for one, web search allowed, no repository access). The narrow question is the one that removed the wording artefact in the blind gate: *"If a shopper buys the cheapest listing instead of any other listing, do they get exactly the same TV?"*

**Result so far (founder's answers pending — they take precedence and will be appended):**

| | reviewer A | reviewer B |
|---|---:|---:|
| SAME_EXACT_COMMERCIAL_VARIANT | 2 (T03, T07) | 2 (T03, T07) |
| DIFFERENT_VARIANT | 20 | 20 |
| REVIEW / INSUFFICIENT_EVIDENCE | 0 | 0 |
| **agreement between the two reviewers** | **22 / 22** | |

Adjudication against the verifier (the verifier's before/after outcomes were read only **after** the reviews):

* **False merges removed: 16 groups** — live comparisons in which ≥ 2 listings stood as "match" while a reviewer-identified listing was a different model (TCL 85T8D/85C6K PRO, 65T8D/65Q6C, 65P7L/65T6D, 55T8B/55P8K, 55P8L/55C7L, 75P8L/75Q7C, 75V6D/75V6B, 98C6K/98C8K, 50P7L/50P7K, 55T69D/55T6D; Hisense 55E8S/55U7S, 65E8S/65U7S, 58E6Q/58A6N, 85U7Q/85U7S, 75Q72Q/75S7N, 55E7S PRO/55Q72Q, 65 QLED Q71Q/65S7N). **8 of the 16 contain an Amazon listing.**
* **Four more DIFFERENT groups** (T02, T08, T14, T15) were already partly Review at baseline; the proposal leaves no comparison among different models there.
* **Residual false merge after the proposal: 0** — in every one of the 20 DIFFERENT groups, no pair of listings that stands as "match" includes a reviewer-flagged odd listing (T04: Noon rejected, Amazon + Extra stand; T08: Amazon + Noon 98Q6C stand, Extra's 98C8L rejected).
* **Legitimate comparisons recovered: 2** — Hisense 55U6Q (Noon + Extra agree) and Impex 75S4QLC2 (Noon + Alnakheel).
* **False splits among the 22: 0** (both SAME groups become all-match).
* **Traps:** 213 non-model tokens in the labelled set, **0 accepted**; title lane 69 codes accepted, 0 traps; refused 277 size-mismatch / 39 no parsed size / 14 technology words.
* Flags the reviewers raised: T14 (55T69D vs 55T6D: close specs, distinct models, medium) and T21 (Extra page shows 85Q6EQ vs Noon "85Q6Q International Model": possibly a regional rebadge of near-identical hardware; the proposal leaves Noon standing alone and Extra Review — conservative).

## 6. Replay (all 182 multi-store TV groups, current offers)

Listing verdicts: current wiring 479 match / 14 review / 0 reject → proposal **444 / 47 / 2**. Comparable groups (≥ 2 stores that stand): **171 → 159 (−12, −7 %)**; with Amazon **68 → 62**. Net coverage loss is the removal of the 16 false merges less 3 recoveries (2 reviewed + 1 partial).

Per-merchant effect inside the 22 changed groups (listings): Jarir 6 (all match→review: size-less series codes) · Amazon 10 (7 match→review, 1 review→match, 2 unchanged) · Extra 20 (13 match→review, 1 review→match, 5 unchanged, 1 other) · Noon 16 (10 match→review, 1 match→reject, 1 review→match, 4 unchanged) · Blackbox 1 (match→review) · Alnakheel 1 (unchanged). No merchant is targeted: the rule is symmetric and every change is traced to a stated or findable code.

Named cases: **TCL 85T8D vs 85C6K PRO** → Amazon review, Noon review, Extra match. **Hisense Q71Q vs 65S7N** → Jarir review, Amazon review, Extra match. Neither pair merges. Permanent regression fixtures (`tests/identity/tv-short-model.test.ts`): those two, `55E8S 65S7N 85T8D 85C6K PRO`, retailer SKU traps (ASIN, Noon, numeric), title-like `model` fields, screen-size and refresh-rate false positives, technology words, prefix truncations, agreeing codes matching, odd-one-out rejected, family keys with no evidence unchanged.

## 7. Residual false-merge risk (stated)

* TV groups with no model evidence on any side are unchanged (family key, nothing to contradict): 6 of 167 verified groups today.
* Lane T accepts what looks like a series code; 63 of 69 are uncorroborated by a second merchant (read by hand: all follow TCL / Hisense naming). A wrongly read token produces a wrong Review/reject (a lost comparison), never a false merge — the failure direction is conservative.
* Size-less series codes (Jarir) stay Unknown.
* The replay uses current offers, not the price-history fallback the signals job also reads — the production shadow covers it.
* Labels are independent of the extractors but I authored both the code and the first classification; the blind reviewers are provisional until the founder's answers arrive.

## 8. Decision — **GO WITH CONDITIONS** (unchanged, now better evidenced; not auto-enabled)

| Condition | Status |
|---|---|
| Full independent review of the 22 changed groups | **DONE by two blind reviewers (22/22 agreement, 0 residual, 0 false splits); founder's own answers pending and prevail** |
| Known TCL/Hisense failures fixed | **DONE in replay** (both named cases no longer merge) |
| No major new false-split class | **MET** (0 among the 22; the cost is 3 one-sided Reviews) |
| 0 unacceptable trap acceptance | **MET** (0 / 213) |
| One shared evidence function wired into signals job, compare page, shadow (TV only; other categories byte-identical, parity tests) | **NOT DONE** (designed in §2) |
| Production shadow with the isolated runner (signals only) incl. history fallback | **NOT DONE** |
| Fresh post-wiring audit sample with zero confirmed false merge; search / product / compare agree | **NOT DONE** |
| Approval to add `tv` to `IDENTITY_RUNNER_APPROVED_CATEGORIES` (a code change) | **NOT DONE** |

NO-GO triggers: any confirmed false merge in the post-wiring audit; comparable groups falling more than this analysis explains.

## 9. Scope-extension findings from the Vacuum review (affects the design, not the TV decision)

The same hidden-evidence class is not TV-specific:
1. **Low-digit codes in titles** (`A9K-CORE` vs `A9K-PRO`, LG vacuums) fail the name-lane density rule (≥ 8 chars, ≥ 3 digits) exactly as `85T8D` fails the length rule.
2. **Attribute conflicts** the verifier has no vacuum rule for: stated capacity in litres. A shadow paper-test of "both sides state litres and they differ by > 15 % ⇒ conflict" caught **3 of the 5** groups the two blind AI reviewers judged different (Midea 2 L vs 18 L, Panasonic 10 L vs 15 L, LG 1.5 L vs 0.44 L) and flagged **0 of 16** groups both judged exact. **The founder's own review of the same groups labelled those three "same family, not enough evidence" (only V14 different), so this rule is NOT validated against the founder's labels** and needs re-testing before it is adopted.
3. **Spec-only model evidence** (§4) and **Extra payloads without `modelNumber`** (186 of 264 Extra Vacuum offers carry it; the rest do not, while Extra's product pages show an mpn).
So the unified function should be category-general in its *interface* and shipped TV-first; each category adds its own trust rows and attribute rules.

## 10. Limits of this evidence

Labels come from cross-merchant agreement, rules and two blind AI reviewers (one of which read Extra product pages), not from a manufacturer database. 404 declared tokens and 63 title tokens are uncorroborated. Extra's `modelNumber` is treated as authoritative on 0.8 % traps over 1,643 values and 80.5 % independent confirmation — the trust matrix must be re-measured if its feed changes. The 22 reviewed groups are the *changed* groups; unchanged groups were not re-reviewed (their outcome is by construction identical).
