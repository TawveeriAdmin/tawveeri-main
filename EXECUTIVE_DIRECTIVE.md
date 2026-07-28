> **📌 PRECEDENCE — Authority 1 (highest) of the operational chain.** Governs positioning, launch, revenue, marketing, and Misk. **Read this first each session; it outranks MASTER_DIRECTIVE.md and all older operational docs on conflict** (it sits below the Constitution, not above it). Chain: **EXECUTIVE_DIRECTIVE** › MASTER_DIRECTIVE › PHASE2_REVISED › ~~PHASE2_MATCHING~~ (superseded). The 19-section "Affiliate Revenue & AI Shopping Agent" directive (§7) is VISION ONLY and is **not a file in this repo** — its supersession banner must be added wherever the founder keeps it.

# TAWVEERI — EXECUTIVE DIRECTIVE
## Launch · Positioning · Revenue · Investors · Retailer Leverage
**2026-07-28 · Supersedes the freeze in PHASE2_REVISED §0**

---

## 0. CORRECTION — THE FREEZE WAS WRONG

PHASE2_REVISED froze all work until 2 August. That was over-broad and it cost us days.

**Corrected freeze — effective immediately:**

| Frozen until 2 Aug | Unfrozen now |
|---|---|
| Schema migrations | All read-only measurement |
| Heavy `product_stores` writes | Recall measurement and gold standard |
| System A connection | Research and analysis |
| Tier 2 execution | Documents and reports |
| Parser rewrites | Low-risk read-side rendering |

The reason for a freeze is production risk before a launch. Measurement carries none.
**Recall measurement starts now, not on 2 August.**

---

## 1. WHAT MEASUREMENT HAS KILLED — AND WHAT SURVIVES

Two of my theses died in one day, both by measurement, both in under ten minutes:

| Thesis | Verdict |
|---|---|
| GTIN is our identity authority | **Dead.** 0 coverage across 5,543 offers, 428 families, 9 UCP profiles |
| Icecat MPN bootstrap rescues it | **Dead.** 12% hit rate, 8% GTIN return, brand-restricted to non-majors |

**One survivor worth noting, honestly scoped:** Open Icecat has real coverage for
TVs and monitors specifically (LG, Hisense, TCL). A category-scoped spec enrichment is
technically possible there. **It is marginal, not a strategy.** Do not build on it.

**One incidental finding that deserves its own investigation: model_number pollution
was flagged during the MPN test.** Our 166 comparisons are built on model numbers. If
those fields are polluted, the number we are most proud of rests on a field we have
not audited. Measure the pollution rate before anything else in §3.

**What this settles:** identity must be inferred from text, structure and images.
There is no authority to lean on. Arabic product matching is the core technical problem
of this business and there is no path around it.

---

## 2. POSITIONING — THE MOST IMPORTANT SECTION IN THIS DOCUMENT

### 2.1 Stop calling Tawveeri a price comparison platform

As a comparison platform we are weak: 166 comparable products against Rakhys's 70,600
listings. That framing loses on a metric we cannot win in the near term, and it invites
exactly the comparison we should refuse.

> **⚠ FACTUAL CORRECTION (measured 2026-07-28) — governs every "166" in this document:**
> the served **"166 comparable products" was measured to be Amazon counted twice** — one
> retailer under two store-name spellings (ADR-132; now deduped in search). Genuine
> **cross-retailer** comparable families ≈ **109** (knowledge layer, model-anchored); what a
> customer sees on the storefront today is a **handful**. **Do NOT cite "166 comparable
> products" externally** — a judge clicking a "2-store" card would see Amazon twice. Lead
> with the 925 verified drops in the table below, which are solid and survive scrutiny.

**As a price truth layer we are unique, and provably so:**

| Metric | Value | Who else has it |
|---|---|---|
| Price drops verified by our own tracking | **925** | No one in Saudi |
| Advertised discounts referencing a price we never observed | **65%** | No one in Saudi |
| Discount offers examined | 10,302 | No one in Saudi |
| Per-retailer discount integrity, measured over months | Yes | No one in Saudi |

**And the single strongest proof point we own:**

> Extra's own page claims a 9,400 SAR saving on the Hisense 85" U7Q.
> **Tawveeri publishes 8,800 — because 14,399 is the highest price we actually observed.**
> We publish a *smaller* saving than the merchant, because ours is evidence.

No competitor can copy this. Not because the code is hard, but because it requires a
**Saudi price observation history that cannot be bought, scraped retroactively, or
faked.** Rakhys has 70,600 listings and zero observation history. Every day we run, the
moat deepens and theirs does not.

### 2.2 The three-line pitch

> **Saudi retailers advertise discounts against prices that were never charged.**
> **We tracked 10,302 discount offers. 65% referenced a price we never observed.**
> **Tawveeri publishes only the 925 we verified ourselves — and we publish a smaller
> number than the merchant, because ours is evidence.**

Every word is measured. Nothing is claimed that we cannot show.

---

## 3. LAUNCH — 1 AUGUST

Launch. Do not delay for coverage. Launch on truth, not on breadth.

### 3.1 The one feature that must ship — highest value, lowest risk
Under every verified saving, render one line:

```
✓ توفير حقيقي 8,800 ريال
  تتبّعنا هذا المنتج 14 يومًا · أعلى سعر رصدناه 14,399 ريال
```

The data exists. This is a text render, not a model, not a migration. **It makes the
entire product thesis visible in one line**, and it is the most defensible sentence on
the Saudi internet for this category.

### 3.2 Pre-launch, read-side only
- Model-number pollution rate — audit before we cite the 166 anywhere
- Duplicate visible cards (بيسوس / باسوس class) — read-side dedup only
- Outbound link validity on a sample of 50
- The 20 most likely Saudi consumer searches — does each return a correct product
- Launch scorecard: stores with live offers, served products, comparable products,
  verified drops rendering, link validity

### 3.3 What launch is measured by
Not traffic. **Whether a Saudi user who lands on a verified-saving page understands,
within five seconds, that our number is different from the merchant's and why.**

---

## 4. REVENUE — THE HONEST STRUCTURE

### 4.1 Affiliate is a volume business we do not yet have volume for
Amazon SA electronics commission is 1–3%. Only Amazon is active. A realistic model:
1,000 high-intent sessions → ~250 click-outs → ~3% conversion → ~2,000 SAR average
basket → roughly 300 SAR at 2%.

**Roughly 100,000 high-intent sessions per month are needed for this to matter.**
State the real gap. Do not build the business on this alone.

### 4.2 The B2B thesis is the stronger investor story — and it needs no consumer traffic
We hold **6,747** `inflated_reference` facts [**corrected 2026-07-28 from "4,531"** —
measured `verdict='inflated_reference'` = 6,747, which is the figure that produces the 65%
cited in §2.1: 6,747 of 10,303 examinable offers], per-retailer trust scores, and months of
Saudi price history. ADR-051 described this as unique: no comparison platform scores
merchants on observed discount honesty.

Three buyers, in order of plausibility:

1. **Brands.** LG, Samsung, Toshiba and Hisense monitor distributor price discipline
   and grey-market leakage. They pay for this today, to foreign vendors, with worse
   Saudi data than ours. Research what they currently pay and to whom.
2. **The retailers themselves.** A merchant dashboard showing their price position,
   category competitiveness and high-intent demand share.
3. **Consumer protection bodies.** Aggregate, anonymised, never named.

**What could we sell today, with zero additional consumer traffic?** Name the report,
its contents, and the data behind it. This is the question with the shortest path to
first revenue.

### 4.3 The badge — commercial leverage over retailers
**"Tawveeri Verified Pricing"** — awarded only where our own tracking confirms an
advertised drop. **Positive-only publication. Never name a retailer negatively.**

This inverts the relationship. Today we ask for a feed as a favour and are ignored. A
badge a retailer *wants* gives them a reason to supply one. It is the same asset as
§2.1, pointed at a different audience, and it is the most plausible route into Jarir,
Extra and Noon.

Assess it properly: what would a retailer have to do to earn it, what do they get, and
what do we ask in return.

---

## 5. MARKETING — GEO IS OUR CHANNEL, NOT SEO

### 5.1 What the research establishes
- **GEO is academically grounded.** The founding paper (Aggarwal et al., KDD 2024,
  Princeton / Georgia Tech / IIT Delhi) showed GEO methods lift visibility in AI
  answers by up to 40%, with the strongest drivers being **statistics addition, source
  citation, and quotation addition.**
- AI search handles an estimated **12–18% of English informational queries** as of
  Q1 2026, up from roughly 2–4% two years earlier.
- AI answers cite **2–7 sources** versus 10 blue links. Smaller surface, larger share.
- Citation rates differ enormously by engine. A 2026 study of 34,234 responses found a
  46-fold spread: **ChatGPT 0.59%, Perplexity 13.05%, Grok 27%.** An analysis of 680M
  citations found only 11% of domains cited by both ChatGPT and Perplexity.
- **Claude cites the documents handed to it** — MCP and connectors matter for Claude,
  not page optimisation.
- **Original research is disproportionately cited.** LLMs heavily cite the original
  source of a statistic; one original data publication per quarter reportedly earns
  50+ citations over twelve months.

Verify all of it independently. These figures come partly from vendor-published
studies with an obvious interest — find independent confirmation or downgrade them.

### 5.2 Why this fits us better than almost anyone
**"Statistics addition" is the top-ranked GEO driver, and we manufacture original
Saudi statistics that cannot be produced without our observation history.**

We are not competing for citations on general knowledge. We are the only possible
source for "what percentage of Saudi electronics discounts reference a price that was
never charged."

### 5.3 The work
1. **Quarterly original research.** "تقرير حقيقة أسعار الإلكترونيات في السعودية —
   الربع الثالث 2026." Original statistics, transparent methodology, stable citable
   URL, Arabic and English. Positive-only on named retailers.
2. **Structural citability.** schema.org Product and Offer markup carrying our
   verified-drop data; audit the existing `llms.txt` against current reality; stable
   evidence URLs; TL;DR summaries at the top of substantive pages; explicit dated claims.
3. **Prioritise by measured citation rate.** Grok and Perplexity are an order of
   magnitude more likely to cite than ChatGPT. Effort follows the spread.
   Establish a baseline now: ask each engine ten Saudi price questions, record who is
   cited, re-measure monthly.
4. **Claude and MCP.** Scope an MCP server exposing Saudi product identity, observed
   price history, verified drops, and discount integrity. Scope only — do not build.

---

## 6. MISK — WHAT THE SUBMISSION NEEDS

Misk Accelerator is a three-month intensive programme for early-stage technology
startups that takes **no equity**, and Misk Entrepreneurship connects to the
Entrepreneurship World Cup, which since 2019 has supported over 300,000 participants
from 200 countries and awarded 2 million USD in prizes plus 150 million USD in in-kind
support. Verify current cohort details and deadlines before relying on any of this.

### 6.1 The framing that wins, and the one that loses

| Loses | Wins |
|---|---|
| "A Saudi price comparison platform" | "The price truth layer for Saudi retail" |
| 166 comparable products | **925 verified price drops** |
| 5,543 products | **65% of advertised discounts reference an unobserved price** |
| "We aggregate offers" | **"We publish a smaller saving than the merchant, because ours is evidence"** |
| Competing with Rakhys on breadth | **A moat that requires time and cannot be bought** |

### 6.2 What to prepare — the evidence pack
1. **One-page narrative** built on §2.2, every number measured, none rounded upward.
2. **The proof card**: the Hisense 85" screenshot next to our page. One image carries
   the entire thesis.
3. **The moat argument**: price observation history compounds daily and cannot be
   acquired retroactively. State plainly how long a well-funded competitor would need
   to replicate it — that duration is the moat, expressed honestly.
4. **Market sizing** from the founder's study: 40–50bn SAR broad, 8–15bn SAR initial
   serviceable. Cite the sources; do not inflate.
5. **The competitive teardown**: Rakhys, 27 stores, ~70,600 listings, 7,572 smartphones
   of which 5,305 are AliExpress, nearly every card showing a single store. Breadth
   without comparison. Present it factually, without disparagement.
6. **Revenue model** — lead with B2B and the badge, support with affiliate. An investor
   who hears "1–3% Amazon commission" as the primary model will discount heavily.
7. **Vision 2030 alignment**: consumer protection, price transparency, and a Saudi
   data asset held domestically. Research the specific programme language before using it.
8. **Traction, stated honestly**: private beta, real users, verified drops live,
   discount integrity in production. Do not overstate. Judges verify.

### 6.3 The honest risk to name before they find it
Our comparable coverage is 166 [**see the §2.1 correction — the real cross-retailer figure
is ~109; do not present "166" to judges**] and our matching recall is now in measurement (the
independent blocker surfaced ~32–50 recoverable cross-retailer matches — §5 / recall work). **Name it, and
name the plan.** A founder who names their weakest number and shows the measurement plan
is more credible than one who avoids it. This is also true of investors, and of Misk.

---

## 7. ON THE 19-SECTION VISION DOCUMENT

The founder's earlier "Affiliate Revenue & AI Shopping Agent Execution Directive"
remains a **good destination document and a poor execution document.**

**What is still right:** the offer architecture (§7), the agent commercial conduct
(§8 — commission never influences ranking), the affiliate readiness score (§12), and
the non-negotiable rules (§18). Several of these are already built — ADR-091,
Discount Integrity, the `/go` exit layer.

**What measurement has invalidated:**
- Its targets — 5,000 canonical products, 2,750 with two retailers, 900 with three.
  Reality is 166. Roughly sixteen-fold off. Targets that far from reality stop guiding
  and start demoralising.
- It assumes retailer affiliate programmes exist. Only Amazon is active.
- It assumes identity is a solved input. GTIN is 0. **Identity is the whole problem,
  and the document does not mention matching once.**

**Recommendation:** keep it as the vision. Do not execute from it. Add one line at its
top: *"Superseded for execution by MASTER_DIRECTIVE.md and this document. Retained as
the destination, not the route."*

---

## 8. ORDER OF WORK

```
Now → 31 Jul   Read-side only. Evidence line. Duplicate cards.
               Model-number pollution audit. Launch scorecard.
               Recall measurement STARTS — it is read-only.

1 Aug          Launch. Positioning per §2. Not "comparison" — "price truth."

2 Aug →        Gold standard. Blocking. Then System A connection.
               Then acquisition. In that order, no exceptions.

In parallel    Misk evidence pack. Quarterly report drafted.
               B2B: name what we could sell today.
```

---

## 9. STANDING RULES — UNCHANGED

1. **"We did not observe it" is never "it is not true."** Permanent.
2. Never name a retailer negatively in public.
3. Ranking is never influenced by commission.
4. Unknown beats incorrect.
5. No automated merge without a measured precision floor.
6. Label everything measured / inferred / assumption.
7. Cite the ADRs checked and external sources for research claims.
8. Full task ledger, including omissions.
9. **Override me where the evidence says I am wrong.** Two of my theses died today by
   measurement. That is the system working, and it should keep happening.

---

## 10. THE POINT

We are not the largest Saudi catalog and will not be soon. Rakhys has that and it is
worth nothing.

We are the only place where a Saudi buyer can find out **what a price actually did** —
verified by observation, not asserted by a merchant.

That is a smaller claim than "compare every product in Saudi Arabia."
It is also true, defensible, and impossible to fake.

**Launch on that.**
