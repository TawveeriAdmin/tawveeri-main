# TAWVEERI — PHASE 2 DIRECTIVE (REVISED)
## Stores · Products · AI · Becoming the Reference
**2026-07-28 · Execution begins 2 August · Launch freeze holds until then**

---

## 0. A CORRECTION I OWE YOU

I told you GTIN was your Tameeni-equivalent authority — that identity could be
*supplied* rather than inferred, and that provisioning Icecat opened that path.

**You measured it. GTIN coverage is zero. Not low — zero.**

- 0 of 5,543 served offers
- 0 of 428 canonical families
- 0 of 9 UCP profiles
- Icecat is configured but unusable, because there is nothing to resolve

**My thesis was wrong, and your measurement killed it in six minutes.** That is the
system working. Record it and move on.

**What this changes:**
- Exact matching is impossible. There is no shortcut.
- Every match must be *inferred* from text, structure and images.
- Arabic product-text matching is no longer a refinement. **It is the core technical
  problem of the business**, and there is no path around it.
- The recall question is not pre-empted — it is now the only question.

**One hypothesis worth testing before accepting defeat (labelled as a hypothesis):**
Icecat can be queried by **Brand + Product Code (MPN)**, not only by GTIN. We already
extract model numbers — the 166 comparisons are built on them. If brand + model number
resolves in Icecat, we could *bootstrap* GTINs we do not currently hold, plus
normalised specs and canonical titles.

Test this on 50 known model numbers before doing anything else. It is cheap, and if it
works it changes the whole picture. If it fails, we proceed with text and images only.

---

## 1. WHERE WE ACTUALLY ARE

| | |
|---|---|
| Stores registered | 22 |
| Stores with products | ~6 |
| Stores that matter | 4.5 — Amazon, Jarir, Extra, Almanea, (Noon, thin) |
| Served products | 5,543 |
| **Comparable to a customer (2+ stores)** | **166 — 3%** |
| Comparable in the isolated knowledge layer | 428 (+88 from UCP stores) |
| Verified price drops | 925 of 10,302 examinable |
| GTIN coverage | **0** |
| Precision | 97%+ |
| **Recall** | **never measured** |

**The governing fact:** we hold 5,543 products and can compare 166 of them. Nothing
else — not acquisition, not affiliate, not the agent — moves until that ratio moves.

---

## 2. PRODUCTS — THE MATCHING PROBLEM

### 2.1 The diagnosis stands, and GTIN=0 strengthens it

Our identity key does two jobs at once: it **proposes** candidate pairs and it
**decides** matches. In the entity-resolution literature these are deliberately
separate stages, because a key that blocks too tightly means candidate pairs are never
*considered* — not rejected, never seen.

بيسوس and باسوس are never compared because nothing ever proposes comparing them.

High precision with unmeasured recall is the exact signature of over-blocking.

**Our two known defects are the field's two named hard cases:**

| Literature term | Our instance |
|---|---|
| Positive corner-case — same product, dissimilar surface forms | **بيسوس / باسوس** (Baseus) |
| Negative corner-case — different products, near-identical text | **LG white 1,290 vs black 2,599** |

Ceneo, the Polish price-comparison platform, has the same documented failure: offers
of one watch split into two groups because some sellers used abbreviated titles — and
the split group with the lower price looked more attractive to shoppers. A production
European comparison site, same defect, published in the literature.

We are not behind. We are at the frontier of a hard problem, in a language the
frontier has barely addressed.

### 2.2 What the research supports — verify all of it independently

1. **Blocker + matcher is the standard architecture.** A cheap high-recall blocker
   proposes candidates; an expensive high-precision matcher decides. TF/IDF blockers
   are described in the literature as simple yet surprisingly strong.
2. **LLMs dominate in the transfer setting.** Fine-tuned models reach ~85% F1 on their
   own development set but lose 36–56% F1 on unseen entities; LLMs lose far less, and
   GPT-4 outperformed the best transferred model by 40–68% F1. **Unseen entities is
   precisely our regime** — new products daily, no labelled training data.
3. **Images help where text is chaotic.** A Turkish e-commerce deduplication system
   combining text and image embeddings at 128 dimensions reported macro-F1 0.90 versus
   0.83 for third-party solutions, over 200M+ items. Turkish is a closer analogue to
   Arabic than English. **We hold product images and use them for nothing but display.**
4. **Arabic is a documented low-resource gap** in multilingual e-commerce matching.
   Established normalisation exists — Alef variants, diacritics, tatweel, token-level
   Jaccard with edit distance.
5. **WDC Products** is the reference benchmark for constructing a matching gold
   standard with a controlled proportion of corner cases.

### 2.3 The work, in order

**2.3.1 — Test the Icecat MPN bootstrap (do this first; it is cheap)**
50 known brand + model-number pairs from our 166. Does Icecat resolve them? What
returns — GTIN, specs, canonical title? Report the hit rate. This either reopens the
identity-authority path or closes it for good.

**2.3.2 — Measure recall. Nothing else matters until this exists.**
We know precision. We have never measured recall. We do not know whether 166 is 90% of
what is matchable or 5% of it, and every decision below depends on which.

Build a Saudi gold standard on the WDC model:
- 300–500 human-labelled offer pairs from our own data
- Deliberately include both corner-case types
- Cover the categories we actually serve
- Label: match / no-match / genuinely ambiguous

Report against it: precision, **recall**, F1, and failure breakdown by corner-case type.
State the precision floor required before any automated merge reaches production.
My view: nothing below 98% merges automatically. Argue if you disagree.

**2.3.3 — Quantify the headroom**
Given measured recall: if blocking were perfect, how many comparable families exist in
the current catalog?

**This number decides the next six months.** ~250 means acquisition is the bottleneck
and matching is a distraction. 2,000+ means matching is the entire business and no
store should be onboarded until it is fixed.

**2.3.4 — Build normalisation and blocking only, then measure**
Arabic normalisation (Alef, diacritics, tatweel, digit forms, units) plus a candidate
generator. Do not touch the matcher. Report the recall delta.
A blocker that raises recall without touching precision is pure gain.

**2.3.5 — LLM matcher, offline only**
Run over the disagreement set. Output must be same / different / uncertain **plus the
specific field evidence** — never a bare verdict. Measure against the gold standard.
Report cost per 1,000 pairs. Do not connect to production.

**2.3.6 — Images: assess, do not build**
What fraction of offers have a usable image? What would an image-embedding signal cost
at our scale? Is a vector database justified for 5,543 products, or premature?
**At our size the honest answer may be "not yet." Say so if it is.**

---

## 3. STORES — THE ACQUISITION RULE

### 3.1 The rule, measured
UCP measurement produced 127 families shared between a UCP store and a major, of which
**88 are new**. Concentration: alnakheelk 68, najm 48, aletawik 10, eazyworld 7,
goldenstore99 5, pcpalace 2, hdf 2, **sonyworld 0**.

**Two stores produce 91%. Both are multi-brand appliance/AC retailers on Salla.
The single-brand specialist produces zero.**

Validate the rule, then state it in one sentence. It governs every future store decision.

### 3.2 The constraint that outranks it
The 88 new families live in the isolated knowledge layer. **The customer cannot see
them, and will not see them no matter how many more stores we add.**

**Onboarding into an isolated layer is filling a locked warehouse.** Connecting that
layer is a larger North Star mover than any acquisition — and it is blocked by the
identity defects in §2.

**Order is therefore fixed: fix identity → connect the layer → then acquire.**

### 3.3 The majors stay closed
UCP does not open Jarir, Extra, Noon or Amazon. Stop probing them for protocol
adoption. Their path is commercial and belongs to §5.

### 3.4 Noon
Thinnest approved retailer at 809 URLs, and the largest overlap opportunity among the
majors. If Noon tripled, how many new comparable families appear? Measure before
investing effort.

---

## 4. AI — WHERE IT ACTUALLY IS, AND WHERE IT SHOULD GO

**Honest assessment: our AI is early. وفّر exists and search is intelligent, but the
customer does not feel it.** The most valuable intelligence we have — deciding that a
saving is verified versus unverified from our own observation history — is invisible.

### 4.1 The ranking of AI value, highest first

1. **Matching (§2).** This is where AI earns its place. It is the bottleneck, the
   research supports LLMs strongly in our exact regime, and every other capability is
   downstream of it.
2. **Arabic normalisation.** Bounded, verifiable, high leverage. Produces a map with
   confidence and evidence, not decisions.
3. **Spec extraction from merchant titles.** Structured fields from unstructured Arabic
   text. Feeds both matching and comparison quality.
4. **Making verification visible.** Not a model — a rendering. See §4.2.
5. **The agent (وفّر 2.0).** Last, deliberately.

### 4.2 The cheapest, highest-value AI feature we can ship
Where a saving is verified, render one additional line:

```
✓ توفير حقيقي 8,800 ريال
  تتبّعنا هذا المنتج 14 يومًا · أعلى سعر رصدناه 14,399
```

**The data already exists.** This is a text render, not a model. And it is the entire
product thesis made visible: we publish a *lower* saving than the merchant claims,
because ours is evidence-based.

No competitor can copy this without years of observation history.

### 4.3 The agent — the bar it must clear
The strategy document's own risk list warns against turning وفّر into a generic chatbot
not grounded in the Product Graph and evidence.

**State the data-quality bar as a number against the North Star before any وفّر 2.0
work begins.** An agent that recommends confidently over 166 comparisons and 3%
coverage will destroy trust faster than a static page ever could.

My proposed bar — argue with it: no agentic recommendation work until comparable
products exceed 1,000 and measured matching recall exceeds 80%.

---

## 5. BECOMING THE REFERENCE FOR CHATGPT, CLAUDE AND GROK

This is the section with the shortest window and the least competition in Arabic.

### 5.1 What the research establishes

- **GEO is academically grounded.** The founding paper (Aggarwal et al., KDD 2024,
  Princeton / Georgia Tech / IIT Delhi) showed GEO methods lift visibility in AI
  answers by up to 40%, with the strongest drivers being **statistics addition, source
  citation, and quotation addition.**
- **AI search now handles an estimated 12–18% of English informational queries as of
  Q1 2026**, up from roughly 2–4% two years earlier.
- **AI answers cite 2–7 sources**, against 10 blue links. The surface shrank; the share
  grew.
- **Citation behaviour differs enormously by engine.** A 2026 study of 34,234 responses
  found a 46-fold spread in brand citation rates: **ChatGPT 0.59%, Perplexity 13.05%,
  Grok 27%.** An analysis of 680M citations found only 11% of domains cited by both
  ChatGPT and Perplexity. **These are different channels, not one channel.**
- **Claude cites the documents handed to it** — meaning connector and MCP integration
  matters for Claude specifically, not page optimisation.
- **Original research is disproportionately cited.** LLMs heavily cite the original
  source of a statistic. Publishing one original data piece per quarter reportedly
  earns 50+ citations over twelve months.

Verify all of the above independently and update anything stale.

### 5.2 Why this fits us better than it fits anyone else

**"Statistics addition" is the top-ranked GEO driver, and we manufacture original
statistics no one else on earth holds:**

- 65% of advertised Saudi electronics discounts reference a price we never observed
- 925 price drops verified by our own tracking, out of 10,302 examinable offers
- 166 products confirmed across multiple stores by model number
- Per-retailer discount integrity measured over months of observation

**No one else can produce these numbers**, because producing them requires a Saudi
price-observation history that cannot be bought or scraped retroactively.

### 5.3 The work

**5.3.1 — Publish original research quarterly**
"Saudi Electronics Price Truth Report — Q3 2026." Original statistics, transparent
methodology, stable citable URL, Arabic and English.
**Positive-only on named retailers. Never name a retailer negatively** — legal exposure
and it closes the commercial doors in §5.4.

**5.3.2 — Structural citability**
Assess and implement: schema.org Product and Offer markup with our verified-drop data,
`llms.txt` (we already have one — audit whether it reflects current reality), stable
evidence-page URLs, TL;DR summaries at the top of every substantive page, explicit
claims with dates and sources.

**5.3.3 — Prioritise by measured citation rate**
Grok at 27% and Perplexity at 13% are an order of magnitude more likely to cite than
ChatGPT at 0.59%. Effort should follow that spread, not intuition.
Establish a baseline: ask each engine ten Saudi price questions today, record who is
cited, and re-measure monthly.

**5.3.4 — Claude and MCP**
Claude cites what is handed to it. Scope an MCP server exposing Saudi product identity,
observed price history, verified drops, discount integrity, warranty and regional
variant. What could we expose today? At what effort? What is the risk of supplying the
asset versus the reach of being the source?
**Scope only. Do not build.**

### 5.4 The commercial route into the majors
Jarir, Extra and Noon will not open a feed as a favour. They may open one as a trade.

Assess a **"Tawveeri Verified Pricing" badge** — awarded only where our own tracking
confirms an advertised drop. Positive-only publication. Full comparative data stays a
B2B product.

Does a badge a retailer *wants* give them a reason to supply a feed? This is the most
plausible path into the majors, and it is the same asset as §5.2 pointed at a different
audience.

---

## 6. YOUR MANDATE — OVERRIDE ME IF YOU ARE RIGHT

**Research all of this independently before accepting any of it.** My summaries come
from limited searches on 2026-07-28. They may be incomplete, stale or wrong — as my
GTIN thesis was, and you disproved it in six minutes.

**If you find a better, simpler, cheaper or more accurate approach, adopt it and tell
me why mine was worse.** State which claims you verified, which you could not confirm,
and which you are overriding.

Pressure-test these specifically — the weakest points in my reasoning:

- **Is blocking really the bottleneck?** I inferred it from high precision plus
  unmeasured recall. **Read the code before accepting the diagnosis.** If the key
  already proposes wide candidate sets and the matcher rejects them, my whole analysis
  collapses.
- **Is an LLM matcher justified at 5,543 products,** or is it engineering for a scale
  we do not have? A curated brand map may capture most of the gain at a fraction of the
  cost.
- **Is 300–500 gold-standard pairs the right size** for a catalog this small?
- **Does the Icecat MPN bootstrap work?** If it does, most of §2 is over-engineering.
- **Are the GEO citation-rate figures reliable?** They come from vendor-published
  studies with an obvious interest. Find independent confirmation or downgrade them.

---

## 7. CONSTRAINTS

- Nothing executes before 2 August. Launch freeze holds: read-side and content only.
- No automated merge without the gold standard and a measured precision floor.
- No agentic recommendation work until the §4.3 bar is met and agreed.
- Never name a retailer negatively in public.
- Unknown beats incorrect. A missed match costs a comparison; a false match costs the
  only thing we own.
- **"We did not observe it" is never "it is not true."** Permanent.
- Label everything measured / inferred / assumption. Cite ADRs and external sources.
- Full task ledger, including omissions.

---

## 8. THE POINT

Rakhys has 70,600 listings and almost no real comparison. Global agents will have
protocol reach but not Saudi product truth.

We are trying to be the one place where **two listings are correctly known to be the
same product, and the price difference between them is true** — and then to be the
source that AI assistants quote when a Saudi buyer asks.

Those are two goals with one requirement: matching that works.

**Begin with 2.3.1 — the Icecat MPN test. Then 2.3.2 — measure recall.
Then tell me what the recall is.**
