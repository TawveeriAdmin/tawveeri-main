> **📌 PRECEDENCE — Authority 2 of the operational chain.** Governs phases, gates, and standing rules. On conflict it is outranked by **EXECUTIVE_DIRECTIVE.md** (positioning / launch / revenue / marketing / Misk). Chain, highest first: EXECUTIVE_DIRECTIVE › **MASTER_DIRECTIVE** › PHASE2_REVISED › ~~PHASE2_MATCHING~~ (superseded).

# TAWVEERI — MASTER DIRECTIVE v2
**2026-07-28 · Supersedes all prior directives · Read fully before acting**

---

## 0. HOW TO USE THIS DOCUMENT

Work through the phases **in order**. Each phase has a **gate**: do not begin the next
phase until the gate is met and I have approved it.

Every turn ends with a task ledger: every numbered item as
`DONE / NOT DONE / NOT POSSIBLE + reason`. Never summarise only completed work.

Before every section: grep `docs/DECISIONS.md` for the topic and cite the ADRs you
checked. With 130+ ADRs the probability a question is already answered is high.
Re-deriving a documented finding is waste.

Label every material statement: **[MEASURED today]** / **[INFERRED]** / **[ASSUMPTION]**.

---

## 1. ESTABLISHED FACTS — do not re-derive these

**Trust layer (working, verified):**
- The `توفير حقيقي` badge computes from `observed_max` in our own `price_history`,
  held separate from the merchant's `claimedWas`, gated on a `verified_drop` verdict
  over `MIN_DISTINCT_DAYS`. Architecturally correct; our most defensible asset.
- Live proof: Hisense 85" U7Q — Extra's page claims "وفر 9,400" from 14,999.
  We publish 8,800 from an observed 14,399. **Our number is lower than the merchant's
  claim because it is evidence-based.** The entire product thesis in one card.
- 925 verified drops out of 10,302 examinable discount offers (~9%). Precision working
  as designed, not a coverage failure.
- **166** model-number-confirmed multi-store products on the served layer.
- SAVINGS_GATE live, default on. Rollback: `NEXT_PUBLIC_SAVINGS_GATE=off`.
- Trust-page ranking fixed: high-value confirmed products lead, accessories deprioritised.
- Float artifacts fixed.

**Architecture:**
- Storefront layer serves customer search (Algolia `products`). TPS knowledge layer
  holds 428 comparable families but is isolated from search (ADR-125).
- Green (audited comparable) count = **220**, key `brand|cat|round(min)|round(max)`.
- Extra parser reads the correct price. Confirmed fault is **identity merging**:
  distinct models merged as colour variants (white LG 1290 vs black LG 2599).
- Almanea prices verified 5/5 exact against the live customer surface.
- `ICECAT_USERNAME` provisioned and verified working — GTIN identity path is open.
- 21 exact-slug duplicate canonical groups is a **floor**; Arabic brand
  transliteration (بيسوس / باسوس = Baseus) is not normalised and escapes that count.

**Protocol position — MEASURED 2026-07-28 (ADR-130):**
- **9 of 22 registered stores publish a `/.well-known/ucp` profile.**
- **None of Jarir, Extra, Noon or Amazon publish one.** The credential deadlock with
  the majors is NOT solved by UCP. Negotiation remains the only path to them.
- What UCP does deliver: a free, credential-free data-quality upgrade for the 9
  mid-market stores — structured real-time price, stock and checkout.
- **127 canonical families exist where a UCP store shares a product with a major**
  (Amazon / Noon / Jarir / Extra / Almanea).
- Concentration: alnakheelk **68**, najm **48**, aletawik 10, eazyworld 7,
  goldenstore99 5, pcpalace 2, hdf 2, **sonyworld 0**.
- **Two stores produce 116 of 127 (91%).** Both are multi-brand appliance/AC retailers
  on Salla. Sonyworld — a single-brand specialist — produces zero.
- Defects fixed: alsfeerzone disabled (dead DNS, silent ingestion failure);
  pcpalace platform label corrected.

**Market (founder's study, corrected by measurement):**
- The study ranked 8 categories by market size. **Measured overlap says otherwise:**
  monitors (33) and audio (29) intersect more than refrigerators (11) and
  dishwashers (5). Rank acquisition by **measured overlap**, not market size.
- Store overlap among the majors is dominated by Extra+Almanea (236 of 428 = 55%).
- Noon is present but thin (809 URLs) — the largest deepening opportunity among
  approved retailers.
- Amazon SA affiliate active (`tawveeri-21`), electronics commission 1–3%.
  No other retailer programme is active.

**Competition:**
- Rakhys (rakhys.com, NexuMind): 27 stores, ~70,600 listings, 7,572 smartphones of
  which 5,305 are AliExpress. Nearly every card reads "من 1 متجر" — breadth with no
  real comparison. Not the threat.

**Permanent rule — the most important line in this document:**
> **"We did not observe it" is NEVER "it is not true."**
> Deep Saudi discounts on accessories and clearance are frequently genuine.
> Never publish or imply merchant deception. Say only what we measured.

---

## 2. NORTH STAR

**Primary metric:** the number of products a Saudi consumer can see, from two or more
stores, with a price we verified ourselves, on a public surface, with a working link.

Today that number is **~a handful** consumer-visible. **The "166" is retracted** — it was
Amazon counted twice (ADR-132). The genuine cross-retailer comparable set is **~564**, but
it is **locked in the disconnected System A** (ADR-125/133) — so the *visible* North Star is
near zero, and **connection (Phase 2.5) is what converts ~564 into visible.**

**Not** catalog size. **Not** scraper count. **Not** store count.

**Secondary (commercial):** qualified affiliate clicks per 1,000 high-intent sessions,
until confirmed sales data exists.

---

## ★ REVISED PHASE ORDER (2026-07-28 — measurement reversed the earlier order)

The earlier order put acquisition/matching ahead of connection. **Measurement reversed it
(ADR-133):** matching adds only ~10–50 (marginal); ~564 genuine comparisons already exist,
locked. So the order of value is now fixed:

1. **CONNECT System A** (Phase 2.5) — releases ~564 comparable products to customers. Highest-value action by a wide margin (~10–20× the matching upside). Gated on the Phase 1.3 identity merge defects, which are therefore **on the main path, not a side quest.**
2. **ACQUIRE** (Phase 3 / `ACQUISITION_TARGETS.md`) — multi-brand appliance/AC Salla/Zid stores via UCP/feed, credential-free. Raises the overlap ceiling beyond ~564. The measured rule governs (alnakheelk 68, najm 48, sonyworld 0).
3. **MATCHING** (Phase 2 / recall) — **marginal.** Finish the recall measurement for the record, then STOP. **Do NOT build the LLM matcher or image embeddings on a ~10–50 upside.**

Phase 1 (trust layer / identity-defect fixes) still comes first because it *gates* connection.

---

## PHASE 1 — CLOSE THE TRUST LAYER
*Target: 2 weeks · Gate: verified savings render on every surface, duplicates measured*

### 1.1 Tier 2 — surface the verified savings everywhere (HIGHEST PRIORITY)
We hold 925 verified drops and render them on `/price-truth` only. That is our best
asset hidden on four of five surfaces.

Bake `verified_drop` + `observed_max` into the served layer at build time
(`rebuild-products-index.ts` + storefront rows). Surfaces read a boolean:
verified → show the saving with `كان {observed_max}`; unverified → price only.
Zero per-request queries. Extend ADR-129.

**Acceptance:** a verified offer renders its saving on search, deals, comparison card
and product page; an unverified one renders none; median latency unchanged.

### 1.2 Arabic identity normalisation — an AI task, done properly
The بيسوس / باسوس case proves exact-slug matching cannot see transliteration variants.
A bounded, high-leverage, verifiable LLM task:

1. Extract every distinct Arabic brand token across active canonicals.
2. Use an LLM to cluster them to a canonical Latin brand (Baseus, Anker, Kelvinator…),
   **returning a confidence and the evidence for each mapping**.
3. Auto-accept only high confidence with corroborating evidence (shared model number,
   shared GTIN, or shared price band). Everything else goes to a review list.
4. Extend the existing `BRAND_AR` table in `arabic-titles.js` with the accepted map.
5. Report the **transliteration-aware duplicate count** — the true figure, not the 21 floor.

Do not auto-merge. Produce the map, the true count, and a merge plan.
Unknown beats incorrect.

### 1.3 Identity merge defects — the two known classes
- **Model-vs-colour:** white LG 1290 and black LG 2599 merged. Different models.
- **cooling_mode (ADR-001 violation):** Extra "Cold" merged with Almanea LK182H0
  "HEAT+COOL". ADR-001 declared `cooling_mode` a critical identity field.

Report both model numbers, quantify how many families carry each defect class, write
the fix ADR. Diagnose and plan; do not execute merges yet.

### 1.4 Almanea anchor — finish it (URL-keyed)
Join the 5 Almanea listing URLs to `tps_listing_price_facts`; report per listing:
verdict, `distinct_days`, `observed_max` vs `claimed_was`.
**Framing is mandatory:** a coverage question, not an accusation.

### 1.5 Stock signal — resolve the contradiction
Unbxd reported `inStockFlag=false` in every city for a product that renders as
purchasable with reviews on the live page. Determine what that field actually means
before any stock filter is proposed. Then measure out-of-stock ingestion across **all**
stores, not just Extra.

**GATE 1:** verified savings live on all surfaces · true duplicate count known ·
both merge-defect classes quantified with a written fix plan.

---

## PHASE 2 — IDENTITY AT SCALE
*Target: 4 weeks · Gate: the North Star number materially above 166*

We have 166 and not 1,660 because identity is inferred rather than known. Tameeni has
no identity problem because the state supplies it via vehicle registration. Our
equivalent authority is the **GTIN**.

### 2.1 GTIN coverage — measure first
Icecat is live. How many of the 428 families carry a GTIN? Which stores expose one, in
which field? Do UCP profiles carry GTIN — if so, that is a second free source. What
proportion of the served storefront rows could be resolved by GTIN alone?

### 2.2 GTIN-first matching
Where two offers share a GTIN they are the same product — no inference, no scoring, no
colour heuristics. Design the pipeline so GTIN, where present, **overrides** the
inferred identity key. Report how many new comparable families this creates.

### 2.3 Roadmap correction to assess
`Tawveeri_Post_E15_Strategy_2026_2040_AR` schedules barcode/image search at E22. Given
that GTIN supplies identity from an authority rather than inference, argue for or
against pulling it forward to E16 — using measured coverage from 2.1, not opinion.

### 2.4 AI-assisted matching where GTIN is absent
Use an LLM as a **candidate ranker with evidence**, never as a decider:
- Input: two normalised listings with all structured fields.
- Output: same / different / uncertain, **plus the specific field evidence**.
- Auto-accept only when the LLM and the deterministic key agree.
- Disagreements go to a review queue.

Measure precision on a human-labelled sample before any production use. State the
precision floor you would require. Report it; do not deploy.

### 2.5 Noon depth
Noon is the thinnest approved retailer (809 URLs) and the largest overlap opportunity
among the majors. If Noon coverage tripled, how many new comparable families appear?
Use `store-impact.ts` and `feed-overlap-probe.ts`. Evidence before effort.

**GATE 2:** North Star materially above 166, with identity precision measured on a
human-labelled sample.

---

## PHASE 2.5 — CONNECT SYSTEM A
*Gate to enter: Phase 1 complete (identity defects cleared). · The single largest
North Star mover available — larger than Tier 2, larger than further acquisition.*

**Why this phase exists (measured 2026-07-28, corrected):** connection releases **~564
genuine cross-retailer comparable products** — canonicals with offers from ≥2
retailer-normalized stores (projection `has_comparison` = 598) — that live in **System A**,
**isolated from customer search (ADR-125)**. `/api/search` reads the storefront Algolia
`products` index; System A's `tawveeri_tps_products` is never read. **~0 of the 564 are
consumer-visible today.** (The earlier "88 net-new / 428" figures were partial cuts; the
full locked set is ~564 — see ADR-133.) Customers cannot see any of it, and cannot see it
no matter how many more stores we onboard. **Onboarding into an isolated layer is filling a
locked warehouse.** Connection converts ~564 already-held comparable families into
customer-visible ones **at zero acquisition cost — by a wide margin the highest-value action
available**, ~10–20× the entire matching upside (~10–50, ADR-133).

**What was frozen and why:** connecting System A is drafted as **ADR-126** and was
**frozen because of the identity-quality defects** (transliteration duplicates,
model-vs-colour merges, cooling_mode merges). Serving those defects to customers is
worse than not serving. **Phases 1.2 and 1.3 exist precisely to clear this freeze** —
this phase cannot start until they are done and the true duplicate count and both
merge-defect classes are quantified and fixed (GATE 1).

**2.5.1 Un-freeze ADR-126 on evidence.** Restate the identity-defect blockers that
froze it; show, with measurement, that each is cleared (or bounded to an acceptable,
disclosed residual). No connection until this evidence is on the record.

**2.5.2 Choose the connection mechanism.** Two options (ADR-125): (a) point
`/api/search` at `tawveeri_tps_products`; (b) merge canonical/comparable data into the
storefront `products` index. Assess correctness, latency, and rollback for each; pick
one with evidence. Requires an ADR and approval before any cutover.

**2.5.3 Measure the North Star delta.** Before/after: how many customer-visible
verified multi-store products does connection add to the **166**? This is the number
that justifies the whole phase.

**GATE 2.5:** System A connected to search behind a reversible switch · the North Star
number re-measured on the served surface and materially higher · zero known identity
defect served (or residual explicitly disclosed and founder-accepted).

---

## PHASE 3 — MID-MARKET ACQUISITION
*Replaces the earlier "protocol position" phase. UCP is measured; act on it.*

> **HARD PRECONDITION (2026-07-28):** Phase 3 must NOT begin before System A is
> connected (Phase 2.5 complete). Acquiring more stores into an isolated layer adds
> zero customer-visible comparisons — it fills the locked warehouse. Overlap without
> visibility is not growth.

### 3.1 The rule — validate it, then apply it
Measured concentration: alnakheelk (68) and najm (48) produce 91% of the 127
UCP-major shared families. Sonyworld produces 0.

**Hypothesis:** multi-brand appliance and AC retailers overlap with the majors;
single-brand specialists do not.

Confirm or correct this with evidence, then state the acquisition rule in one
sentence. That sentence governs every future store decision.

### 3.2 New vs already-counted — the decisive number
Of the 127 UCP-major shared families, how many are **already inside the 166** served
comparisons, and how many are **new**?

This single number tells us whether mid-market acquisition grows the North Star or
merely re-counts what we already have. Measure it before any further onboarding.

### 3.3 Onboarding cost
Roughly how many engineering hours to onboard a NEW Salla or Zid store via its UCP
profile instead of writing a parser? If the answer is hours rather than days, propose
a target list of Saudi multi-brand appliance/AC retailers on Salla and Zid, ranked by
predicted overlap using `feed-overlap-probe.ts` **before** onboarding any of them.

### 3.4 The majors remain closed — plan for that separately
UCP does not open Jarir, Extra, Noon or Amazon. Do not spend further effort probing
them for protocol adoption. Their path is commercial, and it belongs to Phase 4.

---

## PHASE 4 — REVENUE_THESIS.md
*A decision memo, not an essay. Every claim carries a number or is labelled ASSUMPTION.*

### 4.1 Affiliate — model it, do not assert it
Sessions → click-out → conversion → commission → monthly revenue.
Conservative / base / optimistic. Amazon electronics is 1–3%; only Amazon is active.
State plainly how many monthly high-intent sessions are required for this to matter,
and how far we are from that number.

### 4.2 The B2B thesis — assess seriously; it may be the primary business
ADR-051 built something it called unique: no comparison platform scores merchants on
observed discount honesty. We hold 4,531 `inflated_reference` facts, per-store trust
scores, and accumulated Saudi price history no competitor can cheaply replicate.

- **Who pays?** Brands (LG, Samsung, Toshiba) monitoring distributor price discipline
  and grey-market leakage; the retailers themselves; consumer bodies. Research what
  brands currently pay for price monitoring in this region and who provides it.
- **What could we sell TODAY** from production data with zero additional consumer
  traffic? Name the report, its contents, and the data behind it.
- **What is missing** to make it sellable?
- **Merchant dashboard** (price position, category competitiveness, high-intent demand
  share, feed health) as the onboarding hook.
- **"Tawveeri Verified Pricing" badge** — awarded only where our own tracking confirms
  an advertised drop. **Positive-only publication; never negative naming.**
  Does the badge give a retailer a reason to supply a feed? A feed may be a trade, not
  a favour. Assess — this is the most plausible route into Jarir, Extra and Noon.

### 4.3 Mid-market acquisition — largely answered, close it out
Measured: 127 shared families, 91% from two multi-brand appliance retailers, 0 from a
brand specialist. The remaining question is 3.2 (new vs already-counted).
Once 3.2 lands, state the verdict in one line: is mid-market acquisition the growth
path, a marginal contributor, or a dead end?

### 4.4 Retention
Tameeni's real product is not comparison — it is the renewal notification, and its
identity problem is solved for it by government vehicle registration. Our equivalent
retention mechanism is the price-drop alert, and our identity authority is the GTIN.
We already track verified drops; an alert on a *verified* drop is a claim we can stand
behind. Assess what exists, what is missing, and the data-quality bar required before
a single alert is sent. Scope only.

### 4.5 وفّر and the agent
The strategy document's own §14 warns against turning وفّر into a generic chatbot not
grounded in the Product Graph and evidence. State plainly what data-quality bar must
be met before any وفّر 2.0 or agentic work begins, expressed as a number against the
North Star.

### 4.6 Being reachable by agents
UCP and ACP move discovery into AI surfaces; ChatGPT alone reports roughly 50 million
shopping queries a day. Global agents will have protocol reach but not Saudi product
truth — identity, observed price history, discount integrity, warranty and regional
variant.

Assess two things concretely:
- **Citability:** what structural changes (schema, llms.txt, structured data, public
  evidence pages) would make us the cited Saudi price authority inside AI answers?
- **MCP server:** what could we expose today from production data, at what effort, and
  what is the strategic risk of supplying the asset versus the reach of being the
  source? Scope only — do not build.

### 4.7 The recommendation — one paragraph, no hedging
What is Tawveeri's primary business, what is the secondary, and what should be stopped
entirely? Name what to stop explicitly. A recommendation that stops nothing is not a
recommendation.

### 4.8 Ninety-day plan
Three things worth doing. What we stop. What each is measured by.

---

## STANDING RULES

1. Grep `docs/DECISIONS.md` before every section; cite what you checked.
2. Never verify a data source using that same source, and never use our own parser to
   establish what a customer sees.
3. Label everything measured / inferred / assumption.
4. **"We did not observe it" is never "it is not true."** Permanent.
5. Ranking is never influenced by commission. Not now, not later.
6. No parser change, classification change, or deploy without an ADR and approval.
7. Report the full task ledger, including omissions.
8. Checkpoint state to `HANDOVER.md` before context grows large; commit and push.
9. Unknown beats incorrect — everywhere, always.
10. A store is onboarded only when it is predicted to create comparisons. Depth without
    overlap is not growth. Sonyworld's zero is the reference case.

---

## THE GOVERNING PRINCIPLE

Rakhys has 70,600 listings and almost no real comparison. Global agents will have the
protocol and the reach but not Saudi product truth.

Tawveeri wins if, and only if, it is the place where a Saudi buyer — or the agent
acting for them — can find out **what is actually true about a product's price in
Saudi Arabia**, verified by observation rather than asserted by a merchant.

Everything in this document serves that one sentence.

**Begin with Phase 1.1.**
