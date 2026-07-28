# EVIDENCE_LINE_COPY — for founder approval

**2026-07-28 · Status: PROPOSED, awaiting founder approval before execution.**
Read-side render only (no model, no migration). Data already fetched (`RealDeal.distinct_days`, `observed_max`, `real_saving_pct`). Surface: `/price-truth` only until Tier 2 unfreezes. A basic version (no `ريال`, fixed `يومًا`) is already live from commit `a4d5162`; this is the refined copy.

---

## The exact Arabic strings

**Line 1 — the verified-saving badge (already renders):**
```
✓ توفير حقيقي {saving} ريال
```

**Line 2 — the NEW evidence line (the product thesis, made visible):**
```
تتبّعنا هذا المنتج {distinct_days} {DAY_WORD} · أعلى سعر رصدناه {observed_max} ريال
```

**`{DAY_WORD}` — Arabic number agreement (our `distinct_days` runs ~2–14, so more than one form occurs):**

| distinct_days | DAY_WORD | full line 2 example |
|---|---|---|
| 1 | `يومًا واحدًا` | تتبّعنا هذا المنتج يومًا واحدًا · … |
| 2 | `يومين` | تتبّعنا هذا المنتج يومين · … |
| 3–10 | `أيام` | تتبّعنا هذا المنتج 5 أيام · … |
| 11+ | `يومًا` | تتبّعنا هذا المنتج 14 يومًا · … |

Numbers rendered in `tabular-nums`. `ريال` follows each amount.

---

## Rendered example — the real Hisense 85″ U7Q card

Live values: saving **8,800** · distinct_days **14** · observed_max **14,399** (verified_drop, verified live 2026-07-28).

```
✓ توفير حقيقي 8,800 ريال
تتبّعنا هذا المنتج 14 يومًا · أعلى سعر رصدناه 14,399 ريال
```

For contrast, a 5-day product would read:
```
✓ توفير حقيقي 1,200 ريال
تتبّعنا هذا المنتج 5 أيام · أعلى سعر رصدناه 4,999 ريال
```

---

## Why this line
It makes the entire product thesis visible in one sentence: we publish a **smaller** saving than the merchant (8,800 vs Extra's claimed 9,400) **because ours is evidence** — the highest price we actually observed over 14 days of tracking. No competitor can copy this without an equivalent observation history.

**On approval:** reply "approved" (or with edits) and I execute the refined render on `/price-truth` before 1 August.
