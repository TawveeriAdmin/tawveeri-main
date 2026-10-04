# TV short-model identity — research, shadow replay and proposal (2026-10-04)

**Status: research / shadow only. No production behaviour changed. TV stays HOLD (rolled back 2026-10-04 10:15Z).**
Evidence: `docs/evidence/amazon-diagnostic-2026-10-03/phase3b/tv-short-model/` (`summary.json`, `token-dataset.json`, `replay-changed-groups.json`) · code: `src/lib/identity/tv-short-model.ts` (imported by nothing in production) · regression: `tests/identity/tv-short-model.test.ts` (42 cases) · research script: `scripts/tps-analysis/tv-short-model-research.ts` (read-only against production).

## 1. What actually failed (diagnosis corrected)

Wave 1's audit sample held TV groups with two different manufacturer codes — TCL **85T8D** (Amazon) vs **85C6K PRO** (Extra), Hisense **Q71Q** (Jarir) vs **65S7N** (Extra). First diagnosis ("short codes are rejected by `extractManufacturerModel`") was incomplete. The measured picture:

| Where | What it reads | Short code visible? |
|---|---|---|
| TV plugin (key builder) `normalize()` | payload → title (ADR-175) → size-prefixed (ADR-177) | only if the code is **declared in a payload field AND repeated verbatim in the title** |
| Verifier callers (compare page `get-comparison.ts:410`, signals job, shadow) | `extractManufacturerModel(payload)` only, minimum 6 chars | **no** |

So the verifier is blind to what even the key builder sees (title-derived models: Samsung 279/422 listings seen vs 395 by the plugin; LG 106/176 vs 153; Skyworth 29/72 vs 54; Nikai 9/50 vs 45; Sony 0/11 vs 10), and **both** are blind to a short code that sits **only in the title** (Amazon `TCL 85T8D …`) or **only in a structured field** (Extra `modelNumber: 85C6K PRO`). Two different codes, zero evidence either side → the spec-family key (`tcl|85|4k|mini_led|144`) matches.

## 2. Short-code taxonomy (from the live catalogue, 1,110 TV listings, 182 multi-store groups)

| Class | Examples | Where it appears | Verdict-relevant |
|---|---|---|---|
| Size-prefixed series code (TCL / Hisense / Haier) | `85T8D` `65P7L` `98C6K` `98Q6C` `55E8S` `65S7N` `58A6N` `85U7Q` `75Q6Q` `H85M80FUX` | Extra `modelNumber`; Amazon/Noon/Almanea/Blackbox **titles** | yes — the codes that were invisible |
| Same + variant word | `85C6K PRO` `55E7S PRO` | Extra `modelNumber` (also seen unspaced `85C6KPRO`); titles | yes — variant word is part of the model |
| Long manufacturer code | `QA55Q7FAAUXSA` `75QNED93A6A` `OLED77C66LA` | all merchants | already handled |
| Size-less series code | Jarir `…, Black, Q71Q` / `P7L` / `V6D` / `M1EH` | Jarir titles | **12 listings, 4 in multi-store groups** — too few to justify a lane; stays Unknown (one-sided → Review) |
| Notation variants | `85C6K PRO` vs `85C6KPRO`, colour/region suffix | Extra | handled by the verifier's notation-robust comparison (ADR-403) |

Hisense and TCL carry the problem: Hisense 17 + TCL 20 listings have **only** a declared short code (invisible to the plugin lane), and the title lane adds 15 + 19 more.

## 3. Source reliability — by (merchant, field), measured, not assumed

Independent measure per field: declared value present in the listing's own title; **confirmed** = a *different* merchant independently states the same whole token (title word or structured field); **trap** = sizes, refresh rates, panel words, retailer SKUs, whole titles.

| merchant.field | values | in own title | confirmed by another merchant | traps | Reading |
|---|---:|---:|---:|---:|---|
| extra.modelNumber | 306 | 0 | 123 | **0** | structured manufacturer MPN, never repeated in the title — **most reliable source for short codes** |
| samsung_ksa.model | 120 | 120 | 100 | 0 | official, reliable |
| almanea.model | 123 | 118 | 55 | 0 | reliable |
| amazon.model | 204 | 176 | 4 | **151 (74 %)** | truncations (`85T`), sizes — **never trust** |
| jarir.model | 30 | 30 | 0 | 30 | the whole title |
| alnakheelk.model | 31 | 0 | 0 | 31 | the whole title |
| noon.model | 130 | 0 | 0 | 0 | title fragments (`Television 85 Inch Smart`) |

Consequence for design: **the generic `model` field is never a source for short codes**; `mpn` / `modelNumber` / `model_number` are. Reliability is a property of the field a merchant uses, not of a string's length or regex shape — a short explicit `modelNumber` outweighs a long inferred title token, as required.

## 4. Labelled dataset (labels independent of the extractors under test)

`token-dataset.json`: 1,013 declared-field tokens. Labels by rule / cross-merchant agreement only — **282 `model_confirmed_cross_merchant`**, 104 `model_declared_in_own_title`, 404 `declared_uncorroborated` (genuine-looking, no second source), and **213 non-model traps** (163 whole titles, 31 retailer numeric SKUs, 18 panel/marketing words, 1 size). Trap classes: ASIN `B0…`, Noon `N\d+[A-Z]`, numeric retailer SKU, `\d+INCH`, `\d+HZ`, `4K/UHD/FHD`, panel words (`QLED`, `MINILED`, `QNED`…). Corroboration requires a **whole-token** match (an earlier version used substring matching, which made `85T` "confirmed" by `85T8D`; that labelling bug was found, fixed and every figure here is from the corrected run).

## 5. Proposed evidence (not a regex relaxation)

Two lanes added to what the verifier is given as the listing's declared model, **in this order after the plugin's own derivation**:

* **Lane D — declared short model.** A value in `mpn` / `modelNumber` / `model_number` (not `model`), 4–22 chars, letters **and** digits, not a retailer id / spec / trap / the title repeated; one token or token + variant word (`PRO PLUS MAX ULTRA EVO LITE`).
* **Lane T — title short model.** ADR-177's three conditions moved from "payload candidate verified in the title" to "title token": shape `<2–3 digits><letter><1–3 alnum>`, leading digits **equal the listing's parsed screen size**, not a prefix of a longer token in the same title, technology tails refused (`65QLED`), variant word kept.

Wiring (one function, three callers — the same change that fixes the write/verify asymmetry): the signals job, the compare page and the shadow script must obtain the declared model from **one** shared function. TV only; every other category stays byte-identical (parity tests). The verifier's rules are untouched: stated conflict ⇒ reject, code on one side ⇒ Review, agreeing codes ⇒ match; family key proposes, exact model verifies.

## 6. Evaluation

**Extractor vs independent labels** (282 confirmed models / 213 traps): recall P0 current gate wiring 97.5 % · P1 plugin parity 97.5 % · P2 +lane D 98.9 % · P3 +lane T 98.9 %; **false accepts 0 / 213 for all**. (The labelled positives are mostly long codes, so recall barely moves — the gain is in the *unlabelled* short codes below.) Lane T on titles: **69 codes accepted, 0 traps**; 4 confirmed by another merchant's structured field, 2 by another title, **63 unconfirmed** (sample read by hand: `85T8D 85C6K 85Q6C 65P7L 75Q6Q 55T69D 55E7S PRO 55Q72Q 65E8S 75Q7C 50S5K 50A62Q 55E8S 85P8L 85C7L 65E8Q` — all follow TCL/Hisense series naming, but "plausible" is not "confirmed": see §9). Refused by rule: 277 size-mismatch (e.g. `144HZ`), 39 no parsed size, 14 technology words.

**Verifier replay** over all 182 multi-store TV groups (493 listings), current offers: listing verdicts P0 479 match / 14 review / 0 reject → **P3 444 / 47 / 2**. Comparable groups (≥ 2 stores that stand): P0 **171** · P1 172 · P2 156 · **P3 159**; with Amazon P0 68 → P3 62. Named cases: **TCL 85T8D vs 85C6K PRO** → amazon *review*, noon *review*, extra *match* (no merge); **Hisense Q71Q vs 65S7N** → jarir *review*, amazon *review*, extra *match* (no merge).

**The 22 groups whose outcome changes (P0 → P3), each read by hand:**

| # | Class | Groups |
|---|---|---|
| 16 | **False merge removed** — two different stated models | TCL 85T8D/85C6K PRO · 65T8D/65Q6C · 65P7L/65T6D (noon rejected) · 55T8B/55P8K · 55P8L/55C7L · 75P8L/75Q7C · 75V6D/75V6B · 98C6K/98C8K · 50P7L/50P7K; Hisense 55E8S/55U7S · 65E8S/65U7S · 58E6Q/58A6N · 85U7Q/85U7S · 75Q72Q/75S7N · 55E7S PRO/55Q72Q · TCL 55T69D/55T6D |
| 3 | **Legitimate comparison recovered** (review → match) | Hisense 55U6Q (noon + extra agree) · TCL 98Q6C (amazon + noon verified; extra's 98C8L *rejected*) · Impex 75S4QLC2 |
| 3 | **Conservative one-sided Review** (match → review, no stated conflict) | Hisense 85Q6Q (extra states nothing) · Hisense Q61Q/65Q6N (Jarir size-less) · Hisense Q71Q/65S7N (the named case) |

Net: **−12 comparable groups (−7 %) for 16 groups that stop claiming two different models are one product.** Coverage falls; Integrity rises; none of the 22 is a false split that the evidence can show (the three one-sided cases are the price of "one-sided uncertain model stays Review").

## 7. Residual false-merge risk (stated)

* TV groups with **no model evidence on any side** are unchanged (family key, nothing to contradict) — 6 of 167 verified groups today (`evidence_strength.family_only`), versus 149 exact-model-key and 2 agreeing stated codes.
* Lane T accepts what *looks* like a series code; 63 of 69 are uncorroborated by a second merchant. A wrongly-read title token would produce a wrong **review/reject**, i.e. a lost comparison, never a false merge — the failure direction is conservative.
* Size-less series codes (Jarir) remain Unknown.
* The research replays **current offers**, not the price-history fallback the signals job also reads; the production shadow will cover it.

## 8. Recommendation — **GO WITH CONDITIONS** (not auto-enabled)

Conditions, all required before any TV cutover:
1. **Reviewer audit**: the founder or a reviewer reads the 22 changed groups (`replay-changed-groups.json`, listing titles side by side) and a sample of the 63 uncorroborated title codes — the labels above are independent of the extractors but I authored both the code and the classification.
2. Implement the **single shared function** and wire the signals job, compare page and shadow script to it; TV only; parity tests prove other categories byte-identical.
3. **Production shadow** with the isolated runner (signals only, no read gate): confirm the 22-group effect on real signals including the history fallback.
4. Fresh audit sample on TV after the wiring with **zero** confirmed false merge, and 85T8D/85C6K PRO + Q71Q/65S7N shown not to merge on the live compare page.
5. Surfaces agree (search card / product / compare / category) — the storefront and agent bypasses are already gated.
6. Approve adding `tv` to `IDENTITY_RUNNER_APPROVED_CATEGORIES` (a code change — deliberately not a variable).

NO-GO triggers: any confirmed false merge in the post-wiring audit; comparable groups falling more than the 22-group analysis explains.

## 9. Limits of this evidence

Labels come from cross-merchant agreement and rules, not from a manufacturer database; 404 declared tokens and 63 title tokens are uncorroborated. Extra's `modelNumber` is treated as authoritative on the strength of 0 traps in 306 values and 123 independent confirmations — if Extra changes its feed that must be re-measured (the proposed lane D is per-field, not per-merchant, so the monitor's candidate scan will surface a regression).
