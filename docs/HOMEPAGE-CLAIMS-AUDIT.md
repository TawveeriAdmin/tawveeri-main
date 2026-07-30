# HOMEPAGE CLAIMS AUDIT
**2026-07-30 · REDESIGN_BRIEF §1.2 · Verified against live production HTML, not source**

Prerequisite: `docs/DATA-AVAILABILITY-AUDIT.md` (§1.1) — establishes what production can support.

---

## 1. THE HEADLINE FINDING — §1's premise was only half true

REDESIGN_BRIEF §1 states the three figures *"were removed before this redesign began"* and asks
me to verify they remain absent.

**They were removed from the HOMEPAGE. Two of them were still live on the About page.**

Fetched `https://tawveeri.com/ar/about` and `/en/about` — both HTTP 200, both serving
`85K+ منتج` and `8 متجر`. The §1 audit checked one surface and concluded the claim was retired;
the claim had simply moved out of the checked surface.

**This is the same lesson §1 draws, one level deeper.** §1 says the reviewers failed because
they never fetched the live HTML. The follow-on failure is fetching *one page* of live HTML and
generalising from it. A claim is retired when it is absent from **every** rendered surface.

---

## 2. THE §1.2 TABLE

| Current figure | Actual source | Honest replacement | Justification |
|---|---|---|---|
| `+٨٥,٠٠٠ منتج مقارن` | **None.** Hardcoded array literal in `src/app/[locale]/about/page.tsx:39` and `src/app/about/page.tsx`. No query, no derivation. | **No figure.** Removed, not replaced. | Production serves **5,037** projection rows, of which **758** are comparable. 85,000 corresponds to nothing measurable. Publishing 5,037 as "compared" is forbidden by LAUNCH_VOCABULARY §3 (catalogue ≠ comparable); publishing 758 on a static page violates §1.4 (no hardcoded figure). Both roads are closed → the page carries no number. |
| `٨ متجر موثوق` | **None.** Same hardcoded arrays. The word `موثوق` ("trusted") has no backing definition anywhere. | **No figure.** Removed, not replaced. | 24 stores are registered; **6** carry any listing. "8" matched neither. `موثوق` asserts a trust relationship we do not hold — LAUNCH_VOCABULARY §3 forbids "official partnerships"; a "trusted store" count implies the same. |
| `+٦٢,٠٠٠ فرصة توفير` | **None.** Already absent from every rendered surface — homepage and About. | n/a — already gone. | Confirmed absent in live HTML on `/ar`, `/ar/about`, `/en/about`. |

### 2.1 Two further violations found on the same page, not in §1's list

| String | Rule broken | Disposition |
|---|---|---|
| `تحديث يومي` / `أسعار حقيقية ومحدّثة يومياً` | LAUNCH_VOCABULARY §3 — **any refresh-cadence promise**. Dedicated price refresh is not our freshness mechanism (HANDOVER #16, exclusion 1). | Removed. |
| `من جميع المتاجر` ("from all stores") | LAUNCH_VOCABULARY §3 — **comprehensive-market claim**. | Removed. |
| `الأرخص أولاً دائماً` ("cheapest first, always") | Describes a ranking policy that is not ours (corroboration precedes cheapness), and REDESIGN_BRIEF §14.1 forbids public statements about ranking policy. | Removed. |

---

## 3. WHY NO REPLACEMENT FIGURE WAS INTRODUCED

§1.4 is absolute: *"Never hardcode a number in JSX. Every figure derives from a live query with
a documented definition, or it does not appear."*

The About page is a static server page. Two options existed:

1. Wire a live query into it, or
2. Carry no figure.

**Option 2 was chosen.** A count on an About page does no work for a shopper that the evidence
line on a product card does not do better and closer to the decision. Adding a query to satisfy
a slot that need not exist would be building a claim to fill a layout, which is the inversion
§6 warns against — *prove, then explain*. The page now explains what we do; the products carry
the proof.

The figures that **may** appear once bound to a live query with a stable definition are recorded
in `docs/DATA-AVAILABILITY-AUDIT.md` §1 (758 comparable, 70% unobserved-reference share).

---

## 4. NAMING RULE COMPLIANCE (§1.3)

Applied to every candidate figure:

- **observations ≠ products** → 5,037 is *served projection rows*, never "observations".
- **offers examined ≠ offers available** → the 70% statistic's denominator is 13,879 *checkable*
  listings, and must always carry *"among the offers we examined"*.
- **canonical products ≠ comparable products** → 5,037 canonical-backed rows vs **758** with
  ≥2 retailers. The About page previously merged these into "85K+ compared".
- **connected retailer ≠ retailer with coverage** → 24 registered, **6** with listings. This is
  the exact defect behind `٨ متجر موثوق`.

---

## 5. VERIFICATION PERFORMED

| check | result |
|---|---|
| `/ar` live HTML — three figures | **Absent.** Only survivor is `متجر موثوق` as a dead label inside the serialized translation payload (`landing.json :: stats.trustedStores`), with **0** component references — latent per LAUNCH_VOCABULARY §5, renders nowhere. |
| `/ar/about` live HTML before fix | `85K` ✗ · `تحديث يومي` ✗ · `جميع المتاجر` ✗ · founder card ✗ |
| `/en/about` live HTML before fix | Served **hardcoded Arabic** with `direction:'rtl'` — no English page existed. |
| `/ar/about` rendered text after fix | Clean on all 7 probes (`85K`, `تحديث يومي`, `القريني`, `المؤسس والرئيس`, `جميع المتاجر`, `شراكات رسمية`, `الأرخص أولاً`). |
| `/en/about` rendered text after fix | Clean on all 7 probes; renders English. |
| Test suite | **770/770 passed**, 62 suites. |
| Production build | Passed. `/[locale]/about` 405 B · `/about` 350 B. |
| **Affiliate integrity (§14.1)** | `/go/fff360db-…` → `amazon.sa/dp/B07V448GMX?tag=**tawveeri-21**&ascsubtag=…` — **identical on production and locally after the change**, fresh per-click sub-id. Intact. |

---

## 6. DEFECT FOUND WHILE VERIFYING — the exit layer's fallback leaks an internal address

Not part of §1, recorded because it was found by this audit and it is a customer dead end.

`src/app/go/[offerId]/route.ts` falls back with `NextResponse.redirect(new URL("/", req.url))`
whenever an offer id is malformed or unresolvable. Behind Railway's proxy, `req.url` is the
**internal bind address**, so production returns:

```
GET https://tawveeri.com/go/680712
→ 302  location: https://0.0.0.0:8080/
```

A user following a stale or malformed exit link is sent to an unreachable host rather than the
homepage. **The affiliate path itself is unaffected** — a valid offer id resolves and tags
correctly (§5 above). Fix: build the fallback from the configured public origin
(`NEXT_PUBLIC_APP_URL`) rather than `req.url`. Recorded as the next exit-layer item; not bundled
into the About commit, because the exit layer is revenue-bearing and changes to it deserve their
own reversible unit.
