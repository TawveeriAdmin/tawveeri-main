# UX Decision Record

Created 2026-07-31, at the first significant UX decision — not retroactively, per
`docs/IMPLEMENTATION_ROADMAP.md` ("deliverables are created when they earn existence").

This file records decisions that change what a customer **sees or does**, and the evidence
behind them. Architectural decisions belong in `docs/DECISIONS.md`; wording belongs to
`docs/LAUNCH_VOCABULARY.md`, which outranks this file on any public string.

---

## UXD-001 — The brand green got darker, because it could not carry its own text

**Date:** 2026-07-31 · **Unit:** P2-7 (WCAG 2.2 AA) · **ADR:** ADR-151 · **Commit:** see below

### What changed for the customer

Filled buttons, price-savings figures and success states render a **deeper green**. Nothing
moved, nothing was removed, no interaction changed. The logo is untouched — it is a PNG and
does not read these tokens — and the light mint survives as backgrounds and borders.

| token | was | is | why |
|---|---|---|---|
| `--brand-green` | `#55B295` | `#3B816B` | white label on it measured **2.56:1**, needs 4.5 |
| `--brand-green-dark` | `#3D8468` | `#35735B` | as ink on white measured **4.46:1**, needs 4.5 |
| `--brand-green-dark` (dark theme) | *(not overridden)* | `#66BD93` | ink on `#111513` measured **4.11:1** |

### Why this was not a smaller change

The obvious smaller change — fix the fourteen call sites that hardcode `text-white` on
`bg-[var(--brand-green)]` — was rejected. It leaves the trap armed: the fifteenth call site
reintroduces a 2.56:1 failure and nothing catches it. A contrast rule that depends on every
developer remembering is not a rule.

The other candidate — keep the mint and put dark ink on it, which is how Spotify solves the
identical problem — was measured too (`#0E281F` on `#55B295` = 6.1:1, it works). It was
rejected because `--color-primary` is *also* used as ink on light containers, where it
measured 2.35:1. That option fixes the buttons and leaves the text failing.

### What this decision costs

The product's dominant colour is visibly different. That is a real cost and it is the
founder's to reverse if the brand judgement outweighs the accessibility one — `git revert`
on the token commit restores the previous palette exactly, and the audit returns to ~800
failing contrast nodes, which is the trade being made.

### The measurement that justifies it

`docs/a11y-2026-07-31-BEFORE.log` · `…-AFTER.log` · `…-PRODUCTION.log` — both harnesses each time.
The before/after pair was re-run with the FINAL harness so the two share a denominator.
The failing-node count moves run to run with the live results rendered (769–806 measured);
the seven colour pairs behind it are stable, and they are what the fix was sized from.

```
before   axe: 2 rules · 769 failing nodes across 36 renders   keyboard: 30 checks · 12 failing
after    axe: 0 rules ·   0 failing nodes across 36 renders   keyboard: 31 checks ·  0 failing · 1 accepted
prod     axe: 0 rules ·   0 failing nodes across 36 renders   keyboard: 31 checks ·  0 failing · 1 accepted
```

Reproduce (dev server on :3000, or `--base https://tawveeri.com`):

```bash
node scripts/tps-analysis/a11y-audit.js       # axe, 5 routes × 2 locales × 2 viewports × 2 themes
node scripts/tps-analysis/a11y-keyboard.js    # focus order, focus return, reflow, target size, lang
```

---

## UXD-004 — «وفّر» left the header; the search box learned to answer needs

**Date:** 2026-07-31 · **Unit:** P2-8 (UNIFIED SEARCH) · **ADR:** ADR-152 · **Commit:** `3071af1`

### What changed for the customer

There is one box. Type a product name and you get results; describe a situation — *"a quiet
AC for a 30 m² room under 4000"* — and the deterministic decision engine answers above them,
with its evidence, its total-cost estimate and its confidence. **You never choose which one
you wanted.** The «وفّر» item is gone from the header, `/advisor` redirects into search
carrying your query, and the entry page now shows three need-phrasings next to the product
names so the capability is visible.

### The judgement call, and its cost

Retiring a labelled destination is a real loss of *signposting*. A customer who knew «وفّر»
by name no longer sees it. The Constitution is unambiguous that the signpost is the problem
— *"Customers never choose between search · AI search · assistant"* — so the alternative was
to keep a door the governing document forbids.

**The mitigation is the need-phrasing row on the entry page**, and it is the part most likely
to be wrong. Every "popular search" already there is a product *name*; without something
teaching the other half, the engine would still run and simply never be invoked, which is
indistinguishable from having deleted it. Three example phrasings are a first attempt, not a
measured answer. **When there is traffic (P2-4), the thing to measure is the share of queries
that carry a need signal.** If it collapses versus the وفّر era, this decision under-served
customers and the answer is better teaching, not a second door.

### What the customer does NOT see, deliberately

- **Two picks are never shown at once.** The retrieval "smart pick" is suppressed whenever
  the engine answers. Both are "our pick", chosen on different grounds; showing both makes
  the customer arbitrate between two answers to one question.
- **Advisor failures are silent here.** If the engine errors or has nothing, the results
  stand on their own. An "I could not help" panel above good results invents a failure the
  customer does not have. `/advisor` used to show those states because there the assistant
  *was* the page; on the unified surface it is not.

### Verified

`docs/unified-search-2026-07-31-PRODUCTION.log` — 34 checks, routing both ways in both
locales, the AI disclosure at-or-before the answer in the exact §8 wording, redirect landing,
header door gone, need phrasing present.

```bash
node scripts/tps-analysis/unified-search-verify.js --base https://tawveeri.com
```

---

## UXD-005 — The assistant may ask one question, and only when the answer would change its mind

**Date:** 2026-07-31 · **Unit:** P2-8 · **ADR:** ADR-153 · **Commit:** `306a8b4`

### What changed for the customer

Describe a need too vaguely for the engine to size an answer — *"a quiet energy-saving air
conditioner"* — and **one** question appears above the recommendation: *"Roughly how large is
the room?"* with three sizes and a labelled **Skip — show the current recommendation**.

**The recommendation is already there.** The question sits above it, not in front of it.
Declining costs the shopper nothing; answering refines what is already on screen.

### The two rules that decide whether it appears at all

1. **It must change the answer.** Before asking, the engine runs the decision at both ends of
   the offered range (15 m² and 40 m²) over the same candidates. If the top pick is identical
   at both ends, no answer in between can move it, and the question is never shown. This runs
   **in the decision**, not in review — a rule enforced by a reviewer is a rule that
   eventually is not.
2. **It must not already have been answered.** «ابي مكيف رخيص لغرفه ٤٠ متر» is never asked for
   a room size. That is not a new rule; it is a **fixed defect** — see below.

### The defect that made this necessary

The assistant previously asked for a room area supplied in the same sentence. The cause was
not the question logic: **every numeric pattern in the parser used `\d`, which matches ASCII
digits only.** A shopper typing ٤٠ on an Arabic keyboard had their room size dropped — along
with their budget and storage size — and was then asked for it. Nothing errored, so nothing
surfaced.

This was the **third** time Arabic-Indic digits produced a false result here. It is now
normalised once, at the parser's entry point, rather than in each pattern.

Tested on the exact failing phrase plus nine real Saudi phrasings — ابي/ابغى/ودي, «غرفه»
without the taa marbuta, متر / م٢ / م, صالة, مجلس, غرفتي, a bare number after the room noun,
and an English control.

### What to watch, when there is traffic

`advisor_clarified` fires when a shopper answers. **Asked-vs-answered is the measure that
should decide whether the question set grows or shrinks.** A question the engine proved
*could* change the recommendation is not automatically one a shopper *wants* to answer; if
the answer rate is low, the honest response is fewer questions, not more.

---

## UXD-002 — A card's action buttons now name their product; the DOM order was left alone

**Date:** 2026-07-31 · **Unit:** P2-7 · **ADR:** ADR-151

Product-card action buttons are rendered **before** the card body in the DOM, deliberately, so
they do not intercept the card click. The consequence is that keyboard focus reaches "Save to
Wishlist" before the product is ever announced — and in a twenty-card grid that is twenty
identically-named buttons.

**Decided:** name each control with its product (`"Save to Wishlist: <product>"`,
`"Add to compare: <product>"`). **Not decided:** the DOM order, which stays as it is.

Reordering it is a component restructure and would risk the click-interception bug the layout
exists to prevent — out of scope under an accessibility ticket, per the P2-7 stopping
condition. Naming is what 2.4.3 actually asks for: focus order must *preserve meaning and
operability*, and a self-describing control preserves both.

The harness reports this as an **accepted deviation carrying its reason**, never as a pass, and
only for pairs it can prove belong to the same card. A cross-component inversion still fails
the gate.

**Reopen this if:** the card is restructured for another reason, or a screen-reader user
reports the order as confusing. Fixing the order then costs nothing extra.

---

## UXD-003 — `/en` still serves `<html lang="ar">` in its bytes, and that is recorded, not hidden

**Date:** 2026-07-31 · **Unit:** P2-7 · **ADR:** ADR-151

`src/app/layout.tsx` sits above the `[locale]` segment and cannot read the locale, so every
page shipped a hardcoded `lang="ar"` and no `dir` at all. The document language is now
corrected from the URL before first paint, so the accessibility tree — which is what a screen
reader actually reads — is built from the right value, and `dir` on `<html>` also fixes Radix
portals that mount outside the `[locale]` wrapper.

**The gap that remains:** the served HTML still says `ar` for `/en`. A consumer that never runs
JavaScript sees the wrong language. The complete fix is the root layout owning the locale,
which requires the same root-shell restructure that the 404-body roadmap item is already
blocked on. **One structural change unblocks both** — worth doing together, not twice.
