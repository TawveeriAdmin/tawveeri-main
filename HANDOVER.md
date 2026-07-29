# HANDOVER — جرد حالة العمل

> **نطاق هذا الجرد (صراحةً):** قرأتُ فعليًا وبالكامل الملفات الـ45 داخل `scripts/tps-analysis/` — وهي مجلد المخرجات/الأدوات التحليلية التي أنتجتها الجلسات السابقة. **لم أقرأ** بقية المستودع (كود التطبيق `src/`، مجلد `docs/`، `mobile/`، `scripts/tps-core`، `scripts/tps-plugins`، ملفات الإعداد) ملفًا-ملفًا — قراءة آلاف الملفات غير ممكنة في جلسة واحدة، وادّعاء ذلك سيكون غير أمين. حيث أشير إلى ملف خارج `scripts/tps-analysis/` فذلك **استنتاج** من استيرادات الكود أو من الذاكرة، وسأضع عليه علامة "لم أقرأه".
>
> التاريخ المرجعي: 2026-07-28. مصدر التواريخ/الأحجام: نظام الملفات (`ls`).

---

# ═══ RESUME HERE — 2026-07-30 CHECKPOINT #5 (supersedes everything below) ═══

**Working state. Read this, not the whole directive.**

## Gate

**Overall 80/80 = 100% · Comparison 58/58 = 100%** — `docs/ui-journey-2026-07-29-close.log`.
Zero failures, homepage inside the denominator.

**What a PASS means** (read before quoting it): relevant product for the query · not an
accessory · a full store name visible on the card · the compare page's lowest price agrees
with the card's price to within 1 SAR · ONE outbound link resolves to a real product page ·
no card on the page claims a store count with no compare link. It does **not** verify that
every retailer's link works, and the query set contains **no model-specific query** — which
is exactly how the Arabic Pro/Max defect below survived a 100% score.

**The 22 are not failures.** 80/80 passed. 22 = 20 single-store journeys (5 queries ×2
locales ×2 surfaces: macbook · ps5 · washing machine · شاحن · مروحة) + 2 homepage rows that
have no store count. Those 5 queries are the real backlog: we have no comparison for them.

## THE RULE I GOT WRONG — corrected by measurement 2026-07-30

I said single-brand retailers produce no overlap, citing sonyworld = 0. **Wrong
generalisation.** The variable is not single-brand vs multi-brand, it is **how many of that
brand's products OTHER retailers already carry**:

| brand | canonicals | single-store (the opportunity) | already comparable |
|---|---|---|---|
| **samsung** | 432 | **281** | 151 |
| apple | 298 | 230 | 68 |
| lg | 299 | 212 | 87 |
| **sony** | **11** | 10 | 1 |

Sonyworld produced zero because **Sony has 11 canonicals in the whole catalogue** — nobody
else carries them. Samsung KSA is the opposite case and is the single largest measured
opportunity in this project: **ceiling +281 comparisons.**

## Predicted overlap for the three named retailers (measured, pre-investment)

- **Samsung KSA — ceiling +281.** 281 single-store Samsung canonicals that Jarir/Extra/
  Amazon/Almanea/Noon already carry. Highest-value onboarding available.
- **SWSG (الشتاء والصيف)** — already approved, thin. Its categories hold the largest pool
  in the catalogue: air_conditioner **1,006** single-store, refrigerator 238, washing_machine
  236. AC alone is bigger than every unlock so far combined.
- **Noon** — already approved, 809 URLs. Broad-catalogue retailer against mobile 481 /
  audio 529 / laptop 423 single-store pools.

**None of the three needs discovery. All three are depth, not breadth.**

## Next, in order

1. **Ingest Samsung KSA** (+281 ceiling), then SWSG depth (AC 1,006 pool), then Noon depth.
2. **Parsers for multi-retailer brands** — jbl(6 stores, 45 missing) · xiaomi(9, 22) ·
   promate(3, 16) · garmin(2, 15) · hp(6, 14).
3. **Add model-specific queries to the harness** — `iPhone 16 Pro Max 256` and Arabic
   equivalents. A 100% gate that never tests a model query is not measuring the promise.

## Capacity rule

One full harness run per session; a second only if announced and deliberate. Probes:
`--query x`, direct SQL, `scratchpad/pick.js`.

---

# ═══ SUPERSEDED — CHECKPOINT #4 ═══

**Working state. Read this, not the whole directive.**

## Gate

**Comparison 54/58 = 93.1% · Overall 74/80 = 92.5%** — `docs/ui-journey-after-adr139.log`,
one full run, homepage leg included for the first time.

Comparison journeys grew **16 → 48 → 58** across two unlocks. The rate is flat; the
denominator is the story.

## Current item

**Acquisition is now genuinely blocked on DISCOVERY** — see the ledger. Both cheap
unlocks are spent (ADR-138 released 323 hidden by a category gate; ADR-139 admitted 3
already-ingested stores for +137). There is no third. New targets need StoreLeads, a
paid dataset outside standing authority.

## Next, in order

1. **Homepage restructure.** The harness now measures it and it fails 0/2: two search
   fields, two وفّر entries. Savings claims are clean (gated 2026-07-29). The IA proposal
   is in the directive §3.5.
2. **The homepage leg is UNDER-WEIGHTED** — 2 rows of 80, though a shopper hits it 100%
   of the time. Consider weighting it, or gating every journey behind it.
3. **`store_visible` instrument fix is committed but unmeasured** — the FULL_STORE regex
   did not know the newly admitted retailers, so 4 correct `ثلاجة` cards read as broken.
   Fixed; the corrected figure lands on the next run.

## Capacity rule (enforced from this session)

**One full harness run per session.** Root cause of three sessions of "NOT REACHED" was
seven full runs in one session ≈ 2.5 hours. Probes for iteration: `--query x`, direct
SQL, `scratchpad/pick.js`. This session used exactly one, at the end.

---

# ═══ SUPERSEDED — CHECKPOINT #3 ═══

**Read order:** `CLAUDE.md` → `STANDING_DIRECTIVE.md` → `EXECUTIVE_DIRECTIVE.md` →
`MASTER_DIRECTIVE.md` → this block.

## The gate

**Comparison journey 16/16 = 100%. Overall 76/76 = 100%.** Production, after ADR-137.
Logs: `docs/ui-journey-final2-2026-07-29.log` (+ `-run2`).

**Read the limits before quoting it.** 20 queries × 2 locales × 2 surfaces is a *curated*
set, not all queries. Only **16 of 76** journeys are comparison journeys at all — the
other 60 are single-store, which is the acquisition constraint (§3.6), untouched by any
of this. 100% means *the journeys we test all work end to end*; it does not mean the
catalogue is broad. Breadth is still the weak number.

## Four defects, one symptom — all deployed (ADR-137)

Done in the founder's order: instrument first, then the fix, then the honest delta.

| # | Defect | Root cause |
|---|---|---|
| 3.2 | `subject_result_card = 0` | the pick was the sole subject; result cards never price-checked |
| 3.1 | "intermittent search" | **our own rate limiter** — `/api/events` shared search's 30/min bucket |
| 3.3 | accessory / wrong Smart Pick | `buildDecisionLayer` never got `relevanceGroups` → relevance term was **zero** |
| — | "compare page says none" | the page **fetched itself over HTTP** and got 429'd |
| 3.4 | outbound 404 | Almanea URL **shape**, not link rot — 280 of 1,298 offers |

**Search never failed.** `POST /api/search` returned 25 products in under 2s on 100% of
four passes. The page was blank because our own limiter 429'd it, and a 429 rendered as
"no results" — indistinguishable from an empty catalogue. In Saudi Arabia carriers NAT
many subscribers behind few IPs, so strangers consumed each other's search budget.

## Delta, decomposed (rule 2 — do not blend these)

| after | overall | gate | note |
|---|---|---|---|
| 3.2 instrument (baseline) | 65/78 = 83.3% | 15/16 = 93.8% | denominator ~doubles: two surfaces per page |
| 3.1 rate limit | 69/80 = 86.3% | 15/16 | 78→80: two pages that produced no card now do |
| 3.3 relevance | 70/76 = 92.1% | 14/16 = 87.5% | 80→76: a **withheld** pick correctly emits no row |
| compare self-fetch | 72/76 = 94.7% | 16/16 = 100% | |
| 3.4 URL shape | **76/76 = 100%** | **16/16 = 100%** | |

The row count moves for reasons that are **not quality**. Never quote the endpoints
without the middle.

## Two near-misses worth keeping

1. **I nearly fixed the wrong URLs.** The first measurement said 22,004 Almanea rows were
   in the "legacy shape". Sampling them showed the dev host returns **200** — the real
   class was 280 storefront rows, and the `/go` path had **zero**. Sample before repairing.
2. **The accessory fix moved the symptom rather than removing it.** `laptop` stopped
   returning a bag and `لابتوب اتش بي` started returning a JBL speaker. That second
   symptom is what exposed the actual root cause (relevance never reaching the pick).

## What "اختيار توفيري" optimises for (§3.3 asked; answered from the code)

Relevance dominates (+300 all word-groups matched / −400 each missing), then in-stock +25,
**corroboration +14/store capped 56**, deal +8, rating ×3, verified comparison +15, minus a
price penalty up to 22 and an accessory penalty of 1000 on main-product queries. It is
**not** lowest-price. Corroboration was capped at 18 against a 22-point price term — the
cheapest single-store listing could outrank a product three retailers agree on, inverting
CLAUDE.md's non-negotiable rule. Fixed. Consequence: `iphone` and `ايفون` returned
different winners and now **agree**.

## Open, in leverage order

1. **§3.6 acquisition — now the binding constraint.** The gate is healthy; 60 of 76
   journeys are single-store. No amount of journey work makes the catalogue bigger.
   `ACQUISITION_TARGETS.md` + `feed-overlap-probe.ts`; predicted overlap is the criterion.
2. **§3.5 IA / homepage harness** — not started. The harness still starts at `/search?q=`.
3. **§3.7 Noon, §3.8 evidence line, §3.9 positioning copy, §3.10 moat, §4 strategy** — not
   started (capacity).
4. **§1 figures in `STANDING_DIRECTIVE.md` conflict with their own ADRs** — `342` vs
   ADR-134's **340**; `72%` vs ADR-134's **87.7%** (or 74.3% widest); `166 comparable` was
   retracted by ADR-132 as an Amazon double-count. §3.9 puts 72% and 166 in *public copy* —
   restate before any external or Misk use.
5. **`شاشة` returns a Samsung Galaxy phone** (a phone has a screen, so it matches). Not a
   failure by the harness's intent list, but not a good answer either.

---

# ═══ SUPERSEDED — 2026-07-29 CHECKPOINT #2 ═══

**Read order:** `CLAUDE.md` → `EXECUTIVE_DIRECTIVE.md` → `MASTER_DIRECTIVE.md` → this block.

## The gate, and why its old value must be discarded

Two production runs after `af3aca8` (ADR-136), reported with their spread:

| run | comparison gate | overall | unhonoured claims | read from card attrs |
|---|---|---|---|---|
| 1 (`docs/ui-journey-after-adr136.log`) | **6/7 = 85.7%** | 30/40 = 75% | 0 | 37/37 |
| 2 (`docs/ui-journey-after-adr136-run2.log`) | **7/7 = 100%** | 31/40 = 77.5% | 0 | 37/37 |

The single flip is `ar شاشة` in run 1 (`compare page says none`); it did not reproduce
— the API returns 2 offers and the page renders them — and it coincided with the deploy
rollover. Named, not smoothed.

**The previous `6/34 = 17.6%` is not a lower baseline — it is a different, invalid
measurement.** Do not quote the two as a before/after improvement. The denominator fell
from 34 to 7 because 27 of those "comparison journeys" were single-store cards whose
PRICE had been read as a store count.

## The instrument was measuring the page, not a card (third instrument error, 2026-07-29)

`readSearchPage` walked up from every `img[alt]` to the first ancestor containing a
marker phrase. **The first image on any page is the header logo**, whose nearest
marker-bearing ancestor is the whole page. So the journey's subject was a
4,484-character box holding 33 images. Proof, from the baseline JSON: `pickName` is
**`"Tawveeri"` on all 40 rows**.

With the page as the box, the store-count regex matched the Smart Pick's own price
label: **`cardStores === cardPrice` on every mis-parsed row** — ثلاجة "900 stores"
= 900 SAR, washing machine "219 stores" = 219 SAR. So the "27 cards claiming a store
count the compare page cannot honour" were **single-store cards whose PRICE was read
as a store count**, and the gate denominator (34, then 32 on re-run) was mostly not
comparison journeys at all. `relevant` / `sensiblePick` / `storeVisible` were equally
page-level: the query string appears in the page text, so they scored `Y` for free.

**A result card could not have violated the rule anyway:** all **5,844** active
storefront products have offers from exactly **one** distinct `store_id`, so a
storefront card cannot claim ≥2 stores; multi-store cards come only from
`searchTPSCanonical`, which sets `tps_compare_url` on the same `>= 2` condition that
sets the count.

**Checked at population scale, not only on the 40 sampled journeys.** The one way the
card could still out-claim the compare page is that `searchTPSCanonical` counts distinct
`price_history.store_name` while `/api/compare` dedups by resolved retailer slug — the
ADR-132 double-count, which was fixed on the Algolia path but never on the TPS path. Over
every canonical with offers: **457 where card and compare agree, `0` where the card would
claim more.** The class is empty in current data; it is now a *monitored* invariant
(`unhonoured_store_claims`) rather than an assumption, so if a second name spelling for
one retailer ever lands, the next run fails instead of shipping a false comparison.

## The real defect, found and fixed (ADR-136)

**The Smart Pick card.** It rendered `مقارنة موثقة · متوفر في 3 متاجر` and its only
link was `/go/<id>` — one store's exit. Told the customer a 3-store comparison
existed; gave no way to see it. Now it leads with `قارن الأسعار في N متاجر` → the
compare page, and makes **no** multi-store claim when no comparison surface exists.

**Cards now publish their claim** (`data-store-count` / `data-best-price` /
`data-compare-url`), so the harness reads what the card says instead of inferring it.
The standing rule is checked across **every** card on the page, not just the subject:
**`cards_violating = 0` across all 40 journeys.**

**Instrument discipline additions:** every run prints `read_from_card_attributes`
(37/37 — anything lower means a wider error bar) and `unhonoured_store_claims`.
Outbound links are matched by **host**: `!href.includes('tawveeri')` had been
discarding every Amazon exit, because the affiliate tag *is* `tag=tawveeri-21`.

## What the honest gate now shows as open

- **`سماعات` AR / `ايفون` EN / `ps5` EN return no product card** — the intermittent
  search, different queries each run. Unchanged and still the top open item.
- **`laptop` / `لابتوب اتش بي`: the top pick is an accessory** — the relevance item.
  Previously scored `rel=Y` by page-level measurement; now visible.
- **`شاحن`: outbound 404** (one dead Amazon link).
- One `ar شاشة` failure in run 1 (`compare page says none`) did **not** reproduce —
  the API returns 2 offers and the page renders them; it coincided with the deploy
  rollover. Named, not smoothed.

## Known limit of the new instrument (fix before quoting a higher gate)

`subject_result_card = 0` in both runs: whenever a Smart Pick exists it is the journey's
subject, so the **result cards' own** compare consistency is never price-checked — only
the page-wide rule check covers them. Next instrument step is to run each journey twice
(pick and first card) before reading anything into a gate above ~90%.

---

# ═══ SUPERSEDED — 2026-07-29 CHECKPOINT #1 (kept for history) ═══

**Read order:** `CLAUDE.md` → `EXECUTIVE_DIRECTIVE.md` → `MASTER_DIRECTIVE.md` → this block.

## The one number that matters

> **⚠ SUPERSEDED 2026-07-29 by ADR-136.** The `17.6%` below, the `27 cards`, and
> resume item 1 are all **invalid** — the harness was measuring the whole page and
> reading the Smart Pick's PRICE as a store count (`pickName == "Tawveeri"` on all 40
> rows; `cardStores == cardPrice` on every mis-parsed row). Read checkpoint #2 above.
> The rest of this block (deployed changes, measured facts, standing authority) stands.

**The launch gate is the COMPARISON-JOURNEY pass rate: `6/34 = 17.6%`.**
Overall pass rate is 25%, and it is the *lesser* number — it is carried by
single-store journeys that need no comparison at all. Always report BOTH, and
lead with the gate.

**Do not trust any earlier figure.** During 2026-07-29 this gate was reported as
0/8, then 8/9, then 87.9%. **All were wrong.** Current truth:
`docs/ui-journey-honest-2026-07-29.log`. Command: `npm run tps:ui-journey`
(prints both numbers each run, gate labelled `<-- LAUNCH GATE`).

## The 70-point instrument error — read this before quoting any pass rate

The harness reported **87.5%** when the honest figure was **17.6%**. Cause: a
journey where the card claims ≥2 stores but renders **no compare link at all**
was scored as a *pass*, because the "vacuous price check" branch fired whenever
no compare page existed. **27 of 34 journeys are exactly that case** — so the
harness was scoring a violation of the standing rule (*never show a store count
the compare page can honour*) as success. Fixed in `ed270ad`: that case is now
an explicit FAILURE.

Second error, same day: the pre-fix gate was reported as "0/8" when the corrected
baseline log actually reads **1/10** — a number carried forward from a superseded
run that still counted false 403s as failures.

**Decomposition (same data, both definitions):** under the OLD definition
(journeys that reached a compare page) ADR-135 moved the gate **10% → ~65%** —
that +55 is real. The further jump to 87.9% was **denominator, not progress**.

**Gate definition, current and honest:** a journey is a *comparison journey* iff
the CARD claimed ≥2 stores. It PASSES only if a compare page rendered and its
price agreed with the card. A card claiming N stores with no compare link FAILS.

**Instrument discipline (keep it):** BLOCKED outbound links (bot walls) are
EXCLUDED from the rate, never failed. Every pass rate carries its error bar. Any
run-to-run flip is named, not smoothed.

## Resume order — highest leverage first

1. **The 27 cards claiming a store count the compare page cannot honour.**
   This IS the gate. `searchTPSCanonical` sets `tps_compare_url` only when it
   sees ≥2 stores in `price_history`, but the card's visible store count comes
   from storefront grouping — **two sources for one claim**, the same disease as
   the 840/1,099 split that ADR-135 fixed on the compare side.
2. **Intermittent search.** 2–4 journeys per run return "no product card found",
   **different queries each run** (run A lost `ايفون` EN / `ps5` EN / `سماعات` AR;
   run B lost `macbook` AR / `lg tv` EN / `laptop` EN / `مكيف 18000` AR — no
   overlap). This is the founder's original C1, now reproducible via the harness.
   It is NOT harness timing — that race was fixed in `0ce9054`.
3. **Homepage-start harness BEFORE any IA restructure.** The current harness
   starts at `/search?q=` and never touches the homepage, so every IA change
   would ship unmeasured. Build landing → primary action → results → correct
   product at correct store, then restructure, then re-measure.

## Deployed 2026-07-29 (all live on Railway, verified)

| Change | Commit | Rollback |
|---|---|---|
| ADR-134 — superseded duplicate listing may not publish a saving (979→340 verified drops) | `8f99f25` + `8666825` | `git revert 8666825 8f99f25` |
| `/categories/<slug>` resolves instead of 404 (+ fix for the 500 the first cut shipped) | `26e7211` + `fb9f6f4` | `git revert fb9f6f4 26e7211` |
| UI-journey harness + 403→three-bucket link classification | `4a42620`, `3568783`, `a11ba55` | `git revert a11ba55` |
| **ADR-135 — one store identity, compare derived from the same source as the card** | `91e3f1a` | `git revert 91e3f1a` |
| Dead-link census tool (`npm run tps:dead-links`) | `456e127` | `git revert 456e127` |
| Harness render-race fix + **beta banner removed** | `0ce9054` | `git revert 0ce9054` |
| Harness vacuous-pass fix (the 70-point correction) | `ed270ad` | `git revert ed270ad` |

## Measured facts established today (do not re-derive)

- **Dead outbound links are NOT a blocker.** 400 sampled: OK 386 · DEAD 1 ·
  BLOCKED 13 → **0.3% dead**, est. ~233 of 77,744 served. The 5 the harness found
  were 2 products counted twice across locales.
- **Verified price drops: 979 → 340** after ADR-134. `EXECUTIVE_DIRECTIVE.md`'s
  "925" and "65% inflated" are **superseded** and must be restated before any
  external or Misk use (inflated share now measures 72% of checkable listings).
  **Not yet edited — positioning is the founder's call.**
- `normalized_product_observations.store_id` is numeric-as-text in **96.3%** of
  rows; `price_history.store_name` is a display name. `resolveApprovedSlug()` now
  resolves both namespaces — use it, never raw string equality.

## Standing authority (granted 2026-07-29)

Full authority to research, decide, implement, deploy and verify **without
returning to the founder**, except: a paid commitment or legal signature;
credentials, banking, or company identity; a production risk that cannot be
safely reversed; or publishing a claim we have not measured. Deploy everything —
commit, push, verify live on Railway, report the URL. Never report "not started
because I was waiting"; report DONE or NOT POSSIBLE with a reason.

## Not started, and why

**Item 5 — acquisition targets (`ACQUISITION_TARGETS.md`).** Not started: the
session reached its context limit after the instrument correction. The founder's
standing instruction is that once the harness is green, onboarding a store whose
own overlap probe predicts comparisons needs **no further approval** — predicted
overlap is the criterion (alnakheelk 68 · najm 48 · multi-brand overlaps;
sonyworld 0 is the counter-example: brand specialists produce nothing).
Also not started: intermittent search, homepage harness + IA restructure, item
3(a) card store-stubs (`اك أم جر` two-letter avatars, no full store name on
ordinary result cards), and item 2 relevance (`iphone` surfaces a 2020 phone; the
pick changes between AR and EN — first task there is to state what
"اختيار توفيري" optimises for; if it is lowest price, that is the bug).

---

# ═══ 2026-07-29 — TWO DEAD THESES, RECORDED ═══

Both of these were stated confidently and both were wrong. They are recorded because
every dead thesis in this project is recorded, and because each one was disproved by a
specific, reproducible query that anyone can re-run.

## Dead thesis 1 — founder's: "the compare page reads System B"

**What was claimed** (`LAUNCH_BLOCKERS.md` §0): search and وفّر read System A via
`searchTPSCanonical` and know about multi-store; the compare page reads the storefront
(System B) and does not — so the user is told a comparison exists, clicks, and is told
it does not. The proposed fix was a connection project extending System A to compare.

**What the actual cause is:** the compare page is **already on System A**.
`compare/[key]/page.tsx:49` calls `/api/compare`, which reads `canonical_products` +
`product_matches` + `normalized_product_observations` + `price_history` — all System A.
There is no A/B split in this journey. The defect is a **broken join key inside one
System A endpoint**: `/api/compare/route.ts:83` builds its price map keyed by
`price_history.store_name` (a display name — "اكسترا", "المنيع", "jarir") and then looks
it up at line 98 with `normalized_product_observations.store_id` (a **numeric id as
text** — "4", "1", "5"). Different namespaces, so the lookup misses, the price falls
back to `raw_payload.current_price`, and where that is absent the offer is dropped at
line 120 → `offers: []` → *"لا تتوفر مقارنة"*.

**The evidence that disproved it:**
- `store_id` is numeric in **76,141 / 79,091** observations (**96.3%**); only 8,649
  (10.9%) could ever match a `store_name`.
- Of **431** canonicals where search claims ≥2 stores, **394 (91%)** render zero offers
  on compare, 22 render one, and only **15 (3.5%)** honour the badge.

**Why it matters:** the fix is one file, not a connection project. Same outcome, far
cheaper — and it also explains D1 (compare renders the string `"4"` as a store name),
D4 and D5 (`product_url` null → dead "في المتاجر" text).

## Dead thesis 2 — mine: "66% of verified drops have no backing evidence"

**What I claimed:** 649 of 979 `verified_drop` verdicts sat on a decommissioned dev host
with zero backing raw observations, so we were publishing savings we could not
substantiate — including the 4,109 → 2,799 AC claim.

**What the actual cause is:** the claims **are** backed. I had queried
`raw_observations.raw_url` and `raw_observations.price`, but the facts builder reads the
listing URL and the price from the **payload** (`build-listing-facts.ts:59-60`). Against
the correct fields: **216,711** observations carry a `dev-almanea` URL and the
4,108.996 price **was** genuinely observed (2 rows). Zero verified drops are unbacked.
The real defect is **duplicate listing identity** — see ADR-134.

**The evidence that disproved it:** the evidence-backing test I wrote to justify the
gate returned `killed_by_item1 = 0` against my own hypothesis. The correct query is in
ADR-134; the number 649 survives, but as *superseded duplicates*, not *unbacked rows*.

**Why it matters:** the fix I was about to ship would have gated nothing. And the
founder's §2 suspicion — that we were echoing Extra's "was" — is **not** what happened:
Extra's row correctly says `inflated_reference` 0%. The two "identical" numbers were
two different retailers.

---

# ═══ END-OF-DAY CHECKPOINT — 2026-07-28 ═══ (resume here; zero-memory safe)

**Read order for a fresh session:** `CLAUDE.md` → `EXECUTIVE_DIRECTIVE.md` (authority 1) → `MASTER_DIRECTIVE.md` (authority 2) → this checkpoint. `docs/archive/` is reference only, never execute.

## a) Deployed today & live status (+ rollback)
| Change | Commit | Live? | Rollback |
|---|---|---|---|
| **Amazon store-identity dedup in search** (a retailer under two name spellings = one store; kills the false "2-store" Amazon cards) — ADR-132 | `a4d5162` | ✅ live | `git revert a4d5162` |
| **Evidence line on `/price-truth`** (basic: `تتبّعنا … {distinct_days} يومًا · أعلى سعر رصدناه {observed_max}`) — Task 3 | `a4d5162` | ✅ live | revert a4d5162; **refined copy (+`ريال`, correct plural) is PROPOSED, awaiting founder approval** |
| **Registry integrity**: alsfeerzone disabled (dead DNS/410), pcpalace label→Zid — ADR-130 | `34daa08` | ✅ live | `git revert 34daa08` |
| SAVINGS_GATE (suppress merchant-`was` savings) — prior session | `caba8de` | ✅ live, default on | `NEXT_PUBLIC_SAVINGS_GATE=off` in Railway + redeploy |
| /price-truth ranking (non-accessory→SAR saving) + float fix — prior session | `caba8de` | ✅ live | `git revert caba8de` |

## b) Findings, each with its measurement
- **GTIN = 0** — 0 non-null GTIN values across 522,853 raw_observations (304,496 have an empty `gtin` key); 0 of 5,543 offers, 0 of 428 families, 0 of 9 UCP profiles. Icecat configured but unusable (nothing to resolve).
- **Icecat MPN bootstrap = 12% hit / 8% GTIN** (6/50; brand-restricted — Samsung/Apple/HP/Lenovo/Asus all 0; only TV/monitor brands LG/Hisense/TCL/Acer resolve). Credential confirmed working (first real Icecat success).
- **UCP = 9 of 22 stores publish `/.well-known/ucp`**, all mid-market Salla/Shopify/Zid; **0 of the majors** (Amazon/Noon/Jarir/Extra/Almanea/Samsung). 127 UCP×major shared families, **88 new**; concentration alnakheelk 68 / najm 48 / sonyworld 0.
- **North Star reconciled: "166" retracted** (Amazon double-count, ADR-132). Genuine cross-retailer comparable in System A = **~564** canonicals (≥2 retailer-normalized stores; projection `has_comparison`=598). SQL def: `count(canonical_product_id) HAVING count(distinct retailer_normalized(store_id)) >= 2` over `normalized_product_observations`. **⚠ CORRECTION (later 2026-07-28): the earlier "~0 consumer-visible" was WRONG.** The storefront SEARCH already serves **genuine live cross-retailer comparisons** via runtime fingerprint grouping (groupSearchProducts) — measured **52/52 accurate (0 false, post-ADR-132)** across 45 queries, e.g. iPhone 16 128GB across Jarir 1899 / Extra 2249 / Amazon 2899 / Almanea 3239. So comparison IS live where retailers overlap. The ~564 is a **separate, richer System-A layer** (verified price history + corroboration); connecting it **upgrades and extends** the already-live comparisons, it does not create them from zero.
- **Trigram blocker: 836 candidate pairs the key never proposed** (50 at sim>0.75, 32 distinct products); ~half of high-sim are legit variants; **~10–50 genuinely recoverable** (ADR-133). → matching is marginal.
- **Recall/precision (v1, agent-adjudicated):** key **recall ≈ 92–98%** (catches ~564 of the ~574–614 genuine matches; misses ~10–50). **Precision ≈ 94–99%** on the model-verifiable subset (7 detectable false-merges / 122 clean-model canonicals — e.g. an LG-dishwasher canonical mixing DFC513FM+DFC335HD); **442/564 (78%) rest on unaudited name-based matching** — precision there is a blind spot. The "97%+" claim is not fully verified.
- **model_number pollution: 3.2% of observations / 10.8% of distinct values** malformed (floor) — full titles in the model field (Amazon path: `IPHONE 17 PRO MAX 256 GB: 6.9-INCH…`), `N…V` store-SKU leaks. **~0% of the 564 corroborations rest on a polluted model** (pollution suppresses matches, doesn't underpin them).
- **`store_id` pollution in System A**: same retailer under numeric + Arabic-name IDs (extra `4`/`اكسترا` 1,080; almanea `5`/`المنيع` 1,681). Inflates the ≥2-store count by only 1 (565→564) but **fragments canonicals**.
- **Hisense 85" U7Q proof — re-verified live, HOLDS:** Extra live 5,599 / was 14,999 / claims **9,400**; ours **8,800** (observed_max 14,399 over 14 days, verdict verified_drop); model `85U7Q`. Ours is lower and evidence-based. Only Hisense 85" with a verified_drop (others are inflated_reference).
- **Verified-drop economics:** 926 verified_drop of 10,303 examinable (65% = 6,747 inflated_reference — **corrects the stale "4,531"**).

## c) Theses that died today (measurement killed each)
1. **GTIN is our identity authority** → killed by GTIN=0 measurement.
2. **Icecat MPN bootstrap rescues GTIN** → killed by the 12%/8% brand-restricted probe.
3. **Matching is the bottleneck (PHASE2_REVISED)** → killed by the trigram measurement (~10–50 recoverable); acquisition/connection are the levers (ADR-133).
4. **The over-broad launch freeze** → corrected; measurement/recall/research/read-side rendering unfrozen.
5. **My own "~109 comparable"** → corrected to ~564 before it reached the investor doc.

## d) Open items (owner · next action)
- **Evidence-line refined copy** (me · execute once founder approves the `ريال`+plural wording; read-side, `/price-truth`).
- **19-section vision doc supersession banner** (founder · not a repo file — add banner wherever it lives).
- **StoreLeads Salla/Zid check** (founder · one action, unblocks acquisition — see `ACQUISITION_TARGETS.md §5`).
- **Recall gold standard v2** (me · ~300 stratified pairs, human spot-check — matching is marginal, so this is "finish for the record then stop").
- **Post-2 Aug order:** Phase 1.3 identity-defect fixes → **Connect System A (releases ~564)** → Acquire → (matching stop).
- **Frozen until 2 Aug:** schema migrations, heavy `product_stores` writes, System A connection, Tier 2, parser rewrites. **Unfrozen:** measurement, recall/gold-standard, research, low-risk read-side rendering.

## e) Standing rules (full)
1. **"We did not observe it" is never "it is not true."** Permanent. 2. Never name a retailer negatively in public. 3. Ranking is never influenced by commission. 4. Unknown beats incorrect. 5. No automated merge without a measured precision floor (≥98% proposed). 6. No parser/classification change or deploy without an ADR + approval. 7. Label everything measured/inferred/assumption; cite ADRs + external sources. 8. Full task ledger, including omissions. 9. Checkpoint to HANDOVER before context grows large; commit + push. 10. A store is onboarded only when predicted to create comparisons (sonyworld's zero is the reference). 11. Search the Decision Register before analysing; state which ADRs you checked.

## f) Phase order (revised 2026-07-28, ADR-133)
**Phase 1** (trust layer + identity-defect fixes, gates connection) → **Phase 2.5 CONNECT System A** (releases ~564, highest-value action) → **Phase 3 ACQUIRE** (`ACQUISITION_TARGETS.md`, raises overlap ceiling) → **Matching** (marginal — finish recall, then stop; do NOT build LLM matcher / image embeddings).

---

## ★★★★ POSITIONING (2026-07-28, founder-set — EXECUTIVE_DIRECTIVE §2). Read first.

**Tawveeri is the PRICE-TRUTH LAYER for Saudi retail, not a price-comparison platform.** As comparison we are weak on BREADTH (most products are single-store), but comparison IS genuinely LIVE where retailers overlap — the storefront search shows real cross-retailer cards (52/52 accurate in sample, post-ADR-132; e.g. iPhone 16 across 4 Saudi retailers). The "166" was an Amazon-double-count artifact; the System-A knowledge layer additionally holds ~564 richer verified comparisons (locked, connection upgrades/extends the live ones). As price truth we are unique and provable: **925 verified drops**; **65% of advertised discounts reference a price we never observed** (6,747 of 10,303 examinable — corrects the stale "4,531"); and the flagship proof — Hisense 85" **U7Q**: Extra's live page claims a **9,400** SAR saving (was 14,999 → 5,599); **we publish 8,800** (from our observed_max 14,399 over 14 tracked days) — a *smaller, evidence-based* number. **Verified live 2026-07-28.** All public copy, the Misk submission, and investor material follow from this frame: lead with verified price truth, never with comparison breadth.

---

## ★★★★ MATCHING FINDING (2026-07-28, ADR-133) — matching is marginal; connect + acquire.

Independent trigram blocker (retailer-normalized): **836** cross-retailer candidate pairs the identity key never proposed (50 at sim>0.75, 32 distinct products); **~half of high-sim are legitimate variants** (capacity/gen/cooling_mode); genuinely recoverable ≈ **10–50** (floor for text-similarity). Corrected baseline: the catalog already holds **~564** genuine cross-retailer comparable families (canonicals with ≥2 retailer-normalized stores; projection `has_comparison`=598), **locked in the disconnected System A**. Per PHASE2_REVISED §2.3.3's own rule (~250 → acquisition is the bottleneck), **matching is NOT the bottleneck.** Lever order: **Connect System A (releases ~564) → Acquire overlapping stores → Matching (marginal — finish for record, then stop)**. Do not build the LLM matcher / image embeddings on a 10–50 upside. Caveat: trigram misses semantically-different Arabic phrasings (بيسوس/باسوس), so 10–50 is a floor for this method — but the ~564 overlap ceiling is an acquisition constraint, not a matching one.

---

## ★★★ CHECKPOINT — 2026-07-28 (UCP measurement → phase-order correction). Read first.

Two findings from the UCP/mid-market measurement (ADR-130, and the canonical-layer
new-vs-recount split) that **change the plan of record** — recorded here per founder:

**Finding 1 — the mid-market growth is real but currently INVISIBLE.**
Of the 127 UCP-store × major shared canonical families, **88 (69%) are NEW** comparisons
that exist only because of the mid-market store (measured on `normalized_product_observations`;
39 are re-count of an existing major↔major comparison). **But all of these live in System A
(the TPS knowledge layer), which is ISOLATED from customer search (ADR-125):** `/api/search`
reads the storefront Algolia `products` index; System A's `tawveeri_tps_products` is never read.
So the customer cannot see the 88 new families **today, and cannot see them no matter how many
more stores we onboard.** *Onboarding into an isolated layer is filling a locked warehouse.*
(Honesty caveat still standing: the 88/39 split is canonical-layer; it was NOT equated to the
"166 served comparisons", which is a storefront-layer figure with no stored comparison set to
intersect — ADR-125. §3.2 of MASTER_DIRECTIVE remains to resolve that overlap exactly.)

**Finding 2 — phase order changes.** Connecting System A to the search surface — frozen as
**ADR-126** (connect-plan draft, held BECAUSE of the identity-quality defects) — is now the
**single largest North Star mover available, larger than Tier 2 and larger than further
acquisition.** Reason: it is the only lever that converts already-held comparable families into
customer-visible ones at zero acquisition cost. Phases 1.2 (Arabic transliteration normalisation)
and 1.3 (model-vs-colour + cooling_mode merge defects) exist precisely to clear the ADR-126 freeze.
**Revised order of record:** Phase 1 (fix identity) → **un-freeze ADR-126 & connect System A
(new Phase 2.5)** → Phase 3 (acquire more stores). Phase 3 must NOT begin before System A is
connected. Codified in `MASTER_DIRECTIVE.md` (Phase 2.5 added; Phase 3 gated).

**Tier 2 (Phase 1.1) status:** HIGHEST-priority item, but it is a `product_stores` schema
migration + heavy write (ADR-099 risk) → **gets its own ADR + explicit founder approval before
any execution** (founder-confirmed). Measured yield if built: **926 verified-drop facts → 225
matched `product_stores` offers across 161 products** would render a verified saving on the
served surfaces. RESEARCH PLAN produced 2026-07-28; NO schema change made.

---

## ★ تحديث 2026-07-28 (بعد مسبار الطبقة + TARGET_LIST) — يُبطل غموض §6/§7 أدناه

**غموض الطبقة (كان أكبر مخاطرة) → محسوم بـ[ADR-125] بمسبار قراءة-فقط واحد:**
- الكود: `src/lib/algolia/search.ts` يثبّت الفهرس `products`، و`/api/search` يقرؤه فقط → **System B يخدم العميل**.
- **System A (كل عمل TPS) حيّ ومأهول لكنه معزول عن واجهة البحث** (المجدول بنى الإسقاط 2026-07-28 01:38 UTC؛ فهرس `tawveeri_tps_products`=4,143). تصحيح لمعطى المؤسس "3 سجلات": القياس الحي 4,143 (أُعيدت مزامنة Layer 5).

**أرقام مقيسة اليوم (تنتقل إلى §4 فئة أ — مؤكدة):**
- Algolia: `products`=5,027 (المخدوم) · `tawveeri_tps_products`=4,143.
- System B: منتجات نشطة 5,814 · بعرض متجر معتمد 5,543 · بصورة 4,510 · **مقارنة دائمة (≥2 متجر) = 0**.
- System A: canonical نشط 6,212 · projection 4,143 (**596 قابل للمقارنة**) · بين الخمسة الأساسية **428 قابلة للمقارنة** (74 بثلاثة+).
- صمّام السحب (روابط متمايزة في raw_observations): المنيع 8,104 · أمازون 5,698 · إكسترا 5,298 · جرير 3,191 · **نون 809 (ضعيف)**.

**الاكتشاف الجوهري:** B لا يُنتج مقارنة دائمة (0/5,543)؛ المقارنة التي يراها العميل تأتي فقط من تجميع Algolia اللحظي في البحث. **428 مقارنة جاهزة محبوسة في A، محجوبة عن العميل.** → الرافعة #1 = **وصل A بالبحث** (صفر اقتناء، يُظهر 428 فورًا)، ثم اقتناء موجّه (تعميق نون). التفصيل الكامل في **`TARGET_LIST.md`** (مُنجز هذه الجلسة).

**الخطوة التالية المحدّثة (تحلّ محل §7 أدناه):** بعد موافقة المؤسس على TARGET_LIST — **وصل System A بواجهة البحث** (تبديل الفهرس المخدوم إلى `tawveeri_tps_products` بعد التأكد من اكتماله، أو دمج canonical في B). يتطلب ADR وموافقة قبل أي نشر.

---

## ★★ CHECKPOINT — 2026-07-28 (evening). Read this first; below is older.

**DEPLOYED TODAY & LIVE (commit `caba8de`, verified on production):**
- **SAVINGS_GATE** (`NEXT_PUBLIC_SAVINGS_GATE`, default **on**) — suppresses merchant-`original_price`-derived savings on **search (`خصم%`), comparison card, product page**. Shows a saving ONLY where we observed the drop. `/price-truth` (verified observed-drop pipeline) unaffected. **Rollback:** set `NEXT_PUBLIC_SAVINGS_GATE=off` in Railway + redeploy (NEXT_PUBLIC = build-time inlined).
- **Float fix** — `69.000001 → 69` at render + discount-integrity API + stored `verified_drop` text.
- **Deals page (P0-2)** — un-gated `averagePrice` (our cross-store measurement), relabelled "أقل من متوسط السوق بـ {delta}" / "-{pct}٪ عن المتوسط" (never "بدلاً من").
- **/price-truth ranking (P0-4)** — non-accessory → absolute SAR saving → real%. **Verified live:** top deal = Hisense 85" TV, **8,800 SAR saving**, `verified_deals=20` (was accessory %-theatre).
- ADRs live: **ADR-125** (naming correction), **ADR-128** (register-first + task-ledger rules), **ADR-129** (SAVINGS_GATE + Tier-2 design). CLAUDE.md carries both new non-negotiable rules.

**EARLIER TODAY (committed/pushed):** search-relevance accessory-substitution + device-signal fixes (`ef61ae5`,`a88bd54`); TPS analysis + identity validation + connect plan (`4de625b`).

**KEY VERIFIED FINDINGS (do not re-derive — see the named files):**
- **Extra "parser fault" was NOT a parser fault** → it is **IDENTITY MERGING** (`ANSWERS.md`). PDP JSON-LD = our scraped 1290/1170 exactly (founder-confirmed live). We merged a white/out-of-stock or first-party listing vs a different black/marketplace listing.
- **Almanea is trustworthy** — 5/5 live cash prices exact (`ALMANEA_VERIFY.md`). Anchor (P0-5): 1 verified_drop / 2 inflated_reference / 2 insufficient_history = a **coverage** result (young 2–4d window), NOT fraud. «unobserved ≠ false» is a permanent rule (founder C4).
- **"توفير حقيقي" badge is correct** — uses `observed_max` from our own `price_history`, gated on `verified_drop`. 925 verified / 10,296 = precision working, our single most defensible asset.
- **AGENTIC COMMERCE (`AGENTIC_COMMERCE.md`):** UCP is live/decentralised/MCP-based. **7/22 of our stores publish `/.well-known/ucp`** (all mid-market Salla/Shopify/Zid, auto-published); **0 of the blocked majors** (Amazon/Noon/Jarir/Extra/Almanea) → UCP does NOT solve the credential deadlock. UCP is per-merchant/current-state/transactional — contains none of our moat (Saudi identity, price history, discount integrity). Strategic move = an **MCP truth-server**, but GATED on fixing identity quality + GTIN first.

**STILL OPEN (next sessions):**
- **P0-1 Tier 2** — DESIGNED in ADR-129, **NOT built**. = add `verified_saving_pct`+`observed_max` to `product_stores` via a build job → index + 4 surfaces read it (shows verified savings on the gated surfaces). Needs a migration + heavy write (ADR-099) + verification. The real prize.
- **P0-3 duplicates** — MEASURED (32 transliteration-tolerant groups, a floor; بيسوس/باسوس uncaught). Fix = normalise Arabic brand transliteration in the identity key (extend `BRAND_AR`), then `merge-canonicals.js`. Plan only — **no merges executed**.
- **P2 REVENUE_THESIS.md (11A–11I)** — **NOT started**. Decision memo: affiliate model, B2B thesis, credential deadlock vs UCP (11H), GTIN unblocked via Icecat (11I), 90-day plan. Needs its own turn(s).
- Identity fixes queued (all need ADR + approval): AC cooling-mode parser (`AC_IDENTITY_ADR_DRAFT.md` / ADR-127 draft), jarir "Renewed" separation, colour-dup merges, marketplace-seller capture.
- Standing constraints: never verify a source with itself; never use our parser to establish what a customer sees; label measured/inferred/assumption; deep Saudi discounts are frequently real.

---

## 1. خريطة المجلد `scripts/tps-analysis/` (الأحدث أولًا)

| # | الملف | آخر تعديل | الحجم | سطر واحد عن المحتوى |
|---|---|---|---|---|
| 1 | `search-success.js` | 2026-07-28 00:31 | 8.3KB | معيار الـNorth-Star: يقيس % استعلامات المستهلك السعودي المُجابة بنجاح على `/api/search` الإنتاجي (منتج صحيح + سعر حي + رابط)، ويرفض بدائل الملحقات/المستهلكات. قرأته بالكامل. |
| 2 | `search-benchmark.js` | 2026-07-27 22:34 | 4.6KB | معيار صلة أقدم (23 استعلامًا) + مقياس "البطاقة الموحّدة" (top متعدّد المتاجر مرتّب من الأرخص). قرأته بالكامل. |
| 3 | `arabic-titles.js` | 2026-07-27 22:03 | 5.8KB | يركّب عناوين عربية للمكيفات/الثلاجات/الأجهزة من حقول هوية مُهيكلة (خريطة نقحرة للعلامات + مواصفات + كود موديل لاتيني). DRY افتراضيًا؛ `--go` يطبّق. |
| 4 | `spec-backfill.js` | 2026-07-27 21:52 | 4.0KB | يستخرج مواصفات المقارنة (BTU/لتر/قدم/كجم/واط/نوع مكيف/إنفرتر…) من عنوان المنتج **الذي يكتبه التاجر نفسه**، يعلّم `_spec_source:'title'`. `--go` يطبّق. |
| 5 | `rebuild-products-index.ts` | 2026-07-27 21:40 | 5.5KB | يعيد بناء فهرس Algolia `products` من `products/product_stores` (متاجر معتمدة + منتجات ضمن النطاق فقط)، ويضبط إعدادات الصلة (اسم أولًا، لا شعبية). يكتب على Algolia. |
| 6 | `extra-enrich.js` | 2026-07-27 21:01 | 2.5KB | يعبّئ صور Extra من واجهة Unbxd (صور `media.extra.com` مطابقة بالـSKU=uniqueId). `--go` يطبّق. |
| 7 | `lulu-enrich.ts` | 2026-07-27 20:55 | 1.8KB | يعبّئ صور LuLu بإعادة استخدام `LuluScraper.discoverProducts` والمطابقة بالـSKU. `--go` يطبّق. |
| 8 | `almanea-enrich.js` | 2026-07-27 20:42 | 4.3KB | يعبّئ أسماء عربية + صور المنيع من تغذية Algolia الخاصة بالمتجر (مطابقة بالـSKU). `--go` يطبّق. |
| 9 | `baseline-metrics.js` | 2026-07-27 20:23 | 3.9KB | لقطة "قبل/بعد" لجودة المنتج لكل فئة (صور%/مواصفات%/عنوان عربي%/علامة%) + عمق المقارنة. للقراءة فقط. |
| 10 | `product-layer-audit.js` | 2026-07-27 19:45 | 3.7KB | تدقيق جودة طبقة المنتج لكل فئة (صور/علامة/رقم موديل/عنوان/مواصفات/تغطية مقارنة). للقراءة فقط. |
| 11 | `merge-canonicals.js` | 2026-07-27 19:42 | 3.7KB | يطوي الكانونيكال الفائضة التي تتشارك نفس `identity_key` صالح داخل الأساسي (يعيد توجيه `price_history` + يعطّل الفائض). DRY؛ `--go` يطبّق. |
| 12 | `identity-audit.js` | 2026-07-27 17:24 | 4.7KB | تدقيق سلامة الهوية/المقارنة: يكشف الدمج الخاطئ (مفاتيح/تخزين/BTU متعارضة) والمطابقة المفقودة (نفس المفتاح في أكثر من كانونيكال). للقراءة فقط. |
| 13 | `refresh-prices.ts` | 2026-07-27 16:12 | 1.0KB | تحديث أسعار محدود لمتجر عبر `runPriceUpdateJob` بالمنسّق. |
| 14 | `report-metrics.js` | 2026-07-27 15:45 | 3.5KB | مقاييس "تقرير جاهزية المنتج" لكل تاجر (قمع الواجهة + توزيع الفئات + مقارنات TPS + تكرارات). للقراءة فقط. |
| 15 | `leak-scan.js` | 2026-07-27 15:21 | 2.9KB | فحص تسرّب السوبرماركت/خارج-النطاق لمتاجر الهايبر/الماركت (نون/لولو/شرف). `--purge` يحذف عروض التسرّب. |
| 16 | `product-quality-audit.js` | 2026-07-27 15:19 | 4.0KB | تدقيق جودة المنتج + أدلة المجدول (`scraping_runs`) + نضارة الأسعار + كشف تسرّب LuLu/نون/شرف. للقراءة فقط. |
| 17 | `ingest-store.ts` | 2026-07-27 14:53 | 1.5KB | استيعاب عام محدود لأي متجر عبر `runDiscoveryJob` (نفس مسار المجدول). DRY؛ `--go`. |
| 18 | `ingest-lulu.ts` | 2026-07-27 14:10 | 1.2KB | استيعاب LuLu محدود (تسلسلي لأن LuLu يشارك صفحة Puppeteer واحدة). DRY؛ `--go`. |
| 19 | `ingest-noon.ts` | 2026-07-27 12:56 | 1.1KB | استيعاب نون محدود عبر المنسّق. DRY؛ `--go`. |
| 20 | `verify-search.js` | 2026-07-27 12:14 | 2.2KB | تحقق حي من بحث الإنتاج لاستعلامات محدّدة + فحص تسرّب متجر غير معتمد. للقراءة فقط. |
| 21 | `run-mig.js` | 2026-07-27 12:01 | 0.7KB | مشغّل SQL عام لملف هجرة (يقرأ ملفًا ويشغّله). **يكتب** بحسب SQL المُمرّر. |
| 22 | `url-quality.js` | 2026-07-27 11:47 | 1.5KB | يقيس نظافة روابط المنتجات لكل متجر (جرير/أمازون/إكسترا/المنيع) وتكرار الروابط. للقراءة فقط. |
| 23 | `sample-outbound.js` | 2026-07-27 11:45 | 1.4KB | يسحب عيّنة روابط منتجات لكل متجر معتمد لاختبار الخروج، ويكتبها إلى `outbound-sample.json`. |
| 24 | `retailer-audit.js` | 2026-07-27 11:42 | 3.3KB | تدقيق إنتاج للـ27 متجرًا: صفوف `stores`، عروض/نضارة لكل متجر، مساهمة الكانونيكال. للقراءة فقط. |
| 25 | `usage-report.ts` | 2026-07-26 17:15 | 20.2KB | لوحة قمع البيتا الخاصة (Search→Results→View→Comparison→Evidence→Outbound)، تفصل الحقيقي عن الاختبار + تجربة A/B، وتكتب `docs/BETA-FUNNEL.md`. |
| 26 | `launch-audit.ts` | 2026-07-26 15:32 | 13.1KB | تدقيق جاهزية الإطلاق المُقيَّم (ADR-114): ~23 بُعدًا بدرجة حالية/هدف/فجوة، يقيس زمن الاستجابة حيًّا، ويكتب `docs/LAUNCH-SCORECARD.md` + تاريخًا. |
| 27 | `security-audit.ts` | 2026-07-26 14:23 | 4.6KB | تدقيق أمني: جداول بلا RLS يصلها anon، جداول حسّاسة مكشوفة، درجة أمان. للقراءة فقط، يخرج بكود غير صفري عند ثغرة حرجة. |
| 28 | `sentinel-check.ts` | 2026-07-26 12:32 | 2.9KB | بوّابة تسرّب الحرّاس (NO_STORAGE/NO_TECH…): يفحص كل اسم كانونيكال فعّال، يخرج غير صفري عند أي تسرّب. |
| 29 | `store-impact.ts` | 2026-07-26 12:29 | 5.9KB | محلّل أثر المتجر: المقارنات الصافية الجديدة التي مكّنها متجر (لن توجد بدونه) + العمق المُضاف + تفصيل بالفئة والوفورات. للقراءة فقط. |
| 30 | `category-coverage.ts` | 2026-07-26 12:13 | 3.6KB | بوصلة الاستحواذ: يرتّب كل فئة حسب جودة المقارنة (كانونيكال/قابلة للمقارنة ≥2 متجر/المعدّل/العمق)، ويشير للفئات الضعيفة. للقراءة فقط. |
| 31 | `feed-overlap-probe.ts` | 2026-07-25 21:31 | 10.5KB | مسبار تداخل التغذية (بلا اعتماد): يفحص WooCommerce Store API عام، يعيّن عملة SAR، ويقيس تداخل العلامة/كود الموديل مع منتجاتنا أحادية-المتجر → قرار استحواذ بالأرقام. |
| 32 | `gtin-coverage.ts` | 2026-07-25 20:01 | 8.5KB | تغطية GTIN (ADR-100): وضع `--probe` يقيس أي تغذية تُصدر GTIN صالحًا، والوضع الافتراضي يقيس تجميعات ≥2-متجر من `raw_observations`. للقراءة فقط. |
| 33 | `e15-5-gate-audit.ts` | 2026-07-25 11:38 | 14.0KB | بوّابة الإنتاج E15.5: أدلة مؤرّخة برقم مرتبط بكل استعلام (خام/كانونيكال/إسقاط/عمق مقارنة/تغطية/نضارة/هوية/صلاحية عرض/سلسلة كاملة). للقراءة فقط، إنتاج فقط. |
| 34 | `comparison-value.ts` | 2026-07-24 12:46 | 7.0KB | أداة العائد على الهندسة (ADR-068): يقيس % التعرّف **حيث المقارنة ممكنة** (علامة في ≥2 تاجر) مقابل حيث تستحيل، لكل إضافة parser. للقراءة فقط. |
| 35 | `platform-health.ts` | 2026-07-24 11:22 | 15.8KB | مراقب النضارة والانتشار (ADR-062): يفحص هل كل طبقة مشتقّة محدّثة مقابل أدلّتها (استيعاب→هوية→كانونيكال→إسقاط→فهرس→حقائق→ثقة→حواف). يستخدم المضيف المباشر لا الـpooler. |
| 36 | `plugin-failures.ts` | 2026-07-23 19:23 | 5.2KB | يعيّن عناوين الإدراج الحقيقية التي يدّعيها plugin ولا يستطيع تعريفها، مجمّعة بتوقيع الفشل، لتوجيه عمل الـparser. للقراءة فقط. |
| 37 | `projection-snapshot.ts` | 2026-07-23 16:10 | 1.6KB | يفرّغ حقول الإسقاط المشتقّة إلى JSON مرتّب لإثبات تكافؤ المخرجات عند إعادة كتابة الباني (ADR-067). للقراءة فقط. |
| 38 | `plugin-yield.ts` | 2026-07-23 15:10 | 6.5KB | ناتج plugin مرشّح قبل التسجيل: كم إدراج يدّعيه/يعرّفه/يُصادَق عبر المتاجر/يصطدم بكانونيكال قائم. للقراءة فقط. |
| 39 | `catalog-funnel.ts` | 2026-07-23 15:00 | 7.2KB | قمع الكاتالوج (ADR-065): إدراجات سعودية→هوية→كانونيكال→إسقاط→قابل للمقارنة، مع فصل الملحقات وتحديد أكبر تسرّب. للقراءة فقط. |
| 40 | `search-quality.ts` | 2026-07-23 14:42 | 7.0KB | معيار جودة البحث السعودي (ADR-064) ضد فهرس Algolia `tawveeri_tps_products`: استرجاع (HIT/WEAK/MISS) + ترتيب + قابلية الفعل (صورة). |
| 41 | `normalization-gap.ts` | 2026-07-23 12:09 | 8.0KB | محلّل فجوة التطبيع (ADR-060): ينسب كل إدراج غير معرّف لسبب محدّد (تاجر/فئة/سبب رفض/حقل ناقص/لغة/منتج-مقابل-ملحق). للقراءة فقط. |
| 42 | `identity-impact.ts` | 2026-07-23 11:24 | 14.2KB | محلّل أثر تغيير الهوية (ADR-058): يعيد تشغيل مسار normalize→buildIdentityKey ويقارن دلتا المصادقة قبل/بعد أي تغيير parser + وضع محاكاة استحواذ متجر. للقراءة فقط. |
| 43 | `state-snapshot.ts` | 2026-07-23 11:02 | 8.6KB | لقطة حقيقة الإنتاج: يعيد بناء "ما هو صحيح الآن" من قاعدة الإنتاج (أحجام/استيعاب/هوية/إسقاط/حقيقة الكاتالوج بالإدراجات السعودية المتمايزة). للقراءة فقط. |
| 44 | `q.ts` | 2026-07-23 09:49 | 1.5KB | مشغّل استعلام SELECT/WITH فقط للإنتاج (يرفض أي كتابة، ويرفض غير الإنتاج). للقراءة فقط. |
| 45 | `coverage-matrix.ts` | 2026-07-22 16:35 | 5.6KB | مصفوفة تغطية متجر×فئة للرسم المعرفي (System A)، تُخرج Markdown إلى `docs/COVERAGE-MATRIX.md`. للقراءة فقط. |

**ملاحظة بنيوية مهمة:** هذه الملفات تنقسم إلى **طبقتَي بيانات مختلفتين** — وهذا جوهري لفهم أي رقم:
- **طبقة الواجهة (System B / storefront):** جداول `products` / `product_stores` / `stores`. تستهدفها ملفات جلسة 2026-07-27 (`baseline-metrics`, `product-layer-audit`, `report-metrics`, `*-enrich`, `spec-backfill`, `arabic-titles`, `leak-scan`, `merge-canonicals`, `identity-audit`, `ingest-*`, `rebuild-products-index`, و`/api/search`). هذه هي الطبقة التي يراها العميل حاليًا في البحث.
- **طبقة المعرفة (System A / TPS):** جداول `canonical_products` / `tps_product_projection` / `normalized_product_observations` / `raw_observations` / `price_history`. تستهدفها الملفات الأقدم (`launch-audit`, `platform-health`, `catalog-funnel`, `normalization-gap`, `identity-impact`, `state-snapshot`, `e15-5-gate-audit`, `category-coverage`, `store-impact`, إلخ).
- **الرابط بينهما غير مؤكد لي:** أي الطبقتين هي التي تغذّي البحث الإنتاجي فعليًا، ومدى تزامنهما — **لم أتحقق منه هذه الجلسة**. `/api/search` يستعمل Algolia فهرس `products` (طبقة B) مع رجوع إلى `products` في قاعدة البيانات. الملفات القديمة تقيس طبقة A. **هذا أكبر غموض بنيوي في هذا الجرد.**

---

## 2. ماذا أُنجز فعلًا

### أ) إصلاح صلة البحث (عمل هذه الجلسة — مؤكد بأدلة إنتاجية)
- **الملفات:** `src/app/api/search/route.ts` (لم يكن ضمن مجلد الجرد لكنه عُدِّل هذه الجلسة ونُشر)، و`scripts/tps-analysis/search-success.js` (أداة القياس).
- **ما يجيب عنه:** "كم % من استعلامات المستهلك السعودي الواقعية تُجاب بمنتج صحيح + سعر حي + رابط نشط".
- **مكتمل أم متوقف:** مكتمل ومنشور على الإنتاج ومتحقَّق منه. آخر commit: `a88bd54`.
- **على أي بيانات بُني:** قياس حي على `https://tawveeri.com/api/search` + مسابر قراءة-فقط على قاعدة الإنتاج (عبر pg pooler). لا بحث ويب، لا إدخال يدوي من المؤسس.
- **التفصيل:** أُصلحت 8 استعلامات كانت تُرجع منتجًا خاطئًا، ثم اكتُشف عبر فحص يدوي أن المعيار كان متساهلًا ويُمرّر **بدائل ملحقات** (كابل لـ"ابل واتش"، أقراص غسيل لـ"غسالة صحون"، ماوس لـ"ايباد")؛ فشُدّد كشف الملحقات وأُضيف "تجاوز إشارة الجهاز" (منتج فيه `GPS + Cellular` هو الجهاز لا ملحق). النتيجة النهائية المقيسة: **54/54 على مجموعة الـ54 استعلامًا** بمعيار صارم يرفض بدائل الملحقات.

### ب) أدوات القياس والتخصيب (جلسات سابقة — قرأتُ الكود، لم أعِد تشغيلها هذه الجلسة)
لكل أداة أعلاه غرض واضح (العمود الأخير في §1). حالتها: **الكود مكتمل وقابل للتشغيل**. هل طُبِّقت مخرجاتها فعلًا على الإنتاج (مثل `--go` لملفات التخصيب)؟ **لم أتحقق هذه الجلسة**؛ الذاكرة تدّعي أن بعضها طُبِّق (صور طُبِّقت، مواصفات طُبِّقت، عناوين عربية طُبِّقت جزئيًا) لكنني لم أعِد قياس قاعدة البيانات لتأكيدها الآن.

### ج) مخرجات Markdown مكتوبة بأدوات (خارج مجلد الجرد — لم أقرأها هذه الجلسة)
`docs/BETA-FUNNEL.md`، `docs/LAUNCH-SCORECARD.md` + `docs/launch-scorecard-history.json`، `docs/COVERAGE-MATRIX.md`، `docs/RETAILER-MATRIX.md`. هذه يكتبها الكود المذكور؛ محتواها الحالي **لم أتحقق منه**.

---

## 3. القرارات المتخذة

| القرار | مَن اتخذه | موثّق أين |
|---|---|---|
| تجميد التوسّع على 7 متاجر معتمدة (أمازون/جرير/إكسترا/المنيع/نون/لولو/شرف) والتحوّل لجودة المنتج | المؤسس | توجيه المؤسس (محادثة سابقة) + `src/lib/retailers/approved-retailers.ts` (لم أقرأه، استنتاج) |
| North-Star = "% استعلامات المستهلك السعودي المُجابة بنجاح" (الرحلة الكاملة) | المؤسس | توجيه المؤسس (رسالة رسمية) + `search-success.js` يشغّله عمليًا |
| "لا تُحسِّن لمطابقة Rakhys؛ ابنِ أفضل كاتالوج بغضّ النظر عن المنافس" | المؤسس | توجيه المؤسس |
| الترتيب: المصادقة (≥2 متجر) قبل الأرخص؛ لا مصلحة تجارية في الترتيب؛ لا اختلاق | المؤسس/الدستور | `CLAUDE.md` + `TAWVEERI_CONSTITUTION.md` (لم أقرأه، مذكور في CLAUDE.md) |
| ⚠ **تعديلات كود البحث ونشرها على الإنتاج هذه الجلسة** (خريطة توسيع الاستعلام، أنواع المنتج الرئيسية، إزالة apple/samsung من GENERIC، كشف ملحقات موسّع، تجاوز إشارة الجهاز) | **أنا، بشكل مستقل** تحت "تفويض الاستقلالية" العام من المؤسس | commits `ad0ca1d`, `ef61ae5`, `a88bd54` على `main`. لا يوجد ADR مكتوب لها. |
| ⚠ **تفسير "المجلد" في هذه المهمة على أنه `scripts/tps-analysis/`** وليس المستودع كامله | **أنا** | هذا المستند، §النطاق أعلاه |
| منهجية التحقق: قراءة-فقط، قاعدة الإنتاج هي مصدر الحقيقة الوحيد، إثبات هوية المشروع قبل أي حكم | المؤسس/الدستور | `CLAUDE.md` + الحرّاس داخل الأدوات (`q.ts`, `state-snapshot.ts` يرفضان غير الإنتاج) |

> **تنبيه أمانة:** جميع تعديلات هذه الجلسة على الكود دخلت الإنتاج مباشرةً باجتهادي تحت التفويض العام، دون موافقة صريحة على كل تغيير على حدة، ودون كتابة ADR لكل منها. هذا ضمن تفويض الاستقلالية لكنه يستحق التنبيه.

---

## 4. الأرقام والحقائق المستقرة (القسم الأهم — بلا تساهل)

**فئة أ — مؤكدة من مصدر، قِيست هذه الجلسة على قاعدة/بحث الإنتاج:**
- نجاح البحث ارتفع من **83% → 98% → 100%** على مجموعة 54 استعلامًا. *مؤكد* من مخرجات `search-success.js` الحيّة. **قيد مهم:** المجموعة **مُنتقاة (54 استعلامًا)** وليست كل الاستعلامات الممكنة؛ ومعيار "المنتج الصحيح" يعتمد على regex كشف ملحقات **كتبتُه أنا** — فرقم الـ100% دقيق ضمن هذا التعريف وهذا النطاق فقط، وليس ادّعاءً مطلقًا.
- من الـ54، **20 فقط** ينتج عنها بطاقة متعددة المتاجر (top متعدد المتاجر)، و**20/20 منها مرتّبة من الأرخص**. *مؤكد* (نفس المخرجات). أي: 34 استعلامًا يُجاب بمنتج صحيح لكن **أحادي المتجر (بلا مقارنة سعرية)**.
- وجود المنتجات في الكاتالوج (مسابر قراءة هذه الجلسة): iPad ≈92 بمتجر معتمد، Apple Watch: 117 إجمالًا لكن **3 أجسام ساعة حقيقية فقط مسعّرة** بمتجر معتمد (SE 3، Series 11 ×2، كلها أمازون) + واحدة "Ultra مجدّدة"، Galaxy S24 =13، غسالة صحون =28، صانعة قهوة =42، لابتوب قيمنق =54، Samsung Tab ≈18. *مؤكد* من مسابر SQL هذه الجلسة.

**فئة ب — مُدّعاة في الذاكرة/جلسات سابقة، لم أُعِد التحقق منها هذه الجلسة (تعامل معها كـ"غير محقّقة الآن"):**
- "الكاتالوج ≈ 11,237 إدراجًا"، "≈89% أحادي المتجر"، تفعيل المتاجر وأعدادها، تغطية الصور "50%→81%"، مواصفات "89%/95%"، عناوين عربية "61%"، دمج 224 كانونيكال مكرر. **كل هذه من ملفات الذاكرة، لا من قياس هذه الجلسة.**
- درجات `launch-audit`/`platform-health` (تغطية، نضارة، أمان 92، إلخ) الموجودة في ملفات `docs/*`: **لم تُشغَّل هذه الجلسة**؛ قيمها الحالية غير معروفة لي.

**فئة ج — افتراضات غير محقّقة (خطيرة إن اعتُمد عليها):**
- **أي طبقة بيانات تخدم البحث الإنتاجي فعلًا** (A أم B) ومدى تزامن الفهرس معها — *افتراض غير محقّق*. عملي هذه الجلسة كان على طبقة B عبر `/api/search`؛ لم أثبت علاقتها بأرقام طبقة A في الملفات القديمة.
- أن مخرجات `--go` للتخصيب/الدمج **لا تزال مطبّقة وسليمة** في الإنتاج — *افتراض غير محقّق الآن*.
- ثوابت مفاتيح الطرف الثالث المكتوبة داخل ملفات التخصيب (مفاتيح Unbxd/Algolia لإكسترا والمنيع) صالحة — *لم تُختبر هذه الجلسة*.

---

## 5. المفتوح والمعلّق

- **قيد التنفيذ عند آخر جلسة عمل (قبل مهمة الجرد):** لا شيء متوقف في المنتصف؛ إصلاح البحث اكتمل ونُشر وتُحقّق منه، والشجرة نظيفة (`git status` نظيف، آخر commit `a88bd54`).
- **مهام مفتوحة معلّقة (من قائمة المهام):**
  - #19 اتساع/عمق المنتج عبر استيعاب أعمق (متاجر معتمدة فقط) — **معلّقة، لم تبدأ**. هذه هي الرافعة الحقيقية لرفع نسبة البطاقات متعددة المتاجر (20/54).
  - #20 إعادة تشغيل/مراقبة المجدول + تعافي refresh — **معلّقة**. الذاكرة تشير لحادثة سابقة عَلِق فيها علم `refreshRunning`؛ لم أتحقق من حالته هذه الجلسة.
- **ما وعدتُ به ولم أسلّمه:** في نهاية جلسة العمل قلت "الخطوة التالية هي #19 (اتساع المقارنة)" — لم تُنفَّذ (توقّفت لمهمة الجرد هذه).
- **أسئلة طُرحت على المؤسس ولم تُجب:** لا يوجد سؤال معلّق موجّه للمؤسس في هذه السلسلة.

---

## 6. الفجوات والمخاطر

- **أكبر فجوة معرفية:** ازدواج طبقتَي البيانات (A/B) وأيّهما مصدر الحقيقة للعميل. إن كان البحث يخدم من طبقة B بينما كل تدقيقات الجاهزية/الصحة تقيس طبقة A، فقد تكون بعض "الأدلة" في `docs/` غير ممثِّلة لما يراه العميل فعلًا. **يجب حسم هذا قبل الاعتماد على أي رقم جاهزية.**
- **رقم الـ100% هش تعريفيًا:** يعتمد على مجموعة 54 استعلامًا وعلى regex ملحقات كتبته يدويًا. توسيع المجموعة أو استعلام حقيقي خارجها قد يكشف فشلًا. ليس ادعاء كمال.
- **Apple Watch = فجوة تغطية حقيقية:** 3 أجسام مسعّرة فقط بمتاجر معتمدة. لو حُذفت هذه، يعود البحث لعرض ملحق كأنه إجابة. الإصلاح الحقيقي استيعابي لا بحثي.
- **تعديلات بحث بلا ADR:** غيّرتُ منطق التصنيف (GENERIC، كشف الملحقات) على الإنتاج دون توثيق ADR؛ إعادة تدريب/تعديل مستقبلي قد يكسر افتراضًا غير موثّق (مثل "إزالة apple/samsung من GENERIC آمنة").
- **ما قد ينهار إن كان افتراض خاطئًا:** إن لم يكن `--go` للتخصيب مطبّقًا فعلًا، فأرقام الصور/المواصفات/العناوين في الذاكرة متفائلة. وإن كان المجدول (#20) عالقًا، فطبقة الأسعار/الاشتقاق قد تكون قديمة صامتًا — وهو بالضبط نمط الفشل الذي بُني `platform-health.ts` لكشفه ولم يُشغَّل هذه الجلسة.

---

## 7. الخطوة التالية بحسب فهمي الحالي (واحدة فقط)

**تشغيل `platform-health.ts` (أو `state-snapshot.ts`) قراءةً-فقط على الإنتاج لحسم أي طبقة بيانات حيّة ومدى تزامن الطبقات ونضارة المجدول** — قبل أي عمل جديد على الاتساع (#19).

**لماذا هي التالية:** كل ما يلي (اتساع المقارنة، جاهزية الإطلاق، صحة أرقام الذاكرة) مبنيّ على افتراض غير محقّق حول أي طبقة تخدم العميل وهل السلاسل المشتقّة محدّثة. حسم هذا الغموض بدليل إنتاجي **يقرأ ولا يكتب** هو الأساس الذي بدونه أي رقم لاحق قد يكون وهمًا — وهو منسجم تمامًا مع منهجية "قاعدة الإنتاج مصدر الحقيقة الوحيد".
