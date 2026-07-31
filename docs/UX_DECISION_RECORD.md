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
on the token commit restores the previous palette exactly, and the audit will return to
806 failing nodes, which is the trade being made.

### The measurement that justifies it

`docs/a11y-2026-07-31-BEFORE.log` · `docs/a11y-2026-07-31-AFTER.log` (both runs, both harnesses)

```
before   axe: 2 rules · 806 failing nodes across 36 renders   keyboard: 28 checks · 12 failing
after    axe: 0 rules ·   0 failing nodes across 36 renders   keyboard: 29 checks ·  0 failing · 1 accepted
```

Reproduce (dev server on :3000, or `--base https://tawveeri.com`):

```bash
node scripts/tps-analysis/a11y-audit.js       # axe, 5 routes × 2 locales × 2 viewports × 2 themes
node scripts/tps-analysis/a11y-keyboard.js    # focus order, focus return, reflow, target size, lang
```

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
