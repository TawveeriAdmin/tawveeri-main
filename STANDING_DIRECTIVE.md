# TAWVEERI — STANDING DIRECTIVE
**2026-07-29 · Supersedes every prior prompt · Read once, then work without stopping**

---

## 0. HOW WE WORK NOW

You have **full authority** to research, decide, implement, deploy and verify without
returning to me, on everything except:

- a paid commitment or legal signature
- credentials, banking, or company identity
- a production risk you cannot safely reverse
- publishing a claim we have not measured ourselves

Everything else: research it, decide, ship it, tell me after.

**This document is my view from outside. You read the code.** Take every clause,
research it directly against the system and against global practice, and where you find
a better route to the same outcome, take it without asking. You have overridden me
correctly nine times in four days, and every one was faster than my path.

**Nothing here may be silently skipped.** Every item returns DONE, or NOT POSSIBLE with
a reason, or NOT REACHED with the capacity limit stated. Never "waiting on you."

**Process rules earned the hard way in this project:**

1. **Baseline before change.** Measure, then act, then re-measure. Report the delta.
2. **Decompose any number that jumps.** A figure that moves because the method moved is
   not progress. This caught a 70-point instrument error.
3. **Audit the instrument before trusting it.** A broken measuring tool is worse than
   no tool — it manufactures confidence.
4. **Deploy everything.** Commit, push, verify live on Railway, report the URL and the
   rollback command. Undeployed work does not exist.
5. **Making a hidden failure visible is progress, even when the number falls.**
6. **"We did not observe it" is never "it is not true."**
7. **Never publish a saving we did not verify ourselves.**
8. **Unknown beats incorrect.**
9. When context runs low, checkpoint to HANDOVER.md, commit, push, and say so.

---

## 1. MEASURED REALITY — do not re-derive any of this

**Journey quality (the gate):**
- Honest journey pass rate: **17.6%** — not 87.5%. That figure was a 70-point
  instrument error, caught by decomposition
- `npm run tps:ui-journey` reports both numbers with the gate labelled;
  `docs/ui-journey-honest-2026-07-29.log` is the current truth
- Tests: 738/738 passing
- **Instrument limit, flagged not hidden:** `subject_result_card = 0` — the Smart Pick
  is always the subject when present, so result cards' own compare consistency is not
  yet price-checked. Any gate above ~90% is unreadable until this is fixed

**Catalog:**
- 22 stores registered · ~6 with products · **4.5 actually working** — Amazon, Jarir,
  Extra, Almanea, and Noon (thin, 809 URLs)
- 5,543 served products
- Model-number pollution 3.2–10.8%, but ~0% of corroborations. Dead links 0.3%

**⟶ CORRECTED 2026-07-29 (re-measured on production; these supersede the three figures
that stood here). Every number below is live, not a snapshot — the pipeline keeps
observing, so re-measure before publishing rather than quoting this line.**

- **Comparable products: 459** canonicals carry live offers from ≥2 distinct approved
  retailers (**88** from ≥3), out of 5,648 canonicals with any offer = **8.1%**.
  This replaces **166**, which ADR-132 retracted as an Amazon double-count, and it is a
  different thing from ADR-133's "~564 families in the knowledge layer" (that figure
  counted retailer-normalized store rows, not approved-retailer offers).
  **Of the 459, only 132 (mobile 81 + AC 51) are reachable from search today** — the
  canonical injection is hard-limited to those two categories. The other **323** exist,
  are comparable, and cannot be found. See ADR-138.
- **Verified price drops: 351** (live `/api/v1/tps/discount-integrity`). Neither 342 nor
  340 — 340 was ADR-134's figure on the day it landed; the count moves as we observe.
- **Unobserved-price share: 71%** — 9,644 `inflated_reference` of 13,599 checkable
  listings (verified 351 + inflated 9,644 + stable 3,604; `insufficient_history` 4,616
  abstains per ADR-134, and 636 superseded duplicates are suppressed).
  **Not 87.7%.** That figure used a narrower denominator on a smaller population and no
  longer reproduces. 71% is what the product publishes and what an auditor would recompute.

**Identity — three dead ends, do not revisit:**
- GTIN coverage across all offers and families: **zero**
- Icecat MPN bootstrap: 12% hit, 8% GTIN, brand-restricted. Marginal for TVs/monitors
  only (LG, Hisense, TCL) — not a strategy
- Trigram blocking: 836 new candidates yielded only **10–50 genuinely recoverable**.
  **Matching is not the bottleneck. Acquisition is.**

**Acquisition — the measured rule:**
- UCP: 9 of 22 stores publish a profile. **None of Jarir, Extra, Noon or Amazon.**
  The credential deadlock with the majors is not solved by protocol
- UCP stores share **127 families with the majors, 88 of them new**
- Concentration: alnakheelk 68 · najm 48 · aletawik 10 · eazyworld 7 ·
  goldenstore99 5 · pcpalace 2 · hdf 2 · **sonyworld 0**
- **The rule: multi-brand appliance and AC retailers overlap with the majors.
  Single-brand specialists produce nothing.** Sonyworld's zero is the reference case
- 5,200+ active Salla stores exist in Saudi Arabia. The pool is not the constraint;
  selection is

**Merchant behaviour:**
- Extra: `aggressive_claims`, 100% of advertised discounts unsupported by our
  observation — **but genuinely cheapest ~60% of the time** (ADR-051). The defect is
  the discount claim, not the price
- Almanea: prices verified 5/5 exact against the live customer surface. 216,711 of that
  retailer's 337,118 observations sit on the dev host — a data decision, not a bug
- Amazon affiliate `tawveeri-21` is the only active programme. Electronics commission
  1–3%

**Competition:**
- Rakhys: 27 stores, ~70,600 listings, 7,572 smartphones of which 5,305 are AliExpress.
  Nearly every card reads "من 1 متجر" — breadth with almost no real comparison.
  Their structure is cleaner than ours; their content is not

---

## 2. DEAD THESES — mine, killed by measurement. Do not resurrect.

1. GTIN is our identity authority → zero coverage
2. Icecat MPN rescues it → 12%
3. Matching is the bottleneck → it is acquisition
4. The blanket freeze until 2 August → over-broad, cost days
5. The A/B split explains the compare page → wrong, it was one join
6. Dead links are a major blocker → 0.3%
7. 87.5% was progress → instrument error

Keep killing them. It is the most valuable thing that happens here.

---

## 3. THE WORK — ordered by measured leverage

### P0 — the gate

**3.1 Intermittent search.** `تاعامس` · `نوفيا` · `ps5` return no card. You identified
this two days ago. It is the top item, it is the most user-visible defect, and it makes
every other measurement unreliable. Fix it.

**3.2 The instrument limit.** `subject_result_card = 0`. Until result cards are
price-checked in their own right, no gate above ~90% can be read. Fix the harness so it
tests result cards independently of the Smart Pick, then re-baseline.

**3.3 Relevance.** `laptop` and `بوتبال شتا` return an accessory as the top pick.
`iphone` surfaced a 2020 phone while `ايفون` surfaced the current one — the same intent
in two languages producing two winners. State what "اختيار توفيري" optimises for. If it
is lowest price, that is the bug: cheapest is not best.

**3.4 Outbound 404s.** `نحاش` lands on a 404. 0.3% overall, but each one is a user lost.
Add a link-health check that demotes dead URLs automatically rather than waiting for a
harness run to find them.

**3.5 Information architecture.** The homepage still has two search fields, وفّر in two
places, and the trust block sitting between the user and the categories. Build the
homepage-start journey harness, baseline it, then restructure, then re-measure.

My proposal — override it if your research says otherwise:
one search field in the hero · categories directly below · أفضل العروض with real
products carrying the evidence line · "قارن بذكاء ووفّر بثقة" **after** the evidence,
not before it · وفّر with a single entry point.

Reasoning: the trust claim should be **proven by products, then explained**. Asking a
user to accept the claim before seeing any product is exactly what we say we do not do.

### P1 — the constraint

**3.6 Acquisition.** Everything above makes the existing catalog usable. **None of it
makes the catalog bigger.** 4.5 stores and 166 comparable products is the business
constraint, and the measured route out is already in your own work.

Once the journey gate is materially above 17.6%, open `ACQUISITION_TARGETS.md` and
start. Use `feed-overlap-probe.ts` to **predict** overlap before onboarding — predicted
overlap is the only criterion. Multi-brand appliance and AC retailers on Salla and Zid,
credential-free via UCP. You do not need my approval to onboard a store your own probe
predicts will create comparisons.

**3.7 Noon.** Thinnest approved retailer, largest overlap opportunity among the majors.
Measure what tripling it would create before investing effort.

### P2 — the surface that earns

**3.8 The evidence line.** Under every verified saving:
`تتبّعنا هذا المنتج {days} يومًا · أعلى سعر رصدناه {observed_max}`
The data exists. It is a text render. **It makes the entire product thesis visible in
one line** — we publish a *smaller* saving than the merchant because ours is evidence.
Ship it.

**3.9 Positioning.** Tawveeri is **the price truth layer for Saudi retail**, not a price
comparison platform. 459 comparable is a weak number; **351 verified drops** and **"71%
of advertised discounts reference a price we never observed"** is a strong one. Same
platform, different frame. All public copy follows from this.
*(Figures corrected 2026-07-29 — the 166 / 342 / 72% that stood here were retracted or
stale. Re-measure before publishing: these move as the pipeline observes.)*

The proof card, re-verified and holding: Extra claims a 9,400 SAR saving on the Hisense
85" U7Q; **we publish 8,800, because 14,399 is the highest price we actually observed.**
Our number is lower than the merchant's because ours is evidence.

**3.10 The moat.** Price observation history compounds daily and cannot be bought
retroactively. Rakhys has 70,600 listings and zero observation history. A funded
competitor starting today needs months of waiting, not money.

---

## 4. THE STRATEGIC LAYER — do not build yet, but do not lose

**Revenue.** Amazon electronics affiliate is 1–3% and is the only active programme.
Roughly 100,000 monthly high-intent sessions would be needed for it to matter. The
stronger near-term story is B2B: 4,531 `inflated_reference` facts, per-retailer trust
scores, and Saudi price history no competitor can cheaply replicate. Brands (LG,
Samsung, Toshiba, Hisense) pay foreign vendors today for worse Saudi data than ours.

**The badge.** "Tawveeri Verified Pricing" — awarded only where our own tracking
confirms an advertised drop. **Positive-only publication; never name a retailer
negatively.** A badge a retailer wants gives them a reason to supply a feed. This is the
most plausible route into Jarir, Extra and Noon, and it is the same asset as §3.9
pointed at a different audience.

**Being cited by AI.** GEO's strongest driver is statistics addition, and we manufacture
original Saudi statistics no one else can produce. Citation rates differ ~46-fold by
engine (Grok ~27%, Perplexity ~13%, ChatGPT ~0.59%); Claude cites documents handed to
it, which makes MCP the route there. Verify these figures independently before acting
on them.

**Retention.** The price-drop alert is our equivalent of Tameeni's renewal notification.
An alert on a *verified* drop is a claim we can stand behind. Scope it; do not build
until the journey gate is healthy.

**وفّر.** No agentic recommendation work until the data-quality bar is met. An agent
recommending confidently over a 17.6% journey destroys trust faster than a static page.
State the bar as a number against the gate.

---

## 5. THE LAUNCH DECISION — 1 August

Judge it on the honest journey gate, not on any other figure:

| Gate | Decision |
|---|---|
| 60%+ | Launch as announced |
| 30–60% | Launch as the price truth layer — verified drops, the 72% statistic, the proof card. No promise of comparison |
| Under 30% | Do not launch a comparison promise. The product does not do what it says |

Today it is 17.6%. The three P0 items address exactly the failures behind that number.

**Misk submission:** lead with the price-truth moat and the proof card. Name the
breadth weakness first — a founder who names their weakest number and shows the
measurement plan is more credible than one who avoids it.

---

## 6. WHY THIS DOCUMENT EXISTS

We kept writing a new prompt every few hours because I kept telling you to stop and
wait. That was my error, and it was the real bottleneck — not capability, not clarity.

So: **work the whole list.** Report once, with a full ledger. Deploy as you go. If you
find a defect I did not list, fix it and tell me. If my diagnosis is wrong, correct it
and tell me.

**Start with 3.1 and 3.2 together — the search and the instrument. Then re-baseline and
report both numbers before moving on.**
