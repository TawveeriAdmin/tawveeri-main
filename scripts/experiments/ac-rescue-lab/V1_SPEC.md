# AC Rescue Lab — V1 FROZEN SPEC (ADR-319 algorithm, frozen for Phase 2 blind validation)

**Frozen at commit `f048a62c`** (the ADR-319 commit). Files `01-build-fingerprints.ts`,
`02-candidate-generation.ts`, `03-rank-and-classify.ts`, `04-price-experiment.ts` are NOT
modified during Phase 2 blind validation. Any change required to fix a genuine bug (not to
improve results) will be recorded explicitly as a V1.1 patch note below, never silently.

This file exists to prevent evaluation leakage: the blind gold set built in Phase 2 must be
established against these frozen rules, not against a moving target.

## V1_FEATURES

Per-product fingerprint (`01-build-fingerprints.ts`), derived once per AC row:

| Feature | Amazon-side source | Trusted-side source |
|---|---|---|
| `brand_raw` / `brand_canonical` | `detectBrandFromText()` + `canonicalizeBrand()` on title | parsed from `tps_identity_key` segment 1, or `canonical_products.brand` fallback |
| `brand_safe` | `false` if canonical brand ∈ `UNSAFE_BRAND_PLACEHOLDERS` (`unknown`, `generic`, `no brand`, `n/a`, `na`, `غير معروف`) | same |
| `ac_type` | `normalize()` payload | `tps_identity_key` segment 2 |
| `capacity_btu` / `capacity_class` | `normalize()` payload; `capacity_class = round(btu / 1000)` | `tps_identity_key` segment 4; same rounding |
| `cooling_mode` | `normalize()` payload | `tps_identity_key` segment 6 (`NO_MODE` → null) |
| `technology` | `normalize()` payload | `tps_identity_key` segment 5 (`NO_TECH` → null) |
| `series_or_platform` | `normalize()` payload | `tps_identity_key` segment 3 (`NO_SERIES` → null) |
| `model_number` / `mpn` | `extractModelMpnEvidence()` on `raw_observations.payload->specifications`, joined by exact `raw_name = products.name_en` string match | `canonical_products.model_number` (mpn always null on trusted side) |

**Known V1 limitation, disclosed in ADR-319 and unchanged here:** the Amazon-side
model/mpn join (`raw_name = products.name_en` exact string match) silently fails on
scrape-session title drift, showing 0/270 in this lab vs ADR-318's more carefully-verified
2/270. Not fixed for V1 — fixing it would change results, which Phase 2 validation must not do
mid-flight. A fix is in-scope for a V2 proposal only.

## V1_THRESHOLDS

- **Blocking key equality:** `capacity_class` must match EXACTLY (`CAPACITY_TOLERANCE_CLASSES = 0`, i.e. rounding to nearest 1000 BTU, no additional tolerance band).
- **Eligibility for Run A (the trustworthy tier):** `brand_safe && ac_type && capacity_btu !== null && cooling_mode && technology` all present (the "full founder fingerprint").
- **Eligibility for Run B (characterization only, not classified):** `brand_safe && ac_type && capacity_btu !== null` (the "minimal blocking fingerprint").

## V1_CONFLICT_GATES (hard, non-negotiable — reject regardless of other agreement)

A candidate is removed from the surviving set if, on ANY of the following four attributes,
**both sides state a value AND the values differ**:

1. `cooling_mode`
2. `technology`
3. `series_or_platform`
4. `model_number`

Brand, `ac_type`, and `capacity_class` are never conflict-checked because they are the
blocking keys — a candidate that reaches the conflict check already agrees on all three by
construction.

## V1_RULES (ranking + classification, `03-rank-and-classify.ts`)

```
score(candidate) = matching_attributes.length - missing_attributes.length
  where matching/missing are drawn from {cooling_mode, technology, series_or_platform}
  (brand, ac_type, capacity_class always "matching" by blocking construction)

rank candidates within a surviving set by score, descending
top = highest-scored candidate; topScore = score(top)
secondScore = score of the runner-up, or -Infinity if only one candidate
clearLead = topScore > secondScore
topMissing = top.missing_attributes.length

if surviving_candidate_count == 0:
    class = HARD_CONFLICT   if any raw candidate was rejected by a conflict gate
    class = NO_CANDIDATE    otherwise

elif surviving_candidate_count == 1:
    class = RESCUE_PROVEN            if topMissing == 0
    class = RESCUE_HIGH_CONFIDENCE   if topMissing == 1
    class = RESCUE_REVIEW            if topMissing >= 2

else (surviving_candidate_count >= 2):
    class = RESCUE_HIGH_CONFIDENCE   if clearLead and topMissing == 0
    class = RESCUE_REVIEW            if clearLead and topMissing <= 1
    class = AMBIGUOUS                otherwise (no clear lead, or clear lead but topMissing >= 2)
```

Note the asymmetry already present in V1: a UNIQUE candidate with `topMissing == 1` is
`RESCUE_HIGH_CONFIDENCE`, but a MULTI-candidate winner needs `topMissing == 0` (full
agreement) to reach the same class. This was a deliberate V1 design choice (uniqueness alone
is weaker evidence than full attribute agreement) — Phase 2 blind validation is the first real
test of whether that asymmetry is calibrated correctly.

## V1 measured results (ADR-319, Run A, n=26 eligible) — for reference only, NOT to be used to tune Phase 2

RESCUE_PROVEN=0, RESCUE_HIGH_CONFIDENCE=4, RESCUE_REVIEW=4, AMBIGUOUS=3, HARD_CONFLICT=3, NO_CANDIDATE=12.

## Patch log

*(empty — no patches applied since freeze)*
