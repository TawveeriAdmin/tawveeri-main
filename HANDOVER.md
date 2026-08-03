# ═══ RESUME HERE — 2026-08-02 CHECKPOINT #42 · UNIT C REJECTED ON EVIDENCE · SESSION CLOSED ═══

**Tree clean · pushed · NO product change made.** `AI_ASSISTANT_ENABLED` = ON, untouched.

## UNIT C — HYPOTHESIS REJECTED. NO CODE SHIPPED.

### §0 — the instrument was ruled out FIRST, and it was not the cause

The previous check used puppeteer with `setExtraHTTPHeaders({'Accept-Language':'ar-SA'})` — a real
browser, but **`navigator.language` stayed `en-US`**, and many sites branch on the JS value rather
than the header. That gap could have produced the entire finding.

Re-verified with the **full** Arabic profile — header **and** `navigator.language` **and**
`navigator.languages` **and** `--lang=ar-SA`, mobile 390×844, on five live production exits:

| | header-only | full-arabic |
|---|---|---|
| Jarir ×3 · Extra · (5 exits) | `lang=en dir=ltr`, 0–1% Arabic | **identical** |
| redirect occurred | none | **none** |

**The two runs do not differ.** The `DIFFERENT? true` flags were 200-vs-304 cache revalidation and
a 1%→0% character-ratio wobble, not a locale change. **The instrument was not producing the
finding — the retailers genuinely serve English.**

### §1 — but the fix is measurably worse than the defect

Tested the obvious transform on the same live exits:

| retailer | swap | result |
|---|---|---|
| Jarir ×3 | `/sa-en/` → `/sa-ar/`, same slug | **404** → `/page-not-found` |
| Extra | `/en-sa/` → `/ar-sa/`, same path | **404** |

**Jarir and Extra use different slugs per locale.** The Arabic page exists at an address the
transform cannot derive. The obvious fix would have turned a working English exit into a dead end
on every case tested.

### Classification, per the brief

| category | verdict |
|---|---|
| broken link | **No** — 200, real product pages |
| wrong product | **No** — correct product |
| **language-mismatched but working** | **YES — this is the whole finding** |
| acceptable retailer-controlled locale behaviour | **Yes**, given no derivable Arabic equivalent |

**DECISION: reject the hypothesis as a defect worth fixing. No product change.** A working
product page in English is minor friction; a 404 is a dead end, and P3 rates those very
differently. Preserving a working link outranks perfecting a language.

**Also not done, deliberately:** an "opens in English" notice. That is new customer copy governed
by LAUNCH_VOCABULARY, it would assert retailer behaviour measured on only 5 exits, and it adds
friction to every exit for a minor issue.

### If it is ever revisited — scoped, NOT started

**Unit C′ — Arabic destination resolution.** Not a URL transform; per-product slug resolution
against each retailer's catalogue, plus threading locale into `/go` (which is locale-independent
by design today, and skipped by middleware). **Acceptance criteria:** every rewritten URL resolves
**200** to the **same product** before it is ever rendered · affiliate query params preserved
verbatim · a retailer with no derivable Arabic equivalent keeps its working English link ·
verified per retailer, Arabic and English separately, mobile first. **This is a new unit, not a
small fix** — exactly the §2 boundary.

## NEW VERIFIED RULES — both recorded in `docs/ENGINEERING-RULES.md`

1. **An HTTP header is not a locale.** `Accept-Language` alone does not simulate a shopper;
   `navigator.language`/`languages` must be overridden too, and the two runs compared separately.
2. **A working link outranks a perfect language.** Never rewrite a merchant URL without resolving
   the rewritten URL first.

## PRODUCTION STATE AT CLOSE

Units A and B remain shipped and verified — homepage `direct=0 · go=3 · compare=1 · needChips=1`
in both locales. unified-search **54/54** · shell-verify **40/40** · adversarial **23/23** ·
must-pass **4/4** · **0 unavailable** · tests **1,114/1,114**.

**Known-stale gate assertion, unchanged:** `validator-verify` asserts `/api/ai-assistant` → 404;
it returns **200 by founder decision**. Flipping a safety assertion deserves its own boundary.

## ROLLBACK

```
4d9e34f  Unit C — rules only, no product change   git revert 4d9e34f
ba0992e  CHECKPOINT #41 docs                      git revert ba0992e
e0fd005  search import fix   (only WITH ae23976)  git revert e0fd005
ae23976  Unit B affordance                        git revert ae23976
ac6a402  Unit A exits                             git revert ac6a402
```

---

# ═══ SUPERSEDED — 2026-08-02 CHECKPOINT #41 · UNIT A + UNIT B SHIPPED ═══

**Tree clean · pushed · both units verified in production.** ADR-170 (A) · ADR-171 (B).
**`AI_ASSISTANT_ENABLED` = ON, untouched.**

## ⚠ `docs/TAWVEERI_MASTER_BOOK.md` STILL DOES NOT EXIST

Verified again after `git pull`. I did not read it and did not create it. Unit B was decided on
the Ch. 5/9/11 constraints the founder transcribed into the brief plus
`docs/CONSUMER_EXPERIENCE_CONSTITUTION.md` (the consumer-experience authority actually in the
repo, and the home of Appendix F7). **If the real Master Book contradicts the Unit B decision, it
wins and the decision should be revised.**

## UNIT A — homepage exits · `ac6a402`

**Defect, measured:** `/ar` and `/en` each rendered **8 bare retailer links, 0 `/go/` exits**,
while `/ar/deals` on the same data class routed correctly to 26 product pages. Cost: no affiliate
attribution, no `go_click` (the only storefront exit signal), and a comparison platform sending
its visitor away on the first screen without a comparison.

**Rendered outcome verified FIRST, in a real browser:** all four live exits returned **200** and
were real product pages. **There was no dead link** — the defect was attribution and the missing
comparison, not breakage. Saying that precisely is what separates it from the string-reading
error that produced the Jarir report.

**Fix:** destination built server-side. `tps_listing_price_facts` has no observation id and no
canonical (checked against `information_schema`), so the join is on the observation's own raw URL
— the same field `/go` reads, making a resolved id guaranteed to work. Preference: **compare page
→ `/go` exit → drop**. 131 of 300 candidates (43.7%) resolve, ample for a 4-card strip. Exits
carry `source=home_deal`.

**Verified in production, both locales:** `direct=0 · go=3 · compare=1`; each `/go` → **302** to a
real product page; the compare page renders **2 retailer exits**. Retailer displayability and
approved affiliate identifiers untouched — `/go` resolves the provider exactly as every other exit.

## UNIT B — وفّر discoverability · `ae23976` (+ fix `e0fd005`)

**Root cause, and neither step was wrong alone:** (1) the homepage offer was removed 2026-07-29
because the first screen carried **two doors**; (2) the nav item it was removed *in favour of* was
retired by ADR-152 as the forbidden choose-between-search-and-AI fork. **Two correct removals left
zero entry points**, and the code comment still pointed at the vanished nav item.

**DECISION: an affordance, not an entry point.** `/search` already routes by intent from the same
field the homepage posts to — the capability was **reachable and undiscoverable**. Added one line
under the search input showing that a sentence is a valid query. Novice describes a situation,
expert types a model, same box.

**Rejected:** a separate «اسأل وفّر» button/card (recreates the two-doors failure and the forbidden
fork) · restoring the nav item (recreates ADR-152's defect) · floating bubble (excluded; also
REDESIGN_BRIEF §5) · contextual help after first search (does not solve *first-time* discovery) ·
onboarding modal (friction before first value; dismissed = buried).

**One source for the teaching:** `src/lib/agent/need-phrasings.ts`; **both** homepage and `/search`
import it. Two surfaces teaching different sentences is the one-fact-two-representations defect
this codebase has already paid for twice.

**No disclosure on the homepage, deliberately** — no AI answer appears there. **Correcting my own
earlier report:** the disclosure renders on **neither** homepage (`data-testid` absent in both
locales). My "present on `/ar`, absent on `/en`" was a grep artefact matching the message bundle
in the RSC payload. **There is no locale asymmetry.**

**Verified, mobile 390×844:** affordance in the first viewport (`ar` 384px, `en` 434px), 33–34px
targets, 0 controls under 32px. Clicking a phrase routes to `/search?q=…` and renders the advisor
answer with the disclosure, 25 result cards, both locales.

## 🔴 A REGRESSION I SHIPPED AND CAUGHT — read this one

`ae23976` replaced the inline phrasings in `search-client.tsx` **without adding the import**.
Both identifiers were undefined at runtime; **`/[locale]/search` rendered the error boundary in
both locales** — the primary customer surface. Fixed in `e0fd005`; search restored and verified.

**Two of my own failures let it through:**
1. My verification asserted `s.includes('need-phrasings')` *after* writing the file — and the
   **comment I had just added** contains `need-phrasings.ts`. **The check passed on its own
   artefact.**
2. `next.config.ts` sets `typescript.ignoreBuildErrors: true`, so the build was green. **tsc did
   report it**; I filtered with `head -3` and read only the pre-existing warnings above it.

**Rule earned:** never verify an edit with a substring check against the file you just wrote, and
never read a filtered typecheck when the filter is your own guess at the error.

## VERIFICATION

unified-search **54/54 GATE: PASS** · shell-verify **40/40** · adversarial **23/23** · must-pass
**4/4** · 2,023 strings validated, 0 rejected, **0 unavailable** · tests **1,114/1,114**.

**One known-stale gate assertion:** `validator-verify` asserts `POST /api/ai-assistant` → 404. It
now returns **200 by founder decision**. Not a regression — the check was written when the surface
was closed. **Left unchanged deliberately**: flipping a safety assertion to match reality deserves
its own boundary, not a quiet edit inside an unrelated unit.

## UNIT C — NARROWED, NOT CLOSED

Rendered-outcome verified: Jarir `/sa-en/` and Almanea `/en/product/` both return **200 real
product pages** but **do not locale-redirect** — `lang=en dir=ltr` even with `Accept-Language:
ar-SA`. So "it resolves normally" and "the Arabic shopper lands on English" are **both true** —
the pair of facts each of us merged in opposite directions. **It is a locale-UX defect, not a
broken-exit one, and it affects Almanea too.** Lower severity than assumed; still open.

## ROLLBACK

```
e0fd005  search import fix        git revert e0fd005   (revert only WITH ae23976)
ae23976  Unit B affordance        git revert ae23976
ac6a402  Unit A exits             git revert ac6a402
```
A and B are independent. `e0fd005` fixes `ae23976` and must not be reverted alone.

---

# ═══ SUPERSEDED — 2026-08-01 CHECKPOINT #40 · SESSION CLOSED · BASELINE FROZEN ═══

**Tree clean · everything pushed · nothing running.** This is the canonical engineering state.

## PRODUCTION STATE — exact

| | |
|---|---|
| **`AI_ASSISTANT_ENABLED`** | **ON** (`=1`). Verified live: `POST /api/ai-assistant` → **200** |
| assistant health | `unavailable` **0 / 132 journeys** · 0 published violations · 0 F7 bypasses · 0 errors |
| rejection rate (natural, n=24) | **42%** — see the noise-floor caveat below |
| deterministic advisor | unaffected; `/api/v1/agent/decide` makes no model call |
| tests | **1,114 / 1,114** |
| gates | validator-verify PASS · 23/23 adversarial · unified-search 54/54 · shell-verify 40/40 · vocabulary-scan PASS |

**Kill switch:** Railway → `AI_ASSISTANT_ENABLED=0` → **verify `POST` returns 404**. Verify it;
twice in this rollout a variable change did not reach the running process.

## ⚠ GOVERNING REFERENCE — `docs/TAWVEERI_MASTER_BOOK.md` IS NOT IN THE REPOSITORY

I was asked to make it the governing product / consumer-experience reference. **The file does not
exist** — `git ls-files` finds no Master Book under any name. The closest artefacts are
`MASTER_DIRECTIVE.md` (phases/gates) and `docs/CONSUMER_EXPERIENCE_CONSTITUTION.md` (the
consumer-experience authority actually in force, and the source of Appendix F7).

**I did not create it.** Inventing a governing document would be the worst thing to fabricate in
a repository whose entire discipline is that claims trace to evidence. **The founder must add the
real file**, after which it takes precedence for product/consumer-experience decisions,
subordinate to `TAWVEERI_CONSTITUTION.md`. Until it exists, `CONSUMER_EXPERIENCE_CONSTITUTION.md`
governs — the next session should treat Master Book references as pointing there and say so.

## DONE THIS SESSION

F7 complete end-to-end (ADR-157 vocabulary-as-data · 158 validator · 159 adversarial gate ·
160 durable logging · 161 wording · 162 engine contract · 163 P2-5 advisor · 164 dead code ·
165 §1b AST · 166 ai-assistant contract · 167 evidence boundary · 168 `customerPrice` ·
169 measurement rule). Root layout / locale / canonical (155–156). Assistant activated,
stabilised, and its first two production defects diagnosed and closed.

## OPEN — in agreed order

**UNIT A — homepage exits (FIRST).** `/ar` and `/en` each render **8 direct retailer links,
0 `/go/` exits, 0 compare, 0 product**, while `/ar/deals` on the same data class routes correctly
to 26 product pages. Cause: `src/lib/intelligence/home-verified-deals.ts` selects a raw `url` and
the card renders it; no canonical is resolved. **Bypassing `/go` costs affiliate attribution
(`tag=tawveeri-21`) and every `go_click` signal P2-4 will need.** Fix: return the observation id +
canonical; route through `/go/<offerId>` and to compare/product where one exists.

**UNIT B — وفّر placement (SECOND). PLACEMENT IS NO LONGER RESERVED FOR FOUNDER APPROVAL.**
The next session has **full authority to research, decide and ship** under the Master Book (see
caveat above) and the Protected Trust Policies. Measured: **zero `href` to `/advisor` on `/ar`** —
the 13 «وفّر» matches are brand copy, not an entry point.
**CORRECTION TO THE BRIEF:** the AI disclosure **IS present** on `/ar`, `/ar/deals`,
`/ar/price-truth`. It is **ABSENT on `/en`**. The gap is **locale, not page** — that changes what
"fix the disclosure" means. Constraints unchanged: one obvious entry point · no choose-between
search-and-AI · no floating bubble · disclosure at-or-before any advisor answer, both locales.

**UNIT C — retailer exit locale (THIRD, ONLY IF EVIDENCE SUPPORTS IT).**
**Do not act on the `/sa-en/` string.** I reported it as a defect from served HTML without opening
it; the founder opened it and it resolved normally. My re-verification was **inconclusive** —
Jarir returns `404` to curl while serving `lang="en"` HTML, i.e. bot protection, so every
conclusion from an HTTP client is about the instrument. **Settle it with puppeteer** (`ui-journey.js`,
`a11y-audit.js` already use it), per retailer, on the rendered outcome. Unit C may narrow to a
subset or disappear entirely.

## THE MEASUREMENT CAVEAT THAT GOVERNS ALL OF THE ABOVE

Noise floor **±19 points** (two natural samples, no code change between them: 31% n=16, 50% n=24).
**ADR-167 and ADR-168 are UNVALIDATED at the rate level** — sound mechanisms, unit-tested, no
measured harm, but neither may be cited as a proven rate improvement. Rule: `docs/ENGINEERING-RULES.md`
§ "an effect smaller than the sample variance validates nothing."

## ROLLBACK — latest units, newest first

```
3fd3f7f  ADR-169 hash correction (docs)     git revert 3fd3f7f
c4bbd49  ADR-169 measurement rule (docs)    git revert c4bbd49
e0af3fc  ADR-168 customerPrice              git revert e0af3fc
98351e9  ADR-167 evidence boundary          git revert 98351e9
f674162  measurement: rounding cause (docs) git revert f674162
a60e568  ADR-166 ai-assistant contract      git revert a60e568
```
Each is independent. Reverting `e0af3fc`/`98351e9` returns the assistant to the ADR-166 baseline.

## ENTRY POINT FOR THE NEXT SESSION

Read this checkpoint, then **open `src/lib/intelligence/home-verified-deals.ts` and add the
observation id + canonical to its `select`.** That single change is the head of Unit A and unblocks
the exit path Units B and C both touch.

---

# ═══ SUPERSEDED — 2026-08-01 CHECKPOINT #39 · MEASUREMENT CHAPTER CLOSED ═══

**Tree clean, pushed. Assistant enabled, rollout healthy.** Decision: **ADR-169** (measurement rule).

## THE DOCTRINE, RECORDED GENERALLY

`docs/ENGINEERING-RULES.md` now carries it as a standing rule, not a note on one unit:

> **A measured effect smaller than the sample's own variance cannot validate an engineering
> change. It cannot refute one either. It is not evidence in either direction.**

Establish the noise floor before claiming a delta · prefer the decomposed signal to the headline ·
non-deterministic systems need far larger n · "unvalidated" is the honest verdict · **more data
beats more changes.** Same failure class as the two sampling-bias entries already in that file.

## THE THREE PROMPT CHANGES ARE **UNVALIDATED** — not validated, not failed

| unit | mechanism | status |
|---|---|---|
| ADR-166 ai-assistant evidence contract | sound, proven by regression test | **partly validated** — 86% → 31–50% is far outside the noise floor |
| ADR-167 evidence boundary block | sound | **UNVALIDATED** — 50% → 46% is inside ±19pt variance |
| ADR-168 `customerPrice()` single representation | sound, proven by regression test | **UNVALIDATED at the rate level**; the rule-level fall (`saving-or-price…` 10 → 3) **does** survive the noise floor |

**They remain in the codebase.** Each has a sound mechanism, a unit test, and no measured harm.
**None of ADR-167/168 may be cited as a proven rate improvement.** The noise floor is **±19
points**, measured from two natural samples taken with no code change between them (31% n=16,
50% n=24).

## THE BOUNDARY — engineering vs. traffic

**Still advanceable by engineering alone:**
- `identity-sentinel` in generated names — a data/ingestion-path unit; **zero** non-generative
  customer exposure (audited).
- Vocabulary constraints in the evidence-boundary block (`price-currency-claim`, 3 of 10) —
  in scope, but see the falling-return warning below.
- §1b residual (7 triaged non-violations); promote the sub-gate when it reaches zero.
- Product-detail 404 body — needs a middleware pre-render existence lookup (ADR-155).
- Engine category coverage beyond 17 advisable categories.
- Wiring `npm run a11y` / the F7 gates into whatever runs on change.

**Now genuinely blocked on real customer traffic (P2-4):**
- **Any further validation of prompt work.** n≥100 is needed to see an 8-point effect. Synthetic
  samples cannot supply it — they are our guesses about what shoppers type.
- The true production rejection rate, and whether 42% is even the right number.
- Share of queries carrying a need signal (UXD-004); asked-vs-answered on clarification (UXD-005).
- Whether suppression is a customer problem at all — nobody has been suppressed yet except us.

**The line:** engineering can still fix *identified defects*. It can no longer *measure whether
the assistant is good*. That now requires shoppers.

## ROLLOUT

`unavailable` **0 / 132 journeys** · 0 published violations · 0 F7 bypasses · 0 errors ·
1,114/1,114 tests.

## ROLLBACK

```
c4bbd49  ADR-169 measurement rule (docs)   git revert c4bbd49
e0af3fc  ADR-168 customerPrice             git revert e0af3fc
98351e9  ADR-167 evidence boundary         git revert 98351e9
```

---

# ═══ SUPERSEDED — 2026-08-01 CHECKPOINT #38 · MEASUREMENT: THE 7 REJECTIONS EXPLAINED ═══

**Read-only measurement. NO code changed.** `AI_ASSISTANT_ENABLED` remains **ON**; rollout healthy.

## THE ROOT CAUSE — AND MY HYPOTHESIS WAS WRONG

I predicted the 7 `saving-or-price-without-provenance` rejections were queries returning **no
priced products**. **Measured: all 7 return 4 priced products each.** The evidence bundle has
prices. The hypothesis is dead.

**The actual cause is a ROUNDING MISMATCH between the prompt and the evidence.**

`formatProductsForAI` rounds every price into the prompt —
`Math.round(p.best_price)` (line 155) and `Math.round(s.current_price)` (line 144) — while the
evidence contract publishes the **unrounded** value. Measured prices from the failing queries:

```
جوال رخيص        10.99, 10.994001      → prompt shows "11"
تلفزيون سمارت    55.004501, 123, 182   → prompt shows "55"
لابتوب للالعاب   168.83, 336.25        → prompt shows "169"
سماعة بلوتوث     24.99, 39.99          → prompt shows "25"
```

The model faithfully repeats **11**; the evidence declares **10.994001**;
`saving-or-price-without-provenance` requires an exact value match and correctly refuses to
certify a figure that is not in the bundle. **The model did nothing wrong, the guard did nothing
wrong, and the evidence was complete** — the two representations of the same fact simply differ.

**This also explains why the evidence boundary (ADR-167) only half-worked:** it listed *unrounded*
prices while the context above it showed *rounded* ones — the boundary and the context disagreed
about the same number.

**The fix is a one-line class of change** (publish the rounded value, or stop rounding in the
prompt — they must agree). **NOT started; it is its own bounded unit,** and it touches
prompt assembly, which is out of scope here.

## READ-ONLY AUDIT — identity-sentinel on NON-GENERATIVE surfaces: **NONE**

| surface | result |
|---|---|
| `/api/search` — 100 products across 5 queries | **0 sentinel-bearing names** |
| `/ar/search` rendered · JSON-LD · metadata | **clean** |
| `/ar/compare/<key>` rendered · JSON-LD · metadata | **clean** |
| `/ar/deals` · `/ar/products` | **clean** |

**No non-generative customer surface is affected — live or dormant.** The sentinel reaches only
the generative path, where F7 caught it both times. **`identity-sentinel` remains its own future
bounded unit**, and is NOT a live customer defect.

This is consistent with `tps:sentinel-check`, the standing DB-layer gate, and with ADR-078's
requirement that sentinels be stripped at every customer render path — which they are.

## ROLLOUT STATUS

`unavailable` **0 across 108 journeys** · 0 errors · 0 published violations · 0 F7 bypasses.
No rollback condition met.

## NEXT BOUNDED UNIT (not started)

**Reconcile the rounded/unrounded price representation.** Smallest correct form: publish the same
rounded value the prompt shows, so prompt, boundary and evidence state one number. Expected to
clear ~7 of 11 current rejections. Measure with the same 24-query natural sample.

---

# ═══ SUPERSEDED — 2026-08-01 CHECKPOINT #37 · ai-assistant EVIDENCE CONTRACT ═══

**Tree clean, pushed. `AI_ASSISTANT_ENABLED` verified OFF (404) throughout.** Decision: **ADR-166**.

## THE FIRST PRODUCTION SESSION, AND WHAT IT PROVED

Enabled ~10 min. **6 of 7 answers suppressed** (86%), against a pre-declared >30% rollback
threshold. Rules: `saving-or-price-without-provenance` ×5 · `comparison-claimed-without-two-retailers` ×1.
**`unavailable`: 0.** No unsupported claim reached a customer.

**F7 was right. The route's contract was incomplete.** Every suppressed price was REAL and
SUPPLIED in the prompt — the route declared retailers and store counts and **not one price**, so
the validator correctly refused to certify figures nobody had published. The same defect ADR-162
fixed for the decision engine, on the one route that never received the fix.

## THE DIVERGENCE, PROVEN

| route | evidence |
|---|---|
| `/api/v1/agent/decide` | `buildPublishedEvidence(...)` — the shared contract |
| `/api/ai-assistant` (before) | hand-built: `kind:'retailer-count'` only, **zero `price` figures** |

## THE FIX — one contract, not a copy

The route now maps its facts into the shape `buildPublishedEvidence` already understands and
calls **the same builder**. Prices are declared where the prompt prints them: every per-store
price and `best_price` from search, `bestPrice`/`averagePrice` from deals, and
`currentBestPrice`/`lowestEver`/`average` from price intelligence — each beside its render, so
the two cannot drift. A test asserts the route contains **no hand-rolled figure literals**: a
second bundle format would be a second policy.

## MEASURED SEPARATELY, AS REQUIRED

| | before | after |
|---|---|---|
| **true supported answers suppressed** | 5 of 7 | **0** (regression test: same answer, old bundle rejects, new bundle publishes) |
| **genuine violations blocked** | 23/23 adversarial | **23/23 — unchanged** |
| | | + 7 new genuine-violation cases, all still rejected under the NEW bundle |
| **unavailable** | 0 | **0** |
| **false rejections** (production strings) | 0 of 2,023 | **0 of 2,023** |

**Genuine rejections did NOT decrease** — that is the decomposition the founder asked for. Had
both numbers fallen, the guard would have been weakened; instead suppression of *supported*
answers went to zero while every violation class stayed blocked, including two the old bundle
could not even have tested (unsupplied retailer, inflated store count).

**No guard behaviour changed.** No rule edited, no threshold moved, fail-closed intact
(asserted: malformed evidence still yields `unavailable`), durable logging unchanged, no
route-specific bypass.

## VERIFICATION (flag OFF throughout)

validator-verify **GATE: PASS** · 23/23 adversarial · 4/4 must-pass · unified-search **54/54,
0 failing** · **1,110/1,110** tests (12 new) · `/api/ai-assistant` → **404**.

**Not verifiable while off:** the live generative path. The contract is proven by regression
test and by the shared builder's own tests, not by a live 200.

## ROLLBACK

```
a60e568  ADR-166 ai-assistant evidence contract   git revert a60e568
```

## ACTIVATION DECISION — BACK TO THE FOUNDER

Same runbook, same thresholds (CHECKPOINT #34 §1–3). **Watch the first 10 answers**: expect
`rejected` to fall from 86% toward <10%. If it stays high, the remaining cause is the prompt, not
the contract — and the kill switch is one variable.

**Verify the kill switch yourself before and after.** Last time the reported disable had not
taken effect; the endpoint was live for the whole interval.

---

# ═══ SUPERSEDED — 2026-08-01 CHECKPOINT #36 · §1b EXTENDED TO THE AST ═══

**Tree clean, pushed. Nothing running.** Decision: **ADR-165**. **`AI_ASSISTANT_ENABLED` untouched.**

## THE COVERAGE MAP — what §1b inspects, and what it cannot

| surface | covered? |
|---|---|
| locale/message JSON | ✅ §1 (3,232 strings) |
| **JSX / TSX text nodes** | ✅ **NEW — the blind spot that escaped three scans** |
| string literals in components | ✅ (now AST, was regex) |
| template literals — **static spans only** | ✅ NEW |
| shared constants / config | ✅ NEW (`.ts` now scanned, not just `.tsx`) |
| metadata · title · description | ✅ NEW (string literals in metadata objects) |
| Open Graph / social fields | ✅ NEW (same mechanism) |
| JSON-LD builders | ✅ NEW (literals inside the builder) |
| **alt text · aria-label · placeholder · title** | ✅ **NEW — a claim spoken aloud is still a claim** |
| button / link labels · validation · error · empty · not-found | ✅ (literals + JSX text) |
| server-rendered fallback HTML | ✅ §2 (rendered bytes) |
| client-only fallback text | ✅ via source, ❌ not via §2 (§2 sees server bytes only) |

**Outside §1b BY DESIGN — governed elsewhere, and repository scanning must never be implied to
cover them:** model-generated runtime text (**F7·2 validator**) · retailer-originated remote
content (**provider/evidence controls**) · database content (**TPS evidence layer**) · externally
configured copy (**none today; would need its own control**).

## KNOWN POSITIVES — proven before any zero was believed

`tests/vocabulary/source-scan.test.ts` — **22 fixtures, all caught**, including the exact JSX
claim that escaped: «نجمع أسعار نفس المنتج من جميع المتاجر». Fixtures live in tests, never in
production source. **Historical §1b coverage re-verified**: the quoted-literal class the regex
version found is still detected.

## FINDINGS — 47 → 10, all classified

| class | n | detail |
|---|---|---|
| **live violation** | **1 → fixed** | `product-detail-client` "across **every store**" / «بين كل المتاجر» → §9 approved wording |
| false positive | 6 | sentences about our ACTIVITY or COVERAGE («…حالياً», "currently watching") + a `50/50` layout ratio ×2 |
| approved wording | 1 | "real-time **alerts**" — §1 records notification speed as TRUE |
| out of scope | 3 | **prompt text** in the closed generative route — not repository copy a customer reads |
| operator surface | 2 | `store/product-form.tsx` (§10 scope) |
| dormant | 0 | — |
| requires founder decision | **0** | — |

**37 of the original 47 were the instrument scanning ITSELF** — `src/lib/vocabulary/` must contain
the forbidden strings verbatim, because they are the fixtures proving they are blocked. Excluded
by path, with the reason stated in source: that is the difference between a claim and a fixture,
not a scope exemption.

## THE CLEANLINESS CLAIM I CAN HONESTLY MAKE

> **Clean across all static repository surfaces covered by §1b** — 464 source files, 3,468
> customer-text candidates, plus 3,232 bundle strings. **Remaining blind spots:** client-only
> fallback text is covered in source but not in the rendered §2 check; prompt text is scanned but
> classified out of scope. **Runtime-generated language remains outside §1b and under F7.**

**NOT "clean by construction."** §1b covers static repository text; it cannot cover what a model,
a retailer feed, or the database produces.

## ROLLBACK

```
ef78eae  ADR-165 §1b AST extension   git revert ef78eae
```

Instrument + fixtures + one copy fix. `source-scan.ts` is imported by the scanner only.

---

# ═══ SUPERSEDED — 2026-08-01 CHECKPOINT #35 · DEAD-CODE CLEANUP ═══

**Tree clean, pushed, verified in production. Nothing running.** Decision: **ADR-164**.
**`AI_ASSISTANT_ENABLED` untouched.**

## PROVEN BEFORE ANYTHING WAS DELETED

**Deleted — ONE module, all six criteria met:** `src/app/[locale]/landing-client.tsx` — zero
static imports (two COMMENT mentions only), no `LandingClient` symbol referenced anywhere, no
dynamic or lazy import, not a route file (page/layout/error/not-found), no error-boundary or
not-found reference, unreachable by locale routing.

**NOT deleted — still reachable:** `src/app/how-it-works/page.tsx` and `src/app/about/page.tsx`
are **route files**; Next resolves `/how-it-works` and `/about` to them. Production returns
**307** because middleware redirects to the locale route. **Interception is not deadness**, and
it is config-dependent — deleting them changes behaviour the moment the matcher changes. Claims
replaced instead, exactly as instructed.

## THE FIND THAT MATTERED MOST

**`src/app/[locale]/how-it-works/page.tsx` is LIVE (200, both locales) and carried
«من جميع المتاجر»** — a comprehensive-market claim §3 has forbidden since 2026-07-30.

**§1b missed it.** The scanner reads QUOTED LITERALS; this is JSX **text content**. A third
blind spot in the same instrument — found by grepping the repo for the CLAIM rather than trusting
the scanner. Recorded; closing it is its own boundary.

## CLAIMS REPLACED — pre-approved wording only, no new claim invented

| where | was | now |
|---|---|---|
| `[locale]/how-it-works` **(LIVE)** | «من جميع المتاجر» | «من متاجر سعودية» |
| `app/how-it-works` (intercepted) | «من جميع المتاجر» | «من متاجر سعودية» |
| `landing.json` ×2 keys ×2 locales | "from all stores" / «من كل المتاجر» | §9 capability statement |
| `agent.json:measuredExitNote` ×2 | «الأسعار تُحدّث» / "Prices are updated" | «الأسعار من رصدنا» |
| `ai-assistant` prompt context | «السعر الحالي الأفضل» | «أفضل سعر رصدناه» |

The prompt fix matters on its own: a prompt steering the model toward retired wording would have
produced answers the validator then correctly suppressed. A prompt that fights the guard is a
defect even while the surface is closed.

## MEASURED

| | before | after |
|---|---|---|
| latent bundle findings | 5 | **0** |
| §1b component findings | 10 | **7** |
| pending copy decisions | 0 | **0** |
| unit tests | 1,076 | **1,076** |

**The remaining 7 are not defects:** operator surface ×3 (§10 scope), a `50/50` layout ratio ×2,
and two sentences about OUR ACTIVITY/COVERAGE rather than price currency.

## ROLLBACK

```
e9cde62  ADR-164 dead-code cleanup   git revert e9cde62
```

---

# ═══ SUPERSEDED — 2026-08-01 CHECKPOINT #34 · P2-5 ADVISOR BUILD-OUT ═══

**Tree clean, pushed, verified in production. Nothing running.** Decision: **ADR-163**.
**`AI_ASSISTANT_ENABLED` untouched — enabling it is a separate founder decision.**

## CORRECTION — the retailer-count amendment is CLOSED

Decided and shipped in **`53e6894`** (2026-07-31): §9 amended, `search.json` updated in both
locales. Earlier checkpoints listed it as an open founder decision; that was wrong and is
corrected here and in the superseded table below.

## WHAT SHIPPED

**1 · Raw scores are gone from the advisor.** «درجة الثقة 75%» and «درجة الثقة الإجمالية: 75/100»
both removed. A shopper cannot act on 75, cannot tell it from 71, and cannot learn what would
raise it. P2-5's rule is exact — *if confidence cannot be explained in customer language, do not
display it.* Replaced by `TrustSummary`, which states the EVIDENCE behind the score in words —
«سعر مؤكَّد في 3 متاجر» / "Price corroborated at 3 retailers", or «رصدناه في متجر واحد» when
there is one. The tier is the engine's own, never re-derived in the view; the cited breakdown
stays one tap away.

**2 · F7 now governs the deterministic advisor.** CHECKPOINT #25 recorded, correctly, that F7 does
not *govern* a surface with no runtime generation — but that was a statement about risk, not
coverage. The advisor's sentences are **composed at runtime** from data (`أوفر بـ${diff} ريال`),
and a repository search cannot catch what a template produces. `guardAdvisorPayload` validates
every prose field before the response leaves the route.

**Failure behaviour differs from F7·2 deliberately: WITHHOLD the sentence, never rewrite, never
suppress the whole answer.** A generated answer is one artefact, so editing it manufactures a
claim. A deterministic answer is a LIST of independently-derived statements — dropping one
withholds a claim without inventing one, and suppressing all of them would delete a correct
recommendation because an adjacent sentence failed.

**It fires zero times** on real production output (2,026/2,026 strings pass). A guard that never
fires is the difference between "we checked" and "we believe"; every activation is recorded in the
same durable log.

**3 · The scanner's blind spot is closed.** `vocabulary-scan` read `messages/` only, so a claim
hardcoded in a component was invisible. New §1b scans 216 component files.

## WHAT §1b FOUND — 18 → 10, triaged

**Two were LIVE and are fixed:** `price-alerts/page.tsx` carried «السعر الحالي» / "the current
price" hardcoded — the wording §10 retired. The bundle fix could not reach it.

**Eight of the original findings were my own instrument's fault**, corrected before any conclusion:
JSX quote-alternation captured code fragments as literals (`{t('…')}: <Price`), and a comment in
`about/page.tsx` documenting the claims it REMOVED was read as the violation — the instrument
reading its own audit trail as a defect.

**The remaining 10, each with its reason:**

| finding | why it is not a defect |
|---|---|
| `landing-client.tsx` ×2 («من كل المتاجر», «8 متاجر سعودية») | **dead module** — no importers; the homepage renders `BetaLanding` |
| `src/app/how-it-works/page.tsx` | non-locale duplicate; middleware redirects to `/[locale]/…` |
| `store/product-form.tsx` ×2 | **operator surface** — §10 scope note |
| `store-comparison-panel.tsx` ×2 (`50/50`) | a layout ratio matching the harness-figure SHAPE |
| "currently watching prices" · «…لهذا المنتج حالياً» · «أسعار متاحة حاليً» | statements about OUR ACTIVITY or COVERAGE now, not price currency |

**§1b is REPORT-ONLY, and that is stated in the source.** It is new coverage, so its first run is
a backlog, not a regression. A permanently-red gate trains people to ignore it; a green one would
be a lie. Everything prints every run. **Promote it to gate-failing when the backlog reaches zero.**

## VERIFICATION

| | before | after |
|---|---|---|
| adversarial cases blocked | 23/23 | **23/23** |
| must-pass answers publish | 4/4 | **4/4** |
| advisor guard activations, production | — | **0** |
| vocabulary scan | PASS | **PASS** |
| unit tests | 1,076 | **1,076** |

## ROLLBACK

```
0f4abcb  ADR-163 P2-5 advisor build-out   git revert 0f4abcb
```

## STILL OPEN

- **`AI_ASSISTANT_ENABLED`** — founder decision, no technical blocker.
- **P2-4** customer-outcome measurement — needs traffic.
- **§1b backlog** — 10 triaged findings; promote the sub-gate when cleared.

---

# ═══ SUPERSEDED — 2026-08-01 CHECKPOINT #33 · ENGINE CONTRACT SHIPPED ═══

**Tree clean, pushed, deployed, verified in production. Nothing running.** Decision: **ADR-162**.
**`AI_ASSISTANT_ENABLED` untouched — surface verified 404.**

## THE FOUR ANSWERS

| question | answer |
|---|---|
| **Is this boundary complete?** | **YES** |
| **Is F7 complete?** | **YES** |
| **Is `AI_ASSISTANT_ENABLED` technically safe to enable?** | **YES** — no technical blocker remains |
| **What kind is the remaining blocker?** | **FOUNDER POLICY**, not architectural or product |

## WHAT SHIPPED

`/api/v1/agent/decide` now publishes an `evidence` bundle — every customer-visible figure with
`value`, `kind`, `derivedFrom`, `label`. **Publish, never infer.** A consumer can verify any
number without knowing how the engine works.

**The guard was correct; the contract was incomplete.** Not one rule changed. Three ways to
"fix" this by weakening the guard were available and all rejected: accepting any *difference* of
two supplied figures (hundreds of pairwise differences — coincidence would often match), letting
the harness compute the delta (the harness fabricating evidence), or keeping the path exclusion
(a suppression list wearing a reason).

**"Cannot declare ⇒ must not render" is structural:** `explainChoice` sets `total_cost_delta` on
the **same branch** that pushes the sentence, so they cannot drift. Dropped sentence ⇒ `null`.

**Two pieces of inference DELETED, not relocated:** the harness had been reconstructing evidence
by guessing from field names — inference dressed as verification, and it still missed the one
figure that mattered. And the `chosen_over.reasons_*` exclusion is gone; nothing is excluded now.

## PRODUCTION VERIFICATION — same denominator, so the comparison is exact

| | before | after |
|---|---|---|
| strings validated | 2,026 | **2,026** |
| **passed** | 2,020 | **2,026** |
| **rejected** | 6 | **0** |
| **unavailable** | 0 | **0** |
| **false rejections** | 0 | **0** |
| unpublished figures | 4 distinct, hidden by a path rule | **0, nothing excluded** |
| adversarial cases blocked | 23/23 | **23/23** |
| must-pass answers publish | 4/4 | **4/4** |
| unit tests | — | **1,076 / 1,076** (15 new) |

**Why true rejections fell to zero — the required explanation.** `saving-or-price-without-
provenance` is **byte-identical** and still rejects an unbacked price: the adversarial suite
proves it, with `price-with-no-observation` and `price-contradicts-evidence` still blocked. The
six disappeared because **the evidence became complete**. A rejection that vanishes because a rule
softened is a regression; one that vanishes because the fact is now declared is the fix.

## AN INSTRUMENT TRAP, FOR THE FIFTH TIME

Post-deploy checks with `curl -d '{"text":"ثلاجة اقتصادية"}'` returned *"category required"* for
every ARABIC query while English worked — which reads exactly like a parser regression. It is the
**`curl -d` argv-mangling** trap CHECKPOINT #19 already recorded. The same queries through
`fetch` returned 43–63 figures each. **Use node `fetch` for any Arabic-bearing request; a shell
quote is not a UTF-8 transport.**

## ROLLBACK

```
3e9f185  ADR-162 engine evidence contract   git revert 3e9f185
ae266a9  docs + harness denominator fix        git revert ae266a9
```

Additive: one new module, one new field on the decide response, one published field on
`chosen_over`. Reverting restores the previous payload and re-opens the gap — the harness would
then need its path exclusion back to stay green, which is the tell that the exclusion was never
the fix.

## NEXT — `AI_ASSISTANT_ENABLED` IS NOW A POLICY DECISION

No technical prerequisite remains. See the recommendation in the closing report before enabling;
the durable log is what makes the first hours legible.

---

# ═══ SUPERSEDED — 2026-08-01 CHECKPOINT #32 · F7 COMPLETE · FLAG STILL OFF BY CHOICE ═══

**Tree clean, pushed, verified in production. Nothing running.** Decisions: **ADR-160** (durable
logging) · **ADR-161** (wording). **`AI_ASSISTANT_ENABLED` untouched — surface verified 404.**

## THE FOUR ANSWERS

| question | answer |
|---|---|
| **Is this boundary complete?** | **YES** |
| **Is F7 complete?** | **YES** — all five checklist items now hold |
| **Does anything block `AI_ASSISTANT_ENABLED`?** | **One thing, and it is not F7** — see below |
| **Does anything block P2-5?** | **The same one thing** |

### The one remaining blocker

**The engine does not publish the figures it renders.** `smart_pick.chosen_over.reasons_*` says
«أوفر بـ180 ريال في التكلفة الإجمالية» / "180 SAR lower total cost" — and **that 180 is nowhere in
the payload.** The engine publishes both total costs but not the delta.

Safe today: the engine computes and writes that sentence itself, deterministically. **The moment
an LLM phrases these facts, the validator will correctly suppress the answer** — a guard doing its
job, on a true statement, because the evidence contract is incomplete. That is a small, contained
change to the decide payload, and it is the last prerequisite.

## WORDING DECISION — APPLIED (ADR-161)

`LAUNCH_VOCABULARY.md` **§10 amended first** (F1), then the copy. «آخر سعر رصدناه» /
**"Last Observed Price"**; validation messages carry the principle rather than the label.

| where | before | after |
|---|---|---|
| `product.json:priceAlertCurrentPrice` | «أفضل سعر حالياً» / "Current best price" | «آخر سعر رصدناه» / "Last Observed Price" |
| `products.json:priceAlert.currentPrice` | «السعر الحالي» / "Current Price" | «آخر سعر رصدناه» / "Last Observed Price" |
| `product.json:priceAlertInvalid` | «…أقل من السعر الحالي.» | «…أقل من آخر سعر رصدناه.» / "…below the last price we observed." |
| **`dashboard.json:currentPrice`** | «الحالي» / "Current" | «آخر رصد» / "Last observed" |

**A FOURTH string was found while applying the decision** — the dashboard alert card. The scanner
had never flagged it, *correctly*: the rule needs a price word within 40 characters and that label
has none (the price is in a sibling component). Found by **grepping the bundles for the claim**
rather than trusting the scanner to have found every instance. A scanner is never the last step of
a copy change.

**`store.json` deliberately unchanged** — a merchant editing their own price sees a price that is
genuinely current *to them*, and that surface makes no claim on our behalf. Recorded in §10's scope.

**Confirmed:** 0 "Current Price" wording remains in customer-facing messages. Pending register is
**empty because the debt was paid**; `regression-current-price-label` keeps it dead.

## DURABLE LOGGING — MIGRATION RISK, ANSWERED

**The table is in `observability`, NOT `public`.** PostgREST introspects only exposed schemas, so
it adds **nothing to the REST schema cache** and is unreachable by `anon` under any
misconfiguration.

**Residual risk, not minimised:** Supabase's `pgrst_ddl_watch` fires one `NOTIFY pgrst 'reload
schema'` on *any* DDL — placement does not change that. It became an outage once (PGRST002) only
when a reload met heavy concurrent pipeline writes and a too-low authenticator timeout. Both are
addressed, and it ran on a **verified-idle** DB (`pg_stat_activity` = 1 active backend, my own
query). After: `discount-integrity` / `/api/search` / `/ar` all 200 across four probes,
shell-verify 40/40.

**Rollback verified BEFORE execution, literally:** `node scripts/database/run-19-dryrun.js` runs
the migration *and* its rollback in one transaction, inserts a representative event, asserts the
schema is gone, then `ROLLBACK`s. The `NOTIFY` is transactional, so the rehearsal fired no reload
— it was free.

**Logging can never become a dependency, structurally:** fire-and-forget · returns `void` so
there is nothing to branch on · every failure path swallowed including the promise rejection ·
`validate.ts` does not import the log (asserted on the source) · the route decides from the
**verdict** · the two sinks are wrapped **separately**, because one try around both would let a
throwing stdout sink silently skip the durable write.

**Disabled under `NODE_ENV=test`** — `.env.local` holds a real production DSN and jest loads it; a
default-on sink would have every test run poisoning the table used to answer whether the guard ran.

**An existing guard caught a real defect in my migration.** `rls-coverage.test.ts` parsed
`(?:public\.)?<name>`, so my schema-qualified table read as RLS-less while its definition enables
and FORCES RLS. Fixed by making the parser schema-aware — strengthening the guard for every future
non-public table rather than exempting mine.

## VERIFIED IN PRODUCTION

```bash
npm run tps:validation-log-health     # table, RLS, grants, all three outcomes round-trip
npm run tps:validator-verify
npm run tps:vocabulary-scan
```

| | result |
|---|---|
| durable log health | **7/7 PASS** — RLS forced, **0 grants to anon/authenticated**, 3/3 outcomes stored distinctly |
| vocabulary scan | **PASS** — 0 live findings, **0 pending** |
| validator-verify | surface **404** · 22/22 blocked · 4/4 must-pass · 0 false rejections |
| shell-verify | **40/40** |
| unit tests | **1,061 / 1,061** |

## ROLLBACK

```
3f6e9a1  ADR-160/161 durable logging + wording   git revert 3f6e9a1
node scripts/database/run-19-dryrun.js --rollback     # drops the table AND its events
```

The code revert is safe alone — the sink is env-gated and a missing table only logs a warning.
Run the SQL rollback only if you also want the schema gone; it is destructive to recorded events
and carries the same one-reload risk.

## NEXT

1. **Publish the engine's derived figures** (the last blocker above).
2. Then `AI_ASSISTANT_ENABLED` is a decision, not a hazard — see the recommendation in the report.
3. P2-5 وفّر advisor build-out.

---

# ═══ SUPERSEDED — 2026-08-01 CHECKPOINT #31 · F7·3 COMPLETE · F7 NOT COMPLETE ═══

**Tree clean, pushed, verified against production. Nothing running.** Decision: **ADR-159**.
**`AI_ASSISTANT_ENABLED` untouched — surface verified 404 after deploy.**

## THE THREE ANSWERS YOU ASKED FOR

| question | answer |
|---|---|
| **Is F7 complete?** | **NO.** F7·1/2/3 are complete. F7's checklist has one item they do not satisfy — see below |
| **Is `AI_ASSISTANT_ENABLED` safe to enable?** | **NO.** Two blockers, both concrete |
| **Does a prerequisite still block P2-5?** | **YES — two**, and one was measured today |

### Why F7 is not complete

F7's own checklist ends with *"It is tested adversarially before deployment"* — that is now a
permanent gate. But the surface it governs would run **with no durable record**: today's sink
writes a JSON line to stdout. A guard whose evidence disappears with the log buffer cannot answer
*"was it running?"* after an incident. **You scoped durable validation logging as its own
boundary before enabling — that is exactly right, and it is the remaining F7 item.**

### Why the flag is not safe to enable yet

1. **No durable validation log** (your named boundary, not started).
2. **The engine does not publish its derived figures** — measured below. Enabling before that
   fixes nothing and would suppress correct answers.

### The two P2-5 prerequisites

1. **Durable validation logging.**
2. **The engine must publish every figure it renders.** Measured on production today:
   `smart_pick.chosen_over.reasons_*` renders «أوفر بـ180 ريال في التكلفة الإجمالية» / "180 SAR
   lower total cost" — **that 180 is nowhere in the payload.** The engine publishes both total
   costs but not the delta. **Safe today** (it computes and writes the sentence itself,
   deterministically). **The moment an LLM phrases these facts the validator will correctly
   suppress the answer.**

## WHAT THE SUITE FOUND — the argument for building it, in one table

Before a single case was written down, four adversarial probes passed clean through the validator
shipped the same morning:

| probe | why it passed |
|---|---|
| «أفضل سعر 1899 ريال لدى كارفور» | `isDisplayableRetailer` only knows retailers we DO source |
| "The best price is 1899 SAR" with no price evidence | no rule tied a price to an observation |
| "Compare across stores" with one retailer | no rule tied a comparison offer to deliverability |
| two contradictory comparable-counts | the validator ruled anyway |

Closed by two new evidence-required rules (`saving-or-price-without-provenance` §2,
`comparison-claimed-without-two-retailers` §1), an unapproved-retailer lexicon, and an
`evidence_internally_inconsistent` refusal. Vocabulary **2026-07-31+2**, fingerprint re-pinned.

## THE SUITE ASSERTS AT TWO LEVELS — the second is the point

**Detection is not protection.** A validator that flags a claim while the route publishes it
anyway has failed completely. All 22 cases are asserted twice: the verdict, **and the actual HTTP
response the customer would have received**, by driving the real route handler with a mocked
generator. Every case → `reply: null`, `suppressed: true`, history unextended.

**Four must-pass answers are asserted too** — the cheapest way to pass every adversarial case is
to reject everything, which would suppress the product.

**"Impossible attributes" is solved by provenance, not plausibility.** No physics model, and
there should not be one: an impossible attribute and an unverified one are the same failure from
the customer's side. That is what keeps it category-independent. A test swaps the category word
through five real categories and asserts no verdict changes.

## VERIFIED

```bash
npm run tps:validator-verify                                             # localhost
npx tsx scripts/tps-analysis/validator-verify.ts --base https://tawveeri.com
```

| | result |
|---|---|
| generative surface | **404** |
| adversarial cases blocked | **22 / 22** |
| must-pass answers still publish | **4 / 4** |
| false rejections on real production output | **0** of 2,026 strings |
| unit tests | **1,049 / 1,049** (53 new) |

## TWO OF MY OWN ERRORS, CAUGHT BY THE MECHANISMS BUILT FOR THAT

1. F7·1's anti-drift test rejected a `source.quote` that spanned a **line wrap** in the document.
2. The first production run rejected **41 correct strings**: the evidence model had no `computed`
   provenance for the engine's disclosed total-cost estimate, and the harness supplied no price
   figures at all. A legitimate, honestly-labelled computation has no observed value of its own —
   treating that as fabrication would have suppressed correct answers on the day the surface opened.

## ROLLBACK

```
fd02cb1  ADR-159 F7·3 adversarial gate   git revert fd02cb1
```

Additive. Reverting removes the suite, the two new rules and the lexicon, and returns the
vocabulary to `2026-07-31+1`. No customer-facing behaviour changes either way.

---

# ═══ SUPERSEDED — 2026-08-01 CHECKPOINT #30 · F7·2 COMPLETE · F7·3 NOT STARTED ═══

**Tree clean, pushed, verified against production. Nothing running.** Decision: **ADR-158**.
**`AI_ASSISTANT_ENABLED` untouched — the generative surface is still closed (verified 404).**

## THE TWO POLICIES, DECIDED RATHER THAN DEFAULTED

### 1. On a violation → SUPPRESS THE WHOLE ANSWER, fall back to the deterministic one

| rejected option | why |
|---|---|
| remove only the offending content | the one option that can **manufacture** a claim while "fixing" one — deleting a clause can invert a sentence |
| replace with approved wording | answers a question the customer did not ask; a silent meaning change |
| regenerate once | non-deterministic, doubles cost, and a model that produced a forbidden claim has no evidence-backed reason to avoid it on retry |
| publish with a warning | a disclosure does not make an unevidenced price claim true |

**Why suppression is not a loss:** ADR-002 already holds — engines decide, LLMs only *phrase*.
There is always a true answer underneath, so **suppression costs the phrasing, not the answer.**
It is also this surface's established behaviour (CHECKPOINT #25): a failed advisory layer is
silent and the deterministic result stands. The response says `suppressed: true` explicitly, and
the suppressed answer is **not** appended to history — carrying it forward would feed a rejected
claim into the next turn as if we had said it.

### 2. When the validator cannot run → FAIL CLOSED

Malformed evidence · non-string answer · empty rule set · an evidence rule F7·1 declares and
F7·2 does not handle · input over the cap · any thrown error → `unavailable`, which suppresses
exactly as a rejection does. *"The guard was down"* is not a defence, and fail-open means the
guard stops guarding precisely when the system is under stress.

**Determinism is structural:** no wall-clock, no randomness, no I/O in the decision path. A
pathological input is caught by a deterministic **character cap**, not a race that resolves
differently on a slower machine. A test greps the source for `Date.now`/`Math.random`/`setTimeout`.

## THE LOAD-BEARING TEST

`EVIDENCE_RULES_HANDLED` must equal `EVIDENCE_REQUIRED_RULES` **exactly**. Add a rule in F7·1 and
F7·2 fails until it handles it; at runtime an unhandled rule returns `unavailable` rather than a
pass. Without it, F7·1 could grow a rule the validator silently never checks — and a clean text
scan would still read as "clean".

## THREE OUTCOMES, NEVER TWO

`passed` · `rejected` · `unavailable`, logged with query, generated output, timestamp, violated
rules, measurable reason, decision taken, and the vocabulary version + fingerprint judged under.
**`unavailable` is deliberately not folded into `rejected`** — same customer-visible effect,
opposite meanings; merging them lets a broken guard hide inside a healthy rejection rate.
Sink is injectable; default is one JSON line to stdout. **Durable storage left open on purpose:**
that is a production write and a migration — a founder decision, not one to make inside a validator.

## VERIFIED AGAINST THE LIVE PRODUCT

```bash
npm run tps:validator-verify                                          # localhost
npx tsx scripts/tps-analysis/validator-verify.ts --base https://tawveeri.com
```

| check | result |
|---|---|
| generative surface still closed | **404** — it was touched, so it is verified, not assumed |
| false rejections on real deterministic output | **0 of 2,026** customer-visible strings, 7 production queries |
| every validation produced exactly one log event | 2,026 / 2,026 |
| unit tests | **992 / 992** (32 new) |
| F7·1 vocabulary scan · shell-verify | unchanged — PASS · 40/40 |

**Unit fixtures cannot find a precision defect** — the same person writes the fixtures and the
rules. Real production language can, which is what §2 is for.

## ONE HARNESS DEFECT CAUGHT — and one thing to keep in view

The first run rejected `recommendations[].tps_identity_key` =
«بيسك\|split\|NO_SERIES\|12000\|Inverter\|hot_cold» for leaking a sentinel. **That was the
harness, not the product:** the key is used only inside an `href` (`advisor-answer.tsx:246`),
never rendered, so it is a machine field and the sentinel belongs in it. Machine fields are now
excluded **by name** — the same principled class as urls and slugs, not an exception carved to
make a gate green.

**Keep in view anyway:** the sentinel *is* shipped to the browser inside the payload. It is one
careless `.toString()` from being a real leak.

## A HAZARD REMOVED BY STRUCTURE

`validate.ts` needs the checkers, which lived in the barrel that re-exports `validate.ts`. That
cycle would not throw — it would leave `FORBIDDEN_CLAIMS` undefined at init, and the validator
**fails closed on an empty rule set**, so the symptom would have been *every generated answer
silently suppressed in production, with no error anywhere.* Checkers moved to `check.ts`; the
barrel is now only a barrel.

## ROLLBACK

```
ba08076  ADR-158 F7·2 validator   git revert ba08076
```

Additive apart from the enforcement point in `src/app/api/ai-assistant/route.ts` — a route that
returns 404 today. Reverting removes the validator and restores the route's previous return.

## NEXT — DO NOT START AUTOMATICALLY

**F7·3** — the adversarial suite F7 names: *a retailer with no provenance* and *a category we do
not cover*, as a gate rather than a manual pass. Not started. Only after that does
`AI_ASSISTANT_ENABLED` become a decision rather than a hazard.

**Still open from #29:** three live customer strings await your wording decision (§F1) —
`priceAlertCurrentPrice`, `priceAlertInvalid`, `priceAlert.currentPrice`.

---

# ═══ SUPERSEDED — 2026-08-01 CHECKPOINT #29 · F7·1 COMPLETE · F7·2 NOT STARTED ═══

**Tree clean, pushed, verified against production. Nothing running.** Decision: **ADR-157**.

## WHAT F7·1 IS, IN ONE SENTENCE

The approved vocabulary is now **typed, versioned, tested data** (`src/lib/vocabulary/`) instead
of prose — because a runtime guard built against prose is not incomplete, it is **confidently
wrong**: it would certify a vocabulary nobody approved.

**F7·2 (the post-generation validator) IS NOT STARTED.** Nothing in this change looks at
generated text or compares anything against structured evidence.

## THE FIVE DESIGN DECISIONS THAT MATTER

1. **Governance is one-way and mechanical.** The document is the authority; the module is
   derived. Every entry carries a verbatim `source.quote` and a test asserts it still exists in
   `docs/LAUNCH_VOCABULARY.md`. Edit either side alone → test fails. Drift is not left to
   discipline.
2. **Versioned.** `VOCABULARY_VERSION` + a pinned `vocabularyFingerprint()`. Any edit fails until
   the version is bumped deliberately. F7·2 stamps verdicts with it.
3. **Customer ≠ internal.** Two registries, two questions: *may a customer READ this claim* vs
   *has an internal token ESCAPED*. Merging them would let a containment failure be argued about
   as a wording preference.
4. **Category-agnostic.** No rule names a category — every rule is a claim CLASS, so a category
   added tomorrow inherits the set. Test-enforced against the app's own category keys.
5. **What text cannot decide is DECLARED.** Three rules ship with `enforcement:
   'evidence-required'` and no patterns — «5,023 products compared» (forbidden) and «we compare
   758 products» (approved) are the same shape; only evidence separates them. Every result
   reports them under `undecided`. **A clean scan is not full coverage, and it says so.**

## WHAT IT FOUND ON THE SHIPPED PRODUCT

```bash
npm run tps:vocabulary-scan                                        # localhost
npx tsx scripts/tps-analysis/vocabulary-scan.ts --base https://tawveeri.com
```

**GATE: PASS — 0 live customer-copy violations, 0 internal-token leaks** across 3,232 bundle
strings and 16 live surfaces, both locales. Findings are **classified**, because "9 findings" and
"3 a customer can read today" are different facts:

| class | n | disposition |
|---|---|---|
| latent (zero refs in `src/`) | 5 | §5's own reasoning, **derived from the repo**, not asserted |
| operator surface (`store.json`) | 2 | a merchant editing their own price legitimately sees "Current Price" |
| **live customer copy** | **3** | **awaiting an F1 wording decision — see below** |

### ⚠ THREE LIVE STRINGS NEED A FOUNDER WORDING DECISION

Recorded in `src/lib/vocabulary/pending-copy-decisions.ts` with shipped text, reason and owner.
**I did not change them** — customer copy is an F1 decision, and rewording live controls is
outside F7·1.

| where | ar | en |
|---|---|---|
| `product.json:priceAlertCurrentPrice` | «أفضل سعر حالياً» | "Current best price" |
| `product.json:priceAlertInvalid` | «…أقل من السعر الحالي.» | "…below the current price." |
| `products.json:priceAlert.currentPrice` | «السعر الحالي» | "Current Price" |

§3 forbids "current" as a price-freshness word. These assert a price is current when it is
**observed**. The replacement is not obvious — «أفضل سعر رصدناه» is accurate but longer and
changes a control read while setting a threshold. **Settle the three together, not piecemeal.**

**The register cannot become a suppression list:** every entry names what is unresolved and who
decides, all are printed on every run *including a passing one*, and a **stale** entry (copy
reworded, finding gone) **fails** both the scanner and CI.

## TWO INSTRUMENT DEFECTS CAUGHT WHILE BUILDING IT — both would have been silent

1. The Arabic pattern carried «حالية» but not «الحالي», so it missed «السعر الحالي» while
   catching the English "current price" **in the same bundle**. That is exactly the one-sided
   audit §1 records, where «في الوقت الفعلي» survived an English-only pass and stood for the
   majority of our users. Both forms now covered and pinned as test cases.
2. The liveness classifier searched the LEAF key, so `features.instant.description` searched for
   "description" — in hundreds of files — and §5's documented dead copy was classified LIVE. Now
   resolves the full lookup path; any partial reference marks a key live, because mislabelling
   live copy as latent hides a real violation.

**That is four instrument errors caught in two sessions.** The standing rule keeps paying.

## ONE DOC CORRECTION FOR THE FOUNDER

`LAUNCH_VOCABULARY.md` §5 lists *"Official partnerships with top stores"* as latent copy in
`landing.json`. **It is no longer in any message bundle.** Reported, not edited — the document is
yours to amend.

## VERIFICATION

| | result |
|---|---|
| unit tests | **960 / 960** (117 new) |
| vocabulary scan, production | **GATE: PASS** — 0 live findings |
| shell-verify, production | **40 / 40** unchanged |
| typecheck (new files) | clean |

**Honest limit on the production scan:** most surfaces are client-rendered, so §2 sees only the
served text (`/ar` ≈ 1.4k chars, not the full page). §1 (the bundles) is the stronger population
— all copy originates there. A clean §2 is not evidence the rendered page is clean, and the
script says so where it prints.

## ROLLBACK

```
562cd6d  ADR-157 F7·1 vocabulary as data   git revert 562cd6d
```

Additive: new `src/lib/vocabulary/`, one new test suite, one new script, one npm script. No
customer-facing behaviour changed, so a revert removes the artefact and the gate and nothing else.

## NEXT — DO NOT START AUTOMATICALLY

**F7·2** (post-generation validator) is the next step in the chain and is **not started**. It must
consume `EVIDENCE_REQUIRED_RULES` — those three rules are the part it exists to answer, and a
validator that treats a clean text scan as a pass would ship the exact false confidence F7·1 was
built to prevent.

---

# ═══ SUPERSEDED — 2026-08-01 CHECKPOINT #28 · ROOT-LAYOUT RESTRUCTURE · ONE DEFECT CLOSED, ONE CORRECTED ═══

**Tree clean, pushed, deployed, verified in production. Nothing running.**
Decisions: **ADR-155** (root layout) · **ADR-156** (canonical).

## ADDENDUM — `/en` CANONICAL FIXED (ADR-156)

`buildAlternates()` — the app's only `rel=canonical` emitter — hardcoded `/ar` for **every** page
in **both** locales. `/en` therefore declared itself a **duplicate of `/ar`**, which removes it
from the index and folds its signals into the Arabic page — while the site ships a full English
translation, `og:locale=en_US`, an `hreflang="en"` alternate and (since ADR-155) `<html
lang="en">`. The `hreflang` pair, which is the correct mechanism for "same content, two
languages", was already right; the canonical was cancelling it.

Fixed at the source: `buildAlternates(path, locale)`, locale **required** so a new call site
cannot silently reintroduce it. All three call sites updated. Now gated on **two independent**
call sites (site layout and product page) plus an hreflang-survival check.

| | production BEFORE | production AFTER |
|---|---|---|
| **shell-verify** | **38 / 40** | **40 / 40** |
| `/en` canonical | `https://tawveeri.com/ar` | `https://tawveeri.com/en` |
| `/en/products/<slug>` canonical | `…/ar/products/<slug>` | `…/en/products/<slug>` |
| hreflang pair | intact | intact (unchanged) |

**Second instrument error caught this session.** The first hreflang check matched `hreflang=`
case-sensitively and reported BOTH locales as having none — a much worse defect than the real
one. React renders the camelCase property, so the bytes say `hrefLang="ar"`. Corrected before any
conclusion was drawn. **That is now two false readings in one session; the standing rule keeps
earning its keep.**

## THE HEADLINE, STATED PLAINLY

The restructure was justified by TWO defects said to share one prerequisite. **One is closed.
The other's recorded cause was wrong, and the restructure does not fix it** — that is the more
important half of this checkpoint.

| defect | status |
|---|---|
| `/en` served `<html lang="ar">` with no `dir` at all | ✅ **CLOSED** — every surface, both locales, in the served bytes |
| site 404 page (unmatched routes) had no header, no fonts, no theme | ✅ **CLOSED** — a real page in both locales |
| `/ar/products/<missing>` answers 404 with an empty body | ❌ **NOT CLOSED, and not closable this way** — see below |

## WHAT THE 404-BODY ITEM ACTUALLY IS — the recorded cause was wrong

On record since CHECKPOINT #24: *"Next resolves the not-found above the shell, so the root
layout must own the HTML shell before any not-found boundary can render."* **Measured on this
build, four placements behave identically — 404, `<html id="__next_error__">`, ZERO bytes of
markup:** boundary at `(product)` · boundary deleted so the root one handles it · `notFound()`
from the page · `notFound()` from `generateMetadata`. Shell ownership is not the variable.

**The real cause:** `notFound()` raised during render aborts the entire React Flight stream,
because the throwing subtree is outside any Suspense boundary. Next serves its bare error
document; the browser renders the not-found from the flight payload after hydration. Put a
Suspense boundary above the page and the not-found **does** server-render in full — and the
status becomes **200**, because the shell flushes before the error arrives. That is precisely
the soft 404 the `(product)` route group was created to eliminate.

> Under Next 14 / React 18 streaming: **correct 404 status XOR server-rendered body.**
> We keep the status. A real visitor still sees the page; a crawler still gets 404.

**The only fix that yields both** is deciding existence *before* the render: a middleware lookup
that rewrites a miss onto an unmatched path (the routing-level 404 path, which does serve a full
body). It costs a network round trip on the hottest customer surface and duplicates the page's
own query. **Scoped, not started** — and it is not a layout change, so do not attach it to one.

## BEFORE → AFTER, MEASURED ON THE RENDERED ARTEFACT

```bash
npm run tps:shell-verify                                       # localhost:3000
node scripts/tps-analysis/shell-verify.js --base https://tawveeri.com
```

| | production BEFORE | production AFTER |
|---|---|---|
| **shell-verify** | **23 / 36** | **36 / 36** |
| `/en` served `<html>` | `lang="ar" dir="rtl"` on all 7 surfaces | `lang="en" dir="ltr"` on all 7 |
| 404 body (unmatched route) | 9,207 bytes, no header, no CTA, `lang="ar"` on `/en` | 119,088 AR / 98,267 EN bytes — header + heading + search CTA, correct locale, both |
| unified-search-verify | 54/54 | 54/54 (incl. *disclosure · relation=at-or-before*) |
| axe (36 renders) · keyboard | 0 rules · 0 nodes / 31 checks 0 failing 1 accepted | **identical** |
| ui-journey | 4 failing (`washing machine` relevance) | **identical set** — pre-existing, not this change |
| unit tests | — | 843 / 843 |

All AFTER figures are from **production**, after the deploy landed (`ed9492a`).

**ONE FALSE READING, CAUGHT — recorded because the next person will see it too.** The first
post-deploy `ui-journey` run reported a fifth failure that was not in the before-run:
`ar سماعات PICK … link=DEAD · could not resolve outbound offer`. It did **not** reproduce. Two
independent checks: a second full run returned the *identical* four-failure set, and the actual
smart-pick exit was followed by hand —
`/go/e416a719-…` → `302 https://www.amazon.sa/dp/B0CDMB5ZQW?tag=tawveeri-21&ascsubtag=…`.
`/go` is a route handler; layouts do not apply to it at all, so this change cannot reach that
path. Transient, not a regression — but it would have been easy to ship as one, in either
direction.

**Journey harness — it did NOT move, and that is the honest answer.** AR 10/10 end-to-end,
cards→real page 80/80; EN 10/10, 79/80 (98.8%). Identical before and after. It measures
reachability, and nothing about `lang`/`dir` or the 404 shell changes where a card goes.
(Note EN 79/80 vs the 76/80 recorded in #25 — that metric tracks the live catalogue, not code.)

**Silent trust elements, verified directly rather than by proxy:**
- AI disclosure at-or-before the advisor answer — `unified-search-verify`, DOM position.
- `tag=tawveeri-21` on a **real** outbound: `/go/<uuid>` → `https://www.amazon.sa/dp/B0CQ31Z35R?tag=tawveeri-21&ascsubtag=…`. Called with `?tw_test=1`, so the click records `is_test` and never enters the funnel it verifies.
- Observation lines still resolve from provenance: the DEBT-1 reference case renders ages **11, 26, 6** days — the recorded 10 and 25 plus one day of drift, which is the correct direction. **The retailer count on that case is 3, not the recorded 5** — identical before and after, so it is live-catalogue movement, not this change. The gate in `shell-verify` was written to ≥2 with that reasoning stated inline, deliberately not to a frozen count.

## WHAT CHANGED, AND THE ONE TRAP IT CREATED

`src/app/layout.tsx` now owns the HTML shell, the locale, the fonts and every provider; the
locale comes from the request (`x-locale`, middleware) because a root layout has no route param.
`[locale]/layout.tsx` keeps only metadata and the unknown-locale guard.

**THE TRAP, handled: never switch locale with `router.push` again.** Next does not re-render a
layout whose params did not change, and the root layout owns none — so a client-side locale
transition swaps the URL and the content while leaving the document's language, its direction
and every loaded message on the previous locale. Nothing throws. There were **five** independent
copies of that navigation (public shell, dashboard header, admin header, two in the profile
page); four would have been missed. All five now call `navigateToLocale()`
(`src/lib/i18n/switch-locale.ts`), which does a document load. The rule is also in CLAUDE.md.

## ROLLBACK

```
c5cef32  ADR-156 canonical per locale     git revert c5cef32
2f70a92  ADR-155 root-layout restructure   git revert 2f70a92
ed9492a  rollback hash in this checkpoint  git revert ed9492a   (docs only)
```

`2f70a92` is the whole change; reverting it restores the previous shell, the script-based
`lang`/`dir` correction and the bare 404 page. `9982a78` is the pre-session head.
**Confirm the range before any range revert** — `git log --oneline 9982a78..HEAD` first; an
inverted range silently reverts nothing.

## F7 — RESEARCHED AND SCOPED. NOT STARTED.

P2-5 (وفّر advisor build-out) is blocked on F7's runtime vocabulary guard, which had never been
scoped. It is scoped now. **No code was written for it.**

**What F7 requires** (`docs/CONSUMER_EXPERIENCE_CONSTITUTION.md` §F7, line 677): no claim outside
the approved vocabulary · never a merchant's discount presented as ours · absence stated plainly
with a handoff to search · adversarially tested before deployment against *a retailer with no
provenance* and *a category we do not cover* · and — stated by F7 itself — **if enforcing the
protections requires changing the protected AI control layer, stop and report before proceeding.**
The governing rule is one sentence: *whenever structured evidence and generated text disagree,
structured evidence always wins.*

**The finding that sizes the work: the approved vocabulary is not machine-readable.** CAN SAY,
MUST NOT SAY, the retirement of the retailer count (§9) and the disclosure wording (§8) are all
PROSE in `docs/LAUNCH_VOCABULARY.md`. A runtime guard cannot read prose. So the first execution
unit is not the guard — it is **turning the vocabulary into one typed, tested artefact that the
guard and the documents both read from**, or the two drift and the guard certifies a vocabulary
nobody approved. That is the whole reason F7 exists.

**The surface it governs is exactly one file today.** `src/app/api/ai-assistant/route.ts` — the
only runtime-generative endpoint, closed since P2-1 (`AI_ASSISTANT_ENABLED`, 404 when off, kept
deliberately as P2-5's starting point). `/api/v1/agent/decide` makes no model call, which is why
the unified search surface is not governed by F7 today (CHECKPOINT #25 established this and it
still holds after the restructure — no generated string was introduced).

**Shape, in order, when it is authorised:**
1. `src/lib/vocabulary/` — the approved claim classes and forbidden claim classes as data, plus
   tests asserting the doc and the module agree. Docs stay authoritative; the module is derived.
2. A **post-generation validator** (ADR-002: enforcement is post-generation, never prompt
   instruction) that reads a candidate answer plus the structured evidence that produced it, and
   rejects any claim the evidence does not carry. Rejection must fall back to the deterministic
   answer, not to an apology.
3. The adversarial suite F7 names, as a gate — not a manual pass.
4. Only then does `AI_ASSISTANT_ENABLED` become a decision rather than a hazard.

**Not begun, and it should not be begun inside another ticket.** Step 1 is a governance artefact,
and getting it wrong makes every later check confidently wrong.

---

# ═══ SUPERSEDED — 2026-08-01 CHECKPOINT #27 · §UNIFIED SEARCH COMPLETE · PHASE 2 OPEN ═══

**Tree clean, pushed, deployed, verified in production. Nothing running.**

## THE TWO STATUSES, STATED SEPARATELY

### §UNIFIED SEARCH — **COMPLETE.** All four routing branches exist and are verified live.

| branch | commit |
|---|---|
| exact product query → comparison | `3071af1` |
| need-based query → reasoning | `3071af1` |
| ambiguous → ONE clarification question | `306a8b4` (ADR-153) |
| **comparison request → structured comparison** | `1b8113b` (ADR-154) |

Plus the section's own conditions: one entry point (`3071af1`), and the AI disclosure
structurally inside the answer, verified in production by DOM position.

### Phase 2 — **OPEN**, and not because anything failed.

| unit | state | what unblocks it |
|---|---|---|
| **P2-4** customer-outcome measurement | **BLOCKED — no traffic.** It measures behaviour; there are no customers yet, so it would ship an instrument with nothing to read | **Launch traffic.** First questions already defined: share of queries carrying a need signal (UXD-004), and asked-vs-answered on the clarification question via `advisor_clarified` (UXD-005) |
| **P2-5** وفّر advisor build-out | **BLOCKED — F7.** F7's protections must exist before the generative surface does. The advisor is deterministic today, which is why it is safe | **Building F7's runtime vocabulary guard**, which is itself an execution unit and has not been scoped |
| Retailer-count amendment | ✅ **CLOSED** — decided and shipped in `53e6894` (§9 amendment, applied to the bundles) | — |
| Normalization backfill / DEBT-1 | **BLOCKED — data** | The match invariant (35 observations holding two canonicals) and the `asus\|dell g-series` parser defect |

## COMPARISON-INTENT ROUTING — WHAT LANDED

**Governing rule honoured: a comparison is offered only where the comparison page can deliver
it**, and deliverability is asked of `getComparison()` — the page's own loader — never of a
proxy. The harness proves it by **following every offered link and counting distinct retailer
exits** on the destination (5 for the deliverable case). Byte length is not evidence: an empty
compare page is ~1059 chars, a real five-retailer one ~1456.

**Two measurements worth carrying forward:**
- **Only 15.1% of canonicals (761/5,054) have ≥2 retailers.** "No comparison available" is
  the COMMON answer, not the edge case.
- **A two-product comparison has no page that can fulfil it.** `/compare/<key>` is one product
  across retailers; the two-product view is the localStorage compare LIST and is not
  URL-addressable. Pair requests therefore never route — by structure, not by policy.

**A second defect, found while measuring:** «قارن»/«أسعار» were being matched against product
text, so comparison queries returned **0 identity-bearing results** (99 results, 0 comparable)
versus 10 of 157 for the bare subject. Retrieval now runs on the subject; the typed query is
still echoed. Same for English (0 of 98 → 12 of 94).

---

# ═══ SUPERSEDED — 2026-07-31 CHECKPOINT #26 · P2-8 CLOSED ═══

## P2-8 STATUS — EXPLICIT

**CLOSED.** Four routing branches named by §UNIFIED SEARCH; all four now exist.

| branch | state |
|---|---|
| exact product query → comparison | ✅ `3071af1` |
| need-based query → reasoning | ✅ `3071af1` |
| bare category → browse/retrieval | ✅ `3071af1` |
| **ambiguous → ONE clarification question** | ✅ `306a8b4` (ADR-153) — **scoped INSIDE P2-8** |

**The boundary call, recorded so it is not re-litigated.** Clarification is a *branch of the
routing decision P2-8 built* — a router that structurally cannot ask is an incomplete router,
not a deferred feature. **Comparison-intent routing is NOT inside P2-8** and stays open as its
own unit: «قارن بين X و Y» needs a new destination and a comparison-generation capability that
does not exist at query time. That is a different kind of thing from a branch of a decision
that already runs.

**What closing it required, beyond the question itself:** the recorded failure — asking for a
room area supplied in the same sentence — was **not** a clarification bug. Every numeric regex
in `task-parser.ts` used `\d`, which matches ASCII only, so «٤٠» was dropped silently and the
field came back undefined. **Third occurrence of that trap in this codebase.** Now normalised
once at the parser entry point. Anyone touching Arabic numeric parsing should read ADR-153
before writing another `\d`.

---

# ═══ SUPERSEDED — 2026-07-31 CHECKPOINT #25 · P2-7 AND P2-8 IN PRODUCTION ═══

**Tree clean, pushed, deployed, re-measured live. Nothing running.**
Decisions: **ADR-151** (accessibility) · **ADR-152** (unified search). UX: `docs/UX_DECISION_RECORD.md`.

## P2-8 · UNIFIED SEARCH — THE ANSWER TO THE QUESTION YOU ASKED

**One capability at the surface. Two engines underneath. No amendment proposed.**

| | |
|---|---|
| **genuinely unified** | the entry point · the routing decision · the rendered answer · the AI disclosure |
| **still two** | `/api/search` and `/api/v1/agent/decide` are separate systems with different data paths, latencies and notions of "best". The customer sees one thing; the platform runs two |
| **coverage-bound** | the engine advises on **17 categories**. Everywhere else "the system determines internally" resolves to *retrieval* — not because the query lacked a need, but because the engine cannot serve it there. «سماعات للألعاب تحت 500» is a described need that gets retrieval |
| **unbuilt, and named in the Constitution** | *"Ambiguous requests may ask **one** clarification question"* — the surface hints (`addRoomSize`), it never asks · *"comparison requests may generate structured comparisons"* — «قارن بين X و Y» falls to retrieval |

**Why no amendment.** Nothing measured in production shows the principle cannot be achieved.
Each gap has a clear path — widen the engine's categories, implement clarification, add
comparison-intent routing. Amending now would ratify an implementation gap as a design limit,
which is the opposite of what an amendment is for.

### What shipped

The search box routes need-based queries to the deterministic decision engine and renders its
answer above the results. «وفّر» left the header — **that nav item WAS the choice the
Constitution forbids**. `/advisor` redirects into search carrying `?q=`; `/assistant` now
points straight at search instead of hopping through it. `advisor-client.tsx`'s ~320 lines of
rendering became `src/components/agent/advisor-answer.tsx`, which **both** surfaces render:
two surfaces cannot be one experience while each owns a copy of the answer.

**Classification (asked for before wiring): STRUCTURED EVIDENCE ONLY.** Every customer-visible
string is a translation key or a repo template literal with measured values substituted;
zero Anthropic/OpenAI/Gemini references under `src/lib/agent/` or `src/app/api/v1/agent/`.
`discount_intel.text` looked like an exception — it comes from a DB column — but it is
composed by `discountVerdictFromFacts()`, a pure function, and *materialised*, not authored.
So **F7 does not govern this surface today**, and the boundary is written into the component:
if any part of the answer ever becomes generated at runtime, it does.

**The hard condition is structural, not remembered.** The disclosure is the answer's first
child and there is **no prop to suppress it** — a `showDisclosure` boolean is exactly the
mechanism by which a trust element is lost in a restructure. Verified in production by **DOM
position**, not by "a disclosure exists somewhere on the page".

### Two judgement calls worth your attention

1. **The need-phrasing row on the search entry page.** Every "popular search" there is a
   product *name*, and every name routes to retrieval. Without something teaching the other
   half, the engine would run and never be invoked — indistinguishable from deletion. Three
   example phrasings are a first attempt, **not a measured answer**. When traffic exists
   (P2-4), measure *the share of queries carrying a need signal*. If it collapses versus the
   وفّر era, the fix is better teaching, not a second door.
2. **The retrieval smart-pick is suppressed when the engine answers.** Both are "our pick" on
   different grounds; showing both makes the customer arbitrate between two answers to one
   question. Advisor errors and empty results are **silent** on the unified surface — the
   results stand on their own, and an "I could not help" panel above good results invents a
   failure the customer does not have.

### Verified in production

```bash
node scripts/tps-analysis/unified-search-verify.js --base https://tawveeri.com   # 34/34
```

`docs/unified-search-2026-07-31-PRODUCTION.log` · journey unchanged before→after
(AR **10/10** end-to-end 80/80 cards; EN **10/10**, 76/80) · a11y unchanged (axe **0** across
36 renders, keyboard **31 checks 0 failing**).

### One risk this change introduced, and closed

The decision engine is now on the customer's **hot path**, called alongside every need-based
search — and it was still in the generic `api` bucket with coupons, products, auth and push.
On a NAT'd carrier IP that is the same starvation the telemetry incident already documents in
`middleware.ts`. Worse: an advisor 429 is deliberately silent here, so it would present as
"the assistant never answers for me". It now has its own bucket at 60/min, paired 1:1 with
search (`eec1eb5`).

---

# ═══ SUPERSEDED — 2026-07-31 CHECKPOINT #24 · P2-7 COMPLETE IN PRODUCTION · P2-8 STARTED ═══

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

## NEXT — what Phase 2 leaves open

| item | state |
|---|---|
| **P2-4** customer-outcome measurement | Still blocked on **traffic**. It now has a specific first question: *the share of queries carrying a need signal* (see UXD-004) |
| **Clarification question** | UNIFIED SEARCH names it; not built. `routeQuery` already returns the parsed task with `unresolved`, so the signal exists |
| **Comparison-intent routing** | «قارن بين X و Y» falls to retrieval |
| **Engine category coverage** | 17 advisable categories; widening it is what turns "two engines" into fewer gaps |
| **Root layout owns the locale** | `/en` still serves `lang="ar"` in its BYTES. Same prerequisite as the 404-body item — **one restructure unblocks both** |
| **a11y is not a gate** | `npm run a11y` exists and passes; nothing runs it on change |

---

# ═══ SUPERSEDED SECTION — P2-8 ENTRY POINT (kept for the reasoning) ═══

## P2-8 · UNIFIED SEARCH — STARTED, ROUTER LANDED, SURFACE DELIBERATELY NOT MIGRATED

**Done and shipped (`d5e06c0`):** the routing decision, isolated — `src/lib/agent/route-query.ts`
plus 23 tests, and the required before-measurement.

```
1. no category classified   → retrieval    4. ≥1 need signal → advisory
2. category not advisable   → retrieval    5. otherwise      → retrieval (browse)
3. query names a model      → retrieval
```

Two findings worth carrying forward, both already encoded and tested:

- **`audio` and `camera` parse as categories but `decide()` returns `supported: false`.** The
  advisable set is therefore built **from the engine's own dispatch** (`APPLIANCE_META` + the
  explicit cases), never restated, so the two cannot drift. Routing «سماعات للألعاب تحت 500»
  to the engine would replace working results with "not supported yet".
- **Model detection is precise on purpose.** A general `<word> <number>` rule also matches
  «مكيف 30 متر» and "laptop 5000" — a room size and a budget — which would take the reasoning
  engine dark for exactly the customers it serves.

**Before-measurement:** `docs/journey-2026-07-31-p2-8-before.log` — AR **10/10** end-to-end,
cards→real page **80/80**; EN **10/10**, **76/80 (95%)**. It also confirms P2-7 cost the
journey nothing.

### WHY THE SURFACE WAS NOT MIGRATED — read before doing it

`/search` and `/advisor` are **not the same capability with two doors.** Measured:

| surface | what it actually does |
|---|---|
| `/search` → `/api/search` | retrieval, plus a `decisionCard` that is the **best-matching result with a reason** — cheapest/most-relevant, not suitability |
| `/advisor` → `/api/v1/agent/decide` | the deterministic **decision engine**: room size → capacity, priorities → suitability, total cost, alternatives, evidence groups, confidence |

So absorbing `/advisor` into `/search` **cannot** be done by deleting a nav item and pointing
the box at the same API. If the nav entry goes before the search surface can render the
engine's answer, the customer loses the reasoning **and** the AI disclosure goes with it —
which is precisely the failure the Constitution's HARD CONDITION names: *a trust element
silently lost in a restructure, where nothing breaks, no test fails, and no error surfaces.*
Shipping that half-state is worse than not starting.

### THE EXACT NEXT STEP

1. **Extract `advisor-client.tsx`'s result rendering** (it is 498 lines, and the rendering is
   the bulk) into a shared `<AdvisorAnswer result locale />`. Both `/advisor` and `/search`
   render the same component — that is what makes the two surfaces one experience rather than
   two implementations of it. `src/lib/agent/advisor-api.ts` already exports every helper it
   needs (`recTitle`, `costLines`, `choiceReasons`, `exitHref`, `parsedSummary`,
   `evidenceGroups`), so nothing is duplicated.
2. **In `search-client.tsx`, call `routeQuery(q)`.** On `advisory`, fire `askAdvisor()` **in
   parallel** with `/api/search` and render `<AdvisorAnswer>` above the results. Parallel
   matters: the results must not wait on the engine. Note the rate-limit buckets —
   `/api/v1/agent/decide` sits in the generic `api` bucket, `/api/search` in `search`, so an
   advisory query spends one token from each.
3. **Carry the AI disclosure onto the unified surface** — the exact approved wording,
   `docs/LAUNCH_VOCABULARY.md` §8, both clauses; the second one is load-bearing.
4. **Only then** retire the وفّر nav item and redirect `/advisor` → `/search?q=…`.
5. **Verify in production**, both the journey harness delta and the disclosure's presence on
   the unified surface — "exactly as an affiliate tag is verified after an exit-layer change."

### ALSO WORTH DOING, CHEAP

**Wire `npm run a11y` into whatever runs on change.** Both harnesses exist and pass; nothing
runs them automatically. The `.sr-only` defect is the argument — it was invisible to the type
checker, the linter, the test suite and a served-HTML inspection, because it exists only in
the rendered artefact.

## ROLLBACK — this session, newest first

```
d5e06c0  P2-8 router + before-measurement git revert d5e06c0   (inert — nothing calls it yet)
7f5ca62  HANDOVER #24                     git revert 7f5ca62
a715177  ADR-151 + UX Decision Record     git revert a715177
d68cf5d  npm run a11y scripts             git revert d68cf5d
4672ec5  keyboard/focus/lang/target fixes git revert 4672ec5
4056572  BRAND GREEN token fix            git revert 4056572   ← the one with a visible cost
2d37f8e  the two harnesses + before log   git revert 2d37f8e
```

`d5e06c0` changes no customer-visible behaviour: `routeQuery` is not called from any surface
yet. It can stay while the rest of P2-8 waits.

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

---

## CHECKPOINT #43 — CATALOGUE TRUTH AUDIT (2026-08-01/02)

**The question as posed was invalid.** "12,000 listings vs 507 products" compared a
count of store-product RELATIONS against a BROKEN PAGE METRIC. 507 was never a
population. Denominators, one snapshot, one cohort:

| Figure | Entity | Value |
|---|---|---|
| `product_stores` | store×product relations, current | 13,201 |
| distinct products carried | products, current | 9,378 |
| `raw_observations` | observation events, cumulative | 831,694 |
| distinct URLs observed | listings, cumulative | 14,245 |
| `normalized_product_observations` | normalized events | 127,167 |
| …carrying a canonical | — | 125,034 (98.3%) |
| `canonical_products` active | canonicals | 7,191 |
| `tps_product_projection` | customer-visible canonicals | 5,070 |
| …with 2+ stores (comparable) | comparable canonicals | 763 |

**Two defects, both root-caused and both fixed as separate reversible units:**
- ADR-172 (`fd6a663` + `4f68477`) — the retailers page selected `product_stores`
  with no `.range()` and no `.order()`. PostgREST capped it at `db-max-rows`=1000,
  so the page saw **7.6%** of the table, understated by ~18x, **non-deterministically**
  (Extra read 85 then 57 on consecutive loads), and **hid two entire retailers**.
  Now paginated in parallel: **9 stores / 9,388 products**, 3–5s in both locales.
- ADR-173 (`13b66ac`) — the «موثوق»/Trusted tile. `is_premium: false` is hardcoded
  in the store mapper; no measured definition of "trusted" existed. It could only
  ever render 0. Removed, per the brief's instruction not to invent a replacement.

**Hypotheses REJECTED by measurement** (all four, including two of my own):
1. "Identity resolution is the largest loss" — **no.** 98.3% of normalized
   observations already carry a canonical.
2. "header 507 vs per-store sum 534 is a defect" — **no.** They match exactly
   (505 == 505, stable across 3 runs). The 534 was read from a truncated page.
3. "There is hidden comparison depth to release" — **no.** All 730 canonicals with
   2+ stores are already in the projection; 729 already flagged `has_comparison`.
4. "The 2,337 active canonicals missing from the projection are recoverable volume"
   — **no.** They have **zero** normalized observations. Correctly excluded.

**WHERE THE PRODUCTS ACTUALLY ARE — storefront carried vs known to TPS:**

| Store | Storefront | In TPS | Gap | Limiter |
|---|---|---|---|---|
| Noon | 3,750 | 1,254 | **2,496** | never observed (2,590 obs < 3,750 products) |
| Amazon SA | 1,834 | 477 | **1,357** | never observed (1,101 obs) |
| Jarir | 994 | 321 | **673** | observed but unidentified (23,162 obs, 321 canon) |
| Almanea | 1,298 | 1,146 | 152 | near-complete |
| Extra | 871 | 1,652 | −781 | TPS knows more than the storefront carries |

**The two-track architecture is the finding.** The storefront layer carries 9,378
products the knowledge layer has never seen. This is NOT merchant-data-access-bound
(ADR-133's ceiling) — the products are **already in our own database**. It is a
bridge that was never built between two tracks that grew separately.

**`store_id` type defect (small, real):** `normalized_product_observations.store_id`
holds Arabic store NAMES in 2,929 rows (المنيع 1,681, اكسترا 1,080, جرير 168)
alongside integer ids. Those rows cannot join to `stores.id`, so they can never
corroborate. Worth ~69 canonicals — record it, do not prioritise it.

**NOT DONE:** §6 query coverage (real vs diagnostic queries) — context exhausted.
Stated as an omission, not silently dropped.

**What we may honestly say publicly today:** we compare 9 Saudi retailers; we carry
9,378 products; we hold 763 products with a genuine multi-store price comparison;
every price we show is an observation with a timestamp and a source.
**What we must not say:** that we compare "12,000 products" (that is relations, not
products), that any retailer is "trusted" (no measured definition exists), or that
9,378 products are comparable (763 are).

---

## CHECKPOINT #44 — TPS BRIDGE: GATE §1 FAILED, NO WRITE PERFORMED (2026-08-02)

**Authorised unit: the carried-but-unobserved TPS bridge. NOT EXECUTED.**
Gate §1 ("prove the source population") failed. Per §5 the unit stopped before any
production write. Nothing was written. Rollback is not required: no rows were emitted.

### Why the unit died — my audit finding was wrong

CHECKPOINT #43 claimed 4,526 products are "carried but never observed" at Noon,
Amazon and Jarir. **That figure was an artefact of a NULL-poisoned anti-join.**
`raw_observations.raw_url` is NULL for these stores (Noon: 0 of 11,127 rows carry a
URL; Jarir: 9,714 of 90,205). My anti-join tested `r.raw_url = ps.product_url`, which
is NULL for nearly every row, so `NOT EXISTS` returned true for almost everything.

Re-keyed on `raw_name` — the key these stores actually populate — the real population is:

| Store | Storefront products | Genuinely never observed |
|---|---|---|
| Noon | 3,749 | **7** (0.2%) |
| Jarir | 982 | **1** (0.1%) |
| Amazon SA | 1,825 | **0** |

**8 products, not 4,526.** Verified non-spurious: sampled storefront names match
exactly ONE raw observation each (not zero, not many). The bridge would have written
~6,676 duplicate observations for near-zero gain.

I flagged this exact hazard in #43 ("the raw→normalized URL gap is partly a join
artefact because layers key URLs differently") and then built a recommendation on top
of the same artefact anyway. **A stated caveat is not a control.**

### The prior art that should have warned me

`normalized_product_observations` already contains 2,133 rows with
`source_table='products'` (2026-06-29/30) — a PREVIOUS run of this same bridge. It
failed silently: **0 canonicals**, empty `normalized_payload`, and `store_id` holding
Arabic store NAMES. Those rows ARE the §7 "Arabic store_id" finding. Same rows, same
cause. They are Almanea/Extra only, so they never collided with this unit's target.

### Where the products actually stall — measured

- **Identity is NOT the loss.** For Noon every category normalizes at 100% yield
  (laptop 958/958, monitor 552/552, tablet 188/188, air_fryer 187/187).
- **Normalizer backlog is NOT the loss.** Stores 1, 2, 3, 4, 5 all report `behind=0`.
- **The loss is category registration.** Only 2,590 of Noon's 11,127 observations ever
  receive a `detected_category`; the rest fall outside the registry and are skipped.
- **Two stores are disconnected outright:** LuLu (23) and Sharaf DG (24) hold 11,454
  raw observations / 495 distinct products and have **no `tps_progress_cursors` row at
  all**. The normalizer has never been told they exist. `stores.name_en` is also NULL
  for both.

### §7 recorded as instructed — schema-integrity defect, not a curiosity

`normalized_product_observations.store_id` is `text` and holds two different types:
integer ids and Arabic names (المنيع 1,681, اكسترا 1,080, جرير 168 = 2,929 rows).
Rows keyed by name cannot join `stores.id`, so they can never corroborate — worth ~69
canonicals. **Definition drift inside the schema will produce another silent failure.**
Own boundary, not this one.

### Gates

§1 prove source population — **FAILED (8 products, not 4,526)** · §2 identity/provenance
— not reached · §3 idempotency — not reached (and `idx_npo_source` is NOT unique, so
there is no DB-level duplicate guard today) · §4–6 — not reached. No production write.

---

## CHECKPOINT #45 — ADR-174: LULU + SHARAF DG SWEPT INTO THE KNOWLEDGE LAYER

**Executed. Both stores are now in the TPS sweep. My own projection was REJECTED.**

### Root cause — the cursor was a symptom, not the disease
`progressive-engine.ts` iterates `for (const s of TPS_STORES)`, a hardcoded constant in
`category-registry.ts`. LuLu (23) and Sharaf DG (24) were simply absent from it. Their
missing `tps_progress_cursors` rows were a CONSEQUENCE — the cursor is upserted *after* a
sweep, so an unlisted store can never acquire one. **Seeding a cursor would have done
nothing.** The fix was two entries in a constant. No schema change, no DDL, no manual
row writes.

### Measured result (baseline → after full chain rebuild)

| Metric | Before | After | Δ |
|---|---|---|---|
| normalized observations | 127,167 | 130,805 | +3,638 |
| active canonicals | 7,191 | 7,261 | **+70** |
| customer-visible products | 5,070 | 5,140 | **+70** |
| **price-comparable products** | **763** | **771** | **+8** |

LuLu 1,919 normalized rows · Sharaf DG 469 · together **88 canonicals, 19 comparable**,
of which **8 gained a second displayable retailer because of this unit** (11 joined
comparisons that already existed). Categories: monitor, audio, tablet, TV.

### THE PROJECTION IS REJECTED — say it plainly
I forecast **400–495 products**. Measured: **70**. Off by ~6x.
The error: I equated *distinct raw product names* (495) with *products that survive
identity*. LuLu's 10,084 observations are ~45x time-duplicated and collapse to **44 valid
identity keys**; Sharaf DG's 1,370 to 36. **Distinct names are not distinct products.**
The "9/9 corroborated" dry-run signal was real but measured upsert rows, not net-new
canonicals — the identical conflation that killed the previous unit one checkpoint ago.
**Two units in a row failed on the same class of error: a counter that does not count
what its name suggests.**

### Gates
- §1 population — proven, then contradicted my own forecast. Reported.
- §2 provenance — `source_table='raw_observations'`, real `observed_at` (`o.observed_at ?? now`),
  integer store_id. Nothing invented.
- §3 idempotency — **PROVEN: 0 duplicates across all 2,388 rows** (`count(*)` =
  `count(distinct source_record_id)`). Structural, not incidental: row ids are
  `stableUuid(raw_obs_id)` and `write_ac_batch` uses `on conflict (id) do update` for
  observations/canonicals and `do nothing` for matches, so matches are never reassigned.
- §4 safety — no conflicting writer at start, lane lock active, bounded batches, resumable
  via cursor, one store at a time.
- §5 **no schema changes.**
- §6 outbound — **100% URL coverage on both stores.** Exits verified live:
  LuLu `/go` → 302 luluhypermarket.com · Sharaf DG `/go` → 302 saudi.sharafdg.com.
  Compare page `/ar/compare/samsung|32|qhd|180|ips` renders 200 with Sharaf DG present.

### §3 DISPLAYABILITY — STOPS FOR THE FOUNDER
`tps_merchant_trust`: both stores **`sample_size = 0, confidence = low`**.
**They do NOT meet the displayable-retailer standard for trust claims.** No vocabulary
amendment is proposed; the exclusion stands on the evidence it was set on.

**But note a distinction the pipeline already acted on:** entering the knowledge layer made
their OFFERS render on comparison pages immediately. An offer row is a factual observed
price with a working exit — that is evidence-backed. A *trust verdict* about the merchant
is not. **Founder decision required:** is offer display acceptable while trust display
stays excluded, or should these two be suppressed from comparison surfaces entirely until
they have a trust sample?

### Pre-existing defect found, NOT repaired (own boundary)
`normalized_product_observations` holds **1,166 duplicate `source_record_id`s** among
`raw_observations`-sourced rows — the same raw observation normalized under two different
categories. None are mine (my stores: 0 dupes). Separate from the 2,929 Arabic-`store_id`
rows, which also remain unrepaired as instructed.

### Rollback — concrete, and honestly qualified
1. `git revert b668497 ec3a60a`
2. `update stores set name_ar=null, name_en=null where id in (23,24);`
3. `delete from normalized_product_observations where store_id in ('23','24');`
   `delete from tps_progress_cursors where store_id in (23,24);`
4. `npm run tps:refresh`

**Qualification:** steps 1–4 fully remove these stores' offers. They do NOT cleanly undo
the +70 canonicals, because those canonicals are now shared with other retailers — removing
them would delete legitimate products. After rollback the +70 revert to single-store and
the +8 comparables revert to non-comparable, which is the correct end state.

---

## CHECKPOINT #46 — ADR-175: CATEGORY-REGISTRY PILOT (laptop)

**Pilot category chosen on the founder's two conditions, both measured:**
largest classification failure (890 distinct laptop names absent from the knowledge
layer) AND multi-retailer stock (12 stores; Amazon 251, Extra 212, Noon 180, BC Palace
138). Laptop also had the highest canonical count already (722), proving it corroborates.

### The gap was not what the category list suggested
Bucketing unclassified names by keyword first suggested a MISSING category
(`case_cover` 1,345 names / 13 stores; `storage` 634 / 15). **Sampling killed that:** the
`storage` bucket was ~80% laptops whose titles merely mention SSD/ذاكرة. The real defect
is an EXISTING category failing on merchant naming, not an unregistered one.

Root cause: `extractManufacturerModel()` reads the **payload only**. Arabic listings put
the MPN in the TITLE — `X1504VA-BQ575W`, `83UR007EAD`, `U7-14ILL10`, `9S7-14J112-1024` —
and the family regexes are English-only, so «لابتوب اسوس فيفوبوك» loses family AND model.
Deterministic probe of absent laptop-keyword names: 274 total, 133 correctly rejected as
accessories, **73 identifiable (45 via the new title extractor)**.

### THE FINDING THAT CHANGED THE DESIGN
Wiring the title fallback in unconditionally, measured on ONE fixed window (store 2,
`--replay-from 0`, 500 observations):

| | before | unconditional | rescue-only |
|---|---|---|---|
| valid identity tier | 88 | 96 | **95** |
| **corroborated canonicals** | **23** | **18** ❌ | **23** ✓ |

**More identity, fewer comparisons.** A `MODEL:` key outranks the spec key, so listings
that used to merge across stores on `brand\|cpu\|ram\|storage` split the moment one
merchant writes `X1504VA` and another `X1504VA-BQ575W`. Precision rose; comparison
coverage fell. **Precision and comparability are not the same axis, and comparison is the
product.** Gating the rescue on an incomplete spec triple makes it zero-churn: an
already-identifiable laptop keeps its exact key, so no existing comparison can break.

### Measured result (Amazon + Noon replayed, full chain rebuilt)

| Metric | Before | After | Δ |
|---|---|---|---|
| active canonicals | 7,269 | 7,310 | **+41** |
| customer-visible products | 5,148 | 5,189 | **+41** |
| **price-comparable products** | **771** | **776** | **+5** |
| laptop canonicals | 722 | 825 | +103 |

### Acceptance criteria — all four held
1. **Zero precision regression.** Exactly one accessory sits under `detected_category='laptop'`
   («باندل حقيبة لابتوب») and it is NOT from this unit: `normalizer_version=v9.0.2`,
   `store_id='المنيع'`, dated 2026-06-29 — a row from the failed June bridge.
2. **No CPU token ever extracted** — 11/11 fixtures, including `i5-1334U`, `7-255U`,
   `X1-26-100`, `4.10GHz`, `14.0-inch`.
3. **Baseline laptop canonicals did not fall** (722 → 825).
4. **Measured as net-new comparables after `tps:refresh`**, never upsert counts.

### Scope NOT covered (remaining headroom, deliberately unclaimed)
Only stores 2 and 3 were replayed. Extra (212 missed names), BC Palace (138) and Almanea
— which carries the richest Arabic laptop titles and still shows ~3,078 observations
behind — were NOT replayed. **I will not extrapolate a yield from +5;** the honest next
step is to replay one more store and measure again.

### Rollback
`git revert 9c13cc3`. The emitted rows need no deletion: the gate is rescue-only, so
reverting stops new title-derived keys without invalidating existing ones. To fully
restore prior state, reset cursors for stores 2 and 3 to 0 and re-sweep — writes are
deterministic upserts (0 duplicates proven in #45).

### Still deferred, recorded not forgotten
1,166 duplicate `source_record_id`s (same observation under two categories) and 2,929
Arabic `store_id` rows. Both schema-integrity defects producing silent failures. Own
boundary each.

---

## CHECKPOINT #47 — EXTRA/ALMANEA REPLAY: THRESHOLD SET, RESULT PENDING

### The threshold, fixed BEFORE the run (as required)
- **Justifies continuing:** **>=15** net-new comparables from Extra + Almanea (776 -> 791) —
  3x the Amazon+Noon yield on similar input, meaning replay yield scales with stores left.
- **Means classification is not where the volume is:** **<=5** — same magnitude as two
  stores ago despite two more retailers, retiring replay-of-classification as a lever.
- 6–14 is ambiguous and treated as a STOP unless concentrated in a category with
  demonstrated cross-retailer overlap.

### Baseline (frozen before replay)
canonicals 7,310 · projection 5,189 · **comparable 776**
store_count distribution: 0→211 · 1→4,202 · 2→591 · 3→136 · 4→42 · 5→7

### A BLOCKING DEFECT WAS FOUND AND FIXED FIRST (commit e380131)
The replay failed instantly with `ENOTFOUND db.vyceqrzttspyycdpojtn.supabase.co`.
Supabase's direct host is IPv6-only; BOTH pg connections in `normalize-incremental.ts`
used `SUPABASE_DB_URL` raw. One of them is the **ADR-099 lane lock**, so the
serialization guard **failed CLOSED** — no sweep could run at all, and the symptom looked
like a database outage rather than a resolver problem. CLAUDE.md already required routing
through `pooler-url.js`; that rule now applies to the guard itself.
**This was silently blocking ALL manual normalization, not just this unit.**

### STATE AT HANDOFF — replay INCOMPLETE, threshold NOT yet testable
- Extra (store 4): cursor reset to 0; **~8,500 of 54,378 replayed (~16%)**, still draining.
- Almanea (store 5): **not started**, 3,242 behind.
- `tps:refresh` NOT run since the replay began, so `comparable` still reads 776 — that is
  a stale figure, not a result.
- **No verdict is claimed against the threshold.** Judging a >=15 test on a 16% replay
  would repeat the exact error this stopping rule exists to prevent.

### Note: `--batches` is hard-capped at 20 (10,000 observations/run)
`Math.min(20, arg("batches", 6))`. A 54k store needs ~6 sequential runs; observed
throughput was lower still (~2,000/run). Any future full-store replay must budget for this.

### TO COMPLETE (no new decisions needed)
1. Drain store 4 to `behind=0` (repeat `--stores 4 --limit 12000 --batches 20`).
2. Drain store 5 (one run).
3. `npm run tps:refresh` — NOT concurrently with any sweep (ADR-099).
4. Re-measure canonicals / projection / **comparable** and the store_count distribution;
   compare against the frozen baseline above and report against the threshold.
The hourly scheduler will drain both stores on its own now that the pooler fix has landed,
so this completes without manual intervention if left alone.

### Rollback
Replay itself needs none — writes are deterministic upserts (0 duplicates proven in #45)
and the cursors are already reset, so re-sweeping only rebuilds what was there.
`git revert e380131` reverts the pooler fix, but that would re-break all manual
normalization and is not advised.

### Still deferred, unchanged
1,166 duplicate `source_record_id`s · 2,929 Arabic `store_id` rows. Own boundary each.

---

## CHECKPOINT #48 — THRESHOLD TESTED: CLASSIFICATION RETIRED AS THE CONSTRAINT

**Result: +1 net-new comparable. The pre-set threshold said <=5 retires the lever.
It is retired.** No softening: this is the smallest result of the four units.

### Measured against the frozen baseline

| Metric | Before | After | Δ |
|---|---|---|---|
| active canonicals | 7,310 | 7,311 | **+1** |
| customer-visible products | 5,189 | 5,190 | **+1** |
| **price-comparable products** | **776** | **777** | **+1** |

| store_count | before | after |
|---|---|---|
| 1 (single-store) | 4,202 | **4,202** |
| 2 | 591 | **592** |
| 3 | 136 | 136 |
| 4 / 5 | 42 / 7 | 42 / 7 |

**`store_count=1` did not move.** Almost nothing gained a second retailer.

### Per store (as required)
- **Almanea (5): swept to `behind=0` — COMPLETE. Contributed ~0.** This is the store with
  the richest Arabic laptop titles, i.e. exactly what ADR-175 targets. It is the cleanest
  possible test of the classification hypothesis and it returned nothing.
- **Extra (4): ~23,250 of 54,378 replayed (~43%), 31,128 remaining.** Contributed ~+1.
- canonicals gaining a SECOND displayable retailer: **+1** · a third or later: **0**.
- Caveat kept honest: Extra is partial. But Almanea was complete, and a lever that
  produces ~0 on a complete store is not rescued by finishing a partial one.

### §4 — WHAT THE MEASUREMENT POINTS AT INSTEAD
**It is not classification. It is overlap.**
4,202 of 5,190 customer-visible products (**81%**) are carried by exactly ONE retailer,
and that figure was unchanged by this work. Classification is producing canonicals fine —
what it produces are products only one merchant sells. Detection and identity both work;
the detected products simply do not co-occur across retailers.

**This is a comparison problem, not a classification problem** — which is ADR-133's
merchant-data-access ceiling, now reached from a fourth independent direction.

### Four hypotheses retired by measurement, each narrowing the search
1. **Identity resolution is the largest loss** — no: 98.3% of normalized observations
   already carry a canonical.
2. **Carried-but-unobserved storefront products** — no: 8 products, not 4,526 (the figure
   was a NULL-poisoned anti-join).
3. **Stores missing from the sweep** — real but small: +70 products, +8 comparables.
4. **Classification coverage** — no: +1 comparable, single-store count unchanged.

**All four converge on the same constraint: we do not have enough retailers selling the
SAME products.** More parsing, more stores in the sweep, and more identity work each move
inventory, not comparison.

### What that implies for the next unit (scoped, NOT started)
The lever is merchant overlap on products we already carry — i.e. acquiring data access to
retailers whose catalogues INTERSECT ours, not retailers who add new single-store SKUs.
`tps:feed-probe` already scores exactly this (SAR-gated overlap). Any candidate merchant
should be judged on **predicted overlap with our existing 4,202 single-store products**,
before any engineering.

### State / rollback
Extra's cursor remains mid-replay; the hourly scheduler drains it automatically now that
the pooler fix (e380131) has landed. No rollback needed — writes are deterministic upserts
(0 duplicates proven in #45). Still deferred: 1,166 duplicate `source_record_id`s, 2,929
Arabic `store_id` rows.

### #48 CORRECTION — final post-refresh figures (the chain was still running when first read)

The 8-step chain took 1,145s; the figures in #48 above were read while it was still
executing. Final:

| Metric | Baseline | Final | Δ |
|---|---|---|---|
| active canonicals | 7,310 | 7,314 | +4 |
| customer-visible products | 5,189 | 5,193 | +4 |
| **price-comparable products** | **776** | **778** | **+2** |
| single-store products | 4,202 | **4,204** | **+2** |

**Verdict UNCHANGED: +2 is inside the pre-set `<=5` retire band.** And the sharper
version of the finding survives the correction — **single-store products grew by the same
amount comparables did.** Every product this work added was carried by one retailer.

**Read these as moving numbers, not a frozen ledger:** the hourly scheduler is still
draining Extra's remaining ~31k observations, so canonicals/projection will keep drifting
upward. Any future comparison must re-freeze a baseline rather than reuse these.

---

## CHECKPOINT #49 — THE OVERLAP UNIT: THE ANSWER IS IDENTITY-TIER ASYMMETRY

**BASELINE FROZEN 2026-08-02T10:38:00Z** (the scheduler is still draining Extra, so any
future comparison MUST re-freeze rather than reuse these):
projection 5,193 · **comparable 778** · single-store 4,204 · active canonicals 7,314

### §1 tested first, as instructed — and it did NOT need a new retailer

Who holds the 4,204 single-retailer products:
Extra 1,036 · **Noon 1,011** · Almanea 787 · **Amazon 303** · Jarir 189 · Najm 159 ·
Shaker 154 · Nakheel 99 · Sharaf DG 52 · Amn Kum 38

Bounded sample: 400 single-store products held by Extra/Almanea/Jarir, all with a
model_number of >=6 chars. Asked whether Amazon or Noon ALREADY hold a raw observation
whose name contains that model number.

**51 of 400 = 12.75% already had one.** Extrapolated across the 4,204 that is
**~536 products that could become comparable from evidence ALREADY IN OUR DATABASE** —
no new retailer, no new parser, no scraping, no maintenance.

### Root cause — NOT discovery, NOT classification, NOT missing data
Those 51 products have **1,574** matching observations at Amazon/Noon.
**1,473 of them (93.6%) are already STAGED** — read, detected, classified. Only 101 were
never staged.

They fail to corroborate because the two stores land on **different identity tiers**:
one side keys `brand|MODEL:<mpn>`, the other `brand|cpu|ram|storage`. A model-keyed and a
spec-keyed observation of the SAME product can never merge, because corroboration groups
on the identity key.

**This is the mechanism behind the collective finding.** The catalogue is not as
single-store as it looks — a meaningful slice is the same product split across two
incompatible key spaces.

### §4 — THE RULE IS VERIFIED. Four units, measured:

| Unit | products added | comparables added | single-store added |
|---|---|---|---|
| ADR-172/173 retailers page | 0 (display only) | 0 | 0 |
| ADR-174 LuLu + Sharaf DG sweep | +70 | **+8** | +62 |
| ADR-175 laptop parser rescue | +41 | **+5** | +36 |
| Extra/Almanea replay | +4 | **+2** | +2 |

Inventory grew every time; comparison depth barely moved, and single-store grew almost
exactly in step. **RECORDED AS A VERIFIED RULE:**

> **Catalogue depth and comparison depth are different problems with different fixes.
> Only overlap on the SAME COMMERCIAL VARIANT increases comparison depth.**

### §3 — `tps:feed-probe` NOT USED, and not rehabilitated
Verdict B stands: it scores brand-level similarity, and this unit shows brand overlap is
not the binding constraint at all — **variant KEY COMPATIBILITY is.** Two stores can carry
the identical variant and still not compare. A probe that cannot see that cannot rank
retailers for this purpose. Rejected for prioritisation; a bounded measured run replaced it.

### §2 — NO NEW RETAILER WAS ONBOARDED, deliberately
The §1 test succeeded, so §2's precondition ("only if that yield is poor") was never met.
Adding a retailer now would add inventory into the same broken key space.

### NOT DONE — the fix itself, and why
Cross-tier identity matching (letting a `MODEL:` key corroborate with a spec key for the
same product) is the fix. It was NOT implemented here: it is an identity change, and
ADR-175 measured that an identity change can REDUCE comparables (23 -> 18) while raising
identity counts. Shipping it without the same before/after discipline would repeat the
failure this week retired. **It is the next unit, and it is now precisely specified.**

Acceptance criteria for it, set in advance:
- net-new comparables measured after `tps:refresh` against a re-frozen baseline
- ZERO existing comparison broken (store_count must not fall for any canonical)
- no false merges: a cross-tier link requires the model number to appear in the
  spec-keyed observation's raw_name, never inferred
- bounded to one category first (laptop has both key tiers in volume)

### Still deferred / untouched
Extra's cursor is draining via the scheduler as intended. 1,166 duplicate
`source_record_id`s and 2,929 Arabic `store_id` rows remain their own boundaries. No
schema changes. Nothing became customer-visible, so the displayability gate was not reached.

---

## CHECKPOINT #50 — CROSS-TIER UNIT: THE TOOL ALREADY EXISTED (ADR-060)

**Do not build a cross-tier matcher. One is already written and it is safer than what I
was about to write.**

`scripts/tps-core/write-alias-canonicals.ts` (`npm run tps:alias-foldin`, ADR-060) exists
for precisely the defect diagnosed in #49 — its own header states it materializes
"identity classes that exist only because the MODEL: and spec key spaces were bridged by
co-occurrence evidence."

Its documented safety properties independently match every acceptance criterion I had set
in #49 before finding it:

| my criterion (#49) | ADR-060 property |
|---|---|
| zero existing comparison broken | **clean-create only** — a class is written only when NO member observation is already attached to another canonical; overlapping classes are DEFERRED, never force-merged |
| no false merges | needs **>=2 DISTINCT stores** and a bridgeable spec key |
| bounded / reversible | every row stamped `tps_version='alias-reconciliation-v1'` |
| safe to re-run | deterministic ids; a re-run finds members attached and defers them |
| evidence intact | `raw_observations` only ever READ |

Only **1** canonical currently carries that stamp, so this mechanism has essentially never
been run against the current catalogue — while #49 measured ~536 products waiting for
exactly it.

**Also note:** this script has ONE raw `process.env.SUPABASE_DB_URL` pg connection and so
carries the same IPv6 exposure fixed in `e380131` for the normalizer. It has not failed
yet, but route it through `toPoolerDbUrl` before relying on it in automation.

### State at handoff
`tps:alias-foldin --dry` was launched and is STILL RUNNING (>10 min, no output yet — it
builds its classes before printing). **It writes nothing.** Nothing was committed to
production by this unit. Baseline remains frozen at 2026-08-02T10:38:00Z:
projection 5,193 · **comparable 778** · single-store 4,204 · canonicals 7,314.

### To complete (no new decisions)
1. Read the `--dry` output: classes that would be created, and how many are DEFERRED for
   overlap (deferrals are the safety valve working, not a failure).
2. Run live, then `npm run tps:refresh` — never concurrently with a sweep (ADR-099).
3. Re-measure against the frozen baseline above; the number that matters is
   **comparable 778 → ?**, not canonicals.
4. If the yield is far below the ~536 estimate, the gap is the clean-create constraint
   (products whose observations are already attached), and THAT is the careful-merge
   boundary ADR-060 explicitly defers — a separate unit, not a patch to this one.

### #50 RESULT — ADR-060 YIELDS ZERO. The whole opportunity is behind the deferred boundary.

`tps:alias-foldin --dry` completed. Measured:

```
scanned=846,057  saudi listings=33,858  non-saudi excluded=7,947
with identity=11,023  no identity=22,835
identity classes=5,233  corroborated(>=2 stores)=903  bridged-only=157
clean-create eligible=0   deferred: attached=156   card-collision=1
```

**157 genuine cross-tier bridges exist. ZERO can be safely created.** 156 are deferred
because their observations are ALREADY ATTACHED to another canonical; 1 is a card
collision. This is exactly the outcome #50 predicted, and it means the safe tool cannot
convert a single product.

**TWO CORRECTIONS TO MY OWN #49 FIGURE — both downward:**
1. Measured bridgeable classes are **157, not ~536**. My ~536 came from extrapolating a
   400-row sample where a model number merely APPEARED in another store's `raw_name`.
   That is a looser test than a bridgeable identity class, and it overstated by ~3.4x.
   **A substring match is not an identity class.** Same error family as the NULL-poisoned
   anti-join: a cheap proxy read as the real population.
2. Even those 157 are unreachable by clean-create.

**STRATEGY-LEVEL CONSEQUENCE (not an implementation detail):**
The cross-tier opportunity cannot be taken by any additive mechanism. Every candidate
requires MERGING two canonicals that both already own observations — the "careful merge"
ADR-060 deliberately refuses, because a wrong merge shows a customer two different
products as one price comparison. **That is a Protected-Trust-shaped risk, not a
throughput problem**, and it is the first constraint this week that cannot be measured
away — it needs a merge policy decision.

Also measured and worth its own look: **22,835 of 33,858 Saudi listings (67%) carry NO
identity at all** — an order of magnitude larger than the cross-tier set.

**No production write was made by this unit.** Baseline unchanged and still frozen at
2026-08-02T10:38:00Z: projection 5,193 · comparable 778 · single-store 4,204.

---

## CHECKPOINT #51 — ADR-176 RECORDED; THE 22,835 MEASURED AND AIMED

### ADR-176 is now in the Decision Register (commit ff73a2c)
Protected Trust Policy: **canonical merges require a LITERAL model-number match in the raw
name of both sides.** Never inferred, never probabilistic. Founder reasoning: a shopper
comparing `QN90D-55` against `QN90D-65` buys the wrong size believing they found a better
price — no comparison delays trust, a wrong one destroys it. If it makes the cross-tier
gain far smaller, that smaller number is the correct one.
**Governance debt recorded in the same ADR:** ADRs 163–175 exist only in HANDOVER, never
in `docs/DECISIONS.md`. Backfill from checkpoints #38–#50.

### The 22,835 — NOT an unparseable mass. Mostly DETECTED, KEYED, and rejected on confidence.
`tps_identity_staging` holds only two statuses: **valid 282,814** (4,047 keys) and
**low_confidence_candidate 69,783** (1,604 keys). The unidentified Saudi listings are
dominated by the second — i.e. the plugins DID detect the category and DID build an
identity key, and the confidence score then rejected it.

Low-confidence volume by category (observations / distinct keys / stores):

| category | low-conf obs | distinct keys | stores |
|---|---|---|---|
| **air_conditioner** | **35,889** | **688** | 10 |
| smartwatch | 10,885 | 93 | 11 |
| **tv** | 7,211 | **279** | **18** |
| oven | 3,519 | 18 | 9 |
| monitor | 3,066 | 177 | 13 |
| vacuum | 2,643 | 56 | 12 |
| coffee_maker | 2,439 | 20 | 7 |
| air_fryer | 1,722 | 17 | 10 |

**This is additive and carries no merge risk** — every one of these is a NEW identity, not
a merge of two existing canonicals, so ADR-176 does not gate it.

### Where to aim, and the trap to avoid
- **air_conditioner** is the largest by volume (688 keys, 10 stores).
- **tv** has the widest retailer spread (279 keys across **18** stores) and this week's
  verified rule says spread, not volume, is what converts to comparisons.
- **The trap:** the fix here is a CONFIDENCE THRESHOLD or scorer change, and lowering a
  threshold to admit more identities is exactly the "relax a gate as a growth strategy"
  move the founder prohibited. The unit must first establish WHY these score low —
  a missing attribute the text actually contains (a fix) versus genuinely absent
  evidence (correctly rejected). Sample before touching any threshold.

### State
No production write since the frozen baseline. Baseline still
**2026-08-02T10:38:00Z: projection 5,193 · comparable 778 · single-store 4,204**.
Extra continues draining via the scheduler.

---

## CHECKPOINT #52 — ADR-177: THE PARSER WAS THE CONSTRAINT, NOT THE THRESHOLD

**Committed, NOT pushed. No production write. Baseline still frozen 2026-08-02T10:38:00Z:
projection 5,193 · comparable 778 · single-store 4,204.** Tests **1,137/1,137**.

### The threshold was measured to be right and was not touched
Of the 50 low-confidence TV keys already spanning ≥2 stores, **37 have >1.5× internal price
spread**. `samsung|75|4k|qled|NO_HZ` holds QEF1 + Q7F + Q8F + Q60D across 7 stores at
2,399–5,999 SAR. The gate is doing its job; three parser defects were the constraint.

### Shipped (parser only — takes effect on the next sweep)
1. **Two sources, one vocabulary.** Extra declares refresh on 587/599 low-conf rows in
   `featureArMotionFlow`; the parser read titles only. Declared spec fields now FILL gaps
   (never override a title value); free-text description excluded; Extra's DLG
   (`120 هرتز دي ال جي`, a 120 Hz mode on a 60 Hz panel) rejected.
2. **`Mini-LED` was parsing as `led`** — the hyphen defeated `/mini\s*led/` and `\bled\b`
   caught it. A WRONG value, not a missing one. Also `Nano-Cell`→null, `Neo-QLED`→`qled`,
   `LCD`→null. Fixed; LCD/ULED recorded as themselves, never folded into `led`.
3. **50 Hz** added — Jarir prints it literally on 480 observations.
4. **ADR-175's title-model reader wired into TV** (31.7% of low-conf rows carry a literal
   MPN in the title), behind two new junk guards: `65LCS120HZ`-style refresh compounds and
   slash-joined pairs (`98Q6C/98C6K`, and the pre-existing bogus `MODEL:DDR5/512GB`).
5. **ADR-177 short models by naming CONVENTION**, proven before writing any code
   (`npm run tps:short-model-audit`): Almanea 13 short models / 0 truncations · Extra 73/4 ·
   Amazon 21/14. **The audit changed the rule's shape** — the discriminator is not the
   retailer's name but `<screen-size><series>`; every Amazon truncation is letter-leading.
   A convention test cannot be widened by a retailer changing its data; an allowlist can.

### Created and destroyed, separately — the number that matters
**+70 created · −15 destroyed · net +55.** 311 listings promoted, **0 demoted**. The 15 were
classified, not netted: **6 MOVED** to a tighter still-multi-store key · **5 were FALSE
comparisons dissolved** (S90 vs S95, OLED65G66LW vs OLED65C56LA, QN1EF vs QN70F, 50G6500G vs
50G6520G, S85H vs S85F — each proven by their own model numbers) · **4 genuine losses** to
#49's identity-tier asymmetry. Under ADR-176 that trade is required, not merely acceptable.

### `tps:identity-impact` was counting the wrong population
It loaded only `status='valid'`, so a tier PROMOTION was invisible and this entire unit would
have measured as zero. It now loads both tiers, gates contribution by status on each side,
reports promoted/demoted, and classifies every lost key MOVED vs DIED.

### Instruments kept
`npm run tps:tv-lowconf` · `npm run tps:short-model-audit` · corrected `tps:identity-impact`.

### Also closed (unrelated, pre-existing)
`retailer-registry-coherence` was RED before this work: LuLu (23) and Sharaf DG (24) are now in
`TPS_STORES`, so their ADR-148 known-gap exemptions had outlived the gap. Deleted.

### NOT DONE
No sweep, no `tps:refresh`, no production write — the +55 is a measured projection of the next
sweep, not a realised gain. Multi-Hz titles still take the first match. `SMART-UA65U8000HUXSA`
still will not meet `UA65U8000HUXSA`. Almanea's 2,061-observation block stays low-confidence
where its titles state no refresh at all. ADRs 163–175 still exist only in HANDOVER.

---

## CHECKPOINT #53 — ALL FOUR UNITS RUN. THE NUMBER IS **801**.

**Committed, NOT pushed. Tests 1,147/1,147. Baseline was frozen at 2026-08-02T10:38:00Z
(projection 5,193 · comparable 778 · single-store 4,204); it is now superseded by the
figures below, which were produced by three serialized writes and are re-measurable.**

### THE ANSWER TO THE CLOSING QUESTION

**801 products are genuinely comparable** — 801 of 5,023 (15.9%), across 21 categories,
every one backed by an **active** canonical with ≥2 stores holding a real price. Zero
projection rows have no active canonical (checked; it was not zero when this session
started). Top: air_conditioner 120 · mobile 110 · tv 104 · washing_machine 85 · laptop 76
· tablet 56 · monitor 55 · audio 43 · refrigerator 41 · smartwatch 34.

### CREATED AND DESTROYED, SEPARATELY, AT EVERY STEP

| step | comparable | what moved |
|---|---|---|
| frozen baseline | **778** | — |
| ADR-177 TV re-stage | **811** | **+33 created** |
| honouring deactivation | **797** | **−14 destroyed**: 10 TV keys whose evidence moved away, 4 ADR-118 appliance `…\|NA` canonicals |
| ADR-178 cross-tier | **801** | **+4 created** (key-level +9/−1; price-band and two-stores-with-prices still apply) |

### THE TWO DEFECTS THAT MATTERED MORE THAN THE UNITS

**1 · `is_active` did nothing a customer could see.** The projection query had no
`is_active` filter and the builder never deleted, so **all 303 deactivated canonicals were
still being served, 14 of them as multi-store COMPARISONS.** Four are the appliance `…|NA`
canonicals ADR-118 deactivated in July *precisely because the comparison was false*. The
decision was recorded, the write was made, and the customer kept seeing it for two weeks.
Projection now filters on `is_active` and prunes rows whose canonical is inactive or gone.

**2 · My own orphan check reported success while doing nothing.** It passed 351 keys to a
single PostgREST `.in()` and destructured only `data` — the failed request read as "no
orphans", and 97 TV canonicals stayed live with zero observations behind them. Now SQL,
chunked, errors thrown, and filtered by `tps_version` so it cannot touch canonicals another
writer owns (`model-corroboration-v1` legitimately has no staging row; deactivating on "no
staging evidence" alone would have destroyed 39 real comparisons).

### THE ESTIMATE CHAIN, AND WHY THE SMALLEST NUMBER IS THE TRUE ONE

**536 → 157 → 17.** Three dry runs killed three proposals before any write: 489
observations folding into `dell|MODEL:DDR5/512` (a RAM+storage pair as a model — would have
destroyed 13 comparisons to create 2) · `acer|MODEL:LPDDR5` · and
`samsung|85|4k|led|60 → samsung|MODEL:DU7000`, **ADR-176's own `QN90D-55` vs `QN90D-65`
example reached independently** — DU7000 is a series Samsung ships at four sizes. Every step
that made the number smaller made it true.

### ALSO DONE
- **ADRs 163–175 backfilled** into `docs/DECISIONS.md` from checkpoints #38–#51, and
  **ADR-176 moved** from the bottom of the file (appended under an h2, below 150 older
  entries, in a newest-first register) to its correct position. Register now continuous.
- Arabic **HD/HDR prefix trap** fixed — `اتش دي` is a prefix of HDR/UHD/FHD and was turning
  Extra's 75" 4K QLED into `hd`. Caught by reading a dry-run diff, not by a test.
- Multi-Hz titles no longer resolve by word order; `SMART-` prefix stripped via a closed list.
- `retailer-registry-coherence` was RED before this session (LuLu/Sharaf DG exemptions had
  outlived their gap). Closed.

### INSTRUMENTS
`tps:tv-lowconf` · `tps:short-model-audit` · `restage-category.ts` · `cross-tier-merge.ts` ·
corrected `tps:identity-impact` (it counted only `valid` rows, so a tier PROMOTION was
invisible — this whole week's work would have measured as zero).

### NOT DONE — and the honest reason
- **Nothing is pushed.** The parser change is local; the Railway scheduler still stages NEW
  observations with the old parser. **The data is fixed, the code path is not deployed.**
- **18 health FAILs are ingestion staleness**, untouched: noon 76h · shaker 149h · najm 149h
  · sonyworld/nakheel/eazyworld ~170h · hdf/mhzm/aletawik/pcpalace ~193h. Four stores are
  current (amazon, extra, almanea, lulu). **This is now the largest constraint on the 801**,
  and it is a scraping-schedule problem, not an identity one.
- Almanea's 2,061 TV observations stay low-confidence where their titles state no refresh
  rate — genuinely absent evidence, correctly rejected.
- 46 non-TV canonicals are comparable with no staging evidence (39 of them
  `model-corroboration-v1`, which builds legitimately outside staging). Measured, not acted
  on: deactivating on that signal alone would destroy real comparisons.

---

## CHECKPOINT #54 — INGESTION FRESHNESS: THE CHAIN WAS BROKEN IN FIVE PLACES

**Pushed. Tests 1,147/1,147. No schema change. The four fresh retailers were never touched.**

### THE RULE THIS BOUNDARY PRODUCED
> **Freshness of the catalogue is not freshness of the comparison.**

Store-level ingestion freshness was GREEN for five retailers while only **6 of 801**
comparable products carried a price inside the 26h SLO (median **173.6h**, 7.2 days).
The health check asks "did this store produce ANY row recently" — discovery keeps that
green by finding NEW products. It never asked whether the products we SHOW are being
re-priced. Both checks exist now; `tps:comparison-freshness` is the launch metric.

### DIAGNOSED BEFORE ANYTHING WAS RESTARTED — and they do NOT share a cause
- **noon** — 229-SECOND runs returning 0. An independent datacenter IP also times out on
  noon.com; a Saudi IP gets 29 products in 2.5s. **Blocked at the retailer.**
- **sharafdg** — **HTTP 403** to our egress on search AND product pages (8/8), while the
  same URLs serve fine from a Saudi IP and from a different datacenter. No credential-free
  route exists (`wp-json/wc/store/*` → `rest_no_route`, sitemap 404). **Blocked at the retailer.**
- **shaker/najm/samsung_ksa** — stopped on exactly 2026-07-27, the Founder Directive scope
  cut. **Intentionally paused, not failures.**
- **12 small stores** — never in the ingest set, not approved, not customer-visible.
- **blackbox** — never ingested, bot-walled (ADR-148 known gap).

### FIVE DEFECTS FIXED
1. **A run that fetched nothing reported `success`** — both scrapers swallowed the fetch
   error and returned `[]`. Sharaf DG was dark for three days with every signal green.
2. **Failures were mute** — the reason lived only in container stdout.
   `error_messages` → `scraping_runs.error_summary` is how the 403 was finally read.
3. **60 runs stuck in `running`** (oldest 266h) — corpses read as live runs by
   `hasActiveRun`. `reapStaleRuns` runs BEFORE the overlap check.
4. **The price-update queue had NEVER advanced** — selection orders by `last_checked_at`
   and nothing ever wrote it, so the same rows were re-attempted forever, and that head is
   full of delisted offers (Extra's oldest URLs 404). **Extra went 0/20 → 25/25 with zero
   errors** once the cursor moved past the dead head. No DDL: an earlier attempt disabled
   itself looking for `consecutive_failures`; production has `consecutive_misses`.
5. **A refreshed price was not an observation** — `ingestBatch` ran only in discovery, so
   the price loop fed the storefront and NOT the knowledge layer that serves comparisons.
   Proven: 12 products updated → 12 new `raw_observations`.

### STATE AT CLOSE
**801 comparable of 5,023 products.** Freshness recovery is time-based: the queue now
rotates, and the cap was raised 120→300/store/6h (`INGEST_PRICE_MAX_PRODUCTS` reverts it),
putting a full lap at ~1.5 days instead of ~3.8. **As of this checkpoint the freshness
number is unchanged (6/801 inside 26h) — the mechanism is fixed, the data has not caught
up yet, and saying otherwise would be the same error this boundary just retired.**

### ROLLBACK
```
6c2dc62  price updates write observations   git revert 6c2dc62
c10f530  price queue rotation               git revert c10f530
6736101  wire failure reasons               git revert 6736101
8b777ce  failure reason plumbing            git revert 8b777ce
aa94213  fetch failure != success + reaper  git revert aa94213
```

---

## CHECKPOINT #55 — RETAILER DECISIONS APPLIED · THE THREE FIGURES, DEFINED

**Founder decision 2026-08-02, CLOSED. Applied, verified, pushed.** Tests 1,148/1,148.

### ⚠ THE THREE FIGURES — NEVER MERGE THESE

| Figure | Value | Definition | What it is NOT |
|---|---:|---|---|
| **storefront offer rows** | **~9,300** | rows in `product_stores` — the retailers-page count from ADR-172's pagination fix | not products; Jarir alone holds 4,578 rows for 994 distinct products |
| **customer-visible products** | **5,023** | rows in `tps_product_projection`, each backed by an ACTIVE canonical | not the catalogue; 303 unsupported rows were pruned 2026-08-02 |
| **comparable products** | **801** | projection rows with `store_count >= 2` | **628** of those had >=2 offers from *approved* retailers; **428** after the 2026-08-02 retirements |

> **801 is the number that means anything to a customer** — and after this decision the
> honest customer-facing figure is **428**, because a comparison a customer can SEE must be
> built from retailers we still show. Report 428 with the definition attached, never bare.

**The catalogue is sufficient. Retailer breadth is not the constraint.** No acquisition work
is open and none should be opened.

### DECISIONS APPLIED
- **swsg ACTIVATED** — added to `INGEST_STORES` with categories tv/appliance/kitchen/smartphone.
- **Re-admitted to ingestion:** shaker, najm, alnakheelk (all `sourcing:"api"` → the FEED loop,
  not the scraper loop, so no store is ever ingested twice) and samsung_ksa (scraper).
- **noon, lulu, sharafdg, blackbox → INACTIVE AND HIDDEN.** Removed from `APPROVED_STORE_IDS`
  and added to `COMPARISON_DISPLAY_EXCLUDED`. **No proxy, no paid egress** — circumventing a
  deliberate block is fragile and wrong for a platform built on transparency.
- **Measured cost, recorded not hidden: comparable-with-approved-offers 628 → 428 (−200).**

### DNC160 — VERIFIED ATTACHING (the check that had never been done)
Live production exit, same method as Amazon's control:
```
noon    /go → 302 → …/p/?utm_source=tawveeri&utm_medium=affiliate&utm_campaign=DNC160&utm_content=<subid>
amazon  /go → 302 → …/dp/B0CX94G62T?tag=tawveeri-21&ascsubtag=<subid>          (control, works)
```
**It attaches.** Two caveats recorded rather than smoothed over:
1. The code exists in **two conventions** — `utm_campaign=DNC160` (what `/go` actually sends)
   and `aff_code=DNC160` (`src/lib/transactions/affiliate-config.ts`, unused by the exit path).
   `docs/AFFILIATE-ENROLLMENT.md` still calls the utm form a *placeholder*. If Noon's program
   keys on `aff_code`, every Noon click is unattributed — the exit still works, the revenue
   does not. **Unresolvable without Noon's partner documentation; noon is hidden anyway.**
2. No legitimate Noon data or deep-link route exists without credentials, so per the standing
   rule noon is inactive and hidden.

### THE STANDING RULE NOW IN CODE
> **A retailer that cannot be ingested legitimately is inactive AND hidden — never merely
> un-ingested.** Encoded in `approved-retailers.ts`, asserted by
> `tests/retailers/approved-scope.test.ts`, and it covers every future case without escalation.

### A GATE DIVERGENCE CLOSED IN THE SAME UNIT
`isApprovedStore` (may we INGEST) and `isDisplayableRetailer` (may we SHOW) are different
questions, and two customer surfaces — the stores directory and the search filter sidebar —
were using the INGESTION gate to make a DISPLAY decision. They would have kept showing all
four retired retailers. Both now use the display gate. This is the same defect class that
once put LuLu on 3 customer cards while it held zero comparison offers.

### ROLLBACK
```
<this commit>  retailer decisions      git revert <sha>
7648b15  cap + freshness doc           git revert 7648b15
6c2dc62  price updates → observations  git revert 6c2dc62
```

---

## CHECKPOINT #56 — RETAILER DECISIONS CLOSED · HEALTH 0 FAIL

**Pushed. Tests 1,148/1,148. `tps:health` = 0 FAIL · 2 WARN · 35 OK** (was 18 FAIL).

### THE THREE FIGURES — FINAL, WITH DEFINITIONS (never merge these)

| Figure | Value | Definition |
|---|---:|---|
| storefront offer rows | **~9,300** | `product_stores` rows — the retailers-page count (ADR-172). NOT products |
| customer-visible products | **5,139** | `tps_product_projection`, each backed by an ACTIVE canonical |
| **comparable products** | **807** | projection rows with `store_count >= 2`, counting ALL stores |
| **comparable AND displayable** | **419** | the same, restricted to the 8 retailers a customer can actually be shown |

> **419 is the number to announce.** 807 counts retired and never-approved stores; a
> comparison a customer can SEE must be built from retailers we still show.

### ALL 8 ACTIVE RETAILERS ARE INSIDE THE SLO
shaker 0.2h · alnakheelk 0.2h · najm 0.2h · extra 0.6h · samsung_ksa 0.6h · almanea 0.8h ·
jarir 3.8h · amazon 4.7h. **Zero active retailers stale.**

### RETIRED — inactive AND hidden (standing rule)
noon · swsg · sharafdg · lulu · blackbox. All out of `APPROVED_STORE_IDS` and into
`COMPARISON_DISPLAY_EXCLUDED`. noon/sharafdg/swsg are refused at the retailer from our
production egress (403 / timeout) and serve a Saudi IP fine; **no proxy or paid egress was
used.** swsg was activated by decision and retired the same day on evidence, under the
Founder's own rule — no round trip.

### A FOURTH COPY OF THE SAME SWALLOW
`sharafdg-scraper`, `noon-scraper`, `generic-html-store-scraper` AND
`BaseScraper.discoverByListingConfig` all turned a fetch failure into an empty array, so an
unreachable store was recorded `success` with 0 discovered. That is how swsg looked
activated while ingesting nothing. All four now fail loudly when they produce nothing.

### THE HEALTH CHECK NO LONGER CRIES WOLF
It held every row in `stores` to the freshness SLO, so the retirements produced 14 expected
FAILs — and 14 expected failures is exactly where a real one hides (the 60-stuck-runs
lesson). Only displayable retailers are now held to the SLO; the rest report OK with their
state named.

### ROLLBACK
```
<this>   health scope + swsg retire   git revert <sha>
b60f18a  listing-config swallow       git revert b60f18a
9972cb9  generic-html swallow         git revert 9972cb9
2d9bfb3  retailer decisions           git revert 2d9bfb3
```

---

## CHECKPOINT #57 — NOON AND SWSG ARE IN PRODUCTION

**Pushed. Tests 1,148/1,148. `tps:health` 0 FAIL · 2 WARN · 35 OK.**

### BOTH RETAILERS WERE ROUTE PROBLEMS, NOT RETAILER PROBLEMS

| | observations | freshness | in comparable products |
|---|---:|---:|---:|
| **noon** | **11,295** | **0.2h** | **306** |
| **swsg** | **6,276** | **0.3h** | **160** |

**All 10 active retailers inside the SLO.** noon 0.2 · swsg 0.3 · jarir 0.7 · extra 0.7 ·
almanea 0.8 · najm 1.2 · shaker 1.2 · alnakheelk 1.2 · samsung_ksa 2.5 · amazon 6.7h.

### THE NUMBERS

| Figure | Before | After |
|---|---:|---:|
| customer-visible products | 5,139 | **5,398** |
| comparable (all stores) | 807 | **883** |
| **comparable AND displayable** | **419** | **705** |

**705 is the announceable number** (+286, +68%).

### HOW EACH WAS RECOVERED — ADR-179 / ADR-180
- **swsg** — Magento 2 ships a **public unauthenticated GraphQL endpoint**; `swsg.co/graphql`
  answers 4,274 products. Built as a platform-class adapter beside Salla/Shopify/WooCommerce/
  Algolia, so the next Magento merchant is configuration, not code. The 403 was never worked
  around — a different, published door was used.
- **noon** — its `/_svc/` API is **disallowed by noon.com/robots.txt** (`Disallow: /_svc/`)
  AND blocked from our egress. We should never have been calling it. The permitted listing +
  product pages are server-rendered and publish full `@type:Product` JSON-LD. 144 products
  verified from production egress.

**No proxies, no paid egress, no circumvention. Nothing was forced.**

### DNC160 — ⚠ THIS SECTION WAS WRONG. See CHECKPOINT #58 and ADR-181.
> DNC160 is a customer COUPON, not a tracking parameter. The verification below proved only
> that our own chosen string reached the destination — it could not prove Noon recognised it,
> and Noon does not. The real mechanism is `utm_source=C1000094L&utm_medium=referral`.
> Left in place unedited because the mistake is the lesson.

### DNC160 — as originally (and wrongly) recorded
The exit link was always right:
`…/p/?o=…&utm_source=tawveeri&utm_medium=affiliate&utm_campaign=DNC160&utm_content=<subid>`
(Amazon control: `?tag=tawveeri-21&ascsubtag=<subid>`). Clicks are recorded — 1,165 rows.

**But the attribution RECORD was wrong.** `outbound_clicks.affiliate_tag` took "whichever
param was listed first", which for Noon is `utm_source=tawveeri` — so every Noon click was
filed under `tawveeri`, not `DNC160`. The link earned; the ledger would not have reconciled.
Fixed: the tag now comes from the param that actually carries the code.

**Still unresolved and NOT resolvable by us:** the code exists in two conventions —
`utm_campaign=DNC160` (what `/go` sends) and `aff_code=DNC160`
(`src/lib/transactions/affiliate-config.ts`, unused), and `docs/AFFILIATE-ENROLLMENT.md`
still calls the live one a *placeholder*. **If Noon's program keys on `aff_code`, the clicks
attribute nowhere.** One question to Noon's partner team settles it.

### THE RULE, NOW APPLIED TWICE
> Before declaring a retailer un-ingestible, test every sourcing mode the framework
> supports — and check whether the route you are using is one the site permits at all.

### ROLLBACK
```
cf0fe2c  ADRs + attribution tag      git revert cf0fe2c
1495ee8  un-retire noon + swsg       git revert 1495ee8
bb2b629  noon robots-permitted path  git revert bb2b629
7dc80a0  Magento GraphQL adapter     git revert 7dc80a0
```

---

## CHECKPOINT #58 — NOON ATTRIBUTION CORRECTED · DNC160 WAS A COUPON

**Pushed. Tests 1,148/1,148. ADR-181 records the decision and the rule it produced.**

### WHAT WAS WRONG
`/go` appended `utm_campaign=DNC160` to every Noon exit. **DNC160 is a customer COUPON**
(10% cashback, capped 25 SAR, typed at checkout) — a different system in the same partner
dashboard. Noon's actual mechanism is the **publisher ID**:

    utm_source=C1000094L&utm_medium=referral

**Every Noon click since launch almost certainly earned nothing.**

### WHY MY EARLIER "VERIFIED" WAS WORTHLESS — the lesson
CHECKPOINT #57 recorded DNC160 as verified because the parameters appeared on a live 302
next to Amazon's working control. That proved **the string we chose arrived at the
destination**. It could not prove Noon recognised it, because nothing in our possession said
what Noon keys on. **I verified our own output against our own assumption and called it
evidence.** One link generated from the partner dashboard settled in seconds what our config
had asserted for weeks.

> **RULE: an affiliate parameter can only be verified against the PROGRAM — a
> partner-generated link, partner documentation, or a reconciled conversion. "Our value
> appears on the redirect" answers a question nobody asked. Until one of those three exists,
> a program's attribution is UNVERIFIED and must be recorded as such.**

### `o=` — INVESTIGATED BEFORE SHIPPING, because it gated the fix
- every organic product link on Noon's own listing pages carries `?o=` — **50/50 measured**
- valid, absent and deliberately **bogus** `o=` all render the identical product/price/seller
- all params survive Noon's `/ar-sa/` → `/saudi-ar/` redirect

⇒ `o=` is Noon's internal link token, **not partner-specific and not an attribution key**.
Preserved when the source URL carries one; never synthesized by us.

### VERIFIED IN PRODUCTION
```
NOON    o=eff243a145ab475f · utm_source=C1000094L · utm_medium=referral · utm_content=<clickId>
AMAZON  tag=tawveeri-21 · ascsubtag=<clickId>                                       ← control
```
DNC160 appears nowhere in the exit path; a test now asserts it never can.

### DNC160 PUT WHERE IT BELONGS
Inserted as a real coupon against store 3 (noon), bilingual terms, `percentage` 10 capped 25.
Live: `/api/coupons` returns it, `/ar/coupons` 200. **First active coupon in the table** — so
LAUNCH_VOCABULARY §3's ban on «حصرية»/"exclusive" still stands; one coupon is not an
exclusive offer.

### ROLLBACK
```
<this>   ADR-181 + checkpoint      git revert <sha>
4bf69de  C1000094L attribution     git revert 4bf69de
```
Coupon row: `delete from coupons where code = 'DNC160';`

---

## CHECKPOINT #59 — THE SCORECARD WAS MEASURING THE PRE-FIX WORLD

**Pushed. Tests 1,148/1,148. `tps:health` 0 FAIL. Launch readiness 73 → 79.**

### THREE SCORECARD ROWS WERE LYING, TWO OF THEM HARDCODED
| Row | Was | Now | Why |
|---|---|---|---|
| Data Freshness | 48 (`11/23 stores`) | **100** (`10/10 displayable`) | counted retired retailers and never-approved probes, whose staleness is the INTENDED outcome |
| Crawler Stability | 48 + `"2 known-broken scrapers (noon/swsg)"` | **96** (`430/446 runs in 48h`) | reused the freshness ratio — not a crawler metric — plus a hardcoded string about two scrapers repaired hours earlier |
| Affiliate Readiness | 55 + `"0 ACTIVE programs"` | **80** | hardcoded; amazon + noon are both verified against the PROGRAM (ADR-181) |
| Canonical Accuracy | 79 (`1 duplicate card`) | **94** (`0`) | SQL collapses every NULL into ONE group, so 2,338 canonicals with no TPS identity read as a single "duplicate" — a phantom P1 that `tps:health` correctly reported as none |

**DECOMPOSED, per the standing rule — most of 73 → 79 is INSTRUMENT CORRECTION, not new
progress.** Data Freshness is a denominator fix (the work happened earlier that day, the
instrument was hiding it). Crawler Stability is a real measurement replacing a proxy.
Affiliate Readiness is genuine. **Two instruments disagreeing on an invariant is itself the
defect** — `tps:health` and `launch-audit` gave opposite duplicate verdicts for weeks.

### IMAGE COVERAGE — the 86% is not what it looks like
Decomposed: **comparable products are 870/883 imaged = 98.5%.** The gap sits almost entirely
in single-store products, which are not the comparison surface. And the pipeline is healthy
for NEW data — canonicals created in the last 12h: **noon 131/131 imaged, swsg 347/377**.
The remaining gap is historical backlog, not a broken path. Ran the ADR-101 backfill
(fill-only, idempotent): only **19** canonicals were fillable, because the imageless ones
have no linked observation carrying an image. Applied.

### STATE
projection **5,398** products · comparable (all stores) **883** · **comparable AND
displayable 705** ← the announceable number, defined in LAUNCH_VOCABULARY §10.
Remaining real gaps: **P0 Comparison Coverage** (883/5,398 multi-store), P1 Category
Coverage (21/27), P1 Image Coverage (single-store backlog).

### ROLLBACK
```
745c7da  phantom duplicate fix     git revert 745c7da
f4d5210  scorecard scoping         git revert f4d5210
```
Image backfill is fill-only and additive; no revert needed (it never overwrote a value).

---

## CHECKPOINT #60 — COMPARISON COVERAGE: +27 BANKED, AND THE LEVER RE-SIZED

**Baseline frozen 2026-08-02 20:0x UTC: projection 5,398 · comparable 883 · 3+ store 221 ·
COMPARABLE+DISPLAYABLE 705.**

### RESULT — 705 → 732 (+27), and it did not come from seeding

| | before | after |
|---|---:|---:|
| projection products | 5,398 | **5,456** |
| comparable (all stores) | 883 | **903** |
| **comparable AND displayable** | **705** | **732** |
| swsg participating in a comparison | 160 | **192** |

**The +27 came from COMPLETING swsg's catalogue, not from seeded search.** swsg's entire
catalogue is **4,274 products**; we held 3,276 (77%). Pulling the rest cost **~43 GraphQL
calls** → **~1.6 requests per new comparison**, against seeded discovery's 7.7 and blind
traversal's 120. **For a retailer whose whole catalogue fits in a few dozen API calls,
completing the pull beats seeding by an order of magnitude.** Seeding is for retailers too
large to hold — noon, not swsg.

### THE GATE THAT SAVED THE RUN FROM ITSELF
The first swsg seeded dry run reported a **100% hit rate**. It was entirely fuzzy —
Magento's `products(search:)` matches any shared token:
```
"lenovo Idea Tab 11 128GB 5G" → a Lenovo MOUSE, and an oil heater with 11 FINS
"dell 27 FHD Monitor"         → a SAMSUNG monitor
"apple MK2P3AB/A"             → Apple EarPods
```
Writing those makes orphans at best and a FALSE COMPARISON at worst. The gate is ADR-176's
own standard — the target's model number must appear **literally** in the hit's name or sku.
**150 targets → 446 rejected, 2 genuine hits (1.3%).** The smaller number is the correct one.

### THE LEVER, RE-SIZED HONESTLY
The gate needs a model number on the TARGET, and **only 1,263 of 7,807 active canonicals
have one**. So the seeded lever is far smaller than the raw single-store count suggests:

| retailer | single-store targets | **gate-eligible** |
|---|---:|---:|
| noon | 2,315 | **522** |
| amazon | 2,374 | **530** |
| extra | 1,917 | **295** |

An ungated sample spent ~84% of its fetches on targets that could never be accepted, which
is why the first three noon runs looked dead — `queried` never advanced and the summary
never flushed. The target query now selects only gate-eligible rows.

**⇒ MODEL-NUMBER COVERAGE ON OUR OWN CANONICALS (16%) IS THE BINDING CONSTRAINT ON SEEDED
DISCOVERY — not the retailer's search.** That is the next lever, and it is parser work of
exactly the kind ADR-175/177 already proved.

### IN FLIGHT
A gated noon seeded run (250 eligible targets) is running and writing. noon throttles
hard — a few observations per 20 minutes — so it will take hours. Its yield is NOT counted
in the +27 above.

### ROLLBACK
```
a00db54  gate + api search path   git revert a00db54
```
swsg catalogue completion is additive evidence (raw_observations); nothing to revert.

---

# ═══ RESUME HERE — 2026-08-03 CHECKPOINT #61 · OBJECTIVE 1 CLOSED · QUEUE 2–4 NOT STARTED ═══

**Tree clean · pushed · tests 1,148/1,148 · `tps:health` 0 FAIL · 3 WARN · 34 OK.**

## OBJECTIVE 1 — comparable-and-displayable: **705 → 739 (+34, +4.8%)**

Measured identically before and after (LAUNCH_VOCABULARY §10 definition).
Supporting: projection 5,398 → **5,482** · comparable all-stores 883 → **911** · 3+ store 221 → **233**.

| step | 705 → | how |
|---|---:|---|
| swsg catalogue completed | **732** | held 3,276 of 4,274; pulled the rest in ~43 GraphQL calls |
| shaker retry fix + noon seeded trickle | **739** | one transient 500 had been truncating shaker to 49 of ~900 |

### WHAT WORKED, AND WHY
**Completing a small catalogue beats seeding it.** swsg's whole catalogue is 4,274 products —
43 API calls, **~1.6 requests per new comparison**, against seeded discovery's 7.7 and blind
traversal's 120. Seeding is for catalogues too large to hold (noon), not small ones.

**A retry was worth 12× a catalogue.** The WooCommerce adapter broke out of pagination on the
first non-OK response; shaker returned one `page 2: HTTP 500` and the pull ended at **49 of
~900** products, while every later page was verified healthy seconds later. Same defect family
as the four fetch-failure swallows: a failure handled so that it produces a smaller,
plausible-looking result instead of a loud one. **49 → 585 offers.**

### WHAT FAILED, AND WHY
**Seeded discovery on swsg — abandoned on evidence.** Its first dry run reported a **100% hit
rate** that was entirely fuzzy (a "lenovo Idea Tab" seed returned a Lenovo MOUSE and an oil
heater with 11 FINS; "dell 27 monitor" returned a SAMSUNG). Gated to ADR-176's literal-model
standard: **446 rejected, 2 real hits — 1.3%.** Then the reframe made it moot: we already held
77% of swsg and completing the pull was 5× cheaper per comparison.

**Seeded discovery on noon — works, but small and slow.** Measured on gate-eligible targets:
**110 queried → 12 hits (~11%)**, not ADR-146's ungated 91.2%. noon throttles hard (~2
observations per 30 min). A run of 250 targets is still in flight; its yield is NOT in the +34.

**Non-approved feed retailers deliberately NOT pulled** — mhzm 1,571, hdf 1,800,
goldenstore99 1,255, sonyworld 237 offers are all available and all excluded, because they are
not displayable and cannot move 705.

### WHAT IS BLOCKED, AND WHAT WOULD UNBLOCK IT
**The binding constraint on seeded discovery is OUR OWN model-number coverage: 1,263 of 7,807
active canonicals (16%).** The relevance gate needs a model number on the TARGET, so:

| retailer | single-store targets | gate-eligible |
|---|---:|---:|
| noon | 2,315 | **522** |
| amazon | 2,374 | **530** |
| extra | 1,917 | **295** |

**Unblocking it is parser work of exactly the kind ADR-175/177 proved** — extracting model
numbers from titles and payloads for the 84% that lack one. It multiplies every retailer's
eligible target set at once, and it is the single highest-leverage next unit for Objective 1.

## QUEUE STATUS
1. **Comparable-and-displayable — WORKED, +34. Not exhausted**; next lever named above.
2. English-vs-Arabic experience gap — **NOT STARTED**.
3. وفّر advisor (F7 runtime guard first) — **NOT STARTED**.
4. AI-assistant citation — **NOT STARTED**.

## IN FLIGHT
`seeded-discovery noon --targets=250` is still running and writing a trickle. Its observations
will be normalized by the hourly scheduler; nothing is required of the next session.

## ROLLBACK
```
1f264d7  WooCommerce retry (shaker 49→585)   git revert 1f264d7
a566201  CHECKPOINT #60 docs                 git revert a566201
a00db54  relevance gate + api search path    git revert a00db54
befbc13  CHECKPOINT #59 docs                 git revert befbc13
745c7da  phantom duplicate fix               git revert 745c7da
f4d5210  scorecard scoping                   git revert f4d5210
```
Catalogue completions (swsg, shaker) are additive `raw_observations` — nothing to revert.

---

# ═══ RESUME HERE — 2026-08-03 CHECKPOINT #62 · MODEL-NUMBER UNIT DONE · QUEUE 2–4 NOT STARTED ═══

**Tree clean · pushed · tests 1,148/1,148 · `tps:health` 0 FAIL.**

## THE MODEL-NUMBER UNIT — ADR-182

**Model coverage 1,263 → 3,231 of 7,826 active canonicals (16% → 41%).**
**Seed-eligible targets: noon 522 → 1,367 · amazon 530 → 1,250 · extra 295 → 763 (~2.6×).**

**COMPARABLE+DISPLAYABLE: 739 → 740.** The backfill did **not** itself move the number, and
it was not expected to — it is metadata that lets seeded discovery *aim*. Converting it is
rate-limited (below).

### THE TARGETING WAS WRONG TWICE BEFORE IT WAS RIGHT
1. **air_conditioner looked like the prize** — 39,304 low-confidence rows, 0% model coverage.
   But `requireValidTier: false` for AC, so those rows **already corroborate**; changing their
   keys risks destroying working comparisons. Wrong target.
2. **The "84% lack a model" framing overstated the identity prize.** In the categories where
   low-confidence rows are genuinely dead (`requireValidTier: true`), the whole recoverable
   set is **~16 comparisons** (smartwatch 9, monitor 7). Raw row counts are re-scrapes;
   distinct listings are far fewer.
⇒ So the unit became a **metadata backfill**, not an identity rescue. Identity rescue is the
riskier change ADR-175 measured turning 23 corroborations into 18, and was deliberately avoided.

### THE UNIQUE INDEX EARNED ITS KEEP
`canonical_products_brand_model_number_idx UNIQUE (brand, model_number) WHERE NOT NULL` — the
schema already treats brand+model as an identity, so a colliding value is never written.
**137 collisions refused** (24 against existing canonicals, 113 where two proposals shared one
brand+model: `apple|MMTN2ZE/A ×2`, `anker|A3012H21 ×2`).
**Those 137 are duplicate canonicals of the SAME product** — a merge decision under ADR-176,
listed in `docs/evidence/model-backfill-20260803-062248.json` and left alone. **They are a
real, sized, ready follow-up unit.**

## WHAT BLOCKS CONVERSION NOW
- **noon rate-limits us to ~1 observation per 12 minutes** after today's traffic. A 400-target
  seeded run is in flight and will take many hours. Its yield is not in the 740.
- **Seeded discovery only supports noon + Magento-sourced retailers.** `extra` errored on all
  12 targets — its scraper has no `scrapeApiPage`. **amazon and extra hold 2,013 eligible
  targets between them and cannot be seeded at all until a keyed-search path is added to
  those scrapers.** That is the highest-value follow-up: the targets now exist, the aim does not.

## QUEUE STATUS
1. **Comparable-and-displayable — 705 → 740 this session.** Not exhausted; blockers named above.
2. English-vs-Arabic experience gap — **NOT STARTED**
3. وفّر advisor (F7 runtime guard first) — **NOT STARTED**
4. AI-assistant citation — **NOT STARTED**

## ROLLBACK
```
4fe0e8d  ADR-182 model backfill      git revert 4fe0e8d   +  restore from
                                     docs/evidence/model-backfill-20260803-062248.json
1f264d7  WooCommerce retry           git revert 1f264d7
a00db54  relevance gate + api search git revert a00db54
745c7da  phantom duplicate fix       git revert 745c7da
f4d5210  scorecard scoping           git revert f4d5210
```
The backfill is fill-only and additive; reverting the code does not unfill the column — use
the snapshot to restore if ever needed.

---

# ═══ RESUME HERE — 2026-08-03 CHECKPOINT #63 · OBJ 1 EXTENSION DONE · QUEUE 2–4 NOT STARTED ═══

**Tree clean · pushed · tests 1,152/1,152 · `tps:health` 0 FAIL · "duplicate product cards: none".**

## SESSION RESULT — comparable-and-displayable **705 → 761 (+56, +7.9%)**

| step | → | how |
|---|---:|---|
| swsg catalogue completed | 732 | held 3,276 of 4,274; ~43 GraphQL calls |
| shaker retry fix | 739 | one transient 500 had truncated it to 49 of ~900 |
| model backfill (ADR-182) | 740 | metadata; unblocked the seeding lever |
| extra seeded + duplicate merges | **761** | 16 seeded hits · 73 duplicate cards merged |

Projection **5,366** products (down from 5,482 — duplicate cards removed, which is the point).

## OBJECTIVE 1 EXTENSION — what was asked, and the better route taken
**Asked:** add a keyed-search path to the Amazon and Extra scrapers.
**Taken (ADR-183):** the repo already HAS a keyed-search layer — `src/lib/scraping/search/`,
eight per-store scrapers built for "find THIS product", maintained and exercised by the
customer search feature, and `SearchProduct extends ScrapedProduct` so results are directly
ingestible. Seeded discovery now dispatches Magento GraphQL → search layer → cron scraper.
**Extra went from 20 errors on 20 targets to 0 errors.** Writing bespoke methods per cron
scraper would have duplicated a maintained layer.

**Robots checked per retailer BEFORE use** (the noon lesson): amazon `/s` is ALLOWED (79
disallow rules, none match). extra's robots disallows `/search` and `/*?*` — but our scraper
calls `search.unbxd.io`, Extra's own published storefront search provider, not
`extra.com/search`. Same credential-free pattern as Almanea's Algolia.

**A CUSTOMER-VISIBLE DEFECT FOUND EN ROUTE.** Amazon moved the title; `h2 span` now returns
the BRAND and `[data-cy="title-recipe"] a span` returns "Sponsored". **Every Amazon result on
the customer search page was rendering a brand where its product name should be.** Fixed by
picking the first PLAUSIBLE candidate rather than trusting selector order, with legacy
selectors retained as fallback. Proven by fixture (`tests/scraping/amazon-search-title.test.ts`)
because Amazon rate-limited this IP mid-investigation (HTTP 200, 2,270-byte stub, 0 items) —
live re-verification is still OWED once the throttle clears.

## DUPLICATE CARDS (ADR-184) — 73 merged, 55 refused
130 products were held as TWO active projected canonicals — one named by bare MPN
("Apple MTJY3ZE/A"), one named properly ("Apple Earpods Earbuds"). A customer saw the same
product twice at two prices, which reads as a comparison and is not one.

**Gate is ADR-176's, unchanged:** the same model must appear LITERALLY in the raw evidence on
BOTH sides. **55 pairs were refused** because one side could not show it. Winner = more stores,
then the more descriptive name, then older. Mechanism is the proven one (re-key staging →
corroborate → deactivate emptied), snapshotted to `docs/evidence/dupe-merge-*.json`.

**Two bugs caught in my own tie-break before applying:** a Latin-only bare-MPN regex would have
buried «بيسوس … Headphones» behind a bare code; and `/^[A-Z0-9]+$/i` matches ordinary words, so
the first fix silently scored every name 0 and did nothing.

## SEEDED-DISCOVERY HIT RATES, MEASURED (all gated to ADR-176)
| retailer | hit rate | note |
|---|---:|---|
| noon | ~11% | throttles to ~1 observation / 12 min after sustained use |
| extra | 2.3% | 700 targets → 16 hits, 0 errors |
| swsg | 1.3% | fuzzy Magento search; catalogue completion beat it 5× |
ADR-146's 91.2% was measured **ungated** and does not survive the relevance gate.

## QUEUE STATUS
1. **Comparable-and-displayable — 705 → 761.** Not exhausted.
2. English-vs-Arabic experience gap — **NOT STARTED**
3. وفّر advisor (F7 runtime guard first) — **NOT STARTED**
4. AI-assistant citation — **NOT STARTED**

## OWED / NEXT
- **Re-verify the Amazon title fix live** once Amazon's throttle clears (fixture-proven only).
- 55 refused duplicate pairs — need a second evidence source, not a weaker gate.
- amazon seeded discovery unmeasured (throttled during the window); 1,250 eligible targets wait.

## ROLLBACK
```
<this>   ADR-184 duplicate merge     git revert <sha>  + docs/evidence/dupe-merge-*.json
7aa6fc5  ADR-183 search layer + amazon title   git revert 7aa6fc5
4fe0e8d  ADR-182 model backfill      git revert 4fe0e8d  + model-backfill-*.json
1f264d7  WooCommerce retry           git revert 1f264d7
a00db54  relevance gate              git revert a00db54
```

---

# ═══ RESUME HERE — 2026-08-03 CHECKPOINT #64 · OBJECTIVE 2 CLOSED · QUEUE 3–4 NOT STARTED ═══

**Tree clean · pushed · tests 1,187/1,187 · `tps:health` 0 FAIL · 3 WARN · 35 OK.**

## OBJECTIVE 2 — English-vs-Arabic experience gap: **30% → 8%**

The objective was never defined, so it was measured first. Three candidates ruled out before
anything was touched:

| candidate | measured | verdict |
|---|---|---|
| UI copy parity | 1,617 keys · 2 missing in AR · 0 in EN | not the gap |
| English shopper seeing Arabic | `display_name_en` 94.7% Latin · 5 rows of 5,366 with none | not the gap |
| **Arabic shopper seeing English** | **463 rows with no Arabic character at all** | **this is it** |

Instrument: ten queries × two locales × 24 results on production, reading the exact field the
card renders (`product-card.tsx:94`). **Baseline 73/240 (30%) Arabic names carried no Arabic
character; English 0/240. Close 18/240 (8%), English still 0/240.** Arabic character share of an
Arabic result name **43% → 60%**.

| | before | after |
|---|---:|---:|
| projected products with no Arabic | 463 | **64** |
| …of them **comparable** | 135 | **5** |
| mobile / smartwatch canonicals | 329 / 69 | **4 / 0** |
| storefront titles composed | — | **613** |

## THE BIGGER FIND — ADR-186, and it is not about language
613 names were repaired **and verified in the database**, and the Arabic search page **did not
move**. Searching production for the English string it kept serving returned **zero rows** from
`products` — the page was serving a record the database no longer held.

**There are two Algolia indexes and the pipeline maintains the wrong one.**
`tawveeri_tps_products` is rebuilt by an hourly chain step and **read by nothing on the customer
path**. `products` is what `src/lib/algolia/search.ts` reads and `/api/search` calls the **PRIMARY**
path — and it was fed by **nothing**: no npm script, no cron route, no chain step, no PM2 entry.
`rebuild-products-index.ts` was a manual one-off from 2026-07-27. **Every storefront change since —
new products, prices, availability — has been invisible to search.**

**`tps:health` reported search healthy the whole time**, because its check watches the freshness of
the index nobody reads. Rebuilding the live index moved the page **14% → 8%** in one pass after 613
renames had moved it **not at all**.

Fixed durably: `storefront-search` is now a chain step (slow tier), and `tps:health` gained a
**`live search index`** check that reads the index `/api/search` actually queries — reporting
**unknown, never OK**, when Algolia is unreachable.

## THREE TRAPS THAT WOULD HAVE PRODUCED A FALSE RESULT
1. **The repair races the pipeline.** The hourly scheduler re-normalizes through the **deployed**
   engine and re-wrote three repaired names within half an hour. **Deploy the code, then run the
   remediation** — never the reverse.
2. **The production figure got WORSE (13% → 14%) after 613 more renames.** The result set is not a
   fixed population: better Arabic names rank Arabic-titled products higher and the tail of 24
   refills with different English-named ones. Decomposing that number is what found ADR-186.
3. **A sample of eight hides the defects the pass exists to remove.** The first dry run looked
   clean and was hiding «Galaxy Z Flip 7 Flip» and «Galaxy Watch Ultra Ultra». The dry run now
   scans its whole proposal and prints every hit.

## A LOADED GUN WAS REMOVED FROM THE REPO
`scripts/tps-analysis/arabic-titles.js` looked ready to run and would have renamed 187 rows,
**dropping the BTU from every one** — `capacity_btu` is null for *every* English-named AC while 166
state it in the title — then failed silently on the `products.name_ar` unique index inside a bare
`catch {}`. Replaced by a tested composer that reads capacity from the merchant's own title and
**REFUSES to rename when a stated capacity cannot be carried**. 75 rows were refused on exactly
that gate.

## ALSO FIXED — visible in BOTH locales, not an Arabic issue
«Tecno Tecno Spark 12» · «Honor Honor X 5» · «Galaxy A A07» · «Galaxy Z Flip 7 Flip» ·
«Galaxy Watch Ultra Ultra» · «مكيف سبليت كرافت CRAFFT» (the storefront `brand` column already
holds Arabic for many rows; the old composer appended the Latin brand on top).

## NOT DONE, AND WHY
- **59 audio canonicals stay English.** The real defect in them is that a **store name sits in the
  brand field** — 22 canonicals keyed `sony world - ksa|…`. «صوتيات sony world - ksa Wh-1000xm6» is
  Arabic garbage, not an improvement. **0** of them carry a comparison. *Fixing the brand is an
  Objective-1 lever: those 22 would corroborate against other retailers' Sony listings.*
- **7,155 storefront rows remain English-named.** They are phones/laptops/TVs, and they cannot be
  repaired from what we hold: of 7,762 English-named rows, **0** have an Arabic title anywhere in
  `raw_observations`. Closing it means ingesting each retailer's **Arabic storefront** — a sourcing
  unit with a real hazard, since the normalizer keys on URL and not SKU (ADR-089), so an Arabic URL
  variant would double-count every offer. **Scoped, not started.**
- **Air conditioners are filed under `category = 'accessories'`** in the storefront layer. Worked
  around (the composer reads the type from the title and ignores the stored category) but **not
  fixed** — it still breaks category filtering and faceting for the shopper.
- **ADR-182/183/184 had shipped as commits with no Decision Register entry.** Recorded
  retroactively from their commits and CHECKPOINTs #62/#63, marked as such.

## QUEUE STATUS
1. Comparable-and-displayable — **761**, not exhausted; Amazon's 1,250 seed targets still untouched
   (it throttled). Founder set this to lower priority.
2. **English-vs-Arabic experience gap — CLOSED at 30% → 8%.**
3. وفّر advisor (F7 runtime guard first) — **NOT STARTED**
4. AI-assistant citation — **NOT STARTED**

## OWED
- Re-verify the Amazon title fix live (ADR-183) once the throttle clears — fixture-proven only.
- 55 refused duplicate pairs (ADR-184) — need a second evidence source, not a weaker gate.
- 1 refused name collision (ADR-185) — two canonicals differing only by a duplicate variant
  segment; a genuine duplicate card in ADR-184's territory.

## ROLLBACK
```
89a50d3  ADR-186 live index owner + storefront titles   git revert 89a50d3
e7a30c1  ADR-185 Arabic display names                   git revert e7a30c1
         + docs/evidence/locale-name-remediation-2026-08-03.json holds every before/after
           name; re-running either remediation is idempotent, and reverting the code then
           re-running `refresh-intelligence.ts` restores the previous names.
8273e42  ADR-184 duplicate product cards                git revert 8273e42
```

---

# ═══ RESUME HERE — 2026-08-03 CHECKPOINT #65 · OBJECTIVE 3 · §8 AUDITED AND ITS TWO GAPS CLOSED ═══

**Tree clean · pushed · deployed · tests 1,227/1,227 · `tps:health` 0 FAIL · unified-search 54/54 ·
`tps:validator-verify` GATE: PASS.**

## THE STATED BLOCKER NO LONGER EXISTS
The queue says *"وفّر advisor (F7 runtime guard first)"*. That was written when F7 had never been
scoped. **F7·1** (`src/lib/vocabulary/`), **F7·2** (post-generation validator, ADR-158), **F7·3**
(adversarial suite as a permanent gate, ADR-159) and **`guardAdvisorPayload`** over the
deterministic advisor (ADR-163) have all since shipped. Verified rather than assumed: 453/453
agent+vocabulary tests, and the live gate now green.

## §8 AUDITED BULLET BY BULLET, AGAINST PRODUCTION
| §8 requirement | state |
|---|---|
| hybrid card not chat · follow-ups as buttons · contextual prompts · no login before value | **met** |
| *"Parse what the user already said"* | **met** — «ابي مكيف رخيص لغرفه ٤٠ متر» → `room_size_m2: 40`, `clarify: null` |
| *"Confidence in plain language, or not at all"* | **met** (ADR-163) |
| *"No recommendation without data"* · *"never a dead end"* | **met** — the advisor sits ABOVE the search results on the unified surface, so there is nothing to hand off *to* |
| **"Two sentences of reasoning, maximum"** | **was NOT met** — engine returned five, card rendered five |
| **"Distinguish fact from inference from recommendation"** | **was NOT met** — all five wore one green tick |

The two gaps are one defect seen from two sides, and the founder had already named it: «كثير
ومشتته». On a live AC card, «متوفر ومُقارَن في 3 متاجر» (**measured**) and «التكلفة الإجمالية
التقديرية ~6643 ريال» (a **model** — installation and annual electricity are estimated, never
observed) were the same class of claim to the reader.

## WHAT SHIPPED (ADR-187)
**The kind is declared where the reason is WRITTEN** — `identity · fit · spec · evidence ·
estimate · caution` — never inferred downstream by scanning our own prose. The scorers'
`const reasons: string[]` became a **`ReasonLedger`**, so the **compiler** required all **106**
call sites across eight scorers to be classified; there is no partially-classified state that
compiles.

**Which two lead is the ENGINE's decision** (`headline_reasons`), not the view's — the ADR-163
rule. `identity` and `evidence` are excluded because the title and `TrustSummary` already state
them: **the corroboration claim was being printed twice on every card.** A `caution` outranks
anything positive. An estimate renders «تقديري». Everything else is one tap away.

**Live now:**
```
>> fit       مناسب لغرفة ~40م² (السعة 30000 وحدة تطابق المطلوب)
>> spec      إنفرتر — كفاءة أعلى في الكهرباء
   spec      بارد فقط — مناسب لأغلب أجواء المملكة
   evidence  سعر موثوق — متوفر ومُقارَن في 2 متاجر        ← the TrustSummary badge, not a bullet
   estimate  التكلفة الإجمالية التقديرية ~7943 ريال …     ← labelled «تقديري»
```

## A DEFECT I INTRODUCED, AND WHERE IT HAD TO BE FIXED
`reason_kinds` and `headline_reasons` are index-aligned with `reasons_ar` — and
**`guardAdvisorPayload` removes entries from that array.** Withholding one sentence renumbers
every sentence after it, so the card would have rendered a survivor under the *withheld*
sentence's kind, or read past the end. Silently, and only on the day the guard first fires —
which is today never (2,026/2,026 strings pass), i.e. exactly the latent break that ships.
**Fixed in the guard, because the guard owns the mutation**, with a test for the day it fires.

## THE F7 GATE WAS RED, AND NOT FOR A SAFETY REASON (ADR-188)
`tps:validator-verify` asserted `/api/ai-assistant` → **404**. The founder enabled the surface, so
that check had been **failing ever since** — recorded in #42 as "known-stale". **A permanently red
safety gate is an ignored safety gate**, and it sat next to 30 green lines on the guard that
governs the only generative surface in the product.

The assertion encoded the wrong property. It now asserts the contract for the **deployed state**:
closed ⇒ 404; **open ⇒** every answer is published *with* a verdict or reported `suppressed` *by*
`f7-vocabulary-validator`, **plus a LIVE adversarial probe** — an uncovered category at a retailer
that does not exist — which must come back carrying **no price**. `GATE: PASS`, first time since
the surface was enabled.

## QUEUE STATUS
1. Comparable-and-displayable — **761**; Amazon's 1,250 seed targets untouched (founder: lower priority).
2. English-vs-Arabic experience gap — **CLOSED** 30% → 8% (#64).
3. **وفّر advisor — §8's two unmet bullets CLOSED.** §8 is now met in full; see NEXT below.
4. AI-assistant citation — **NOT STARTED**.

## NEXT, IN ORDER (from the brief's own §6 recommendation, re-checked)
1. **§7.1 explainable deal score** — ranking is cheapest-first and the brief calls that a bug.
2. **§9 وكيل توفيري agent separation** — contract + component only; ship nothing the backend lacks.
3. **§6.1 dynamic proof module** — partly present via verified deals; not qualification-gated.
4. **§2.1 retailer tiers** — cheap, unblocks an honest public retailer count.
5. **§11 WCAG 2.2 AA pass** — never systematically done.

## OWED (unchanged from #64)
- Re-verify the Amazon title fix live (ADR-183) once the throttle clears — fixture-proven only.
- 55 refused duplicate pairs (ADR-184) — need a second evidence source, not a weaker gate.
- 59 audio canonicals stay English until `sony world - ksa`-in-brand is fixed (also an Obj-1 lever).
- 7,155 storefront rows need Arabic-storefront ingestion (ADR-089 URL-vs-SKU hazard). Scoped, not started.
- ACs filed under `category='accessories'` — worked around, not fixed.

## ROLLBACK
```
ee1dab4  ADR-187/188 reason kinds + F7 gate    git revert ee1dab4
aa43ed6  CHECKPOINT #64 docs                   git revert aa43ed6
89a50d3  ADR-186 live index owner              git revert 89a50d3
e7a30c1  ADR-185 Arabic display names          git revert e7a30c1
```

---

# ═══ RESUME HERE — 2026-08-03 CHECKPOINT #66 · THE INDEXABLE SURFACE WAS 100% DEAD ═══

**Tree clean · pushed · deployed · tests 1,227/1,227 · `tps:sitemap-verify` GATE: PASS ·
`tps:validator-verify` GATE: PASS · `tps:health` 0 FAIL.**

## A CORRECTION I OWE THE RECORD
I wrote that the brief "calls cheapest-first ranking a bug." **It does not.** Appendix **F4** is
explicit — *"Search results present the cheapest comparable total first. A weighted deal score
governs the deals surface only. **Two surfaces, two rules.**"* F4 even records that this had been
misread before; mine was the third time. **Search ordering is not in question.**

## THE CHOICE, DECIDED ON EVIDENCE — AND I TOOK A THIRD OPTION
**§7.1 (weighted deal score) — the surface has no reach.** `tps:usage`: **0 deal events across
162 sessions**; `deals` does not appear in the surface breakdown at all. **12 real sessions
total.** `getDeals` already sorts by discount **percentage**, so §7.1 would rearrange a shelf
nobody has walked past. External evidence cuts the same way: **Idealo** ranks by price and states
no shop can buy a better position; **Kelkoo**'s weighted "relevance" order *"partly takes
remuneration into account"*. **A weighted score is the industry's usual vehicle for letting
commercial interest into ranking** — which our Constitution forbids.

**Objective 4 (AI citation) — the obvious mechanism is measured to be ineffective.** Across
**500M AI-bot visits, 408** fetched `llms.txt`; no major provider commits to reading it, Google
has said it will not. **But its prerequisite is the real finding: an assistant cannot cite a page
it cannot fetch.**

## WHAT WAS MEASURED ON PRODUCTION
| | |
|---|---|
| product URLs in `sitemap.xml` | **1,190** |
| of those resolving **200** | **0** — every one 307 `/product/` → `/products/` → **404** |
| catalogue offered for indexing | **595 of 5,366** (sitemap filtered `category='mobile'`) |
| comparison pages offered | **0** — `/*/compare/` was **`Disallow`ed in robots.txt** |
| what a web search for «توفيري» surfaces | our **«المنتج غير موجود»** page, on a Railway preview domain |

**Root cause:** the sitemap published **knowledge-layer** identity slugs at a route that resolves
**storefront** `products.slug`. Two namespaces, one route — the ADR-122 drift family again.

**The comparison page — the one asset no Saudi competitor has — could not be cited for FIVE
independent reasons**, all found by reading the live page rather than the code: robots-disallowed ·
absent from the sitemap · `generateMetadata` passed the **raw** key while the body passed
`decodeURIComponent(key)`, so every page rendered a real five-retailer comparison under the
**generic fallback title** · no `alternates`, so it **canonicalised to the homepage** · **no
structured data at all**.

## RESULT (ADR-189), VERIFIED LIVE
| | before | after |
|---|---:|---:|
| sitemap URLs | 1,204 | **16,994** |
| sampled URLs resolving 200 | **1/12** | **36/36** (compare · product · static) |
| indexable comparison pages | **0** | **1,876** (938 × 2 locales) |
| products offered for indexing | 595 | **7,552** |

```
en title:  Apple iPhone 16 128GB — price comparison | Tawveeri
ar title:  جوال آبل iPhone 16 128 جيجابايت — مقارنة الأسعار | توفيري
AggregateOffer  low=1899 high=3239 count=5
sellers    Jarir Bookstore, Noon, eXtra, Amazon Saudi Arabia, Almanea   (ar: مكتبة جرير, نون, …)
```
Every JSON-LD figure is one the page already renders, from the same objects the body reads.
**Structured data that disagrees with the visible page is a fabricated claim with a schema
wrapper on it** — and it is also what gets a site penalised.

## GATED — `npm run tps:sitemap-verify`
Samples each URL class in the **live** sitemap, **follows redirects** (the final status is what a
crawler records), and fails if any sampled URL is not 200. It also cross-checks that `robots.txt`
does not forbid what the sitemap offers — **those two files disagreed for months and nothing
compared them.** Same failure class as ADR-186: owned by nobody, watched by nothing.

## HONEST LIMIT — DO NOT OVERSTATE THIS
This makes the pages fetchable, readable and machine-parseable. **It does not make anyone cite
them, and no claim that it will may be published.** The measurable outcomes are the four rows in
the table above. Indexation itself takes weeks and is not ours to command.

## STILL OPEN, FOUND EN ROUTE — NOT FIXED
- **The Railway preview domain `tawveeri-main-production.up.railway.app` is indexed** — duplicate
  content splitting authority with `tawveeri.com`. Needs a canonical-host redirect or a
  preview-domain `noindex`. **Not touched** — it is a deployment-config change, not code.
- The `/deals` page is **hardcoded Arabic** (`dir="rtl"`, Arabic-only metadata) in both locales.
  A residue of the same gap as #64.

## QUEUE STATUS
1. Comparable-and-displayable — **761**; Amazon's 1,250 seed targets untouched (founder: lower priority).
2. English-vs-Arabic gap — **CLOSED** 30% → 8% (#64).
3. وفّر advisor §8 — **CLOSED** (#65).
4. **AI-assistant citation — its prerequisite is now built.** What remains is genuinely
   speculative (llms.txt is measured ineffective); the honest next step is to *wait and measure
   indexation*, not to build more mechanism.

## NEXT, RECOMMENDED
1. **Canonical-host fix** for the Railway preview domain — small, and it is currently splitting
   whatever authority we have.
2. **§9 وكيل توفيري agent separation** — contract + component only; ship nothing the backend lacks.
3. **§2.1 retailer tiers** — cheap, unblocks an honest public retailer count.
4. **§11 WCAG 2.2 AA pass** — never systematically done.
5. Re-measure indexation in ~2 weeks (`tps:sitemap-verify` + a site: query) before any further
   citation work.

## ROLLBACK
```
1c94c8f  ADR-189 title + localized sellers   git revert 1c94c8f
5e9049f  ADR-189 sitemap/robots/compare SEO  git revert 5e9049f
8b3cfda  CHECKPOINT #65 docs                 git revert 8b3cfda
ee1dab4  ADR-187/188 reason kinds + F7 gate  git revert ee1dab4
```

---

# ═══ CHECKPOINT #67 — CANONICAL HOST FIXED IN CODE · OBJ 1 REOPENED (AMAZON THROTTLE CLEARED) ═══

**Tree clean · pushed · deployed · tests 1,237/1,237 · `tps:sitemap-verify` 11/11 GATE: PASS.**

## ADR-190 — THE DEPLOYMENT DOMAIN, FIXED ENTIRELY IN CODE
**No Railway dashboard change was needed.** Measured before: the preview host returned **200 with
no `X-Robots-Tag`** and advertised `Sitemap: https://tawveeri.com/sitemap.xml`.

- Middleware sets **`X-Robots-Tag: noindex, follow`** on every response from a non-canonical host,
  applied **before every branch** so API responses, redirects and 429s carry it too.
- **Crawling stays ALLOWED there.** Disallowing instead is the classic self-defeating move — a
  crawler that cannot fetch the page never sees the `noindex`, and the URL stays indexed on anchor
  text alone. *Allow the fetch, refuse the index.*
- **`follow`, not `nofollow`:** every canonical, sitemap entry and internal href on that host
  points at `NEXT_PUBLIC_APP_URL`, so following them passes the signal to `tawveeri.com` rather
  than stranding it.
- `robots.ts` is host-aware **on its own**, because the middleware matcher excludes `robots.txt`.
  On a non-canonical host it withholds the sitemap reference.

**The dangerous failure is not missing a duplicate — it is marking the REAL site `noindex`.**
Every unknown resolves to canonical: missing env var, absent `Host`, localhost, and `www` all
count as canonical. The tests are mostly about that direction.

**Verified live:** preview `noindex, follow` · canonical **no header**. Gated by three new checks
in `tps:sitemap-verify`.

## ADR-183's OWED LIVE VERIFICATION — DONE, AND IT PASSES
Amazon's throttle has cleared (`amazon.sa` serving 1.18 MB, not a 2 KB stub). The title fix was
fixture-proven only since #63. Re-run live across three queries in both scripts:
**18 of 18 titles are real product names · 0 brand-like.** Item closed.

## OBJECTIVE 1 REOPENED — AND AMAZON IS THE BEST SEEDED RETAILER WE HAVE
Gated dry run, 40 targets: **hit rate 30%**, 0 errors, 104 irrelevant correctly rejected.

| retailer | gated hit rate |
|---|---:|
| **amazon** | **30%** |
| noon | ~11% |
| extra | 2.3% |
| swsg | 1.3% |

Baseline before the run: projection **5,419** · comparable **946** · 3+ store **246**.
A 350-target `--go` run is in flight; its yield lands in the next checkpoint.

---

# ═══ RESUME HERE — 2026-08-03 CHECKPOINT #68 · SEED RUN MEASURED · A FIGURE I PUBLISHED WAS WRONG ═══

**Tree clean · pushed · tests 1,270/1,270 · `tps:sitemap-verify` 11/11 PASS.**

## CORRECTION — THE 30% AMAZON HIT RATE IN #67 WAS A SMALL-SAMPLE ARTEFACT
I reported **30%** from a **40-target** dry run. The live **350-target** run measured **7.1%**.

| | targets | hit rate |
|---|---:|---:|
| dry sample (#67, **published — wrong**) | 40 | 30% |
| **live run (authoritative)** | **350** | **7.1%** |

The first 40 targets are the best-covered ones; 350 reaches into the tail. **Amazon is still the
best seeded retailer we have** (noon ~11% was itself measured on a small gate-eligible set; extra
2.3%, swsg 1.3%) — but 30% was never real, and it is corrected here rather than left standing.
*This is process rule 2 — decompose any number that jumps — applied to my own.*

## SEED RUN RESULT
`seeded-discovery amazon --go --targets=350`: **31 written · 24 created · 7 linked · 0 errors ·
329 correctly rejected by the relevance gate.** The 31 observations are **not yet normalized** —
the hourly scheduler owns realization (ADR-099) and they are queued for the next tick. **Their
yield in comparable-and-displayable is therefore still PENDING and is not claimed here.**

Baseline at close: projection **5,421** · comparable **947** · 3+ store **246**.
**Remaining Amazon eligible targets: ~900.**

## ADR-183's OWED LIVE VERIFICATION — DONE, PASSES
Amazon's throttle has cleared. Three queries, both scripts: **18 of 18 titles are real product
names · 0 brand-like.** The fixture-only caveat from #63 is closed.

## ADR-191 — A STORE NAME IS NOT A BRAND
22 canonicals keyed `sony world - ksa|…` (Sony WH-1000XM6, WF-C510, INZONE H3/H9) carry the
RETAILER as their manufacturer. `brand` is the first segment of `tps_identity_key`, so the same
headphone at another retailer **can never corroborate** with it.

**Built the guard, refused the cleanup, and measured why:** only **2 of 7** affected models have a
`sony`-branded twin, so re-keying is worth **≤2 comparisons** and needs ADR-184's merge machinery.
**The ceiling is recorded so nobody re-derives it.** The guard rejects a store-identity brand to
`null` at **both** derivation points (per-store adapters + generic progressive engine).

**Exact match only.** "Samsung" must survive a store called *Samsung KSA*; "Sony" a store called
*Sony World*. Most of the 33 tests defend that direction. A hand-written name list was the wrong
source and missed «مكتبة جرير» immediately — the guard now derives from `TPS_STORES` **and**
`APPROVED_RETAILERS`, so future merchants are covered without an edit.

## QUEUE STATUS
1. **Comparable-and-displayable 947** — Amazon reopened at a *measured* 7.1%; ~900 targets left.
2. English-vs-Arabic — CLOSED (#64).
3. وفّر advisor §8 — CLOSED (#65).
4. AI-assistant citation — prerequisite built (#66); the rest is genuinely speculative.

## NEXT
1. **Let the scheduler normalize the 31 observations, then re-measure comparable.** Do not run
   `normalize` by hand alongside it (ADR-099).
2. Continue Amazon seeded discovery on the remaining ~900 targets — at 7.1% that is ~60 more
   observations, so decide whether it beats catalogue completion for another retailer first.
3. §9 وكيل توفيري agent separation · §2.1 retailer tiers · §11 WCAG 2.2 AA.
4. Re-measure indexation in ~2 weeks (`tps:sitemap-verify` + a site: query).

## ROLLBACK
```
29224ce  ADR-191 store-name-as-brand guard   git revert 29224ce
1beae75  ADR-190 canonical host noindex      git revert 1beae75
1c94c8f  ADR-189 follow-through              git revert 1c94c8f
5e9049f  ADR-189 sitemap/robots/compare SEO  git revert 5e9049f
```

---

# ═══════════ RESUME POINT — 2026-08-03 · SESSION CLOSED · START HERE ═══════════

**Tree clean · everything pushed · head `e388d24` → (this commit) · tests 1,270/1,270 ·
`tps:sitemap-verify` 11/11 PASS · `tps:validator-verify` PASS · `tps:health` 0 FAIL.**

## ⚠ A FIGURE CORRECTION — "740" IS NOT A CLOSING NUMBER
**740 was an INTERMEDIATE row** in CHECKPOINT #63's progression table (the value after ADR-182's
model backfill, before extra-seeding and the duplicate merges). **#63 closed at 761**, and every
checkpoint since has carried 761 forward. Do not resume from 740.

## AND THE 761 ITSELF IS NOW STALE — RE-MEASURE BEFORE QUOTING
Measured at close with `scripts/tps-analysis/comparable-count.sql` (approved-retailer method,
`price_history` → active canonicals → `resolveApprovedSlug`):

| figure | value | method |
|---|---:|---|
| canonicals with any offer | 7,567 | comparable-count.sql |
| **comparable (≥2 approved retailers)** | **918** | comparable-count.sql |
| ≥3 approved retailers | 235 | comparable-count.sql |
| comparable **excluding display-excluded** (lulu · sharafdg · blackbox) | **908** | same query, `COMPARISON_DISPLAY_EXCLUDED` removed |
| ≥3, display-gated | 228 | as above |
| projection rows · `has_comparison` | 5,421 · 947 | `tps_product_projection` |

**I am NOT claiming 761 → 908 as progress.** I could not confirm that this SQL reproduces the
LAUNCH_VOCABULARY §10 method that produced 761 in #63, and *a figure that moves because the
method moved is not progress* (process rule 2). `npm run tps:comparison-value` — the named
instrument — **exceeds 10 minutes and was killed**; run it deliberately, once, as the first act
of the next session and record which method the number came from.

## WHERE EACH OBJECTIVE STANDS
| # | objective | state |
|---|---|---|
| 1 | Comparable-and-displayable | **OPEN.** Amazon reopened at a measured **7.1%** (not the 30% I published from a 40-target sample — corrected in #68). 31 observations from the 350-target run are **queued, not yet normalized**; their yield is unmeasured. ~900 Amazon targets remain. |
| 2 | English-vs-Arabic experience gap | **CLOSED** — 30% → 8% of Arabic result names carrying no Arabic (#64). |
| 3 | وفّر advisor (§8) | **CLOSED** — F7 was already built; §8's two unmet bullets (two-sentence limit, fact/inference/recommendation) shipped (#65). |
| 4 | AI-assistant citation | **PREREQUISITE BUILT, rest deliberately not started.** Every advertised URL was a 404 and the comparison pages were robots-disallowed (#66). llms.txt is measured ineffective (408 fetches / 500M AI-bot visits), so the honest next step is to *measure indexation*, not build more mechanism. |

## START THE NEXT SESSION WITH THESE, IN ORDER
1. **`npm run tps:comparison-value`** — once, deliberately, and record the method. Everything in
   Objective 1 is unquotable until there is one figure from one named instrument.
2. **Let the scheduler normalize the 31 queued Amazon observations, then re-measure.** Do **not**
   run `normalize` by hand alongside the scheduler (ADR-099).
3. **Decide Objective 1's next lever on cost per comparison**, not on availability: ~900 Amazon
   targets at 7.1% ≈ 60 observations. Completing a small retailer's catalogue beat seeding by 5×
   before (#60) — check that comparison first.
4. Then §9 وكيل توفيري agent separation · §2.1 retailer tiers · §11 WCAG 2.2 AA.
5. **In ~2 weeks:** re-run `tps:sitemap-verify` and a `site:tawveeri.com` query to see whether
   any of the 1,876 comparison pages were indexed. That is the only honest read on Objective 4.

## RAILWAY PREVIEW DOMAIN — SHIPPED AND CONFIRMED LIVE
Fixed **entirely in code** (ADR-190, commit `1beae75`). **No Railway dashboard change was needed
or made.** Re-confirmed at session close:
```
preview   https://tawveeri-main-production.up.railway.app/ar   200   x-robots-tag: noindex, follow
canonical https://tawveeri.com/ar                              200   (no x-robots-tag — correct)
preview robots.txt                                             0 Sitemap: lines (withheld)
```
Crawling is deliberately still allowed on the preview host so the `noindex` is readable —
blocking it would leave the URL indexed on anchor text alone. Gated by three checks in
`tps:sitemap-verify`.

## OWED / KNOWN-OPEN
- 55 refused duplicate pairs (ADR-184) — need a second evidence source, not a weaker gate.
- 59 audio canonicals stay English until store-name-in-brand is cleaned (guard shipped, **cleanup
  refused at a measured ≤2-comparison ceiling** — ADR-191).
- 7,155 storefront rows need Arabic-storefront ingestion (ADR-089 URL-vs-SKU double-count hazard).
- ACs filed under `category='accessories'` — worked around in the composer, not fixed.
- `/deals` page is hardcoded Arabic in both locales.
- ADR-183's live Amazon title re-verification is **DONE** (18/18 real names) — no longer owed.

## ROLLBACK — NEWEST FIRST
```
e388d24  CHECKPOINT #68 docs                      git revert e388d24
29224ce  ADR-191 store-name-as-brand guard        git revert 29224ce
9b0b228  CHECKPOINT #67 docs                      git revert 9b0b228
1beae75  ADR-190 canonical-host noindex           git revert 1beae75
3662b38  CHECKPOINT #66 docs                      git revert 3662b38
1c94c8f  ADR-189 compare title + localized sellers git revert 1c94c8f
5e9049f  ADR-189 sitemap · robots · compare SEO   git revert 5e9049f
8b3cfda  CHECKPOINT #65 docs                      git revert 8b3cfda
ee1dab4  ADR-187/188 reason kinds + F7 gate       git revert ee1dab4
aa43ed6  CHECKPOINT #64 docs                      git revert aa43ed6
89a50d3  ADR-186 live search index owner          git revert 89a50d3
e7a30c1  ADR-185 Arabic display names             git revert e7a30c1
```
**Data-layer rollbacks** (code revert alone does not undo these):
- ADR-185 renamed 401 canonicals + 613 storefront titles. Every before/after pair is in
  `docs/evidence/locale-name-remediation-2026-08-03.json`. Reverting the code and re-running
  `refresh-intelligence.ts` restores the previous composed names; both remediations are idempotent.
- The Amazon seed wrote **31 raw observations** — additive evidence, nothing to revert.

---

# ═══════════ RESUME POINT — 2026-08-03 (2) · MASTER BOOK PHASE OPENED · START HERE ═══════════

**Supersedes the resume point above. Tree clean · pushed · tests 1,289/1,289 · build compiles
(the `cp` step in `npm run build` is POSIX-only — run it under bash on Windows; Railway is
unaffected).**

## THE PHASE
`docs/TAWVEERI_MASTER_BOOK.md` v1.2 is IN THE REPO (founder-supplied; ch. 33–35 merged before
Appendix A; Appendix E added for post-approval external evidence). It governs product/CX below
the Constitution. `IMPLEMENTATION_ROADMAP.md` (repo root) is the unit order. Phase rule:
**products are inventory; comparable products are the product.**

## THE FIVE EVIDENCE ANSWERS (2026-08-03, methods named — re-measure before quoting)
| Q | figure | method |
|---|---|---|
| visible (knowledge) | 5,426 | `tps_product_projection` count |
| visible (storefront) | 9,754 (9,557 in-stock) | `products` / `product_stores` |
| ≥2 retailers | **922** (displayable **912**) | `comparable-count.sql` |
| ≥3 retailers | 236 (displayable 229) | same |
| comparison rate | 16.8% of projection · 12.2% of canonicals-with-offer | both denominators stated |
| AR/EN reachability | **54/54 PASS live** | `unified-search-verify.js --base https://tawveeri.com` |

**ONE FIGURE, ONE INSTRUMENT (resolves the 740/761 question):** the comparable count's named
instrument is `scripts/tps-analysis/comparable-count.sql`. `tps:comparison-value` is a DIFFERENT
instrument (per-category return-on-engineering; ran deliberately once: smartwatch 76.4%
identified-where-comparison-possible; ~131 missing listings across multi-merchant smartwatch
brands = U3 input). Do not present either as the other.

## SHIPPED THIS SESSION — ADR-193 (`007fc32`, + `2dd211c` book, + `3f23c47` roadmap)
Pick label conditioned on price-evidence age; observation time at the point of claim.
- `decisionCard.last_observed_at` carried from `price_history.observed_at` (was read and dropped);
  `SmartPickCard` renders shared `observedAgoLabel()` (day form ≥48h — approved corpus).
- Label withheld beyond `PICK_FRESHNESS_MAX_HOURS = 168` (evidence-engine owns it): search emits
  no card, advisor demotes `is_smart_pick`. Ranking untouched; unknown age never demotes (P2);
  grid results always render (P3). Withheld picks logged `[smart-pick-freshness]`.

## THE TWO MEASUREMENTS THAT SET THE NEXT UNIT (U2 — comparable-first observation cadence)
1. Median freshest observation across the 912 displayable comparables: **103.6h**; 42% >7d;
   only 27% <24h.
2. **685/912 (75.1%) of comparables' CHEAPEST offer rows are >7d old** — a stale low price stays
   "cheapest" BECAUSE it aged without re-observation. The best-price claim is structurally biased
   toward stale evidence. U2 re-observes cheapest-offer listings first; success = median <24h and
   the ADR-193 gate band ~empty. Mechanism: priority tier in `scraping_schedules`, ADR-099 rules
   unchanged.

## EXTERNAL EVIDENCE (Master Book Appendix E, sourced)
- No incumbent (idealo/Geizhals/PriceSpy/Google Shopping) shows per-offer freshness to consumers;
  Google suppresses on mismatch. Timestamps = differentiation.
- **Kanbkam (kanbkam.com) does consumer price-history for amazon.sa/noon/extra/jarir** — qualify
  every "no one in Saudi has price history" claim; depth unmeasured.
- Agentic commerce settled on "discover in AI, buy on site"; no first-party evidence-cited price
  API exists anywhere = open lane (U7, scope only).

## FOUND, NOT FIXED (deliberately — own boundaries)
- «ايفون 16» decision card is an **iPad**: `ARABIC_TO_ENGLISH` maps «ايفون»→['iphone','apple'],
  so any Apple product satisfies the relevance group. Reproduce, then fix the expansion
  (device-signal override exists for accessories; this is the sibling defect for brand terms).
- Stale-cheapest bias also affects compare pages' best-price ordering (same evidence; U2 fixes
  the data, but consider whether compare should surface per-offer ages — book §19 says yes:
  «متى رُصد كل سعر»).

## QUEUE (from IMPLEMENTATION_ROADMAP.md)
U2 cadence (next) · U3 comparison lever by cost-per-comparison (tps:feed-probe first) ·
U4 blocked (needs 2nd evidence source) · U5 Arabic ingestion · U6 AC misfiling · U7 scope only.
Owed: mobile-leg journey measurement (the one deliberate `tps:ui-journey` run) — was NOT spent
this session; spend it before or after U2 and re-baseline.

## ROLLBACK
```
007fc32  ADR-193 pick freshness unit        git revert 007fc32
3f23c47  roadmap (docs only)                git revert 3f23c47
2dd211c  Master Book v1.2 (docs only)       git revert 2dd211c
```
No data-layer changes this session (all measurement was read-only).

## ADDENDUM — 2026-08-03 · THE DELIBERATE HARNESS RUN (spent) + ADR-193 VERIFIED AT THE BOUNDARY

**`tps:ui-journey --base https://tawveeri.com` → `docs/ui-journey-adr193-2026-08-03.log`.**
**Overall 65/76 = 85.5% · comparison journeys 51/56 = 91.1% (launch gate).** Do NOT read this
against #40's 93.8%/96.3% as a trend — the journey set grew (48 → 56 comparison journeys) and
the homepage leg is now in the denominator; decompose before comparing (process rule 2).
16/16 named-variant journeys full-pass · outbound links 74 OK / 2 DEAD · the 19 "cross-language
pick mismatches" are the SAME products under ADR-185 localized names — an instrument
string-comparison limit, not a product defect.

**The 11 FAILs, enumerated (all pre-existing classes, none from ADR-193):**
1. `ps5` ar+en — Z-EDGE monitor card claims 2 stores with NO compare link (T3 class) + the first
   result card's outbound is DEAD (both DEAD links of the run).
2. `washing machine` (EN) ar+en — top pick is a **coffee machine** ("machine" token match;
   relevance defect, English query only).
3. `ميكروويف` ar+en — two Royal microwave cards claim 2 stores, no compare link (T3 class).
4. `lg tv` en — no store name on card.
Unhonoured store claims overall: 6 cards / 4 pages of 58 checked.

**ADR-193 verified in production, including at the exact boundary:** «ايفون 15» pick rendered
WITH its timestamp at age 167.98h; re-probed minutes later past 168h → **card withheld**. «مكيف»
grid serves 11 TPS products all carrying `observed_at`; the withheld Gree pick (219h) logged.

**Instrument rule earned (docs/ENGINEERING-RULES.md):** PowerShell mangles Arabic request bodies
to `????` — the apparent "TPS injection dead" and "cross-query pollution" findings were BOTH the
probe. Use bash curl `--data-binary` with a UTF-8 file.

**Found, not fixed (added to the ledger):** `searchTPSCanonical` fetches canonicals with no
`.range()` → PostgREST's 1,000-row cap silently hides ~215 of 1,215 active AC canonicals from
injection (silent-truncation class; needs pagination like ADR-189's sitemap fix). Plus the four
harness failures above and the «ايفون»→'apple' expansion defect (iPad as pick for «ايفون 16»).

## ADDENDUM 2 — 2026-08-03 · ADR-194 SHIPPED · U2 REFRAMED BY MEASUREMENT
Full detail: `docs/CHECKPOINT-2026-08-03-MASTER-BOOK-PHASE.md` (the consolidated checkpoint).
- **price_history.observed_at is price-CHANGE time** (append-only on changed prices —
  progressive-engine corroboratePass). Every freshness surface overstated staleness: comparables
  read median 104.4h; the true observation median is **19.3h** (npo basis). 31% of the "stale"
  cheapest offers had been observed within 24h.
- Fixed: projection `last_observed_at` ← max(npo.observed_at) (chain-realized hourly);
  searchTPSCanonical store entries ← newest npo per (canonical, retailer). Compare page's
  per-offer «رصدناه قبل» still reads price_history — owed, same pattern, own unit.
- **U2 true tail: 81 products / 158 cheapest pairs unobserved >7d — amazon 111 · jarir 42**
  (neither store is in the price re-observation loop). U2b thresholds pre-stated in the
  checkpoint doc. Mobile harness leg measured: identical to desktop (85.5%/91.1%; AR 33/38,
  EN 32/38) — checks are viewport-independent.
- Verify U2a after the next hourly chain tick: median projection freshness for displayable
  comparables ≤24h; «مكيف» card's «آخر رصد» shows true observation age.

## U2b MECHANISM FINDING — 2026-08-03 (scoped, NOT started; context boundary reached)
`/api/cron/update-prices` writes ONLY the storefront layer (`product_stores`) — it never emits
`raw_observations`. Discovery is the sole knowledge-layer observation source, so **the TPS layer
has NO targeted re-observation path**: a specific offer is re-observed only if a catalog crawl
happens to resurface it. This — not scheduling — is why 158 cheapest-offer pairs (amazon 111 ·
jarir 42) stay unobserved while both stores' crawls flow thousands of rows.

**The unit, precisely:** `scripts/tps-core/reobserve-comparables.ts` — select the truly-stale
cheapest pairs (query in `docs/CHECKPOINT-2026-08-03-MASTER-BOOK-PHASE.md` §3, npo basis),
re-fetch each offer's `raw_url` via the store's existing scraper price path, write through the
unified IngestionService into `raw_observations` (normalize picks it up like any observation),
bounded ~50/run, amazon throttle-aware, serialized with the scheduler loops (ADR-099), driven
from `scheduler.js` like the feed loop. Threshold pre-stated: true-stale pairs 158 → <50 within
a week of landing. Also owed: U2a post-tick verification (median ≤24h; «مكيف» card time), and
the compare page's per-offer «رصدناه قبل» npo fix.

## CORRECTION to "U2b MECHANISM FINDING" above — two claims were wrong; both re-measured
1. **"The knowledge layer has NO targeted re-observation path" was WRONG.** The orchestrator's
   price loop DOES ingest each refreshed price as a raw observation
   (`scraping-orchestrator.ts` ~453, "a refreshed price must also become an observation"). I
   grepped the ROUTE file and missed the orchestrator behind it. The real gap is narrower:
   the loop serves only INGEST_STORES (extra · samsung_ksa · noon) and selects by
   `product_stores.last_checked_at` — never by comparable/cheapest priority — so amazon and
   jarir offers never enter it, and extra's stale comparables lose the queue to its ~9k other
   offers.
2. **The "amazon 111 · jarir 42" split was the PRICE-CHANGE-basis artifact.** True
   (observation-basis) stale cheapest pairs, measured 2026-08-03: **162 total — extra 79 ·
   amazon 59 · jarir 9 · others ≤5 · 26 with no recoverable URL.** The checkpoint doc's §3
   store split is superseded by this line.

## ADDENDUM 3 — 2026-08-03 · ADR-195 SHIPPED AND FIRST RUN MEASURED (U2b)
`scripts/tps-core/reobserve-comparables.ts` (`npm run tps:reobserve`) + scheduler loop
(every 6h, `REOBSERVE_LIMIT=60`, `=0` disables). **First live run: 50 attempted → 42 raw
observations ingested (extra 17 · amazon 25/25 · jarir 0/2) · 8 nulls · 0 errors.**
- **The extra nulls are HTTP 404s — delisted product pages.** Their stale prices still win
  best-price. The knowledge layer has no delisting signal (an unobserved offer just goes
  quiet); an observed-delisted verdict is the next trust unit. Both jarir fetches also
  nulled (2-sample; classify before concluding).
- **Threshold (pre-stated, ADR-195): true-stale cheapest pairs 162 → <50 within a week.**
  Verification: the npo-based count moves on the hourly normalize tick — re-run the
  checkpoint §3 observation-basis query after the next tick; expect ~120 after this run,
  then the 6-hourly loop drains the remaining URL-recoverable pairs (136 of 162; 26 have
  no recoverable URL and need discovery, not re-observation).
- U2a verification also owed post-tick: projection median freshness ≤24h for displayable
  comparables; «مكيف» card shows true observation age.

## VERIFICATION — 2026-08-03T14:23Z · U2a MET · U2b ON TRAJECTORY
- **U2a MET:** projection median freshness for comparables **17.6h** (threshold ≤24h,
  predicted 19.3h); 526/960 <24h · 881/960 <7d. Query: `tps_product_projection` where
  `has_comparison`, age of `last_observed_at`.
- **U2b:** true-stale cheapest pairs **162 → 137** after ONE manual run + ONE partial
  normalize tick (34 of the 42 ingested observations realized so far; the rest land on
  subsequent hourly sweeps). The 6-hourly loop (limit 60) covers the remaining ~110
  URL-recoverable pairs within ~24h. Projected floor ≈ 34 pairs (26 no-URL + ~8 dead-404) —
  under the <50/week threshold; both floor classes are ledgered as their own units
  (discovery for no-URL · observed-delisted verdict for 404s — the NEXT trust unit).
- **Live spot-check:** the «مكيف» Smart Pick — withheld yesterday at a false 219h — renders
  again: `is_tps · 3 stores · آخر رصد قبل ~2h`, honest timestamp on the card.

## FINAL RE-MEASURE — 2026-08-03T14:59Z · DELTA AGAINST THE 162 BASELINE
**162 → 137 true-stale cheapest pairs (−25, −15.4%)** of 921 total. Store split:
extra 79→76 · amazon 59→42 · jarir 9→7. Stable across 14:23Z and 14:59Z reads.
**Conversion efficiency question (measure next session):** 42 observations ingested but 25
pairs converted — the gap is either bounded normalize batches still draining (benign) or
re-fetched products normalizing onto a DIFFERENT canonical than the stale pair (identity
drift on refetch — would silently cap this lever). One query decides it: for the run's
npo rows, compare canonical_product_id against the targeted cid list.
Threshold unchanged: <50 within a week; floor ≈34 (26 no-URL + ~8 delisted-404).

## ADDENDUM 4 — 2026-08-03 · ADR-196 PHASE 2 SHIPPED: DELIST VERDICT + SURFACE GATING
- `tps_offer_delist_signals` (migration 21, applied; RLS on, service-role only). Written on
  confirmed gone (404/410 after the store's own scraper failed), HEALED on the next
  successful observation. Availability-observation approach REJECTED: it would bump the dead
  pair's freshness signal.
- Gated in all three readers: projection `latest` CTE · searchTPSCanonical · get-comparison.
- **5 measured gone offers backfilled from the evidence file — all five were their
  comparison's cheapest_store.** Post-gate: 3 comparisons honestly become single-store,
  one 3→2, every lowest_price a real offer.
- Owed verification after deploy + next chain tick: the five canonicals' projection rows drop
  the dead store (query in ADR-196); compare pages for those keys show real cheapest.
- Note for the compare-page ADR-194 follow-up: `observed-freshness.ts` (2026-07-31) already
  governs per-offer display with a conservative earliest-signal rule — feed npo max in as a
  verified provenance signal there, do not bypass it.

## LIVE VERIFICATION — ADR-196 PHASE 2 CONFIRMED IN PRODUCTION
`/ar/compare/midea|side_by_side|370|standard` — the signalled اكسترا offer (previously the
winning cheapest store, page 404) no longer renders; the comparison serves أمازون · جرير ·
نون, all real offers. Request-time gating confirmed; the projection's counts follow at the
next hourly chain tick (owed check: the five canonicals' store_count/cheapest_store per the
ADR-196 query).

## ADDENDUM 5 — 2026-08-03 · ADR-197: JARIR PRODUCT-PAGE PARSER FIXED (JSON-LD @graph)
Jarir's product_price selector is a tile class; product pages carry Product JSON-LD wrapped
in @graph. Parser reads JSON-LD first (selector fallback intact). Live: 7/7 jarir stale
pairs ingested, 0 nulls — jarir's stale set CLEARED. Stale pairs now ~124 and draining
(extra remainder + amazon tail + 25 no-URL). Fixture-passed-live-failed lesson: the first
extractor missed @graph — the fixture now mirrors the measured live shape.

## ADDENDUM 6 — 2026-08-03 · CONTINUOUS-PHASE SWEEP (ADR-199/200/201 + U3 spent + healing verdict)
- **HEALING VERDICT (16:00Z):** orphaned lineages HEAL — npo-never 27 → 17 (10 pairs gained
  their first ledger rows under the price-row canonical). The identity-lineage repair unit is
  NOT required; the loop heals incrementally. True-stale pairs **162 → 112** (−31% today).
- **ADR-200 INCIDENT:** my reobserve run ingested a misparsed Amazon price (59.99 vs 1,609) →
  price_spread_pct overflow → the ENTIRE projection insert failed → chain fail(1), search
  indexes stale. Contained on three levels: derived-row spill cleaned (raw kept), price-sanity
  gate (>4×/<¼ → suspect_price, never ingested), spread clamped at 999.99 so one row can only
  ever degrade one product. Chain re-run: projection 26.5s OK. Ledgered: the Amazon PRICE
  selector needs ADR-183-style candidate plausibility (own unit).
- **ADR-199 (U6):** 325 ACs reclassified accessories → air_conditioner (236→561), 25/25
  hand-audit, evidence JSON; guard drained; storefront index re-synced same hour.
- **U3 SPENT:** amazon seeding 900 targets → 47 obs (11 created + 36 linked) · 4.3% (7.1%
  didn't hold on the tail; 30→7.1→4.3 across 40/350/900). Next lever: noon ~522 eligible @
  ~11% (small-sample).
- **ADR-201:** /deals localized (was hardcoded Arabic + dir=rtl on /en); EN strings are
  mirrors of approved Arabic claims; 14/14 pass checkCustomerText.
- Instrument lesson #3: I mistook DB-UTC vs local (+3h) elapsed time and nearly declared a
  healthy scheduler dead. Check `now()` FROM THE DB before calling anything stalled.

---

# ═══════════ RESUME POINT — 2026-08-03 (3) · CONTINUOUS PHASE CLOSED AT CONTEXT BOUNDARY ═══════════

**Supersedes prior resume points. Chain 9/9 healthy · tests 1,292 · tree clean at this commit.**

## SHIPPED THIS CONTINUOUS LEG (all measured, all pushed)
ADR-193 pick-freshness gate (boundary-verified live) · ADR-194 observation-vs-price-change
truth (median 19.3h real vs 104.4h displayed) · ADR-195 reobserve loop (stale 162→112,
scheduler-driven) · ADR-196 delist verdict + gating (5 dead cheapest offers off every
surface, verified live) · ADR-197 jarir JSON-LD parser (7/7 cleared) · ADR-198 orphaned
lineages (23/26 URLs recovered; HEALING VERIFIED npo-never 27→17 — lineage-repair unit NOT
needed) · ADR-199 325 ACs reclassified (customer index re-synced) · ADR-200 misparse
incident 3-level containment (chain was down one cycle, now 9/9) · ADR-201 /deals localized
(14/14 vocabulary-clean EN mirrors) · ADR-202 almanea Arabic names (25 written; see finding
below) · U3 SPENT: amazon 900@4.3% (47 obs) + **noon 522@21.5% (137 obs · 55 created + 80
linked — the phase's best seeding result)**.

## SEED YIELD PENDING
The 184 seeded observations (amazon 47 + noon 137) normalize on the next chain ticks;
re-measure comparable (`comparable-count.sql`) before quoting any figure.

## NEW FINDING — STOREFRONT EN/AR TWIN ROWS (the real U5 blocker)
ADR-202's apply hit 720/745 UNIQUE-collisions: the storefront holds SEPARATE Arabic-named
rows (name_ar=name_en=Arabic) for the same almanea products as the English-named rows.
U5's real unit is storefront twin-row dedup/merge (FK-heavy: product_stores, wishlists,
views) — scope with care, never improvise. The remaining no-Arabic rows: noon 3,823
(saudi-ar same-slug likely derivable) · amazon 1,867 (/-/ar/dp/ASIN deterministic; throttle-
aware) · jarir 1,008 (slugs differ per locale — #42's 404 lesson applies).

## MEANINGFUL UNBLOCKED UNITS REMAINING (in value order)
1. Re-measure comparable after seed realization; then re-freeze U2b trajectory (112 → <50).
2. Storefront EN/AR twin dedup (above) — unlocks the 720 + display integrity.
3. Amazon product-page PRICE selector plausibility (ADR-200's open item; fixtures like ADR-183).
4. noon/amazon Arabic-name enrichment via derivable AR pages (display-only writes, never
   observations — ADR-089).
5. §2.1 retailer tiers · §9 وكيل توفيري separation · §11 WCAG 2.2 AA (Master Book queue).
6. ~2 weeks: `tps:sitemap-verify` + site: query (Objective 4 indexation read).

## BLOCKED (unchanged)
U4 duplicate pairs (needs 2nd identity evidence source, ADR-184) · U7 build (needs the
indexation measurement first) · StoreLeads acquisition (paid, founder boundary).

## ROLLBACK LEDGER (newest first — every unit independent)
```
(this commit)   ADR-202 script + U5 finding + resume point
746b52b  ADR-199/200/201 sweep + compare-page ADR-194   git revert 746b52b
ee09eed  ADR-198 lineage recovery                       git revert ee09eed
4307614  evidence refresh                               git revert 4307614
72abe06  ADR-196 phase 2 (delist gating)                git revert 72abe06  + delete from tps_offer_delist_signals
84b16b0/1a9cec3  ADR-197 jarir parser                   git revert 84b16b0 1a9cec3
0c548f5/76c151c  ADR-195 reobserve loop                 git revert 0c548f5 76c151c  (REOBSERVE_LIMIT=0 disables live)
4ded4da/4701467  ADR-194 + checkpoint                   git revert 4ded4da 4701467
007fc32  ADR-193 pick gate                              git revert 007fc32
2dd211c/3f23c47  Master Book + roadmap (docs)           git revert 2dd211c 3f23c47
```
Data-layer: delist signals table (`drop table tps_offer_delist_signals`) · AC reclass
(evidence JSON has ids; reverse UPDATE) · almanea names (evidence JSON, reverse UPDATE) ·
ADR-200 spill (3 derived rows deleted, raw 983018 kept) · seeds + reobservations are
additive raw evidence, nothing to revert.

## CORRECTION + ADR-202 CLOSE — 2026-08-03 · THE "720 TWIN ROWS" WERE A PREDICATE ERROR
The previous resume point's "storefront EN/AR twin rows (720)" claim is RETRACTED. Measured:
sku-twin groups = 1, Arabic-name twin groups = 0. The 720 "collisions" were rows colliding
with THEMSELVES: the selection predicate counted `name_ar = name_en` as "no Arabic" even when
BOTH fields hold the same Arabic. Honest split (2026-08-03): truly-no-Arabic = noon 3,877 ·
amazon 1,851 · jarir 1,008 · extra 285 · **almanea only 3** — while **almanea has 1,270 rows
with Arabic in BOTH fields** (the English surface shows Arabic). The dedup unit is CANCELLED
on evidence. Shipped instead: `enrich-almanea-arabic-names.ts --field=en` filled **981/981**
`name_en` values from the merchant's own EN Algolia index (exact-sku, Latin-verified,
evidence JSON). U5's remaining real units: noon/amazon Arabic-page name enrichment.

## FOUNDER DECISION RECORDED — STORELEADS RETIRED (REJECTED HYPOTHESIS, final)
Paid for; produced no meaningful value. A paid generic retailer-discovery database does not
add enough value — the relevant Saudi retailers are publicly identifiable and directly
researchable. Never repurchase; never substitute another paid discovery DB without measured
evidence of a gap public research cannot resolve. The requirement is live-evidence
EVALUATION (overlap, ingestibility, identity quality), not discovery — `tps:acquire` is the
instrument. Also: subagent research is currently unavailable (org API restriction) — the
one partial agent claim (redsea=Shopify) was verified FALSE by direct probe (Next.js,
products.json 404 — ADR-105's classification stands).

---

# ═══════════ RESUME POINT — 2026-08-03 (4) · PHASE BASELINE FROZEN 18:14Z · START HERE ═══════════

**Supersedes prior resume points · tree clean at this commit · chain healthy.**

## THE FROZEN COMPARISON BASELINE (2026-08-03T18:14Z — all queries named)
| metric | value | method |
|---|---:|---|
| customer-visible (projection) | **5,450** | `tps_product_projection` count |
| comparable (≥2 approved) | **955** | `comparable-count.sql` |
| comparable DISPLAYABLE | **945** | same − COMPARISON_DISPLAY_EXCLUDED |
| ≥3 approved / displayable | 239 / 230 | same |
| comparison rate | **18.0%** of projection | has_comparison 980/5,450 |
| median retailer count (comparables) | **2** | projection store_count median |
| U2b true-stale cheapest pairs | **116** (baseline 162; threshold <50/wk, on trajectory) | checkpoint §3 observation-basis query |
**Day's movement: comparable 918 → 955 (+37; displayable 908 → 945)** — seeds (noon 21.5% ·
amazon 4.3%), reobserve loop, lineage healing, delist gating all realized.

## THE DAY IN ADRs: 193–202 + corrections — see resume points (2)/(3) above for detail.

## ACQUISITION CONCLUSION (research standard applied, instrument-measured)
StoreLeads RETIRED (founder decision, rejected hypothesis — recorded). Eight fresh major
candidates (tamkeen · alsaif · eddy · xcite · alhaqeel · hhm · emax · altheqa) evaluated by
`tps:acquire`: **all `unknown` platform, 0 config-only onboardable** — second confirmation of
ADR-105 (majors run closed enterprise platforms). Config-only universe = Salla/Zid/Woo/
Shopify long-tail only. **Next-phase acquisition decision: ONE custom-scraper major chosen by
variant overlap** (tamkeen/alsaif carry the same AC/appliance models as extra/almanea —
verify overlap by hand-sampling 30 models before any build). Subagent research currently
unavailable (org API restriction); the one agent claim tested (redsea=Shopify) was FALSE.

## NEXT SESSION, IN ORDER
1. U2b weekly check (116 → <50) — the loop runs itself; just re-measure.
2. U5 real units: noon (3,877) / amazon (1,851) Arabic-name enrichment via their derivable
   /ar pages (display-only writes, never observations — ADR-089).
3. Amazon product-page PRICE selector plausibility (ADR-200's open item).
4. Custom-scraper major: hand-verify overlap sample, then scope the build as its own ADR.
5. §2.1 retailer tiers · §9 agent separation · §11 WCAG (Master Book queue).
6. ~2026-08-17: indexation re-measure (tps:sitemap-verify + site: query) → Objective 4.

## BLOCKED (exact unblocking events)
U4 55 dupes → a second identity-evidence source at audited precision · U7 build → the
indexation measurement · subagent research → org enables Claude Code subscription access.

## RETAILER PROBE RECORD — 2026-08-03 evening · TAMKEEN REJECTED (instrument grounds) · ALSAIF WAF-BLOCKED
- **alsaif gallery: OUT** — Huawei CloudWAF intercepts plain requests as attacks (418). Same
  class as blackbox; no circumvention.
- **tamkeen: REJECTED FOR NOW — not on overlap, on measurability/ingestibility.** Three
  instruments, each caught by its control: (1) static search probe scored 30/30 — pure
  template echo (nonsense string also ×6); (2) rendered probe 0/30 — the search grid is a
  40-card POPULAR fallback (an AC query's first card is a TV), card titles carry no models;
  (3) product URLs DO embed model slugs (…-gs50wost) but there is NO sitemap (SPA shell at
  every path) and the internal API 404s direct calls. Verdict per the research standard:
  identity exists but every route is a heavy custom build, and the overlap that would justify
  it cannot be cheaply verified. Sample preserved: docs/evidence/tamkeen-overlap-sample-*.json.
  Method for the NEXT candidate: require a keyable search OR sitemap BEFORE sampling.
- **noon Arabic enrichment scoped:** URLs derive by product code (/saudi-ar/x/<CODE>/p/), but
  raw HTTP to noon stalls from here (the recorded egress behaviour) while NoonScraper's own
  fetch path works (wrote 137 seed obs today). The build = batch the 3,877 codes through the
  scraper's fetch + JSON-LD title extraction, display-only writes (never observations,
  ADR-089). FIRST unit next session.
- ADR-201 verified live: /en/deals dir=ltr English, no Arabic leak; /ar unchanged.
- Autonomous loops confirmed self-driving (extra 17:36+, noon 235 rows — zero manual).
