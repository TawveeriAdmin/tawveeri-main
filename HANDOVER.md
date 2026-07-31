# ═══ RESUME HERE — 2026-07-31 CHECKPOINT #24 · P2-7 COMPLETE AND VERIFIED IN PRODUCTION ═══

**Tree clean, all pushed, deploy landed and re-measured live. Nothing running.**
Roadmap: `docs/IMPLEMENTATION_ROADMAP.md`. Decision: **ADR-151**. UX record: `docs/UX_DECISION_RECORD.md`.

## THE ONE THING THE FOUNDER SHOULD LOOK AT

**The brand green is darker on the live site, and that was my call.** `#55B295` → `#3B816B`.

It carried white label text at **2.56:1** where AA needs 4.5, on 234 rendered nodes, on every
route. There is no arrangement in which that colour passes with a white label. I chose the
minimal darkening — same hue, same saturation, lightness lowered only until it clears — over
the alternative of fixing 14 call sites, because fixing call sites leaves the trap armed for
the fifteenth. **The logo is untouched** (it is a PNG and does not read these tokens) and the
mint survives as backgrounds and borders.

**If the brand judgement outweighs the accessibility one, this is one revert:**
`git revert 4056572`. That restores the palette exactly and returns the audit to ~800 failing
contrast nodes. The trade is stated in `docs/UX_DECISION_RECORD.md` § UXD-001.

## WHAT P2-7 ACTUALLY FOUND — three of these were invisible to every existing check

| | |
|---|---|
| **The skip link was NEVER visible.** `globals.css` hand-rolled its own `.sr-only`; Tailwind's utilities live in `@layer utilities` and **unlayered CSS outranks every layer**, so it silently beat `focus:not-sr-only` and the first tab stop on every page stayed clipped to **1×1 px while focused**. CHECKPOINT #23 recorded it as "known good, verified in served HTML" — it was present and announced, and never seen. **Do not re-add an unlayered `.sr-only`; it re-breaks this invisibly.** |
| **`/en` served `<html lang="ar">`** — English announced in an Arabic voice (3.1.1, Level A), on every page, because the root layout sits above `[locale]` and cannot read it. `<html>` also had **no `dir` at all**, which is why Radix portals (mounted on `document.body`, outside the `[locale]` wrapper) need direction set by hand. |
| **The filter sheet dropped focus to `<body>`** on close. It trapped focus correctly and released on Escape correctly — it had nowhere to give focus back to, because it is opened by state and has no `Dialog.Trigger`. A keyboard user pressing Escape was dumped to the top of a long results page. |
| **The mobile filter button had no accessible name** below 640px (its label is `hidden sm:inline`). axe CRITICAL. |
| Footer text at 2.72:1 in **both** themes · "See all" links 19px tall (2.5.8 needs 24) · 20 identically-named "Save to Wishlist" buttons per results page. |

## THE NUMBERS, AND HOW TO REPRODUCE THEM

```bash
npm run a11y          # localhost:3000 — both harnesses
npm run a11y:prod     # https://tawveeri.com — this is what verified the deploy
```

| | axe (36 renders) | keyboard |
|---|---|---|
| before | 2 rules · **769 failing nodes** | 30 checks · **12 failing** |
| after (local) | **0 · 0** | 31 checks · **0 failing** · 1 accepted |
| **after (production)** | **0 · 0** | **31 checks · 0 failing** · 1 accepted |

Logs: `docs/a11y-2026-07-31-{BEFORE,AFTER,PRODUCTION}.log`. The before/after pair was re-run
with the FINAL harness so both share a denominator.

**Read the node count with care.** It moves run to run (769–806 measured) because it depends on
the live results rendered. The **seven colour pairs** behind it do not move, and the fix was
sized from the pairs, not from the node count.

## WHAT WAS DELIBERATELY NOT DONE

- **Product-card DOM order.** Action buttons precede the card body — the documented
  click-interception guard. Each control now names its own product instead, which is what 2.4.3
  asks for (*preserves meaning and operability*). The harness reports the residual order
  deviation as an **accepted deviation carrying its reason, never as a pass**, and only for
  pairs it can prove belong to one card. A cross-component inversion still fails the gate.
- **The 44×44 house rule.** 2.5.8 AA requires **24×24** and that now passes (0 of 38 controls
  under 24px). **25 of 38 are still under 44px** — that is AAA (2.5.5) plus the mobile app's
  own constant, and closing it is a header layout change, not an accessibility fix.
- **Root layout owning the locale.** The served BYTES still say `ar` for `/en`; the correction
  happens before first paint, so assistive tech is right and a no-JS consumer is not. The
  complete fix needs the root-shell restructure — **the same prerequisite the 404-body item is
  already blocked on. One change unblocks both; do them together.**

## NEXT — P2-8, and one cheap thing first

**P2-8 · UNIFIED SEARCH migration** is the next execution unit. It is a migration of shipped
behaviour across both live entry points, and the AI disclosure must relocate with `/advisor`
and be verified in production (Constitution → UNIFIED SEARCH hard condition; F5 extended).

**Before it: wire `npm run a11y` into whatever runs on change.** Both harnesses exist and pass;
nothing runs them automatically. The `.sr-only` defect is the argument — it was invisible to
the type checker, the linter, the test suite and a served-HTML inspection, because it only
exists in the rendered artefact.

## ROLLBACK — this session, newest first

```
d68cf5d  npm run a11y scripts             git revert d68cf5d
4672ec5  keyboard/focus/lang/target fixes git revert 4672ec5
4056572  BRAND GREEN token fix            git revert 4056572   ← the one with a visible cost
2d37f8e  the two harnesses + before log   git revert 2d37f8e
```

`53e6894` is the pre-session head. **Confirm the range before any range revert** —
`git log --oneline 53e6894..HEAD` first; an inverted range silently reverts nothing.

## INSTRUMENT NOTE — five false readings caught before they became claims

A light-only baseline hid a defect only dark mode reveals. The first keyboard run produced
**four false failures**: an Arabic label that does not exist in the app («الفلاتر» vs the
shipped «المرشحات»), a focus ring drawn on the wrapper rather than the input, a trigger never
focused before being clicked so nothing could be restored to it, and an sr-only element counted
as a touch target. A fifth: the use-of-colour check counted every store logo as a colour-only
swatch because it excluded elements *containing* an image but not images themselves. Each was
corrected in the harness **before** any code changed. **Measure the rendered artefact, and
prove the instrument before believing a number that would change a priority.**

---

# ═══ SUPERSEDED — 2026-07-31 CHECKPOINT #23 · PHASE 2 · P2-7 IS NEXT, NOT STARTED ═══

**Head `d8df011`, tree clean, all pushed, nothing running.**
Roadmap and status: `docs/IMPLEMENTATION_ROADMAP.md`. Governing: `CONSUMER_EXPERIENCE_CONSTITUTION.md`.

## WHY P2-7 WAS NOT STARTED

WCAG 2.2 AA is a systematic pass over ~10 components — contrast, keyboard order, visible focus,
dialogs and sheets, focus trapping, RTL focus order, 44×44 targets, 200% zoom — needing tooling
plus manual keyboard verification. It did not fit cleanly in the remaining context, and **a
half-finished accessibility pass is worse than none**: a focus trap without an escape actively
harms the users it is meant to serve. Deliberate stop, not an interruption.

## P2-7 — EXACT ENTRY POINT

**Start by measuring, not editing.** There is no accessibility baseline; create one first.

```bash
npm run dev            # http://localhost:3000
npx @axe-core/cli http://localhost:3000/ar http://localhost:3000/ar/search?q=laptop \
                   http://localhost:3000/ar/compare http://localhost:3000/ar/advisor --exit
```

**Surfaces, in customer-impact order:** `public-page-shell.tsx` (header/nav, every page) →
`search-client.tsx` + `filter-sidebar.tsx` + `mobile-filter-sheet.tsx` (the sheet is the highest
focus-trap risk) → `product-card.tsx` → `compare/[key]/page.tsx` → `advisor-client.tsx` → `footer.tsx`.

**Known good already:** the skip link exists and renders (`تخطي إلى المحتوى الرئيسي`, verified in
served HTML); `MIN_TOUCH_TARGET = 44` is defined in the mobile theme; the new ordering-rule line
and AI disclosure are plain text, not colour-coded.

**"Done" means:** axe reports zero critical/serious violations on those five routes in **both**
locales · every interactive control reachable and operable by keyboard with a visible focus ring ·
the mobile filter sheet traps focus **and releases it on Escape and on close** · no meaning carried
by colour alone · 44×44 minimum on touch targets · RTL focus order follows visual order in Arabic ·
`prefers-reduced-motion` honoured · verified **in production**, not only locally, per Principle 5.

**Stopping condition:** the axe baseline is re-run and the delta reported. If a fix needs a
component redesign, record it and move on — do not redesign under an accessibility ticket.

## ANSWERS TO THE HANDOVER QUESTIONS

**Reachability after P2-2:** **AR 100% · EN 96.3%** (harness, evenly-spaced fetch: AR 80/80,
EN 77/80). Full-population probe: AR 468/471 = 99.4%, EN 468/480 = 97.5%. Up from AR 100% /
EN 90%. Malformed exits **0 of 1,363**. Log: `docs/journey-baseline-2026-07-31-p2-2.log`.
The residual is **12 Amazon cards** (headphones 9, monitor 2, ipad 1) — the known unroutable
population with no normalized observation, gated behind normalization.

**Cards with no destination: RENDERED NON-CLICKABLE, not omitted.** Founder decision 2026-07-31,
on measurement. Omission was approved only if the rate stayed near 1.6–4%; it does in aggregate
(AR 1.86%, EN 3.35%) **but concentrates** — English `air conditioner` was 13 unroutable of 14
cards, so omitting would have rendered **one** result where fourteen existed. The card therefore
keeps its price and retailer, loses its navigation, and states «رابط المتجر غير متاح لهذا العرض» /
"No store link available for this offer" — the same wording the compare page already ships.
**Result count still matches rendered cards by construction**, since nothing is removed. Two
supporting facts: those prices are accurate to **1.90 minutes** (discovery stamps at observation
time), and a disabled "View at store" button was removed as the pattern §7.3 rules out.

**Retailer-tier decision and reasoning:** tiers are computed, never assigned —
`production-deep = depth ≥150 · routability ≥60% · median age ≤14d`. The 150 is anchored in the
distribution's widest tail gap (**182 → 59, 3.1×**), the same method as ADR-150. **7 are
production-deep**; Almanea is *production-limited on routability* (47.0%) despite being second by
depth (2,444 offers), which is exactly the distinction the tier exists to make.
**Open founder decision:** the live claim «8 متاجر سعودية» is assembled from
`SUPPORTED_SEARCH_STORES`, which **includes two non-deep retailers** (Samsung KSA 26, SWSG 59) and
**omits two deep ones** (Najm 223, Alnakheelk 182); search actually returns **11** distinct
retailers once duplicate spellings collapse. I did **not** change the string — it is an approved
CAN SAY entry and F1 requires the vocabulary be amended first. Evidence and recommendation:
`docs/RETAILER-TIERS.md`.

## ROLLBACK — today's work, newest first

```
d8df011  roadmap status                    git revert d8df011
f0b8f64  P2-6 retailer tiers (docs)        git revert f0b8f64
5df38a1  P2-6a LuLu display gate           git revert 5df38a1
bee88b2  P2-3 ordering rule + rating sort  git revert bee88b2
0ce7ef7  P2-2 verification log             git revert 0ce7ef7
709d798  P2-2 Algolia path (the live fix)  git revert 709d798
b02858f  P2-2 Supabase fallback path       git revert b02858f
88cb215  shipping "0 SAR" claim            git revert 88cb215
78b0763  P2-1 close generative surface     git revert 78b0763   (or set AI_ASSISTANT_ENABLED=1 — no deploy needed)
```

Whole Phase 2: `git log --oneline 4e52dab..HEAD` to confirm, then
`git revert --no-commit 4e52dab..HEAD && git commit`. **Confirm the range before reverting** — an
inverted range silently reverts nothing (CHECKPOINT #17 shipped that mistake).

---

# ═══ SUPERSEDED — 2026-07-31 · §3 COMPLETE · LAUNCH BRIEF CLOSED ═══

**Head `4232924`, tree clean, deployed and verified. STOPPED as instructed.**

## 7. RECOMMENDATION — **NO, the brief is NOT complete. Here is exactly why.**

`REDESIGN_BRIEF.md` has sixteen sections. What is finished is the **truth-and-correctness half**.
The **redesign half has not been started.**

| brief section | status |
|---|---|
| §1 truth fixes · §1.1 data audit · §1.2 claims audit | ✅ complete |
| §2 reproduce figures | ✅ complete · §2.1 retailer tiers ❌ not started |
| §3 defects | ✅ complete (this checkpoint) |
| §11 SEO/accessibility | ⚠️ partial — og:image and 404 status fixed; WCAG pass not done |
| §12 journey harness | ✅ built, baselined, re-measured |
| §13 Phase A foundation | ⚠️ partial — tokens/shell touched, not a systematic pass |
| **§4 ADOPT · §5 REJECT · §6 proof module · §7 structure/ranking · §8 وفّر advisor · §9 agent** | ❌ **NOT STARTED** |
| §13 Phases B–E | ❌ not started |

**The brief cannot be called complete while §4–§9 are untouched** — those are the actual product
redesign: advisor/agent separation, the dynamic proof module, the explainable deal score, the
layered product page, the two-stage comparison. Everything delivered so far makes the *existing*
product honest and measurable. None of it makes it the *redesigned* product.

## 1. COMPLETED

**Truth (§1):** About page founder card → mission card, and `85K+` / `8 متجر` removed — they were
still live there after §1 recorded them as gone. Cadence, comprehensive-market and ranking-policy
claims removed. `/en/about` was serving Arabic.
**Category policy (ADR-150):** navigable = ≥30 comparable products, derived live, never hardcoded.
Deleted a hardcoded 17-entry header list of which 8 matched no production category.
**Homepage IA:** company-explanation billboard removed; it also carried a truncation and a
ranking-policy claim.
**Journey (§12):** server-response harness built. AR and EN both **10/10 end-to-end**; cards→real
page AR 100% / EN 90%; malformed exits **0 of 1,323** (was 21).
**Exit layer:** `/go` fallback no longer sends users to `0.0.0.0:8080`; `/go/null` eliminated.
**Product pages:** search emitted UUIDs as slugs AND the SEO query named non-existent columns, so
every product looked missing. Both fixed.
**Freshness:** the pipeline stamped processing time, not observation time — production had been
understating staleness by a median of 7.4 days. Fixed at source and corrected at display.
**Provenance:** discovery discarded observation ids; now 100% linked (269/269 verified live).
**SEO:** no `og:image` existed anywhere; missing products returned 200.
**§3:** dead social links removed, duplicate desktop sort control removed.

## 2. DEFERRED — with reasons

- **DEBT-1** `write_ac_batch` provenance — deferred on measured zero customer impact.
- **Normalization backfill (Step 4)** — gated. Blocked on the match invariant (35 observations
  hold two canonicals) and a `dell g-series` parser defect.
- **§2.1 retailer tiers** — inputs measured, definition not written.
- **Brand collision · competitor scan** — research, not customer-visible defects.

## 3. REMAINING LAUNCH BLOCKERS — **none identified**

No item below prevents launch. The launch-critical class — unevidenced claims, dead exits,
broken product pages, falsely-fresh timestamps — is closed and verified in production.

## 4. REMAINING CUSTOMER-VISIBLE DEFECTS

| defect | severity | note |
|---|---|---|
| **404 page body is empty** (57 bytes) | medium | status correct; see roadmap item below |
| 1,027 offers with neither exit nor provenance | low | honest non-clickable card; self-clearing |
| EN cards→real page 90% vs AR 100% | low | residual identity-slug cards |
| product detail body client-rendered | low | JSON-LD carries offers, so crawlers are covered |
| coupons page empty (0 rows) | low | nav entry to a guaranteed empty state |

### ROADMAP ITEM — RESTORE THE 404 PAGE BODY

**Acceptance criteria:** `GET /ar/products/<missing>` returns **404** (already true) **and** a
rendered body >1,500 bytes containing the site header, a 404 heading, and a search CTA; the same
holds for `/en`; real products and all sibling routes remain 200.
**Architectural prerequisite:** `src/app/layout.tsx` is a passthrough — the HTML shell, fonts and
providers live in `[locale]/layout.tsx`, and Next resolves `not-found` above that level where no
shell exists. **The root layout must own the HTML shell before any not-found boundary can
render.** Measured identical whether the boundary sits in `(product)`, `[locale]` or the root.
**Deferred:** restructuring the root layout touches every page in the app. Not in this brief.
The boundary is already written and annotated at `[locale]/(product)/not-found.tsx`; it activates
the moment the prerequisite lands.

## 5. TECHNICAL DEBT

**DEBT-1** (`docs/ENGINEERING-RULES.md`) with two binding constraints: the FK guard is a
correctness invariant, and render-time provenance resolution is an architectural dependency —
5,827 offers show the correct date only because the render path resolves it; the stored column is
still wrong. Reference case: `/ar/compare/apple|iPhone|15|Standard|128` must render **5, 10, 25**.
**If a change makes those numbers smaller, it has reintroduced the falsely-fresh claim.**

Also open: 35 observations holding two canonicals · the `asus|dell g-series` parser defect ·
`processing_status` is vestigial and must not be used to diagnose backlog.

## 6. RECOMMENDED PHASE 2 — in order

1. **§8 وفّر advisor** — the largest unbuilt customer value in the brief.
2. **§7.1 explainable deal score** — ranking is currently cheapest-first; the brief calls that a bug.
3. **§9 agent separation** — contract and component only; ship nothing the backend lacks.
4. **§6.1 dynamic proof module** — partly present via verified deals; not qualification-gated.
5. **§2.1 retailer tiers** — cheap, unblocks honest public retailer counts.
6. **§11 WCAG 2.2 AA pass** — never systematically done.

---

# ═══ SUPERSEDED — 2026-07-31 CHECKPOINT #21 · NULL obs_id DIAGNOSED · CLAIM INTEGRITY INTACT ═══

**Read-only diagnosis. Nothing repaired.** Head `18afae6`+, tree clean.

## RECONCILIATION FIRST — the two numbers are not the same population

**21 of 1,345 (1.6%)** counted *rendered exits* across 20 harness queries — a card contributes
several exits. **2,321** counts *canonicals in the whole catalogue*. Different units, different
denominators, same underlying NULL. Unroutable canonicals are all single-store and none are in
`tps_product_projection`, so they rank poorly and surface far less often than they exist —
which is why the rendered rate (1.86% AR / 3.35% EN) sits ~20× below the catalogue rate (32.4%).

## THE ANSWER TO EACH QUESTION

**1. Orphaned, or never linked? → NEVER LINKED.** Nothing was deleted. `raw_observation_id` is
NULL on **all 61,451** such rows, and **0 of 2,321** unroutable canonicals have *any* row in
`normalized_product_observations`. There is no observation to point at, because none was created.

**2. Which write path? → THE DISCOVERY CRON.**
`src/app/api/cron/discover-firecrawl/route.ts:77` (`writePriceSnapshot`) inserts
`canonical_product_id, store_id, store_name, price, scraping_run_id` and **neither**
`tps_observation_id` nor `raw_observation_id`. It writes `raw_observations` (line 55) but has
**zero** references to `normalized_product_observations`.

The two writers are perfectly complementary, which is what identifies them:

| | rows | `store_id` | `tps_observation_id` | stores |
|---|---|---|---|---|
| discovery path | 61,451 | **set** | NULL | **3** |
| TPS pipeline | 6,654 | NULL | **set** | 23 |

Store/date fingerprints match `raw_observations.source_method` exactly:
Almanea/`algolia` (Jun 11) · Extra/`unbxd_extra` (Jun 12) · Amazon/`amazon-search` (Jul 22).

**3. Still happening? → YES.** 654 NULL rows written **today** vs 28 healthy. Not historical.

**4. Recoverable? → NOT BY RE-LINKING, but the evidence exists.** The normalized observation was
never written, so there is no FK to restore. However the **raw** observation does exist with
**100% provenance** — `raw_url`, `payload`, `parser_version` all present on 103,106 discovery
rows. Recovery means *normalising the existing raw observations*, not repairing a pointer.

## THE QUESTION UNDER THE QUESTION — MEASURED, NOT ASSUMED

**Are these prices customer-visible?** **YES** — they render as search cards (1.86% AR /
3.35% EN of cards), now non-clickable with an honest note after `d0f2e3e`.

**Are they on a trust surface / feeding verified_drop?** **YES.** Stores 2/4/5 hold 16,379 rows
in `tps_listing_price_facts` — **809 verified_drops, 9,720 inflated_reference**.

**Is claim integrity affected? → NO.** `tps_listing_price_facts` is built **from
`raw_observations`** (`scripts/tps-core/build-listing-facts.ts:63`), not from `price_history`.
Those raw rows carry complete provenance. **"We observed it ourselves" is true and provable for
these prices.** What is missing is the link to the *normalized* layer, which is what `/go` needs
to build an exit — not the evidence itself.

**VERDICT: data hygiene and pipeline completeness, not claim integrity. It queues normally.**
It is nonetheless a *growing functional* defect: it blocks 2,321 canonicals from having exits
and from entering the projection at all, and it grows daily.

## INSTRUMENT WARNING — do not diagnose with `processing_status`

`raw_observations.processing_status` is **vestigial and misleading**: 99.97% is `pending`
across *every* method including the healthy `scraper` path (599,288 pending / 121 done), while
114,920 normalized rows exist. It is not maintained by the normalizer. Reading it as a backlog
would have produced a sixth false finding.

## REPRODUCE

```bash
# the writer fingerprint — discovery sets store_id, TPS sets tps_observation_id
npx tsx scripts/tps-analysis/q.ts "select (tps_observation_id is null) as obs_null, count(*) rows, count(store_id) has_store_id, count(distinct store_name) stores from price_history where canonical_product_id is not null group by 1"

# still happening?
npx tsx scripts/tps-analysis/q.ts "select observed_at::date d, count(*) filter (where tps_observation_id is null) null_rows, count(*) filter (where tps_observation_id is not null) ok_rows from price_history where canonical_product_id is not null and observed_at > now() - interval '7 days' group by 1 order by 1 desc"
```

## WHAT A FIX WOULD BE (not started, needs a decision)

Either **(a)** have the discovery path write a normalized observation as the scraper path does —
correct at the source, stops the growth; or **(b)** run normalization over the 103,106 existing
raw discovery observations — recovers the backlog. **(a) and (b) are complementary, not
alternatives**: (a) stops it growing, (b) clears what exists. (a) first.

---

# ═══ SUPERSEDED — 2026-07-31 CHECKPOINT #20 · OPEN ROOT CAUSE: 2,321 NULL OBSERVATION IDS ═══

**Head `d0f2e3e`+, tree clean, pushed. Nothing running.**

## 🔴 OPEN ROOT CAUSE — DO NOT CLOSE UNTIL RESOLVED

**2,321 of 7,162 canonicals with prices (32.41%) carry a real price and a real retailer on a
row whose `tps_observation_id` is NULL.** Every one is single-store. The consumer symptom is
treated (the card is honest and non-clickable); **the cause is not explained.**

```bash
# full count — reproduce before quoting, it moves
npx tsx scripts/tps-analysis/q.ts "with latest as (select distinct on (canonical_product_id, store_name) canonical_product_id, store_name, tps_observation_id from price_history where canonical_product_id is not null order by canonical_product_id, store_name, observed_at desc), per_canon as (select canonical_product_id, count(distinct store_name) as stores, count(*) filter (where tps_observation_id is not null) as routable_rows from latest group by canonical_product_id) select count(*) as canonicals_with_prices, count(*) filter (where routable_rows = 0) as fully_unroutable, round(100.0*count(*) filter (where routable_rows = 0)/nullif(count(*),0),2) as pct from per_canon"

# rendered impact, per locale (the number that governs UI decisions)
node scripts/tps-analysis/journey-baseline.js
```

**Question to answer:** why does `price_history` hold rows with a price, a retailer and a
canonical, but no link back to the normalized observation that produced them? Until that is
answered, every fix downstream is symptom management.

## WHAT SHIPPED — option 3, and why omission was NOT shipped

Omission was approved **conditional on the rate staying near 1.6–4%**. Measured properly first:

| | measured |
|---|---|
| catalogue: fully unroutable canonicals | **2,321 / 7,162 = 32.41%** |
| rendered AR (20 q, 914 cards) | 17 = **1.86%** |
| rendered EN (20 q, 837 cards) | 28 = **3.35%** |

Aggregate is low — but it **concentrates**, and that decided it: English **`air conditioner`
returns 14 cards of which 13 are unroutable** (stable across two runs). Omitting would have
rendered **one** result where fourteen exist. So the third option shipped instead:

- card is no longer clickable when it has neither a compare URL nor a retailer exit
- the disabled "View at store" button is replaced by «رابط المتجر غير متاح لهذا العرض» /
  "No store link available for this offer" — the wording the compare page already ships, so
  both surfaces explain the same gap identically
- **result count still matches rendered cards by construction** — nothing is removed, so the
  store-count-badge class of inconsistency is not created. Verified: `air conditioner`
  count=14, total=14, cards=14

## BASELINE — unchanged by the card change, as expected

`docs/journey-baseline-2026-07-31-after-card-honesty.log`

| | AR | EN |
|---|---|---|
| all five legs | 100% | 100% |
| **end-to-end** | **10/10** | **10/10** |
| cards → real page | 80/80 **100%** | 72/80 **90%** |
| malformed exits | **0 of 1323** | |

EN's 90% is the honest residual: those cards now *say* they have no destination rather than
pretending. They are counted as unreachable because they are — the display is honest, the
journey still ends there. **That is the root cause above, not a UI defect.**

## STILL OPEN

- HTTP 200 on a genuinely missing product (Next commits status before the page throws)
- Product detail body is client-rendered — served text ~467 chars; JSON-LD does carry offers
- `realSlug=0` — Algolia is the primary path and stores only `objectID`; **the UUID fallback on
  the product page is what repairs those cards. Do not remove it.**
- No `og:image` / `twitter:image` · §2.1 retailer tiers · §3 defects · §4–§9 surfaces

## COMMITS THIS SESSION

| commit | what | rollback |
|---|---|---|
| `b39fbc2` | never render an exit we cannot honour (`/go/null`) — the real AR/EN gap | `git revert b39fbc2` |
| `57fd188` | harness accepts JSON-LD price | `git revert 57fd188` |
| `52841dc` | HANDOVER #18 | `git revert 52841dc` |
| `14cf8d4` | harness leg D mirrors the card's real destination logic | `git revert 14cf8d4` |
| `0c93e4b` | HANDOVER #19 (retracts #18's slug figure) | `git revert 0c93e4b` |
| `d0f2e3e` | card with no destination: not clickable, states why | `git revert d0f2e3e` |

---

# ═══ SUPERSEDED — 2026-07-31 CHECKPOINT #19 · #18's SLUG FIGURE RETRACTED · JOURNEY 100/100 ═══

**Head `14cf8d4`, tree clean, pushed. Nothing running.**

## RETRACTION — read before using any number from #18

**#18 claimed "24.0% AR / 28.0% EN of cards are identity-slug dead ends". That is WRONG by
~40×. The true fall-through rate is 0.6% AR / 4.0% EN.**

The error: I assumed a card without a compare URL links to `/products/<slug>`. It does not.
`product-card.tsx:104` takes `product_stores[0].product_url` whenever the card is not
multi-store — a `/go/<uuid>` exit. **Single-offer cards already link out.**

The field mismatch #18 asked me to confirm **does not exist**:
`mapGroupedToProductCard` (`src/lib/scraping/product-adapter.ts:94`) correctly maps the API's
`stores` onto the card's `product_stores`, carrying `product_url` and `affiliate_url`. So the
requested "fix single-offer cards to link out" was unnecessary — they already do.

Measured, mirroring the card's real logic:

| | viaCompare | viaExit | reachable | falls through |
|---|---|---|---|---|
| AR (471 cards) | 210 | 258 | **468 (99.4%)** | 3 (0.6%) |
| EN (446 cards) | 123 | 305 | **428 (96.0%)** | 18 (4.0%) |

The harness had the same wrong assumption, so its published `cards→real page` understated the
journey by ~25 points. Fixed in `14cf8d4`.

## CURRENT BASELINE — `docs/journey-baseline-2026-07-31-corrected-legD.log`

| | AR | EN |
|---|---|---|
| homepage · search · exits · product · retailer | 100% across all five | 100% across all five |
| **end-to-end** | **10/10 100%** | **10/10 100%** |
| cards → real page | **80/80 100%** | **72/80 90%** |
| malformed exits | **0 of 1323 rendered** | |

**Do not read 100/100 as "the journey is solved."** It means the ten queries per locale in this
set now complete. The denominator is small and the set is fixed; EN's 90% card reachability is
the honest residual.

## THE ONE THING TO DO NEXT — the last dead end, now precisely scoped

**3 AR / 18 EN cards have neither a compare URL nor a usable exit**, so they fall through to
`/products/<identity-slug>`, which does not resolve. These are canonical-injected products
whose latest price row carries a NULL `tps_observation_id` — the same rows that previously
rendered `/go/null` before `b39fbc2`. The count did not change; the failure mode moved from
"broken exit" to "link to a page that does not exist".

**Not fixed deliberately.** It is a UI judgement call — render the card non-navigable, or omit
it entirely — and it arrived at the end of a long session. A card carrying a real price and
retailer still informs even when it cannot be clicked, so omitting it is not obviously right.
**Decide the intent before coding it.**

```bash
# the 18 EN cards, reproducible
# they are the cards where stores[0].product_url === '' and tps_compare_url is null
```

## STILL OPEN, UNCHANGED

- HTTP 200 on a genuinely missing product (Next commits status before the page throws)
- **Product detail body is client-rendered** — visible served text ~467 chars, shell only.
  JSON-LD does carry real offers, so search engines are covered; a plain-text fetcher sees
  nothing. Harness records this as `bodyServerRendered`.
- `realSlug=0` — no card emits a real storefront slug; Algolia is the primary path and stores
  only `objectID`, so **the UUID fallback on the product page is what repairs those cards. Do
  not remove it.**
- No `og:image` / `twitter:image` · §2.1 retailer tiers · §3 defects · §4–§9 surfaces

## COMMITS THIS SESSION

| commit | what | rollback |
|---|---|---|
| `b39fbc2` | never render an exit we cannot honour (`/go/null`) — the real AR/EN gap | `git revert b39fbc2` |
| `57fd188` | harness accepts JSON-LD price; after-exit-fix baseline | `git revert 57fd188` |
| `52841dc` | HANDOVER #18 | `git revert 52841dc` |
| `14cf8d4` | harness leg D mirrors the card's real destination logic | `git revert 14cf8d4` |

**FIVE instrument errors have now been caught in two sessions** — `curl -d` argv mangling, a
200× SQL over-report, Arabic-Indic digits, a client-rendered body read as a price mismatch, and
leg D's missing branch. Every one would have changed a priority. The standing rule holds and is
earning its keep: **measure the rendered artefact, not a model of it.**

---

# ═══ SUPERSEDED — 2026-07-31 CHECKPOINT #18 · AR/EN GAP CLOSED · EXITS 100% ═══

**Head `57fd188`, tree clean, pushed. Nothing running.** Two commits: `b39fbc2` (exit fix),
`57fd188` (harness + baseline).

## THE AR/EN GAP — DIAGNOSED, TREATED, CLOSED

| | before | after |
|---|---|---|
| AR end-to-end | 80% | **90%** |
| EN end-to-end | **50%** | **100%** |
| exits AR / EN | 80% / 60% | **100% / 100%** |
| malformed exits | 21 of 1345 | **0 of 1323** |

**The gap was never localisation, and it was not the slug issue.** Measured over the full
card population before treating anything:

| | AR (471 cards) | EN (446 cards) |
|---|---|---|
| identity-slug dead | 113 (24.0%) | 125 (28.0%) ← only 4 pts apart |
| **malformed exits** | 3/754 (**0.40%**) | 18/590 (**3.05%**) ← 7.6× |

EN's 18 malformed exits were **13 on the single query "air conditioner"**, all from Extra;
the Arabic equivalent «مكيف سبليت» produced **zero**. So this was a **locale-INDEPENDENT**
defect that the EN query set happened to hit a bad cluster of. With ten queries per locale one
unlucky query moves the rate 10 points. The gap was real in the measurement; its cause was not
English. Keep that in mind before reading any future AR/EN delta as a localisation signal.

**Fix (`b39fbc2`):** `/api/search` emitted `` `/go/${obsId}` `` unconditionally, so a retailer
whose latest price row had a NULL `tps_observation_id` got a button that looked healthy and
landed nowhere. It now emits no exit for that offer. We deliberately do NOT substitute an older
row that has an id — that would display a price we are not currently observing.

**ATTRIBUTION, because two different things moved.** The exit fix is real product work worth
EN 50→80 and AR 80→90. The final EN 80→100 is a **corrected instrument**, not a shipped change:
leg D checked only visible text, but `/products/<slug>` renders its body client-side while its
JSON-LD carries real offers. Reporting 50→100 as product work would be false.

AR's remaining 1 dead end is an **external retailer URL returning ≥400** — outside our code,
varies run to run.

## THE ONE THING TO DO NEXT — identity slugs, and #17's recommendation DID NOT SURVIVE

**24.0% AR / 28.0% EN of all cards are identity-slug dead ends.** Largest open item.

**#17 recommended a canonical-identity fallback redirecting to the compare page. I validated it
against production and it does NOT hold up — do not implement it as written.** Evidence:

- The canonical row exists (`apple|iPhone|15|Standard|128`, active) ✓
- The compare route matches `tps_identity_key` **exactly**, so the dash form fails while the
  pipe form renders fully (3 stores, ١٬٩٠٠) — a redirect could bridge that ✓
- **But** identity-slug cards are canonicals *without* a comparison, and for a single-offer
  canonical the compare page renders an **empty shell** (len 1059, no product content).
  Redirecting there trades one dead end for another. ✗

```bash
# reproduce the empty single-offer compare page
curl -s "https://tawveeri.com/ar/compare/zamil%7Csplit%7CNO_SERIES%7C22000%7CInverter%7Ccool_only" | wc -c
```

**Better candidate, not started:** make single-offer canonical cards link **out to the
retailer** instead of to an internal page. They have exactly one offer, so there is nothing to
compare and the useful action is the exit — which the card already holds. The card's own logic
(`product-card.tsx:113`) already prefers an external URL, but its `rawExternalUrl` reads
`product.product_stores[0]`, while `/api/search` returns `stores`. **Confirm that field
mismatch first** — if that is the whole story, the fix is a mapping, not a new page.

## ALSO MEASURED THIS SESSION, NOT ACTED ON

- **`realSlug=0`.** No card in either locale emits a real storefront slug: all non-compare cards
  are UUID (145 AR / 180 EN) or identity-dead. The slug fix in `3dfc18a` therefore rarely fires
  — **the UUID fallback on the product page is what is actually repairing those cards**, because
  Algolia is the primary path and its index stores only `objectID`. Do not remove that fallback.
- **Product detail body is client-rendered**: visible served text ~467 chars, shell only.
  JSON-LD does carry real offers, so search engines are covered; a plain-text fetcher (LLM,
  link preview) sees nothing. Recorded by the harness as `bodyServerRendered`.
- Still open from #17: HTTP 200 on a genuinely missing product · no `og:image` · §2.1 retailer
  tiers · §3 defects · §4–§9 surfaces.

## COMMITS THIS SESSION

| commit | what | rollback |
|---|---|---|
| `b39fbc2` | never render an exit we cannot honour (`/go/null`) | `git revert b39fbc2` |
| `57fd188` | harness accepts JSON-LD price; after-exit-fix baseline | `git revert 57fd188` |

Baseline logs: `docs/journey-baseline-2026-07-31-after-exit-fix.log` (current) ·
`…after-slug-fix.log` · `…2026-07-30.log` (original).

---

# ═══ SUPERSEDED — 2026-07-31 CHECKPOINT #17 · REDESIGN STARTED · JOURNEY BASELINE EXISTS ═══

**Head `346f84d`, tree clean, everything pushed. Nothing is running in the background.**
Six work commits this session plus this handover, each independently revertible. `REDESIGN_BRIEF.md` now exists at
the repo root and governs this work; `docs/LAUNCH_VOCABULARY.md` still outranks it on wording.

## THE ONE THING TO DO NEXT

**Identity-key slugs are the largest remaining dead end.** Canonical-injected products emit a
slug like `apple-iphone-15-standard-128` that has **no row in `products`**, so the card
resolves to nothing unless it also carries a compare URL. This is most of the remaining 27%.

```bash
# reproduce the dead end (both return «المنتج غير موجود»)
curl -s https://tawveeri.com/ar/products/apple-iphone-15-standard-128 | grep -o '<title>[^<]*</title>'
```

Two candidate fixes, neither started, neither needing approval:
1. Point canonical cards without a comparison at their **compare page anyway** (it renders a
   single-offer view), or
2. Give the product page a **canonical-identity fallback** — resolve an unmatched slug against
   `canonical_products.tps_identity_key` before declaring absence.

Prefer (2): it fixes every already-published link rather than only newly-rendered ones. That
was the reasoning that made the UUID fallback the right call in `3dfc18a`.

## THE BASELINE — it is COMPLETE, both runs finished, nothing left mid-flight

```bash
node scripts/tps-analysis/journey-baseline.js            # ~6 min, read-only, safe to re-run
node scripts/tps-analysis/journey-baseline.js --locale ar
node scripts/tps-analysis/journey-baseline.js --json
```

`docs/journey-baseline-2026-07-30.log` (before) · `docs/journey-baseline-2026-07-31-after-slug-fix.log` (after)

|  | AR | EN |
|---|---|---|
| homepage served · search · retailer | 100% · 100% · 100% | 100% · 100% · 100% |
| exits | 80% | 60% |
| product served | 100% | 80% |
| **end-to-end** | **8/10 80%** | **5/10 50%** |
| **cards → real page** | **62/80 77.5%** | **55/80 68.8%** |

**Do not compare the cards→real-page number to the 44.8%/27.8% in the earlier log without
reading why:** that was a `has tps_compare_url` proxy, correct before the slug fix and wrong
after it. The methodology-independent evidence is that of 117 cards now reaching a real page,
only 63 carry a compare URL — the other **54 resolve through the repaired slug and were dead
ends before**.

This harness measures the SERVED RESPONSE, not the hydrated DOM, and complements
`ui-journey.js` rather than replacing it. It is read-only by construction: it NEVER issues
`GET /go/<id>`, because that route INSERTS into `outbound_clicks`.

## OPEN, MEASURED, NOT STARTED

- **Exits with no valid destination: 21 of 1345 rendered (1.6%).** Root cause: `/api/search`
  emits `` `/go/${obsId}` `` without a null check. Correct treatment is to render NO exit
  button, as the compare page already does («رابط المتجر غير متاح لهذا العرض»). Touches the
  search response shape, so it wants its own verify cycle.
- **A genuinely missing product still returns HTTP 200.** `notFound()` renders the not-found
  UI but Next 14 commits the status before the page component throws under streaming; a
  routing miss (`/ar/no-such-route`) does correctly 404. Verified on a production build, not
  just dev. **Not claimed as fixed.**
- **No `og:image` / `twitter:image`** anywhere, despite `twitter:card=summary_large_image` —
  every social/link preview renders imageless. `og:title` also duplicates the brand.
- **REDESIGN_BRIEF §2.1 retailer tiers** — inputs measured (24 registered, 6 with listings,
  per-retailer freshness in CHECKPOINT #15) but the tier definition is not written.
- **§3 remaining defects** — duplicate sort controls on search, footer `#` social links,
  brand collision (`tawfeery.com` et al), bounded competitor scan.
- **§4–§9 product surfaces** — وفّر/agent separation, product page layering, deal score. None
  started; all gated behind §13's "no undeclared E16".

## WHAT SHIPPED THIS SESSION

| commit | what | rollback |
|---|---|---|
| `cc1fe21` | About: founder card → mission card. Found `85K+` / `8 متجر` **still live there** — §1 had only checked the homepage. Also killed a cadence claim, a comprehensive-market claim, and a ranking-policy claim; `/en/about` had been serving Arabic | `git revert cc1fe21` |
| `68570df` | ADR-150 category rule (≥30 comparable, live-derived) + homepage IA: removed the company-explanation billboard | `git revert 68570df` |
| `a3a82bc` | `/go` fallback redirected to `https://0.0.0.0:8080/`; now the real homepage | `git revert a3a82bc` |
| `0ec8439` | journey-baseline harness + before log | `git revert 0ec8439` |
| `3dfc18a` | product pages: search emitted UUIDs as slugs, AND the SEO query named non-existent columns so every product looked missing | `git revert 3dfc18a` |
| `280b1d9` | harness measures reachability by fetching, not proxy; after log | `git revert 280b1d9` |

**Full rollback of the session:**

```bash
git log --oneline c1b3486..HEAD        # confirm 7 commits FIRST — never revert a range blind
git revert --no-commit c1b3486..HEAD && git commit
```

`c1b3486` is the pre-session head. Reverting individual commits above is preferred; they are
independent.

> **Corrected 2026-07-31.** This line first read `git revert --no-commit 280b1d9..cc1fe21^`.
> That range is **backwards** — `A..B` means "reachable from B, not from A" — so it resolves
> to **zero commits** and would have silently done nothing in an emergency, which is worse
> than failing loudly. Hence the `git log` check above before any range revert.

## THREE INSTRUMENT ERRORS, CAUGHT BEFORE THEY BECAME CLAIMS

Recorded because the pattern matters more than the incidents:

1. **`curl -d` with Arabic** is mangled by Windows argv conversion. Reported "Arabic search
   returns earbuds for `مكيف`, zero comparisons" — false. Use `--data-binary @file`, or a
   UTF-8 Buffer in Node. The harness now **aborts** if the server does not echo the query back.
2. **SQL said 28.4% of exits were broken; fetching the rendered links said 0.14%** — a 200×
   over-report. The SQL grouped `price_history` by raw `store_name`; the route resolves to an
   approved retailer slug first, collapsing `أمازون`/`amazon`/numeric-id variants.
3. **18 "price missing from product page" failures were Arabic-Indic digits** — the page
   renders «١٬٩٠٠», the card JSON says `1900`. An English-only harness could not have found it.

**The standing rule this produced: measure the rendered artefact, not a model of it, and prove
the instrument before believing a number that would change a priority.**

## ENVIRONMENT NOTE

Something not mine was already listening on **port 3000** at session start and returned 500
before any change of mine — left untouched. All servers I started (3001/3005/3006) are stopped.

---

# ═══ SUPERSEDED — 2026-07-30 CHECKPOINT #16 · LAUNCH CLOSED · ENGINEERING PHASE ENDED ═══

**Launch verdict: SAFE WITH EXCLUSIONS.** Engineering investigation is CLOSED. Do not reopen
it. Head `a37cb67`, tree clean, pushed.

## READ THIS FIRST IF YOU WRITE ANY CUSTOMER-FACING TEXT

**`docs/LAUNCH_VOCABULARY.md` governs all public language** — the CAN SAY / MUST NOT SAY lists
in Arabic and English, the replacement vocabulary (past tense, evidence-anchored), the
discount-integrity methodology, and the latent copy that must never be reactivated without
rewording. **It outranks any wording you find in the codebase or in older docs.**

## Launch gate — measured against production AFTER the copy deploys

`docs/ui-journey-2026-07-30-launch-eve.log` — **overall 112/112 · comparison 86/86 (denominator
grew from 82) · Arabic 72/72 · English 40/40 · exact-model 32/32 product AND variant ·
0 unhonoured store claims across 58 pages · outbound 112 OK / 0 DEAD / 0 BLOCKED.**
**Never publish these figures** — they are evidence for us, not a customer benefit (§3 of the
vocabulary file).

## The three exclusions that make it SAFE **WITH EXCLUSIONS**

1. **No cadence or real-time language, anywhere.** Dedicated price refresh is not the freshness
   mechanism today — discovery is, and that is coverage, not architecture.
2. **LuLu and Sharaf DG are excluded from every comparison claim** (ingesting, but 0 normalized
   observations — they reach no comparison).
3. **The discount-integrity figure is 70%, not 71%**, and only ever with its scoping clause
   *"among the offers we examined"*. Re-run `curl -s
   https://tawveeri.com/api/v1/tps/discount-integrity` before quoting; it moves
   (87.7 → 72 → 71 → 70).

## Known customer-facing gaps, accepted for launch — all in the Week 1 list

- **Search cards do not show observation age**; only the compare page does. 34% of visible
  offers are >7 days old (~6-day median at the four largest retailers). Mitigated by the
  compare-page age line and by the wording discipline above.
- **Noon's dedicated price refresh returns 0 from Railway** even after the ADR-149 regex fix
  (works 4/4 locally). Unconfirmed cause: API likely unreachable from Railway's egress.
- **LuLu's dedicated refresh is unfixed**; cause not yet explained.
- **The `coupons` table is EMPTY** (0 rows) — the coupons page has nothing to show.

## Post-launch roadmap — approved as written, nothing moved into launch scope

Week 1 / Week 2 / Architecture are in CHECKPOINT #15 §6 and the ADR-148/149 entries. The
governing architectural conclusion, kept verbatim because it is why the roadmap can be trusted:

> **No single dominant constraint survived measurement. Plan many measured improvements, not
> one mythical unlock.**

---

# ═══ SUPERSEDED — 2026-07-30 CHECKPOINT #15 · ADR-148 BACKPRESSURE SHIPPED ═══

**Read this, then ADR-148.** Commits `1723d14` + `6c1dd02`, pushed to `main`.
Launch **B**, gate **112/112**, untouched — no customer-facing code changed.
Suite **756/756** green.

## 0-LAUNCH. PRICE FRESHNESS — TECHNICAL CLASSIFICATION: **SAFE WITH QUALIFICATION**

**The launch condition is a COPY constraint, not a code fix.** Measured 2026-07-30 13:5x UTC.

### Customer-visible offer freshness (`scripts/tps-analysis/offer-freshness.sql`)

| retailer | offers | ≤6h | ≤24h | **stale >7d** | median age |
|---|---|---|---|---|---|
| extra | 2,478 | 0.5% | 7.9% | **1,158** | 6.7 d |
| almanea | 2,436 | 11.5% | 11.9% | **1,114** | 5.8 d |
| noon | 1,264 | 23.3% | 77.5% | 66 | **0.3 d** |
| amazon | 640 | 0.9% | 10.0% | **232** | 6.1 d |
| jarir | 325 | 1.2% | 2.5% | **140** | 6.3 d |
| najm | 223 | 0% | 0% | 0 | 5.1 d |
| shaker | 210 | 0.5% | 0.5% | 0 | 5.7 d |
| alnakheelk | 182 | 0% | 0% | 0 | 4.2 d |
| swsg | 59 | 0% | 3.4% | 29 | 6.7 d |
| samsung_ksa | 26 | 0% | 80.8% | 0 | 0.4 d |

**2,673 of 7,843 visible offers (34%) are older than 7 days; the four largest retailers sit at
a ~6-day median.** This is NOT caused by the price_update bug — it long predates it.

### Why this is still launchable

**The compare page already discloses observation age on EVERY offer** —
`رصدناه قبل X يومًا` / `observed X days ago`
(`src/app/[locale]/(public)/compare/[key]/page.tsx:291–300`). Prices are **labelled evidence,
not claimed as current**. That is the difference between "stale prices shown as live" (not
launchable) and "old observations honestly dated" (launchable).

### The binding conditions — a launch that breaks these is NOT safe

1. **No "real-time", "live", "current" or "today's prices" claim** in any public copy, store
   listing, Misk material or announcement. The honest phrasing is *evidence-backed observed
   prices with the observation date shown*.
2. The compare-page age disclosure must stay. **Do not remove it to make cards look cleaner.**
3. **KNOWN GAP — search/result CARDS do NOT show observation age**; only the compare page
   does. A card can therefore show a 6-day-old price with no date. This is the highest-value
   remaining freshness fix and it is small: render the same age line on the card.
   **Deferred, not done** — it is a customer-facing change and it arrived at the very end of
   this session; shipping UI untested on launch eve is the larger risk.

### Per-retailer disposition

- **LAUNCH-SAFE:** noon (0.3 d median), samsung_ksa (0.4 d).
- **LAUNCH-SAFE WITH QUALIFICATION** (dated evidence, not current prices): extra, almanea,
  amazon, jarir, shaker, najm, alnakheelk, swsg.
- **HIDE UNTIL FIXED:** none. Hiding 34% of offers would gut the catalogue for no integrity
  gain, because age is disclosed where comparison happens.
- **INCONCLUSIVE:** lulu, sharafdg — too few TPS-visible offers to appear in the table above.

## 0-FIRST-INCOMPLETE-ITEM. PRICE UPDATES RUN NOW, BUT FAIL AT ~99%

**Start here next session.** Fixing the startup-timer bug (§0-CRITICAL) made the price loop
actually run — and that immediately exposed a deeper defect it had been hiding.

First full sweep after the fix (13:06–13:14, all four `INGEST_STORES`, 20s staggered):

| run | store | status | products_updated | errors |
|---|---|---|---|---|
| 1349 | noon | partial | **0** | **120** |
| 1350 | lulu | partial | **1** | **39** |
| 1351 | sharafdg | success | 0 | 0 |
| 1352 | extra | running | — | — |

**One product refreshed across four stores; 159 errors.** Price freshness is the platform's
promise and its dedicated refresh path is ~99% broken. It was invisible for as long as the loop
never ran. *(Making a hidden failure visible is progress even when the number is ugly.)*

### NOON — regex bug FIXED, but production is STILL 0%. Two independent faults.

**Fault 1 (FIXED, `08e0a13`).** `updateProductPrice` extracted the SKU with
`/\/p\/([A-Z0-9]+)/i` — "chars AFTER `/p/`". Every production Noon URL is `.../<SKU>/p/` with
`/p/` **terminal**, so it never matched and every refresh fell through to HTML scraping, which
returns null on Noon. `extractNoonSku()` now reads the segment before `/p/`, still supports the
legacy form, rejects explicitly, and has **14 regression tests** including one asserting the old
pattern found nothing. **Local: 0/120 → 4/4** with real prices (605 / 571 / 143.78 / 299 SAR).

**Fault 2 (NOT FIXED — found by verifying in production instead of trusting the local pass).**
With the fix deployed, production run **1358 still returned 12 errors / 0 updated**, and
`price_history` gained **zero** noon rows. Each product takes **~70 s** (retry × 3 then fail),
versus **~1 s** locally. **Strongest hypothesis: Noon's internal API is reachable from a Saudi
residential IP but not from Railway's datacenter IP.** Supporting: my local calls succeeded 4/4
in ~1 s each; Railway fails 100% with timeout-shaped latency. **Not yet confirmed** — the
confirming test (a Noon discovery call from Railway, which uses the same API host) was blocked
by the one-run-per-store guard while slow runs held it.

**NEXT DIAGNOSTIC:** when no noon run is active, `POST /api/cron/discover-products
{store_slug:noon, max_pages:1}` on production. If it writes zero observations, the API is
IP-blocked from Railway and the fix must be an egress path (proxy / different host / official
feed), **not** more parser work. The `[price-attempt]` structured log now records the reason
per attempt.

**Consequence for the record:** noon's excellent 0.3-day freshness was very likely produced by
the **four local schedulers running from a Saudi residential IP**, which I stopped at 11:29 for
sound concurrency reasons. If Fault 2 is confirmed, noon freshness will now decay. That is a
real, self-inflicted trade-off and it should be watched, not assumed away.

**Diagnose per store** — entry: `/api/cron/update-prices` → `runPriceUpdateJob` → each store's
`updateProductPrice(productUrl)`.

**WHY THIS ALSO FORCED A THRESHOLD CHANGE (`6106fa0`).** DISCOVERY is the de-facto
price-observation source — today it wrote almanea 14,057 · noon 737 · jarir 588 · lulu 534
rows, each carrying a price, versus the price loop's **one**. My original 50,000 backpressure
gate would have deferred discovery **~16 hours across launch**, trading high customer value
(fresh prices) for ~none (a shorter queue, whose drain was measured at **zero** new
comparisons). Gate raised to **500,000 / 400,000** — a genuine runaway guard that never blocks
normal operation, since no degradation was ever observed even at 370,000 rows behind.
**Mechanism unchanged; still reversible with `INGEST_BACKPRESSURE_HIGH=0`.**

## 0-CRITICAL. SCHEDULED PRICE REFRESH HAD NEVER RUN — fixed, verification pending

**The worst defect found today, and the most launch-relevant.** `runPriceUpdate` was
registered with `setInterval` **only**, no startup `setTimeout` — while `runDiscovery` and
`runFeedIngest` both had one. The 6-hour clock restarted on every process start, so **any
restart cadence faster than 6h meant scheduled price updates fired NEVER.**

**⚠️ CORRECTION to my own first evidence.** I initially cited "44 `price_update` runs in 7 days,
all `triggered_by='manual'`, none `'schedule'`". **That inference was wrong**: the
`/api/cron/update-prices` route stamps `'manual'` regardless of caller, so the column does
**not** distinguish scheduler from human for price updates (it does for
`/api/cron/discover-products`, which is what misled me). Proof: the scheduler's own first
price run after the fix, id 1349, is also labelled `'manual'`.

**The evidence that actually holds is the GAP, and it is sufficient.** Price updates are meant
to run every 6h. The last one before today's fix was **03:22:30**; the next scheduler-driven
one was **13:06:30** — a **9h 44m gap** where the 6h interval implies a run around 09:22. None
occurred, because Railway restarted at 09:48 / 11:45 / 11:48 / 12:12 and each restart reset a
clock that had no startup timer. **The code defect is directly verifiable by reading:**
`runPriceUpdate` had `setInterval` only while `runDiscovery`/`runFeedIngest` each had a
`setTimeout` kick. Price freshness is this platform's promise, and its loop only ever fired
when uptime happened to exceed 6 hours.

**✅ FIX VERIFIED IN PRODUCTION:** run **1349** (noon, `price_update`) started **13:06:30**,
which is `INGEST_FIRST_DELAY_MS + 2 min` after the post-fix boot — the startup timer this fix
added. The first scheduler price update in at least 9h 44m.

**Fixed in `062dd0d`** (one line). **VERIFY FIRST NEXT SESSION** — a watcher wrote
`scratchpad/price-refresh-verify.log`; if gone, run:
```
npx tsx scripts/tps-analysis/q.ts "select id, store_name, job_type, started_at::text, triggered_by from scraping_runs where job_type='price_update' and triggered_by='schedule' order by id desc limit 5"
```
**PASS** = at least one row (the first ever). **FAIL** = still zero → the loop is still not
firing; investigate `INGEST_STORES` on Railway and the `admit`/`ingestRunning` guards.

**NEW VERIFIED RULE:** *a periodic job registered with `setInterval` alone has no guaranteed
execution on a platform that restarts — its true period is `max(interval, uptime)`, which is
unbounded. Every recurring job needs an explicit first run, and execution must be observable by
TRIGGER SOURCE, not by whether the process is alive.* The scheduler looked healthy throughout —
heartbeat ticking, chain reporting `ok` — while an entire customer-facing loop had never run.

## 0b. BACKPRESSURE — VERIFIED LIVE ✅

Railway booted 12:12:11 on the gate build; first ingest window ~12:27 with `rows_behind`
**200,929 vs a 50,000 gate**; checked 12:36:35 → **zero `discovery` runs after 12:12**. The
12:00–12:07 discovery burst came from the 11:45:38 container, which predated the gate.

## 0a. THE MANUAL DRAIN IS STOPPED — deliberately. Do not restart it without reading this.

**Stopped 2026-07-30 12:32 UTC** after 14 passes. Checkpoint at stop (durable, in the DB —
nothing lives in scrollback):

| store | `tps_progress_cursors.last_raw_id` | rows behind |
|---|---|---|
| **5 almanea** | **461,718** | **166,973** |
| **1 jarir** | **117,938** | **34,322** |

**Why stopped, on evidence not preference:** it processed **142,282 rows and produced ZERO new
customer-visible comparisons** (§4b). Its marginal value is directionally ~0, it was never
proven to survive session termination, and leaving an unattended multi-hour heavy writer
running into launch removes no risk and adds some. **The automatic queue-aware chain now does
this work by itself** — adaptive batches, lane-leased, backpressured — so the backlog drains
without a human. **Price freshness is unaffected: price updates are never gated.**

**Accepted cost, stated plainly:** discovery stays deferred until total rows-behind < 20,000.
At the automatic chain's rate that is roughly a day. **This is acceptable and arguably
desirable** — ADR-146 measured blind discovery at ~80% single-retailer rows, so pausing
catalogue growth costs little and pauses backlog growth too.

**To restart it** (only if a measured reason appears — "the backlog is big" is not one):
```
npx tsx scripts/tps-core/normalize-incremental.ts --batches 20 --limit 500 --stores 5
npx tsx scripts/tps-core/normalize-incremental.ts --batches 20 --limit 500 --stores 1
```
It resumes from the cursors above; it never restarts from the beginning. A manual run does
**not** yield to the lane lease, so it will not silently no-op.

## 0. WHERE THE DRAIN RESULT LANDS IF IT FINISHES UNWATCHED

The loop writes every pass to
`%TEMP%\claude\C--Users-Hp-Downloads-Tawveeri-Official\5b26c93a-01d0-41cd-833e-a876657d11a3\scratchpad\drain-store-5.log`
(`DRAINED:` or `MAX RUNS REACHED:` on the last line). **That path is session-scoped and may be
cleaned up — do not rely on it.** The durable read, true at any time:

```
npx tsx scripts/tps-analysis/q.ts "select k.store_id, (select count(*) from raw_observations o where o.store_id=k.store_id and o.id>k.last_raw_id) behind from tps_progress_cursors k where k.category='_all_' order by 2 desc"
npx tsx scripts/tps-analysis/q.ts --file scripts/tps-analysis/comparable-count.sql    # vs the 718 baseline in §4
```
**Expected result when it finishes: comparable stays ~718. See §4b — this is measured, not
predicted.**

## 1. FIRST INCOMPLETE ITEM — the almanea drain is still running

It is the only unfinished work. Everything else in this session is shipped and verified.

```
# resume (cursor-based — never restarts from the beginning):
npx tsx scripts/tps-core/normalize-incremental.ts --batches 20 --limit 500 --stores 5
# then, only after almanea reports no lag:
npx tsx scripts/tps-core/normalize-incremental.ts --batches 20 --limit 500 --stores 1
```
Repeat until that store stops appearing in the `per-store lag` block. ~10,000 rows
and ~9.3 min per pass. **Then measure with `scripts/tps-analysis/comparable-count.sql` (§4) and report
the delta against the 718 baseline.**

## 2. PROCESSES — what was running, what was changed

| process | PID | role | disposition |
|---|---|---|---|
| Railway scheduler | **37** (container) | THE production scheduler — hourly chain, ingestion | **preserved** — heartbeat ticking, verified |
| local `scheduler.js` ×4 | 2364 · 13224 · 13564 · 7940 | duplicates writing to **production** | **STOPPED** |
| stale `next start` :3021/:3022/:3023 | 22220 · 20636 · 8736 | spawned those schedulers | **STOPPED** |
| `npm run dev` :3000 | 20908 → 22624 | founder's dev server | **preserved** (its scheduler child killed) |
| drain loop `drain.sh 5` | 22628 | the almanea drain | **preserved, untouched** |

**Config change (local only — `.env.local` is gitignored, Railway unaffected):**
```
DISABLE_INPROCESS_SCHEDULER=1      # ADD to .env.local  → no local Next server spawns a scheduler
# RESTORE: delete that line from .env.local, then restart the dev server.
```
**Backpressure rollback (production, env var):** `INGEST_BACKPRESSURE_HIGH=0` disables the
gate entirely. `INGEST_BACKPRESSURE_LOW` (20,000) is the resume threshold.

**Drain job survival:** the loop is **orphaned but alive** — its spawning shell (PID 12468)
exited and it kept running, so it does not depend on any shell. It is **not** proven to
survive `claude.exe` (PID 8668) exiting; Claude Code background tasks are session-scoped by
design. **Assume it dies with the session and resume via §1.**

**Resume safety:** normalization resumes from `tps_progress_cursors` (per store,
`category='_all_'`). It never restarts from the beginning. **Known bounded crash window:**
`normalizeSweep` upserts the cursor (`progressive-engine.ts` ~L126) *before* the staging
rows (~L129), so a crash between them advances the cursor past up to `limit` observations
that were never staged — skipped silently, not retried. Re-running does not repair it; only
a deliberate cursor rewind would. **Fix (not done, deliberately — it is a write to the
engine while a drain is in flight): write staging first, then the cursor.**

## 2b. ADR-099 DETECTION SIGNAL — verified 2026-07-30 12:03 UTC

**`health 200` is NOT sufficient** — the Next server answers from memory while PostgREST is
wedged in the `PGRST002` loop and every REST-backed customer endpoint returns empty. Run
these four, in this order. Whole sequence ≈ 10 seconds.

```bash
# 1. service up
curl -s -o /dev/null -w "%{http_code}\n" https://tawveeri.com/api/health
# 2. REAL PostgREST read — this is the one that catches a wedge
curl -s -w " [%{time_total}s]\n" https://tawveeri.com/api/stats
# 3. representative DB query + lock/connection state
npx tsx scripts/tps-analysis/q.ts "select count(*) conns, count(*) filter (where state='active') active, count(*) filter (where wait_event_type='Lock') lock_waits, count(*) filter (where state='idle in transaction') idle_txn from pg_stat_activity where datname=current_database()"
# 4. normalization actually progressing + scheduler alive
npx tsx scripts/tps-analysis/q.ts "select pid, last_tick::text, last_refresh_at::text, last_refresh_status from tps_scheduler_heartbeat"
```

**HEALTHY looks like this (measured 12:03 UTC):** `200` · `/api/stats` returns real JSON
(`comparable_products` non-zero) in **1.6s** · `conns=11 active=2 lock_waits=0 idle_txn=0` ·
`last_tick` within the last 60s.

**WEDGED / DEGRADED looks like:** `/api/stats` returns `{}`/empty or 5xx or takes >10s while
`/api/health` still says 200 · any `PGRST002` in a response · `lock_waits > 0` sustained ·
`idle_txn > 0` sustained · `conns` near the pool ceiling · `last_tick` older than ~3 min ·
`last_refresh_status` starting `fail(` or `crash:` · per-store lag rising while a normalizer
claims to be running.

## 2c. RECOVERY PROCEDURE — do not execute unless an incident exists

Recovery is **NOT** complete because a process restarted. It requires all three: a real
PostgREST read returning data, a NEW production write, and downstream processing resuming.

1. **Pause the producers first, never the consumer.** Set `INGEST_BACKPRESSURE_HIGH=1` on
   Railway (defers all discovery + feed) — or stop the manual drain loop. **Do NOT kill
   Railway's scheduler**: it is the only thing keeping prices fresh.
2. **Preserve the drain checkpoint.** Nothing to save — progress lives in
   `tps_progress_cursors`. Read it with the §2b query 3 variant on `tps_progress_cursors`.
   Killing the drain loses at most the in-flight pass.
3. **Avoid duplicate workers on restart.** Confirm zero local schedulers before restarting
   anything: `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*scheduler.js*' }`
   must return nothing locally, and `.env.local` must still contain `DISABLE_INPROCESS_SCHEDULER=1`.
4. **If PostgREST is wedged:** `VACUUM (ANALYZE)` the system catalogs, then a **full Supabase
   project restart** from the dashboard (founder action). A bare `NOTIFY pgrst 'reload'`
   re-introspects WITHOUT reconnecting and just re-breaks it — see ADR-099. Role
   `statement_timeout`s are already relaxed (authenticator 30s, anon/authenticated/service_role 20s).
5. **Verify recovery, all three:** §2b returns HEALTHY · a real write
   (`curl -X POST https://tawveeri.com/api/cron/discover-products -H "Authorization: Bearer $CRON_SECRET" -d '{"store_slug":"lulu","category":"smartphone","max_pages":1}'`
   then confirm `max(id)` on `raw_observations` rose) · per-store lag falling again.

**Rollback commands for everything shipped today:**
```
INGEST_BACKPRESSURE_HIGH=0     # Railway env — disables backpressure entirely
NORMALIZE_LANE_LOCK=0          # Railway env — disables the normalization lane lease
# revert the adaptive batch count: drop "--adaptive" from the normalize step in
#   scripts/tps-core/refresh-intelligence.ts  (returns the hourly chain to a constant 6)
# restore local schedulers: delete DISABLE_INPROCESS_SCHEDULER=1 from .env.local, restart dev
git revert b503dcd 6c1dd02 1723d14     # full code rollback, newest first
```

## 3. WHY — ADR-148 in three lines

Ingestion was purely time-driven and never asked whether normalization could keep up, so the
queue could grow without bound. Four duplicate local schedulers multiplied it against
production. The `refreshRunning`/`ingestRunning` guards are module-level booleans — they
serialize within one process and are blind across five (the ADR-099 condition).

**Shipped:** queue-aware admission with hysteresis (discovery + feed gated at 50k rows-behind;
**price updates and the refresh chain never gated**); `normalize-incremental --adaptive` so
normalization capacity follows the queue instead of a constant 6 batches; `--stores` scoping
so a per-store delta is attributable; a registry-coherence test.

## 4. BASELINE — measure the delta against these (2026-07-30 10:13 UTC, production)

| metric | value |
|---|---|
| canonicals with an approved-retailer offer | 6,912 |
| **comparable (≥2 approved retailers)** | **718** |
| comparable (≥3) | 166 |
| almanea in a comparison | 354 · jarir in a comparison | 121 |
| almanea backlog | 322,255 · jarir backlog | 44,172 |

Query: `scripts/tps-analysis/comparable-count.sql` — `price_history` → active `canonical_products`, store
resolved through a SQL transcription of `resolveApprovedSlug`, `count(distinct slug)`.
Reproduces ADR-147's 717 (718 with ingestion since), so it is the same instrument.

**ATTRIBUTION CAVEAT — binding.** The interval before ~11:29 UTC is **contaminated**: four
foreign writers were normalizing concurrently. Proof, not inference — **jarir's lag fell
43,756 → 39,756 (4,000 rows) during an interval when my drain was `--stores 5` and never
touched jarir.** Any delta spanning that window is an **upper bound**, exactly as ADR-147
had to say of its +78. A clean baseline must be re-taken after the drain completes.

## 4b. THE MEASURED RESULT — draining the backlog produced ZERO new comparisons

**121,866 almanea observations normalized (312,005 → 190,139 rows behind). Customer-visible
comparable: 718 → 718. Zero.** Same instrument, same query, 10:13 → 12:10 UTC.

| metric | 10:13 baseline | 12:10 | delta |
|---|---|---|---|
| **comparable (≥2 approved retailers)** | **718** | **718** | **0** |
| comparable (≥3) | 166 | 166 | 0 |
| canonicals with any approved offer | 6,912 | 6,916 | +4 |
| almanea in a comparison | 354 | 354 | 0 |
| price_history rows written since baseline | — | **315** | 0.26% of rows drained |

**This is a FOURTH outcome, and neither of us named it.** The framing was "comparisons rise
materially" / "they barely move" / (founder's addition) "they rise but cannot be attributed".
The actual result is that they did not move **at all**, so attribution never became the
question. **The ~370,000 observations were not hidden customer value; they were hidden
REPETITION** — re-observations of products already held, plus long-tail single-retailer
product. ~567 canonicals were written per pass, but `with_offer` rose by 4, which means they
were upserts onto existing identity keys, not new products.

**This CONFIRMS ADR-146's rejected hypothesis at 12× the scale.** ADR-146 measured 9,730 rows
→ +2 comparable (0.02%). This measured **121,866 rows → +0**. The premise that opened this
session — "370,000 observations already fetched and invisible to customers, the highest-value
action available" — **is disproven by its own execution.** The stock was in the building; it
was not stock anyone can sell.

**What the drain DID buy, honestly:** 315 fresh price observations (real, feeds price-truth
and verified drops) and a queue heading back under the backpressure threshold — which matters
because **discovery is now gated until total rows-behind < 20,000**, so the drain must finish
for catalogue growth to resume. That is why it is still running, not because comparisons are
expected.

**Do NOT re-run this experiment.** The conversion rate of backlog → comparison is now measured
twice, two orders of magnitude apart in sample size, and it is ~0.

## 4b-ii. IS THE REMAINING BACKLOG GROWTH OR HYGIENE? → **DIRECTIONAL ONLY**

**Measured half beats estimated whole.** 142,282 rows of almanea's backlog were processed
today and produced **0 new comparisons** — that half needs no estimate, it has a measurement.

**Classification of the REMAINING 166,973 rows: DIRECTIONAL ONLY.**

**What can be inferred:** the processed cohort is large (46% of the starting backlog), from the
same store, the same discovery process, and drained in id order today. Its conversion was 0
comparisons and 315 `price_history` rows (0.26%). The strong directional expectation is that
the remainder behaves the same — **near-zero new comparisons, some price refresh.**

**What cannot be inferred, and why a count would be false precision:** the cursor advances
**oldest-first**, so the remaining rows are *newer* observations. The cohorts are not fully
exchangeable — newer scrapes can contain more recently discovered products, and a small
non-zero yield cannot be excluded. Producing "expected new 2-store / 3+-store comparisons"
numbers would dress a directional inference as a forecast, which is the exact error ADR-143
recorded (a pool ceiling reported as a run forecast).

**Operationally, therefore: the backlog is HYGIENE, not growth** — with the honest caveat that
the remaining half is inferred, not measured. **Stop calling it "waiting customer value."** The
correct description is **unprocessed observations whose eventual customer value is unknown and
measured at ~0 for the half already done.**

## 4c. CONTENTION — PARTIALLY PROVEN, and mostly rejected as a throughput cause

| | interval A | interval B |
|---|---|---|
| window | 10:24:35 → 11:26:40 | 11:36:14 → 12:00:22 |
| writers | drain + **5** schedulers (4 local + Railway) | drain + Railway only |
| passes | 7 | 3 |
| rows processed | 70,000 | 30,000 |
| **rows/min** | **1,127.5** | **1,243.1** |
| min/pass | 8.87 | 8.04 |
| errors · retries · timeouts · lock waits | **0** | **0** |

**Removing four of five competing writers improved normalization throughput by +10.3%.**
Concurrent writers were unambiguously real — jarir's lag fell 3,750 rows during interval A
while the drain was `--stores 5` and never touched it — but **contention was NOT the dominant
constraint on throughput.** The dominant causes of the backlog were architectural: no
backpressure at all (purely time-driven fetch) and a constant 6-batch drain capacity far below
burst ingestion. **Classification: PARTIALLY PROVEN.**

**JARIR IS NOT A CLEAN CONTROL — do not treat it as one.** Its lag was clean for exactly one
window, runs 8–9 (11:26–11:44, 40,006 → 39,756, essentially flat). From ~11:50 Railway's
adaptive chain resumed normalizing it: 39,756 → 37,756 → 34,506. **Jarir's own drain has
therefore not been run and its delta is unmeasured.**

## 4c-i. ⚠️ MY ROUND-TRIP-LATENCY HYPOTHESIS IS **REFUTED** — read this before §4c-ii

§4c-ii below predicted that the Railway chain, co-located with the database, would be
**substantially faster** than the workstation drain if per-call latency were the limiter.
**It was measured. It is not.**

| runner | location | rows | elapsed | rows/min |
|---|---|---|---|---|
| manual drain | Saudi **workstation** (~265 ms RTT) | 10,000 | ~8.2 min | **1,220** |
| automatic chain | **Railway, co-located** (~1–5 ms RTT) | 10,000 | 8.38 min (12:45:51→12:54:14) | **1,193** |

**A ~50× difference in network round-trip time produced no throughput difference at all.**
Round-trip latency is therefore **excluded** as the dominant limiter, and the arithmetic in
§4c-ii — however neat — was wrong. Keep §4c-ii only as the record of a refuted hypothesis.

**What survives:** the limiter is something identical in both environments — **server-side
query/write cost** (staging upserts, canonical upserts, per-category corroboration queries) or
per-row client CPU across the 22 category plugins. Contention removal gave only +8.2%, so it is
**not** DB contention either; it is the intrinsic cost of the work.

**This strengthens the null hypothesis in §4c-ii's last paragraph.** Five candidate dominant
constraints have now failed: breadth, fetch reach, contention, delivery, and round-trip
latency. **The honest current position is that normalization costs ~8.3 minutes per 10,000
observations wherever it runs, and no single fix has been shown to change that.** Strategy
should assume many small costs, not one big unlock, until something beats that.

**Next diagnostic (unchanged entry point, now better targeted):** instrument elapsed ms around
each `await sb` in `corroboratePass` and around the per-row plugin loop in `normalizeSweep`,
behind an env flag, and run ONE batch. That separates server-side query cost from client CPU —
the only two candidates left. **Entry:** `scripts/tps-core/progressive-engine.ts`. **Safest
time:** after launch.

**Also measured in the same window:** the automatic chain drained **jarir 34,322 → 25,406**
(8,916 rows) and **almanea 166,473 → 151,057** unattended. It is working; it does not need a
human, which is why the manual drain was stopped.

## 4c-ii. RATE-LIMITER HYPOTHESIS — **REFUTED, see §4c-i.** Retained as the record.

Contention gave only +8.2%, so it is not dominant. The evidence points instead at
**per-call network round-trip latency against PostgREST**, with the call COUNT driven by
per-category corroboration.

**The arithmetic** *(repository + measured timings)*: a pass is 20 batches × 500 rows and takes
~8.2 min ⇒ **24.6 s per 500-row batch = 49 ms per row**, far too slow for in-process string
classification. Per batch the code issues ~5 REST calls in `normalizeSweep` (cursor read,
store probe, row fetch, cursor upsert, staging upsert) **plus `corroboratePass` for each of
the 22 registered categories at ~4 calls each** ⇒ **≈93+ HTTP round trips per batch**.
24.6 s ÷ 93 ≈ **265 ms per call** — precisely the latency of a Saudi workstation talking HTTPS
to Supabase. Everything else agrees: removing four competing writers moved throughput 8.2%
(so not server-bound), 0 lock waits, 1–2 active connections, 0 timeouts.

**The consequence that matters:** the manual drain ran from a **workstation**; the hourly chain
runs on **Railway, co-located with the database**. If round-trip latency is the limiter, the
automatic chain should be **substantially faster per unit time than the manual drain ever was**
— which would mean the manual drain was never the fast path. *(That is exactly what the
isolation window in §4f tests.)*

**NOT classified VERIFIED** because per-call latency was not directly instrumented.
**Next diagnostic, cheapest first:** (1) compare the Railway chain's rows/min against the
manual 1,220 — free, no code, in §4f; (2) if confirmatory, log elapsed ms around each `await sb`
in `corroboratePass` behind an env flag and run ONE batch; (3) the structural fix is to cut
calls, not to parallelise them — corroborate only categories with touched keys (already done)
and batch the per-category work into fewer round trips. **Entry point:**
`scripts/tps-core/progressive-engine.ts` `corroboratePass`. **Safest time:** after launch.

**A hypothesis worth holding open:** four explanations have now each failed to be dominant —
breadth, fetch reach, contention, and delivery. It is entirely possible **there is no single
dominant constraint** and throughput is a chain of single-digit-percent costs. The round-trip
finding above is the first candidate with arithmetic behind it, but it must beat that null
hypothesis before it becomes a rule. **Do not force a dominant constraint to exist.**

## 4d. COLLISION RISK — MODERATE, occurring, no degradation

Overlap between Railway's 20-batch adaptive chain and the manual drain is **ALREADY
OCCURRING** (proved by jarir's lag falling under a `--stores 5` drain). **No degradation of
any kind was measured:** 0 lock waits · 0 idle-in-transaction · 11 connections · `/api/stats`
200 in 1,646ms returning real data · 0 errors/retries/timeouts across the whole drain log ·
throughput up, not down. Classified **MODERATE** — occurring but benign — because ADR-099's
precedent is real and the lane had no cross-process guard.

**Mitigation applied (minimum, reversible):** the normalization **lane lease** (§3). Not the
full advisory-lock architecture — that stays deferred.

**§4.1 — is 20 the right value during AND after the drain?** **Yes to both, but only because
the lease now exists.** Without it, 20 during a manual drain was the risk worth mitigating;
with it, two normalizers can no longer overlap, so the steady-state value needs no separate
answer. **Leaving `--adaptive` at 20 active tonight.** If the lease itself proves troublesome,
`NORMALIZE_LANE_LOCK=0` restores the previous behaviour without reverting adaptive capacity.

## 4e. OPEN — backpressure is deployed but its live effect is NOT yet proven

Discovery runs fired at **12:00–12:07** (almanea 270 products, extra, jarir, amazon) *after*
the backpressure deploy, which looks like a gate failure. Best explanation, not certainty:
those came from **containers booted before the backpressure deploy** — Railway booted at
11:45:38, 11:48:39 and 12:12:11, and `INGEST_FIRST_DELAY_MS` is 20 min, so a ~11:40 boot fires
at ~12:00 and the 11:45:38 boot at ~12:05:38 (jarir ran 12:05:58). Deploy churn, not a bypass.

**Ruled out:** `scraping_schedules` is empty (0 rows), so the dispatcher is not a third
ingestion path; and there are **zero local scheduler processes**, so no duplicate writer was
recreated.

**VERIFY THIS FIRST NEXT SESSION.** Railway booted 12:12:11 on `b503dcd`, so its first ingest
window is ~12:32 with `rows_behind = 216,927` against a 50,000 gate. A watcher wrote the result
to `scratchpad/backpressure-verify.log`; if that file is gone, re-run:

```
npx tsx scripts/tps-analysis/q.ts "select id, store_name, job_type, status, started_at::text from scraping_runs where started_at > '2026-07-30 12:12' order by id"
```
**PASS** = no `discovery` runs while rows-behind > 50,000 (`price_update` runs are expected and
correct — they are deliberately never gated). **FAIL** = discovery runs present → the gate is
not wired on the live path; roll back with `INGEST_BACKPRESSURE_HIGH=0` and re-diagnose, since
a gate believed-on but actually off is worse than no gate.

## 5. LULU / SHARAF DG — and the registry defect behind them

`APPROVED_STORE_IDS` (display gate) and `TPS_STORES` (normalization work-list) are two
hand-maintained lists in different layers with **nothing enforcing agreement**. They disagree
on 14 of 24 stores.

- **Approved but NOT swept:** **lulu (23) 5,854 obs · sharafdg (24) 1,370 obs** — both
  ingesting live, both with **no cursor and 0 normalized observations**, so their products
  can never reach a canonical or a comparison. Plus **blackbox (10)**, approved but with zero
  observations ever (inactive, nothing to sweep).
- **Swept but not approved:** 11 stores (hdf, goldenstore99, mhzm, aletawik, pcpalace,
  sonyworld, amnkwm, alsfeerzone, alhowaish, alduaalbarq, eazyworld). **This direction is
  legitimate** — their listings corroborate identity without ever being displayed.
- **Why the ADR-147 lag report never showed them:** it iterates `tps_progress_cursors`, and a
  cursor only exists once a store has been swept. **A store outside `TPS_STORES` is
  structurally invisible to the metric built to catch this.** Not behind the queue — outside it.

**Shipped:** `tests/pipeline/retailer-registry-coherence.test.ts` fails on any approved store
absent from the sweep unless it is an explicit, reasoned `KNOWN_UNSWEPT` entry; a second test
fails if an exemption outlives its fix.

**DEFERRED — the actual fix, with acceptance criteria.** Add `{ id: 23, name: 'لولو هايبر ماركت' }`
and `{ id: 24, name: 'شرف دي جي' }` to `TPS_STORES` in `scripts/tps-core/category-registry.ts`
(both names already resolve through `NAME_TO_SLUG`), delete the two `KNOWN_UNSWEPT` entries,
run a scoped drain per store, measure. **Not done today** because the sweep divides its budget
among pending stores, so it would change almanea's drain rate *and* contaminate the attribution
being measured. **Acceptance:** both stores report a cursor and non-zero normalized
observations, the coherence test passes with a shorter gap list, comparable re-measured
before/after.

## 6. PERMANENT ARCHITECTURE — scoped, not built

Built today: backpressure, adaptive capacity, per-store scoping, registry invariant.
**Not built, with entry points:**

1. **A database-level writer lock** replacing the in-process booleans — a `pg_advisory_lock`
   around the refresh chain and each ingestion loop. *Acceptance:* two schedulers started
   simultaneously must produce exactly one running chain. *Entry:* `scheduler.js` `runRefresh`
   / `runDiscovery` / `runFeedIngest`.
2. **An explicit terminal state per observation** — today an observation is only ever
   "before the cursor" or "after it"; there is no *rejected-with-reason* or
   *deferred-with-retry*, so a row that no plugin detects is indistinguishable from one never
   reached. *Acceptance:* every `raw_observations` row resolves to processed / rejected(reason)
   / deferred(attempts), and the counts reconcile to the table total. *Entry:*
   `progressive-engine.ts` `normalizeSweep`. **This is the real closure of "no observation
   remains indefinitely invisible" — backpressure bounds the queue but does not classify it.**
3. **Backlog alerting before critical levels** — deliberately NOT done as a
   `tps_scheduler_heartbeat` schema change, because ADR-099's outage was triggered by
   DDL-driven PostgREST schema-cache reloads and launch is tomorrow. *Entry:* extend the
   heartbeat row with `rows_behind` after launch, or log-only until then.
4. **Cursor-before-staging ordering** (§2) — small, safe, do it when no drain is in flight.

---

# ═══ SUPERSEDED — 2026-07-30 CHECKPOINT #14 · DRAIN IN FLIGHT ═══

**A drain is RUNNING as this is written.** If the session ended, read §A before anything.

## A. RESUME THE DRAIN — it is cursor-based, so just re-run it

Normalization resumes from `tps_progress_cursors` (per store, `category='_all_'`). It does
**not** restart from the beginning. Safe resume, idempotent, run one at a time:

```
# almanea (store 5) — the big one
npx tsx scripts/tps-core/normalize-incremental.ts --batches 20 --limit 500 --stores 5
# then jarir (store 1)
npx tsx scripts/tps-core/normalize-incremental.ts --batches 20 --limit 500 --stores 1
```
Repeat until that store's `per-store lag` line disappears. ~10,000 observations per run,
~9 min per run.

**`--stores` is new this session** (`normalize-incremental.ts` → `runSweepUnit` →
`normalizeSweep`, optional `onlyStores`). Omitted = every store, so the scheduler chain and
a plain run are unchanged. It exists because the equal-share budget drains every lagging
store in one pass, which makes a per-store delta unattributable.

**Checkpoint at time of writing (2026-07-30 ~11:20 UTC):** almanea **252,339** behind
(from 322,255 at baseline) · jarir **~43,000** behind. Baseline metrics in §B.

**Known crash window (bounded, not yet hit):** `normalizeSweep` upserts the cursor
(`progressive-engine.ts` ~line 126) *before* the staging rows are upserted (~line 129). A
crash between the two advances the cursor past up to `limit` observations that were never
staged — they are skipped silently, not retried. Corroboration runs after that again, so a
crash there leaves staged keys uncorroborated until something re-touches them. Neither is
repaired by re-running; both need a deliberate cursor rewind. Worth fixing (write the
staging rows first, then the cursor) — not done, because it is a write to the engine while a
drain is in flight.

## B. BASELINE — measure the delta against these (2026-07-30 10:13 UTC, production)

| metric | value |
|---|---|
| canonicals with an approved-retailer offer | 6,912 |
| **comparable (≥2 approved retailers)** | **718** |
| comparable (≥3) | 166 |
| almanea in a comparison | 354 |
| jarir in a comparison | 121 |
| almanea backlog | 322,255 |
| jarir backlog | 44,172 |

Query: `scripts/tps-analysis/comparable-count.sql` — `price_history` → active `canonical_products`, store
resolved through a SQL transcription of `resolveApprovedSlug`, `count(distinct slug)`.
It reproduces ADR-147's 717 (718 with ingestion since), so it is the same instrument.

## C. TWO DEFECTS FOUND WHILE CHECKING CURSORS — both unfixed, both delivery holes

**C1. FOUR scheduler processes are running locally against PRODUCTION.** PIDs 2364, 13224,
13564, 7940 — `scripts/scheduler.js`, started 2026-07-29 09:57 / 12:02 / 12:08 / 12:15,
under `next dev` (:3000) and `next start` on :3021, :3022, :3023. Each one independently:
- runs the **full intelligence chain hourly**, whose FIRST step is
  `normalize-incremental --batches 6` across **all** stores;
- feed-ingests **almanea** every 6h (`INGEST_FEED_STORES`);
- scraper-ingests **noon, lulu, sharafdg, extra** every 12h, price-updates every 6h.

The `refreshRunning` / `ingestRunning` / `feedIngestRunning` guards are **per-process module
state** — they do not coordinate across four processes. So up to four concurrent refresh
chains and four concurrent almanea feed ingests are possible. **This is exactly the ADR-099
condition that wedged PostgREST**, and it is the most plausible reason almanea's backlog
reached 320k in the first place: it is being ingested ~4× and normalized under contention.
**Confirmed live in the drain log** — the aggregate backlog fell ~11,250 in a pass where my
almanea-only run cleared 10,250, so jarir drained ~1,000 concurrently from another writer.
**Consequence for this measurement:** the per-store attribution is contaminated. The almanea
delta will contain some jarir progress made by the schedulers. Report it as an upper bound,
not a clean attribution — the same honesty ADR-147 applied to the +78.

**C2. LuLu (23) and Sharaf DG (24) are outside the normalization queue entirely.** 7,204 raw
observations, ingesting live (LuLu's newest was 3 minutes before I looked), both in
`APPROVED_STORE_IDS` so their offers would be customer-visible — but neither is in
`TPS_STORES` (`category-registry.ts`), so neither has a cursor. They are not *behind*; they
are *absent*. This is why they never appeared in the per-store lag report ADR-147 added:
**the lag metric only reports stores it already knows about.** Same class as the 370k
finding, one layer further out. Fix is two entries in `TPS_STORES`; deliberately deferred so
it does not confound the almanea/jarir deltas, and it needs its own before/after.

## D. Process facts

Task `buj626g5m` (the drain loop) is **orphaned but alive** — its spawning shell (PID 12468)
has exited and the loop survived, so it does not depend on any shell. Whether it survives
`claude.exe` (PID 8668) exiting is **not** established; Claude Code background tasks are
session-scoped by design. Assume it dies with the session and resume via §A.

**Untouched this session:** launch B, gate 112/112, no customer-facing code. Suite 752/752
green after the `--stores` change.

---

# ═══ RESUME HERE — 2026-07-30 CHECKPOINT #13 · DRAIN FIRST (supersedes below) ═══

**Read this, then ADR-147 and ADR-146.** State: commit `6461207` · 752/752 green · tree
clean · **launch B, gate 112/112, untouched — no customer-facing code changed today.**

---

## 1. NEXT SESSION'S FIRST ACTION — do this before anything else

**Drain almanea (320,386 rows behind), then jarir (49,338).** Measure the
customer-visible comparable delta after each and report both numbers.

```
npx tsx scripts/tps-core/normalize-incremental.ts --batches 20 --limit 500
```
Repeat until `per-store lag` prints `all stores current`. Throughput is now ~3,000
observations per 6-batch run, so this is cheap. **Do not start new fetching first.**

---

## 2. THE PRIMARY FINDING — bigger than the experiment that uncovered it

**~370,000 observations are already fetched, already paid for, and invisible to
customers** — almanea 320,386 · jarir 49,338 — hidden for an unknown period behind a
backlog metric that was wrong by ~34,000× (it reported `0 → 11`).

**Draining them is the highest-value immediate action and it is cheap.** No fetching, no
credentials, no new retailer. The stock is already in the building.

---

## 3. ADR-146 — **PROVEN**

Overlap-seeded discovery converts fetch into comparisons roughly **15×** more efficiently
than blind traversal:

| | seeded | blind |
|---|---|---|
| fetched products per new comparison | **~7.7** | ~120 |
| orphan (single-retailer) products created | **1** | 592 of 743 |

Comparable **660 → 717** · 3+ store **152 → 166** · Noon-comparable **181 → 259**.

**Attribution, stated honestly:** the traceable **99** identity keys are the seeded run's
own share; **+78** is the window's upper bound (it also contains blind-run Noon rows that
were in the backlog). Both agree within an order of magnitude.

---

## 4. NEW VERIFIED RULES — replacing what ADR-145/146/147 retired

- **Overlap-seeded discovery, never blind traversal.** Blind traversal produced ~80%
  orphans and inflated the catalogue without creating comparisons.
- **Delivery, not fetch, was the constraint.** Every deeper fetch this week made the
  backlog worse rather than better.
- **A retailer-value figure measured through a pipeline that does not deliver is
  meaningless.** alnakheelk 68 · najm 48 · sonyworld 0 · Samsung +7 all require
  re-measuring **after** the drain.
- **Per-store lag is the health metric.** Aggregate backlog hid a 370k failure.

---

## 5. WHERE MY ANALYSIS WAS WRONG — recorded because it should be

**The founder's instinct was right and mine was not.** Three days ago he said the next
phase was more products inside the retailers we already had, not more retailers. That was
correct, and the reason is now measured: ~370,000 observations were already sitting in
Almanea and Jarir, undelivered.

My error was analytical and I repeated it for three days: **I diagnosed fetch four times
in a row — reach, then targeting, then Samsung, then Noon — and never measured delivery
until the experiment could not be read.** Each diagnosis was defensible on the evidence I
had chosen to gather, and each pointed at the wrong layer. I also published a fetch-reach
ADR (145) whose Extra row was a measurement artifact, and quoted a backlog metric all week
without checking what it asked.

**Accuracy note for the record:** the founder *directed* the Samsung/Noon/SWSG work in the
2026-07-30 directive, so that sequencing was jointly chosen — but he had named depth over
breadth first, and the correcting question ("may be under-measured rather than
under-fetched") was also his. The failure to test delivery was mine.

---

## 6. What shipped today (ADR-147)

- **Throughput ~7×** — sweep budget now divides among stores that actually have pending
  work, not all 18. Was 84% wasted on empty stores.
- **Delivery guarantee** — per-store lag printed on every run.
- **Backlog metric corrected** — now the sum of per-store lag, not "newer than the newest
  row any store staged".
- **ECONNRESET fixed** — short-lived pg connections.
- **RETIRED:** every backlog figure from this session and checkpoints #11–#12
  (7,388 / 11,499 / 11,725). Wrong definition; do not cite.

---

# ═══ RESUME HERE — 2026-07-30 CHECKPOINT #12 · ADR-146 INCONCLUSIVE, REAL CONSTRAINT FOUND ═══

**Read this, then ADR-146 (addendum + final classification).**
Launch: **B**, gate 112/112, untouched.

## SAFETY FIRST — nothing was paused, ingestion is live

`scraping_schedules` is **EMPTY**, so the proposed "pause Noon" would have been a no-op.
Attribution came from a naturally clean write window instead. **Ingestion verified live
after all experiment activity:** 113 raw rows in 15 minutes across 2 stores, newest write
**11:29:20**, successful `scraping_runs` 12–14 min prior. **No restoration was required.**

## ADR-146 = **INCONCLUSIVE** (not rejected, not proven)

| stage | count |
|---|---|
| seeds attempted | 250 |
| seeds hit at Noon | **228 (91.2%)** |
| hits fetched | 600 |
| **raw_observations written** | **600** (was **0** in run 1) |
| storefront writes | 598 |
| — **linked to a product we already held** | **597** |
| — created new | **1** |
| **staged for identity** | **0** |
| **new comparisons** | **0 measurable** |

**597 linked / 1 orphan.** Blind traversal of the same retailer produced **592 orphans out
of 743**. That is a **discovery** result and must not be reported as a comparison result.

## THE REAL CONSTRAINT — normalization cannot keep pace with ingestion

*(production)*
- One `--batches 20 --limit 500` pass processed **1,380 observations** while the backlog
  went **11,499 → 11,725 in the same pass.**
- Backlog all session: 7,388 → 7,596 → 7,674 → 7,863 → 11,499 → 11,725, monotonically up.
- **None of the 600 seeded observations reached staging** (ids 641,161–641,760, staged = 0).

*(repository)* **The queue model is wrong.** `runSweepUnit` sweeps **by category
definition**, not id order. The "backlog" metric (`id > max(raw_obs_id)`) is a **proxy, not
a queue position** — an ingested observation has **no bounded time-to-normalization.**

**This outranks both ADR-145 (fetch reach) and ADR-146 (fetch targeting).** Every fetch
strategy writes into a layer with no delivery guarantee.

## Dead hypotheses from this session

- *"Scheduler contamination ruined run 1"* — **mine, wrong.** The 07:54–08:17 writes were my
  own blind run; Noon's last scheduler run was 09:21:58, before the seeded run began.
- *"The seeded run just needs draining to read"* — **wrong.** It wrote **0**
  `raw_observations`; `createOrUpdateProduct` writes only the storefront layer.
- *"The backlog drains in id order"* — **wrong.** Category sweep.

## NEXT ENGINEERING HOUR — not what any prior checkpoint said

**Not** more retailers · **not** `max_pages` · **not** seeded-discovery rollout.

**Normalization throughput and delivery guarantee:** why a pass stages only 298 of 1,380
processed, why sweeps are category-bound rather than backlog-bound, and what guarantees an
ingested observation reaches identity within a bounded time. Until that exists **no
ingestion experiment on this platform can be measured end to end** — which is the wall this
one hit.

Then, and only then, re-read ADR-146 by re-running `seeded-discovery.ts noon --go` (the
script is correct now) and measuring the same waterfall.

## Standing follow-through

Run-level attribution — `scraping_run_id` mandatory on every write path, `product_stores`
stamped with it — remains the permanent fix. Two sessions running have spent their time on
attribution rather than on the result.

---

# ═══ RESUME HERE — 2026-07-30 CHECKPOINT #11 · SEEDED RUN EXECUTED, NOT YET READABLE ═══

**Read this, then ADR-146.** Launch unchanged: **B**, gate 112/112.

## The ADR-146 experiment was RUN. Its input metrics are strong; its output is unmeasured.

`scripts/tps-analysis/seeded-discovery.ts` — overlap-seeded discovery. Seeds each query
from a canonical we already hold from exactly ONE retailer, whose brand the target retailer
stocks, and which that retailer does not already supply. Reuses
`productService.createOrUpdateProduct`, so identity, validation and dedup are unchanged —
**only the seed differs from blind traversal.**

**Run: `noon --go --targets=250 --hits=3`**

```
targets 250 · queried 250 · hit rate 91.2% · 22 targets with no hit
601 hits fetched · 599 written · 418 LINKED · 181 created · 2 errors
```

**418 of 599 writes linked to products we already held.** Blind traversal produced the
opposite profile: 80% Noon-alone rows.

## WHY THE RESULT IS NOT READABLE YET — do not quote +6

| | before run | now |
|---|---|---|
| Noon-comparable | 175 | 181 |
| Noon-alone | 638 | 753 |
| all comparable | 656 | 660 |

**Two confounds, both mine:**

1. **~7,270 observations unnormalized.** The seeded run's products sit at the BACK of that
   queue. Comparisons only appear after normalization, so the +6 largely measures the
   queue *ahead* of them.
2. **The PM2 scheduler ingested Noon concurrently.** Noon storefront offers rose +3,083
   while this run could write at most 750 — so most of the +115 Noon-alone is *scheduler
   blind traversal*, not the seeded run. **I ran a heavy writer alongside the scheduler,
   which ADR-099 explicitly warns against, and it cost the experiment its attribution.**

Quoting +6 would repeat the exact error this investigation exists to correct.

## TO READ IT — a clean 90-minute experiment

1. **Pause the PM2 scheduler** (this is the step that was missing).
2. Baseline: Noon-comparable (was **175** at 09:30).
3. `tsx scripts/tps-analysis/seeded-discovery.ts noon --go --targets=250`
4. Drain the backlog to <50 (`normalize-incremental`, ~140 rows/pass, ~90s each).
5. Re-measure Noon-comparable. **Compare cost-per-comparison against the blind baseline of
   ~120 fetched products per new comparison.**

## What the run already tells us, independent of the confound

*(production)* **91.2% of seeded queries found the product at Noon**, and **70% of writes
linked to an existing product** rather than creating a new one. Blind traversal on the same
retailer created 592 Noon-alone canonicals out of 743. The seeds are hitting the right
products; what is unproven is how many survive normalization into comparisons.

## Standing caution added today

**Never run a heavy ingest or normalize alongside the scheduler** — ADR-099 said so and I
did it anyway. Any measurement taken during scheduler activity is confounded by
construction.

---

# ═══ RESUME HERE — 2026-07-30 CHECKPOINT #10 · AIM THE CRAWLER (supersedes below) ═══

**Read this, then ADR-146, ADR-145, and
`docs/HISTORICAL-MEASUREMENT-REVALIDATION-2026-07-30.md`.**

## Launch: **B**, unchanged. Gate 112/112. No customer-facing integrity defect found.

## THE CONSTRAINT — fetch TARGETING, not fetch volume (ADR-146)

Three interventions measured on the same system, same day:

| intervention | input | new comparable | cost each |
|---|---|---|---|
| Noon blind fetch | +5,644 products | **+47** | ~120 products |
| Backlog drain | 9,730 rows | **+2** | ~4,865 rows |
| Samsung onboarding | 111 products | +7 | ~16 products |

**Noon's 6,736 products → 743 canonicals, of which 592 are NOON-ALONE.** 80% of a large,
successful fetch produced single-retailer rows. We discover by **category traversal**,
which returns whatever a retailer lists; most of it is product nobody else carries.

**The fix: seed discovery from our OWN catalogue.** 2,674 of our 5,854 single-store
canonicals carry a brand Noon also stocks — each one retailer away from a comparison.
`noon-scraper` already has a keyed lookup (`?q=sku&limit=1`) used **only** for price
refresh, while discovery uses blind `scrapeApiPage(categoryQuery, page)`. The capability
exists and is unused. **Effect not claimed — prove with a bounded run.**

**Framework defaults (`max_pages`) DEFERRED, not rejected** — raising them multiplies blind
traversal, which multiplies single-store rows. Aim first, then raise.

## MEASUREMENT DEFECT — found inside my own 2-hour-old ADR

`raw_observations.payload` **has a different shape per retailer**. ADR-145 counted with one
key. Corrected: **extra 36 → 5,248** (one of our deepest, not shallowest); almanea
7,737 → 8,147. ADR-145's core conclusion survives; that row is withdrawn in place.

**RULE:** any cross-retailer measurement over `payload` must resolve identity **per
retailer** (`product_url` / `url` / `rewrite_url` / `objectID` / `uniqueId` / `sku` / `id`).

## Rates retired this session — all were small-sample

- **"58% overlap rate"** (mine, n=24 Samsung) → Noon's real rate is **20%**. Not a constant.
- **"12.6% conversion"** (mine) → wrong denominator.
- **"sonyworld = 0"** → a 236-product fetch. **RETIRED outright.**

## Historical record — see the revalidation doc

**VERIFIED:** Samsung +7 · Noon +47 · 637 comparable · 146 at ≥3 · 363 drops · 71% · 78
corroborated · 112/112.
**UNCERTAIN (quote only with fetch reach attached):** alnakheelk 68 · najm 48 · 127 UCP
families · 88 new · ADR-133 trigram.
**RETIRED:** sonyworld 0 · the 58% constant.

## Fetch reach, corrected

almanea 8,147 · noon 6,736 · amazon 6,693 · **extra 5,248** · jarir 3,266 · shaker 684 ·
najm 606 · alnakheelk 600 · swsg 276 · sonyworld 236 · samsung_ksa 60

## Next, in order

1. **Bounded overlap-seeded discovery run on Noon** against the 2,674 target pool. Measure
   cost-per-comparison against the ~120 blind baseline. This is the whole thesis of
   ADR-146 and it is unproven.
2. If it wins, generalise seeded discovery into the framework, **then** raise `max_pages`.
3. Fix `swsg` (276 products, never deepened) and `sonyworld` (236) reach before re-judging
   either.
4. Brand-only query routing (`سامسونج` / `samsung` reach only mobile).

## Operating rule

**No retailer-value figure may be quoted without the fetch reach it was computed over.**
That omission is exactly how sonyworld = 0 became a strategic rule.

---

# ═══ RESUME HERE — 2026-07-30 CHECKPOINT #9 · FETCH REACH (supersedes below) ═══

**Read this, then `ADR-145` and `docs/PREDICTION-VS-PRODUCTION-2026-07-30.md`.**

## Launch: **B**, unchanged. Gate 112/112. Nothing here blocks 1 August.

The 112 set **does** include the exact-model / exact-variant / Arabic / Arabic-Indic /
mixed-script queries added after the "100% while `ايفون 16 برو ماكس 256` returned one
store" correction — 32 of the 112 journeys are that set, and they score 32/32 on both
product and variant.

## THE FINDING — fetch reach is the binding constraint (ADR-145)

**Distinct products ever fetched, per retailer** *(production; counted on
`payload->>'product_url'` because `raw_url` and `external_product_id` are NULL almost
everywhere)*:

almanea 7,736 · amazon 6,693 · jarir 3,266 · **noon 1,092** · shaker 684 · najm 606 ·
alnakheelk 600 · swsg 276 · **sonyworld 236** · samsung_ksa 60 · **extra 36**

A **~200× spread**, caused by **our own configuration**:
- `scraping-orchestrator.ts` → `options.max_pages || 10`
- `noon-scraper` → `maxPages × limit=50` per category query
- `samsung-ksa-scraper` → `maxPages * 12`
- `extra-scraper` → `maxPages * EXTRA_SITEMAP_DISCOVERY_LIMIT`

## VALIDATED BY INTERVENTION, not inference

Noon re-ingested at `--pages=30`. No parser change, no identity change, no new retailer.

| | before | after |
|---|---|---|
| Noon distinct products | 1,092 | **6,736** (6.2×) |
| comparable (≥2) | 588 | **635** (+47) |
| comparable (≥3) | 141 | **146** |

**+47 from ONE retailer at ~10% normalized** vs **+7** from Samsung's complete run.
9,429 observations still in backlog (~100 min to drain at ~140/run). **Do not extrapolate**
— direction and order of magnitude only.

## Numbers now SUSPECT — do not reuse without re-measuring at known reach

**sonyworld = 0** (from a 236-product fetch — NOT evidence Sony World lacks overlap) ·
alnakheelk 68 · najm 48 · the 127 UCP shared families · the 88 "new" ·
ADR-133's "matching is marginal" (true of our ingested catalogue; **not** a market claim).

## Numbers that SURVIVE — they describe what we hold, not the market

635 comparable · 146 at ≥3 · 363 verified drops · 71% inflated · 78 model-corroborated ·
112/112 gate.

## THE SIZING RULE (ADR-145)

```
new comparisons ≈ (canonicals we can ingest) × (overlap rate ≈ 58%) × (share single-store)
```
Ubiquity sets the ceiling; **reach sets the result**. A retailer-value number without its
fetch reach beside it is a crawler measurement.

**RETIRED:** "predicted overlap is the only onboarding criterion."
**REPLACES IT:** bounded run → measure actual → decide.

## Next, in order — highest leverage first

1. **Drain the 9,429 backlog**, then re-measure Noon's true delta.
2. **Same intervention on almanea, jarir, extra, amazon** — reach, not parsers.
3. **Raise the framework defaults** (`max_pages`, the per-scraper multipliers) so reach is
   not a per-run flag. This is the architectural fix; the runs above are the proof.
4. `extra` fetches 36 distinct URLs from 50,051 rows — its payload lacks `product_url`.
   Investigate separately; it may be under-measured rather than under-fetched.
5. Brand-only query routing (`سامسونج` / `samsung` reach only mobile).

---

# ═══ RESUME HERE — 2026-07-30 CHECKPOINT #8 · PREDICTION METHODOLOGY (supersedes below) ═══

**Read this, then `docs/PREDICTION-VS-PRODUCTION-2026-07-30.md`.**

## Launch: unchanged, **B**. Gate 112/112. Nothing here blocks launch.

## The +281 → 7 miss, resolved

**The probe was never involved.** `feed-overlap-probe.ts` was NOT run for Samsung; the
+281 was my own SQL over single-store Samsung canonicals. The miss is not evidence against
the probe.

**Trace:** 281 pool ceiling → **111 fetched** (capped at `maxPages × 12` per category) → 96
written to storefront → 42 offers → **24 TPS canonicals** → 14 overlapping → **7 newly
comparable** + 7 deepened.

**The dominant loss is FETCH REACH, not overlap.**

## Three hypotheses died, two of them mine

1. *"Samsung KSA has little overlap"* → **58%** of ingested Samsung canonicals (14/24)
   found another retailer. Overlap was never the failing stage.
2. *My "~12.6% conversion"* → I divided by products FETCHED (111) instead of canonicals
   that entered TPS (24). Real rate **58%**. I understated it 4.6× and would have
   mis-sized Noon and SWSG downward.
3. *My "473 pending rows are a pipeline leak"* → **614,692 of ~615,000 rows are `pending`
   and only 277 have ever been `done`.** `normalize-incremental` uses a **watermark on row
   id**, never `processing_status` or `raw_url`. The column is vestigial. No leak.

**Consequence:** any measurement counting `distinct raw_url` is unsound — `raw_url` is NULL
on 83% of rows. The earlier "11,259 distinct raw listings / 8,286 unnormalized" figures are
retired. Do not reuse them.

## THE RULE — use this to size every future retailer

```
new comparisons ≈ (canonicals we can actually ingest) × (overlap rate) × (share single-store)
```

Brand ubiquity sets the **ceiling**; ingest reach sets the **result**. Sony 11 canonicals →
0. Samsung 437 → 7 from a 111-product sample. Measured overlap rate to date: **58%**.

**And: a prediction must name its stage** — pool ceiling · fetchable · ingestible ·
overlapping · newly comparable. The +281 was a pool ceiling reported as a run forecast.

## Founder's premium-tier hypothesis — rejected as stated, unresolved underneath

The 10 non-overlapping Samsung products are **9 audio devices** (soundbars HW-Q800F/D,
HW-Q930F, HW-Q990F, HW-S800D, HW-T400, Galaxy Buds) + 1 dishwasher. One CATEGORY, not one
tier. Zero Samsung `HW-Q*` rows exist for any other retailer, so it is **not** an identity
failure. Whether Extra/Almanea don't stock them, or our audio ingestion there is too
shallow, is **UNRESOLVED** — the external check was inconclusive (JS-rendered search).

## Noon audit — DONE. Limiting factor: **discovery depth**

3,182 raw observations · scraped 29 July · 618 storefront offers · 314 TPS canonicals.
The pipeline works; it is shallow. **Not** parser loss, identity rejection, duplicate
suppression or blocked endpoints. No parser work increases Noon; only fetching more does.

## Next, in order

1. **Bounded Noon deepening** — measure its overlap rate on a small run before investing.
   Expecting it to beat 58% is an expectation, not a measurement.
2. **SWSG** — AC pool 1,006.
3. **Brand-only query routing** (`سامسونج` / `samsung` reach only mobile today).
4. **Bilingual token-parity test** — 3 defects of that class in 4 days.

---

# ═══ RESUME HERE — 2026-07-30 CHECKPOINT #7 · SAMSUNG BUILT (supersedes below) ═══

**Read this, then `docs/LAUNCH-CHECKLIST-2026-07-30.md` (rev 2).**

## Decision: still **B** — launch as the price-truth layer

Samsung did NOT move it to A. The deciding number is **comparable share 9.6%** (588 of
6,103); Samsung moved it +0.1 points.

## Gate — `docs/ui-journey-2026-07-30-final.log`

**overall 112/112 = 100% · comparison 82/82 = 100% · Arabic 72/72 · English 40/40 ·
exact-model 32/32 product AND variant · zero failures · zero unhonoured store claims.**

## Samsung KSA: predicted +281, ACTUAL +7

581 → 588 comparable (2+), 135 → 141 (3+), 14 canonicals involve Samsung.

**The connector already existed and had never run at scale** — 362 raw rows with
`raw_url` / `name` / `price` all NULL and status `pending`. This was not a build; it was
a run. Validate before investing: samsung.com/sa does publish prices in JSON-LD, a dry
run returned 11 products with 0 errors, and only then did I spend a live run.

**MEASURED CONVERSION: ~12.6%** of ingested products become comparison members. Size Noon
and SWSG with THAT, not with a single-store-canonical ceiling. Samsung's full catalogue is
worth roughly +50–60, not +281. My +281 was a ceiling reported as a forecast — that was
the error, and it is the reusable lesson.

Samsung landed on **dishwasher, TV, audio** — not phones. A bare `سامسونج` query routes
only to mobile, so it cannot see them; `تلفزيون سامسونج` and `سماعات سامسونج` do.
**Brand-only query routing is an open gap.**

## ADR-144 — a store count corrected DOWNWARD

`غسالة صحون` rendered "اكسترا, شاكر, 7, المنيع, سامسونج السعودية" — and **7 IS شاكر**.
`searchTPSCanonical` keyed on the raw `price_history.store_name`, which production writes
both as a display name and as a numeric id: two keys, one shop. Now keyed on the resolved
slug — the card honestly shows **4**, and a raw store id can no longer reach a customer.
Some cards will show fewer stores than before. That is the number becoming correct.

## Next, in order

1. **Noon** — the only untouched retailer spanning every scope; single-store pools
   mobile 481 / audio 529 / laptop 423. **This is what could move B → A.** Audit the
   809-URL cause first (shallow discovery / pagination / traversal / blocked endpoints /
   parser loss / duplicate suppression / identity rejection / stale URLs).
2. **SWSG** — AC pool 1,006, the largest single-category pool we hold.
3. **Brand-only query routing** — `سامسونج` / `samsung` should reach every category.
4. **Bilingual token-parity test** — three defects of that class in four days
   (ة/ى folding · برو/pro · جالكسي/galaxy). No systematic guard exists.

## Capacity rule

One full harness run per session, at the end. Probes for everything else. This session:
one run, plus one discarded (`ERR_INTERNET_DISCONNECTED` on every request — a local
connectivity drop, deleted rather than filed, because a dead reading is not a measurement).

---

# HANDOVER — جرد حالة العمل

> **نطاق هذا الجرد (صراحةً):** قرأتُ فعليًا وبالكامل الملفات الـ45 داخل `scripts/tps-analysis/` — وهي مجلد المخرجات/الأدوات التحليلية التي أنتجتها الجلسات السابقة. **لم أقرأ** بقية المستودع (كود التطبيق `src/`، مجلد `docs/`، `mobile/`، `scripts/tps-core`، `scripts/tps-plugins`، ملفات الإعداد) ملفًا-ملفًا — قراءة آلاف الملفات غير ممكنة في جلسة واحدة، وادّعاء ذلك سيكون غير أمين. حيث أشير إلى ملف خارج `scripts/tps-analysis/` فذلك **استنتاج** من استيرادات الكود أو من الذاكرة، وسأضع عليه علامة "لم أقرأه".
>
> التاريخ المرجعي: 2026-07-28. مصدر التواريخ/الأحجام: نظام الملفات (`ls`).

---

# ═══ RESUME HERE — 2026-07-30 CHECKPOINT #6 · LAUNCH REVIEW (supersedes below) ═══

**Working state. Read this, then `docs/LAUNCH-CHECKLIST-2026-07-30.md`.**

## Launch recommendation: **B — launch as the price-truth layer, narrower promise**

Full reasoning, every figure with its query, and the must-not-claim list are in
`docs/LAUNCH-CHECKLIST-2026-07-30.md`. Public launch status unchanged; announcement is
founder-gated.

## Gate — corrected instrument

`docs/ui-journey-2026-07-30-launch-baseline.log`

| dimension | value |
|---|---|
| overall | **108/112 = 96.4%** |
| comparison | **82/82 = 100%** |
| Arabic | 72/72 = 100% |
| English | 36/40 = 90% |
| exact-model correct product | 32/32 |
| exact-model correct variant | 28/32 |

**The headline fell 100% → 96.4%, predicted in advance**, then returned to 100% once the
defect it exposed was fixed. All 4 failures were `Galaxy S24 Ultra 512` (ADR-142).

**CONFIRMATION RUN — `docs/ui-journey-2026-07-30-post-adr142.log`:**
**overall 112/112 = 100% · comparison 82/82 = 100% · Arabic 72/72 · English 40/40 ·
exact-model 32/32 product AND 32/32 variant · zero failures.**
Nothing in the launch checklist is inferred any more.

## Three bilingual-asymmetry defects in three days — the class is not exhausted

1. ة/ى folding → appliance expansions never fired
2. برو / pro → Arabic flagship queries lost their comparison (ADR-141)
3. جالكسي / galaxy → relevance never enforced on an English brand query (ADR-142)

Each was one token present in one script and missing in the other. **There is still no
systematic test that every Arabic token has its Latin twin.** That test is the highest-value
next instrument item.

## Headline iPhone journey (§2) — diagnosed, root cause is ingestion

`apple|iPhone|16|Pro Max|256`: Jarir 3,599 (observed 3 Jul) · Extra 3,704 (1 Jul) ·
Almanea 4,749 (25 Jul). **Amazon and Noon: zero raw listings.** Not search, not joining —
never ingested. Arabic and English now return identical coverage.

## Shipped today

- Exact-model harness set (AR/EN/Arabic-Indic/mixed), per-script reporting, both surfaces
- **Price age disclosed** on every compare offer — 13.6% of offers are >30 days old and were
  shown as current
- Accessories **excluded** from homepage deals and `/price-truth`; savings floor 50 SAR
- `/price-truth` headline corrected 166 → **78** (88 were accessories; `total` was also a
  `.limit(300)` page-size artifact, now an exact count)
- §9 **verified**: the 85,000 / 8 / 62,000 figures are gone from the rendered homepage

## Next, in order

1. **Re-run the harness** — close the one inferred number.
2. **Samsung KSA ingestion** (+281 ceiling), **Noon depth** (809 URLs), **SWSG** (AC pool
   1,006). All three NOT STARTED; they are what turns promise B into promise A.
3. Bilingual token-parity test.

---

# ═══ SUPERSEDED — CHECKPOINT #5 ═══

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
