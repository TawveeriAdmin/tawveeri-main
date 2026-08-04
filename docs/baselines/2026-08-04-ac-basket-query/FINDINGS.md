# Baseline + controlled matrix — «ابي 3 مكيفات بميزانيتي 5000 ريال» (2026-08-04)

**Status:** BEFORE-baseline, frozen prior to any change. Production `tawveeri.com`,
locale `ar`, mobile UA, journey viewport 390×844. Raw artifacts in this directory:
`api-search-response.json` (full server response), `baseline-summary.json`,
`dom-before-mobile.png` + `dom-before-state.json` (customer-visible DOM),
`matrix-results.json` (34-query controlled matrix, full per-layer detail).

## Reproduced defect (production, 2026-08-04 ~09:03Z)

`POST /api/search` for the exact query returned **48 results (total 96)**: ~2 air
conditioners; the rest TVs/monitors (26), smartwatches (8), tablets, laptops, webcams,
a WiFi extender. 4 products above the stated 5,000 SAR budget. No Smart Pick. No
advisor (Waffar) block in the DOM. The ranking-explanation line
(«مرتّبة حسب مطابقتها لبحثك…», search-client.tsx:1496) renders over these results.

## Controlled singular/plural matrix — verdict per layer

34 queries: 6 category pairs × {isolated, need-sentence} × {sg, pl} × {Latin,
Arabic-Indic numerals} + English equivalents + the previously-working control.
Full rows in `matrix-results.json`. Layer probes replicated from
`src/app/api/search/route.ts@88419ac`; candidates-before-ranking measured by direct
Algolia call with the exact production query construction; after-ranking measured on
production `/api/search`; Waffar state measured against production `/api/v1/agent/decide`.

### 1. The founder's plural hypothesis is REJECTED for this defect

- «ابي 3 **مكيف** بميزانيتي 5000 ريال» (singular) produces **identical** junk to the
  plural — same candidate distribution (tv 36 / smartwatch 10 / AC 2), same results.
- Isolated «مكيف» and «مكيفات» both return 47/48 air conditioners.
- Arabic-Indic numerals behave identically to Latin.
- **The failing variable is the need-sentence wrapper, not plural morphology.**

### 2. The failing layers, measured

| Layer | Verdict |
|---|---|
| Query normalisation | OK — digits/hamza folded correctly in every variant |
| Category classification (task-parser) | OK for the failing query — `air_conditioner` extracted from every AC variant |
| **Structured budget extraction** | **FAILING** — Arabic «بميزانيتي 5000 ريال» → `budget=null`. Two independent causes: (a) `parseBudget` knows «ميزانية» but not the attached-morpheme form «بميزانيتي»; (b) the fallback `/([\d,]{3,7})\s*(?:ريال|sar|sr)\b/` ends in `\b` after an Arabic letter — JS `\b` never matches beside Arabic letters (the documented bilingual-invariant trap). English "budget of 5000 SAR" parses fine → `budget=5000`. |
| **Intent routing** | Consequence of the above: no need signal → `retrieval` → **Waffar state = not-routed** (silent by construction). The English equivalent routes `advisory` and **passed**. |
| **Quantity extraction** | **ABSENT** — no quantity field exists anywhere in the parser/engine. |
| **Retrieval (Algolia)** | **FAILING** — the full sentence goes to Algolia with every token optional; «بميزانيتي»/«5000»/«ريال»/«3» become matching terms. Candidates before ranking: tv 36 · smartwatch 10 · tablet 9 · **AC 2**. No price filter is ever derived from the budget. |
| **Ranking / relevance gate** | **SELF-DISABLING** — «بميزانيتي» forms a required word-group no product can match → 0 gate survivors → gate skips itself ("never wipes the page") → the flooded candidates pass through unfiltered. |
| Fallback behaviour | The junk IS the silent fallback the Master Book forbids. |

### 3. Waffar silent non-answer — exact state

`not-routed`. `routeQuery` is deterministic and client-side; with `budget=null` and no
other need signal the advisor is never called. Additionally, when the advisor IS called
and returns error/empty, `search-client.tsx` deliberately suppresses the panel and
**records nothing** — no `advisor_state` event exists. Both halves violate "a silent
absence must end in a recorded state".

### 4. Secondary plural defects (real, distinct from the reported defect)

- «شاشات» isolated: collapses to **1 result** (48 for «شاشة») — the plural has no
  expansion entry, so the relevance group is the bare plural string, which almost no
  title contains.
- «جوالات» isolated: 8 mixed junk results (audio/camera/tablet).
- «ثلاجات», «غسالات»: category = null in the task parser (regexes anchored on «ثلاجة/غسالة»).
- English isolated "air conditioner(s)": mostly non-AC results — the known EN/AR gap
  class, out of scope for this unit.

### 5. Control query

«مكيف رخيص لغرفه 40 متر» → advisory, Waffar **passed** — consistent with the founder's
earlier successful manual test. The variable distinguishing success from failure is
whether the parser finds a need signal, not the category noun's number.
