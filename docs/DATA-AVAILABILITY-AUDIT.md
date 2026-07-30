# REDESIGN — PRODUCTION DATA AVAILABILITY AUDIT
**2026-07-30 · Read-only against production `vyceqrzttspyycdpojtn` · Step 1 of the redesign brief**

This audit establishes what the customer surface is *permitted to render*, measured from
production rather than quoted from documentation. Every figure below was reproduced in this
session. Nothing here is copied from HANDOVER, STANDING_DIRECTIVE, or a prior report.

**ADRs checked before measuring:** ADR-132 (Amazon double-count retraction), ADR-134
(insufficient-history abstention), ADR-138 (category unlock), ADR-139 (najm/shaker/alnakheelk
admission), ADR-148/149 (backpressure, Noon regex).

---

## 1. THE HEADLINE — what a card may claim

| measure | value | source |
|---|---|---|
| projection rows (served products) | **5,037** | `tps_product_projection` |
| **comparable products** (`has_comparison`, ≥2 retailers) | **758** | same |
| rows carrying a real observation timestamp | **4,826 (95.8%)** | `last_observed_at` |
| rows with **no** timestamp — must render no line | **211 (4.2%)** | same |
| rows with an image | **4,756 (94.4%)** | same |

**758 reproduces the CAN SAY figure in `docs/LAUNCH_VOCABULARY.md` §2 exactly.** It supersedes
the 455 / 592 pair in `STANDING_DIRECTIVE.md` §1, which were measured on a narrower
approved-retailer gate before ADR-139. Use 758; re-measure before publishing.

---

## 2. THE §5.1 CONSTRAINT IS SATISFIABLE — the data exists

The brief requires the observation line to render **only** from a real production timestamp,
and to render nothing at all otherwise. Measured age distribution across all 5,037 rows:

| bucket | rows | share |
|---|---|---|
| ≤ 24 h | 1,067 | 21.2% |
| ≤ 7 d | 2,372 | 47.1% |
| ≤ 30 d | 1,384 | 27.5% |
| > 30 d | 3 | 0.1% |
| **no timestamp** | **211** | **4.2%** |

**Conclusion: the line is renderable for 95.8% of products and must be suppressed for 4.2%.**
A conditional render — not a default, not "Unknown", not "Estimated" — is both required and
sufficient. The reference implementation already exists and is correct:
`src/app/[locale]/(public)/compare/[key]/page.tsx:291` guards on `offer.observed_at &&` before
rendering `رصدناه قبل X يومًا` / `observed X days ago`.

### The gap, located precisely

`src/app/api/search/route.ts:696–703` **already reads `observed_at`** from `price_history` —
but uses it only to `.order()` and pick the latest price per retailer. It is never carried onto
the `SearchProduct` object it builds (line ~735 onward). So the search card cannot render an
age line today: the field is dropped one step before the UI.

`search-client.tsx` contains **zero** references to `observed`. This matches the gap HANDOVER
#16 lists as an accepted launch exclusion and calls "the highest-value remaining freshness
fix, and it is small." The audit confirms both halves: high value (34% of visible offers are
>7 days old and currently undated on cards) and small (forward one field already in hand).

---

## 3. CATEGORY COVERAGE — what navigation may expose

Brief §10: *"categories with proven production coverage only."* Measured:

| category | products | **comparable** | with timestamp |
|---|---|---|---|
| air_conditioner | 708 | **118** | 707 |
| mobile | 332 | **106** | 327 |
| washing_machine | 318 | **85** | 318 |
| tv | 502 | **78** | 416 |
| laptop | 742 | **70** | 723 |
| tablet | 451 | **56** | 351 |
| monitor | 450 | **54** | 450 |
| refrigerator | 276 | **41** | 276 |
| audio | 333 | **40** | 333 |
| smartwatch | 73 | **31** | 73 |
| dishwasher | 63 | 17 | 63 |
| printer | 51 | 16 | 51 |
| vacuum | 214 | 10 | 214 |
| air_fryer | 169 | 10 | 169 |
| microwave | 76 | 8 | 76 |
| blender / kettle / oven / coffee_maker / camera | 36–81 each | 3–4 | full |
| toaster | 17 | 1 | 17 |
| air_purifier | 1 | **0** | 1 |

**Design consequence:** ten categories (AC → smartwatch) carry ≥30 comparable products and can
honestly anchor a category surface. The tail below `dishwasher` cannot — surfacing `air_purifier`
(1 product, 0 comparable) or `toaster` (1 comparable) as a browsable category promises a
comparison the catalogue cannot deliver, which is the failure mode §14 forbids. The tail should
remain reachable by search, not promoted as navigation.

**Search reachability is no longer gated.** `STANDING_DIRECTIVE.md` §1 records a hard limit of
mobile + AC only (132 of 459 reachable). No such gate remains in `src/app/api/search/route.ts`;
ADR-138 removed it. That directive line is stale.

---

## 4. DEAD SURFACES — measured, not assumed

| surface | measured state | consequence |
|---|---|---|
| `coupons` table | **0 rows, 0 active** | The coupons page has nothing to render. Navigation to it is a guaranteed empty state. |
| `stores` registered | 24 | — |
| stores with **any** listing | **6** | The other 18 are registry rows, not merchants a customer can be sent to. |

The empty coupons table also independently confirms why «حصرية» / "exclusive" sits on the MUST
NOT SAY list — there is no coupon data for the claim to be exclusive *about*.

---

## 5. THE PUBLISHABLE STATISTIC — re-measured this session

`curl -s https://tawveeri.com/api/v1/tps/discount-integrity`, **generated_at
2026-07-30T18:30:46.953Z**:

| field | value |
|---|---|
| checkable listings | 13,879 |
| `inflated_reference` | 9,673 |
| `verified_drop` | 373 |
| `stable` | 3,833 |
| `insufficient_history` (abstains, excluded) | 10,464 |
| **`inflated_reference_share_pct`** | **70** |

**Reproduced: 70%, unchanged.** The vocabulary file's 16:14:53 UTC reading (13,858 / 9,661) has
moved to 13,879 / 9,673 — the population grew, the share held. Publish only with the scoping
clause *"among the offers we examined"*.

**The proof card reproduces live** from the same payload: Extra, Hisense 85" Mini LED,
`observed_max` 14,399 → `current_price` 5,599, `verdict: verified_drop`, 14 distinct observed
days. Our published saving is lower than the retailer's advertised one because ours is evidence.

---

## 6. WHAT THIS AUDIT DECIDES

Per brief §2 — research that changes no decision is waste. Each finding below changes one:

1. **The observation line ships to search cards, conditionally.** Data exists for 95.8%;
   suppress for 4.2%. Not a data problem — a field-forwarding problem in one route.
2. **Category navigation exposes ten categories, not twenty-two.** Proven comparable depth is
   the gate.
3. **Coupons must not be a primary navigation target** while the table is empty. Either remove
   the entry point or state the empty state honestly.
4. **"758 comparable" is the number.** 455 / 592 are superseded; 5,037 is catalogue size and may
   never be presented as comparable (vocabulary §3 forbids merging them).
5. **70% remains publishable**, with its scoping clause and its date.

## 7. WHAT THIS AUDIT DOES NOT DECIDE

Deferred to real customer behaviour per brief §10 — recorded here so they are not silently
guessed: result ordering, prompt phrasing, recommendation tuning, contextual suggestions,
interaction timing. No user behaviour data exists yet; any such choice made now would be
opinion presented as evidence.
