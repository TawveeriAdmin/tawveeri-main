# The Tawveeri Constitution — Version 2 (Proposal)

**Status:** Strategy synthesis for founder ratification — **NOT yet ratified, NOT an implementation mandate.** It does not replace the ratified `TAWVEERI_CONSTITUTION.md` (v1.0) until the founder ratifies it. Author: the engineering/strategy agent, writing as founder-proxy across CEO/CTO/CPO/CSO/AI-architect/Saudi-commerce-expert/investor lenses.
**Date:** 2026-07-25. **Method:** production evidence (read-only against the production DB) + direct merchant/feed investigation during implementation + fresh 2026 web research (global agentic commerce, AI capability, Saudi market). Where a claim is unverified it is marked **[UNVERIFIED]**.
**Governing rule of this document:** optimize for truth, not agreement. Where V1 is weak, it is named as weak.

---

## PART 0 — The one-paragraph truth

Tawveeri has built a **genuinely world-class knowledge-engineering foundation and a rare, honest trust doctrine** — and it has **0 users, 295 price-comparable products, and 0 riyals of revenue.** The V1 Constitution is ~70% right and ~30% dangerously wrong. It is right that the future of commerce is *decision intelligence and verifiable trust*, not owning the buy-button — the 2026 market has now proven this (OpenAI *pulled* in-chat checkout after it converted 3× worse than click-through; the industry converged on "discover in AI, buy on the merchant's site"). It is wrong in three load-bearing ways: (1) it stakes the company's **identity on "price comparison,"** a category with **no successful precedent in MENA** (Bkam failed, Pricena is shrinking) and one that is **structurally capped at ~10% of Tawveeri's own catalog**; (2) it has **no demand or distribution strategy** in a market where distribution beats data and global agents (Amazon Rufus drove **$12B**; Google's Shopping Graph holds **50B listings**) own the shopper; (3) it keeps **building supply-side cathedral** (digital twins, three protocol adapters, sovereign multi-model orchestration) at zero-traction stage. **V2 reframes Tawveeri from "Saudi Arabia's neutral price-comparison site" to "the trusted Arabic commerce answer-and-verification layer" — the Saudi-deep, evidence-cited product-truth engine that both shoppers and other AI agents consult because it never lies and it knows Saudi.** Comparison becomes a feature of that, not the identity. Trust — the scarcest asset in Saudi commerce and now codified in Saudi law — becomes the wedge. Distribution flips from *destination* to *being inside the agents Saudis already use.*

---

# PART 1 — Current Reality (evidence-based, brutally honest)

All figures verified read-only against the production database (`vyceqrzttspyycdpojtn`) on 2026-07-25 unless noted.

### 1.1 The numbers that matter

| Metric | Value | Verdict |
|---|---|---|
| **Registered users** | **0** | ❌ The company has never met a customer. |
| **Outbound clicks (all-time)** | **73** (≈ test traffic) | ❌ No demonstrated demand or monetization. |
| **Revenue** | **0 SAR** | ❌ Unvalidated business model. |
| Raw observations ingested | 162,567 | ✔ Real ingestion engine works. |
| Canonical products | 5,305 | ✔ Identity resolution works. |
| Projection rows (served) | 3,027 | ✔ |
| **Price-comparable (≥2 stores)** | **295** (251×2-store, 40×3, 4×4) | 🟡 **9.7% of served catalog. The core promise applies to 1 in 10 products.** |
| Stores ingesting fresh (≤2h) | **4 of 8** (Jarir, Amazon, Extra, Almanea) | 🟡 Half the "8 stores" are stale/blocked/low-yield. |
| Price-history rows | 72,430 | ✔ Append-only history is real. |

**The single most important sentence in this document:** *after a very large amount of sophisticated engineering, Tawveeri can price-compare 295 products and has zero users.* Everything else is a footnote to that.

### 1.2 Constitution v1.0 — clause-by-clause

| Clause | Status | Why (evidence) |
|---|---|---|
| Preamble: "Commerce Intelligence Layer for KSA" | 🟡 Aspirational | The *ambition* is right and now well-timed; the *reality* is a 295-node comparison graph. The gap between preamble and production is ~1000×. |
| Art. I Mission "canonical record of what things cost" | 🔄 **Needs redesign** | 90% of catalog is single-store → "what things cost **across stores**" is unavailable for most products. The mission over-indexes on *comparison*; the durable asset is *verifiable product truth*, of which price is one attribute. |
| Art. II.1 Truth before convenience / "unknown beats incorrect" | ✔ **World-class. Keep verbatim.** | This is Tawveeri's single best idea and is now *legally* reinforced in KSA (advertised prices are binding under the 2019 E-Commerce Law). |
| Art. II.2 Evidence before confidence | ✔ Implemented | The Trust & Evidence Engine (`evidence-engine.ts`) computes a deterministic, factor-cited 0–100 score. Genuinely differentiated. |
| Art. II.3 Canonical knowledge / one source of truth | ✔ Implemented (TPS) | `tps_identity_key`, corroboration ≥2, provenance retained. Real. |
| Art. II.5 **Saudi-first** | 🟡 Under-built | Bilingual identity + Arabic matching exist; but "Saudi *depth*" (climate/BTU, GCC variants, installation, total cost) — the actual moat — is barely implemented. Product DNA is a stub. **This should be the #1 build, and it is treated as workstream W2.** |
| Art. II.6 Precision over recall | ✔ **World-class. Keep.** | The discipline that produced "295 real comparisons, 0 fake" instead of "thousands of fake ones." Rare and correct. |
| Art. II.10 **Trust is the product** | ✔ Right principle, ⬆ **under-leveraged** | Correct — and Saudi data says trust is *the* scarcest asset (31% fraud, highest in MENA; trust = #1 barrier to Gulf agentic commerce). But trust is currently *computed*, not *visible to any human* (0 users). A moat no one experiences is not yet a moat. |
| Art. II.11 Build systems not features | 🔄 **Taken too far** | This principle, unbalanced by any "ship to a user" principle, is *why* there are 0 users. It has licensed 18 months of foundation-building with no demand contact. V2 must pair it with a **"contact reality early"** principle. |
| Art. VI AI Doctrine "deterministic decides; LLM only phrases; LLM never chooses identity" | 🔄 **Needs redesign** | Defensible in 2023; **outdated in 2026.** LLMs now beat fine-tuned matchers by **+40–68 F1 on *unseen* products** — exactly the single-store long tail. And constrained decoding + Citations APIs now make "never fabricate" a *runtime guarantee*, so it is safe to let the LLM *propose* identity links (engines still *decide*). The rigid rule leaves the largest available accuracy gain unclaimed. |
| Art. VII Ranking never for sale | ✔ **Keep — now a legal + strategic asset** | KSA's GAMR "Mawthooq" mandates affiliate disclosure; ad-funded incumbents (ads inside Rufus/Copilot) *structurally cannot* claim neutrality. This is a real differentiator, not just ethics. |
| Art. VIII Governance / autonomy filters | ✔ Keep | The ten-year/replacement/compounding filters are excellent. |
| Art. IX Success = production value users experience | ✔ **Keep — and enforce it** | By its own definition, Tawveeri has produced ~0 success (0 users experience it). The Constitution already contains the stick to correct itself; it simply hasn't been applied. |

### 1.3 TPS — status

✔ **Completed and strong:** canonical identity, corroboration-first merging, immutable observations, append-only history, provenance, the two-plane resolved-single model. This is the best-engineered part of the company and should not be touched except to extend.
🟡 **The uncomfortable truth about TPS:** it works, and it revealed that *the comparison opportunity itself is small* — 90% single-store, and the categories with the most single-store tail (Samsung 362, Apple 235, LG 204) don't corroborate because the high-overlap retailers block access or sell different SKUs. **TPS is a success that proved the original business premise is narrower than believed.**

### 1.4 Post-E15 Strategic Brief (2026–2040) — status

| Element | Status | Why |
|---|---|---|
| "Discover in AI, buy on merchant" positioning | ✔ **Prescient — now market-proven** | The single best call in the brief. 2026 validated it hard. |
| Merchant Independence (catalog ≠ commercial deal) | ✔ Keep | Correct and legally aligned. |
| Two-Stage Agent (Stage-1 decision agent early) | ✔ Stage-1 built (`/api/v1/agent/decide`) | Deterministic AC advisor live. Good. But **no user has ever used it.** |
| Product DNA | 🟡 Barely started | The moat, treated as a workstream. ⬆ |
| UCP-first + ACP/AP2 adapters | ⬇ **Over-invested for stage** | Real protocols, but building 3 adapters at 0 users is premature. Pick MCP (neutral, Anthropic-origin, LF-governed) + UCP-*discovery*; defer ACP/AP2 checkout. |
| Consumer/Merchant Digital Twins | 🗑 **Delay hard** | Zero users → no consumer twin to build. Premature. |
| Household Product Graph + Predictive Lifecycle | 🗑 **Delay hard** | Sci-fi at this stage. |
| Sovereign multi-model AI orchestration | ⬇ **Delay** | Interesting given HUMAIN/ALLaM, but not a zero-user problem. |
| Installation & Services Marketplace | ⬇ Delay | Right insight (AC installation = real KSA need), wrong time. |
| Data-Quality-as-a-Service / Merchant Twin revenue | 🟡 Keep as *future* | You cannot sell "data quality intelligence" from a 295-node graph. Revisit at scale. |
| Ranking-blind Revenue Graph | 🟡 Over-specified | The *principle* (separation) matters; the elaborate architecture is premature at 73 clicks. |
| 90-day plan (DNA + benchmark + agent) | 🟡 Supply-only | Competent — but every deliverable is supply-side. **Not one line is about getting a human to use it.** This is the brief's central blind spot. |

### 1.5 Roadmap E15.5 → Phase 2 — status

- E0–E15 (foundation, legacy severance): ✔ **Genuinely complete and verified.** Impressive execution.
- E15.5 Decision Agent + benchmark: ✔ Built, deterministic, ranking-blind. ❌ **Unused.**
- Phase 2 (Trust Engine, Provider/Feed/Affiliate framework, automation): ✔ Built and production-verified this quarter (ADRs 078–092). The feed framework + evidence-cited trust are the two most valuable recent assets.
- **The honest pattern across the whole roadmap:** *supply-side completeness is ~85%; demand-side completeness is ~0%.* The company has been optimizing the half of the equation that doesn't, by itself, produce a business.

---

# PART 2 — Deep Gap Analysis

Five lenses: original vision · production reality · Saudi market · global commerce · AI capability.

### Gap 1 — The Comparison Trap (vision ↔ reality ↔ market)
- **Vision:** "canonical record of what things cost." **Reality:** 295 comparable / 9.7%. **Market:** pure price-comparison has *failed repeatedly in MENA* (Bkam dead; Pricena −9.85% MoM; Yaoota tiny). 
- **Root cause (proven in production this quarter):** comparison is **merchant-data-access-bound**, not engineering-bound. High-overlap retailers block scraping; a whole clean merchant (shaker) added ~0 comparisons.
- **Impact:** existential. Strategic **10/10**. Engineering cost to "fix" via more parsers: **wasted** (proven). Customer value of the 295: real but tiny. Investor value: a "price-comparison startup" in MENA is close to un-fundable on precedent alone.
- **V2 resolution:** stop selling *comparison* as the identity. Sell *trusted product answers*; comparison is one output where data allows.

### Gap 2 — The Distribution Void (the existential gap)
- Every strategic document is **supply-side**. There is **no answer to "how does a Saudi shopper ever meet Tawveeri?"** In commerce, **distribution beats data**. Global agents already own the shopper.
- **Impact:** existential. Strategic **10/10**. Engineering cost: *low* relative to value (an MCP endpoint + a WhatsApp bot are weeks, not quarters). Investor value: **this is the difference between fundable and not.** Competitive value: being *inside* HUMAIN/ChatGPT/Gemini as the Saudi product-truth source is a position no incumbent occupies.
- **V2 resolution:** Distribution is now Priority #1. Two channels: (a) **agent-callable** (MCP server / UCP discovery source) so other AIs cite Tawveeri's Saudi verdicts; (b) **a direct Arabic advisor** where Saudis already are (WhatsApp), anchored on a real use case (in-store *showrooming* — 51% of Saudis compare prices on their phone *inside* the shop).

### Gap 3 — The Depth Deficit (Saudi-first is under-built)
- The *only* durable defensible ground vs Google/Amazon is **Saudi depth** (climate → BTU, inverter economics, GCC-variant traps, installation, total cost of ownership, dialect). It is barely built (Product DNA is a stub).
- **Impact:** high. Strategic **9/10**. Engineering cost: moderate and *compounding*. Investor value: high — it's the answerable "why won't Google crush you." Customer value: very high (this is what a Saudi buyer actually needs).
- **V2 resolution:** Product DNA + Saudi-context reasoning becomes a top build, category by category, starting with AC.

### Gap 4 — The AI-Doctrine Lag (capability ↔ doctrine)
- 2026 AI (LLM entity-resolution +40–68 F1 on unseen products; constrained decoding = 100% schema conformance; Citations/grounding APIs; hybrid BM25+dense+RRF+rerank; cheap multimodal Arabic embeddings) has moved past the "LLM never decides identity" rule.
- **Impact:** medium-high. Strategic **7/10**. Engineering cost: low (these are APIs). Customer value: directly grows the comparable/identified tail. 
- **V2 resolution:** evolve the doctrine to **"LLM proposes over cited evidence; deterministic engines verify and gate; runtime constrained-decoding + citations enforce never-fabricate."**

### Gap 5 — The Over-Engineering Tax (build-systems-not-features, unbalanced)
- Twins, 3 protocol adapters, sovereign orchestration, revenue graph, household graph — all specified, several started, at 0 users.
- **Impact:** medium (opportunity cost + complexity debt). Strategic **6/10**. 
- **V2 resolution:** a hard **"contact reality"** counter-principle; delay everything not on the path to *a user and a riyal*.

---

# PART 3 — Global Commerce & AI (fresh 2026 research)

Sourced findings (full citations in the research appendix the founder was shown live). Signal only.

- **The buy-button retreated.** OpenAI launched in-chat Instant Checkout (Sept 2025) then **deprioritized native checkout (~Mar 2026)** after Walmart data showed it converted **3× worse** than click-through. Industry consensus: **"discover in AI, buy on the merchant's site."** → *validates Tawveeri's decision-layer + measured-exit thesis.*
- **Value accrues at the two ends, not the middle.** Demand-aggregation (top) + **structured product data & verifiable trust** (bottom) capture value; checkout execution commoditizes. → *Tawveeri's evidence-cited trust sits at the valuable bottom end — but only if it has distribution at the top.*
- **Scale of incumbents:** Google Shopping Graph **50B listings, 2B refreshed hourly**; Amazon Rufus **$12B incremental, 300M users, ads now inside**; Walmart Sparky (+150% engagement). → *Tawveeri cannot win on breadth or on owning the shopper. Full stop.*
- **Trust/verification is the fastest-emerging, un-owned frontier.** Bain: shoppers trust a retailer's *own* agent ~**3× more** than a third-party agent (a real threat to neutral aggregators) — *but* ad-funded assistant answers (Rufus/Copilot retail media) structurally **cannot** be neutral. FIDO/Visa/Mastercard are racing to build *agent-identity/trust* rails; **no one owns independent product-truth verification.**
- **Protocols are layering, not consolidating.** **MCP** = neutral plumbing (donated to Linux Foundation; Anthropic-origin; ~97M monthly SDK downloads). ACP (OpenAI/Stripe) and UCP (Google/retail coalition) interoperate; multi-standard adapters win. → *Adopt MCP now; expose Tawveeri as a tool other agents call; treat ACP/UCP as discovery interfaces, defer their checkout halves.*
- **Legal wind at scraping's back is gone.** **Amazon won an injunction against Perplexity's shopping agent (Mar 2026)** for unauthorized access. → *Consented/official feeds beat scraping; the Provider/Feed framework is the right bet.*
- **Comparison-as-destination is declining globally; the incumbents survive on lawsuits, not traffic.** Zero-click search hit ~65% (2026); AI Overviews roughly *halve* click-through (Pew: 8% vs 15%); Google's **March 2026 core update** hammered aggregators (Skyscanner −39%, TripAdvisor −45%). The comparison engines' biggest 2025–26 wins were **antitrust awards** — idealo (~€465M) and **PriceRunner/Klarna (~$1.97B)** vs Google — not organic recovery. → *A comparison **destination** is a melting iceberg; a comparison **capability inside answers/agents** is not.*
- **Consumers trust the decision layer, distrust the buy button — with numbers.** ~**65% trust AI to *compare* prices; only ~14% trust it to *place the order.*** Comparison/advice is the trusted zone; autonomous checkout is not. → *Tawveeri is architected for exactly the trusted half.* (Also: the **Honey scandal** — a checkout intermediary caught silently re-routing affiliate economics — is the market's proof that **neutrality must be provable, not asserted**; Tawveeri's ranking-blind + measured-exit design is that proof.)
- **The niche is empirically open.** No well-funded startup occupies the "deterministic, evidence-cited, commercially-unbiased *verdict* engine." The closest credibility analogue is **Consumer Reports' AskCR** (answer engine, 2M+ questions, funded by memberships, **no ads/affiliate**). Price-surfacers with affiliate conflicts (Phia, ~$43M raised) and dead anti-fake-review apps (Fakespot, shut 2025) show the recurring failure mode: *monetization erodes neutrality.* Tawveeri's constitution forbids that by design.

**Net:** the world moved *toward* Tawveeri's philosophy (trust, evidence, decision-over-checkout) and *away* from Tawveeri's chosen form-factor (a neutral comparison site). V2 keeps the philosophy and changes the form-factor.

---

# PART 4 — Saudi Market (fresh 2026 research)

- **Demand is real and mobile:** 99% internet penetration; ~78% of e-commerce is mobile; electronics is the **largest** online category (~$1.97B). Digital economy $87B→$133B by 2030.
- **Trust is the scarcest asset — and codified in law.** Fraud is **highest in MENA (31%)**; 27% abandon over security. The **E-Commerce Law makes advertised prices legally binding** and mandates pre-purchase disclosure; **GAMR "Mawthooq"** mandates affiliate disclosure; **PDPL** is enforced (48 actions year 1, extraterritorial). → *Tawveeri's "never fabricate a price/verdict" is not just ethics — it is legal alignment, and a wedge against every ad-funded and scraper-only competitor.*
- **Showrooming is a concrete wedge:** **51% of Saudis compare prices on their phone *inside* physical stores.** That is a specific, winnable "ask Tawveeri right now" moment.
- **The data-access reality (confirmed):** no open product API for Amazon.sa (**PA-API is dead for .sa**), Noon, Jarir (Magento; JSON-LD + sitemap only), Salla, or Zid (both OAuth + merchant-approval gated). **The credential-free scale lever is bigger than previously mapped:** **~4,416 live public Salla storefronts** (JSON-LD/sitemap-scrapable) + **~5.17K WooCommerce SA stores** (public Store API). Monetization = affiliate deeplinks (**DCMnetwork explicitly allows price-comparison sites**), not feeds.
- **Competition is thin and struggling:** Pricena shrinking; Bkam dead; **no confirmed Arabic AI-shopping decision-engine exists.** The AI-native, trust-first, Arabic lane is **open.**
- **National tailwind — and a national threat:** **HUMAIN (PIF, MBS-chaired) shipped ALLaM 34B + HUMAIN Chat**; 2026 is the declared "Year of AI"; **56% of Saudis are comfortable with an AI completing a purchase.** This is rocket fuel *if* Tawveeri is the trusted commerce layer these agents use — and an extinction event *if* HUMAIN builds commerce and Tawveeri is a competitor rather than a supplier. **→ Strategic imperative: be HUMAIN's Saudi commerce-truth supplier, not its rival.**

---

# PART 5 — Investor Perspective (international VC lens)

**Would I invest today, as-is? No.** A pre-revenue, zero-user "price-comparison" company in a category with no MENA success stories, competing on breadth against Google/Amazon, is a pass. The deck's headline ("neutral price comparison for KSA") triggers the pattern-match to Bkam.

**Would I invest in the V2 reframe? Yes — at pre-seed/seed, conditionally.** Here's the memo:

- **What's world-class (the asset):** a corroboration-first, provenance-complete, **evidence-cited product-truth engine** with a deterministic Trust Score — built by a team with unusual engineering discipline (precision-over-recall, "unknown beats incorrect"). This is *exactly* the layer 2026 analysts say value accrues to, and it is Saudi/Arabic-native. Rare.
- **What's average / a red flag:** 0 users, 0 revenue, 73 clicks; a supply-obsessed roadmap; the "comparison" label; over-engineering relative to traction.
- **Defensibility / moat (in priority):** (1) **Saudi depth** (climate/BTU/GCC/installation/total-cost/dialect) global players won't build for a single market; (2) **structural neutrality** (ad-funded incumbents legally/commercially can't match it in KSA); (3) **the evidence/provenance graph** as an agent-callable API — becoming the *cited source* other AIs trust for Saudi commerce; (4) **compliance-as-moat** (PDPL/Mawthooq/E-Commerce-Law-clean). None of these is a moat *yet*; each is a credible *path* to one.
- **What excites:** the timing (world moved to your thesis), the open Arabic-AI-commerce lane, the HUMAIN/PIF tailwind, the "be the truth layer agents cite" positioning that sidesteps the distribution war.
- **What concerns:** the "3× trust for first-party agents" finding (neutral third parties start behind); the risk HUMAIN/Noon/Google simply add Saudi depth; execution team's demonstrated preference for building over shipping; single-founder key-person + credential-gated data access.
- **The check I'd write is on one condition:** *show me 1,000 Saudis using the AC advisor and the first riyal of affiliate revenue within two quarters.* Traction on a narrow wedge converts this from "beautiful engineering, no business" to "fundable."

**What should disappear from the pitch:** "price comparison," "50 categories," "Commerce Intelligence OS by 2030," digital twins, sovereign multi-model. **What should lead the pitch:** "the trusted Arabic product-truth layer for the agentic-commerce era — starting by owning *which appliance should I buy in Saudi.*"

---

# PART 6 — Founder Perspective (if this were my company)

- **Build faster:** (1) a **WhatsApp Arabic AC-advisor** aimed at the showrooming moment — the fastest path to a real user; (2) an **MCP endpoint** exposing Tawveeri's Saudi verdicts so other agents (and a HUMAIN partnership) can call them; (3) **Product DNA for AC** end-to-end; (4) **Salla/Zid storefront ingestion** (JSON-LD/sitemap) — the real credential-free scale lever.
- **Stop building:** digital twins, household graph, ACP/AP2 checkout adapters, sovereign multi-model orchestration, revenue-graph elaboration, more scraper parsers hoping for comparisons.
- **Completely redesign:** the *identity* ("comparison site" → "trusted answer/verification layer"); the *AI doctrine* ("LLM never decides" → "LLM proposes over cited evidence; engines verify; runtime guardrails enforce never-fabricate").
- **Delay:** all 50-category ambitions; installation marketplace; Stage-2 payment (SAMA-gated anyway); enterprise Data-Quality product (need scale first).
- **Accelerate:** the AC wedge to *#1 in Saudi for "which AC should I buy"*; the trust layer made *visible* to a human; first revenue via affiliate deeplinks (DCMnetwork/ArabClicks).
- **Simplify:** one channel (WhatsApp), one category (AC), one metric (weekly active askers), one revenue line (measured affiliate). Everything else waits.
- **Remove:** the two-database narrative (done — stop mentioning it); the pretense that supply completeness is progress toward a business.

**The founder's hardest truth to accept:** *the engineering is not the problem; the engineering has been the comfort zone.* The company has been building an ever-more-perfect answer to a question no Saudi has yet been asked. The next 90 days must be about a human asking, and Tawveeri answering, and someone clicking `/go`.

---

# PART 7 — Engineering Review (keep vs redesign)

| System | Verdict | Note |
|---|---|---|
| **TPS canonical model** | ✅ **Keep** | Best asset. Extend, don't touch. |
| **Identity resolution (corroboration-first)** | ✅ Keep, ⬆ augment | Add LLM *candidate proposal* for the unseen-single-store tail (engines still decide). |
| **Evidence/Trust Engine** | ✅ **Keep — and surface it** | Deterministic, cited, differentiated. Currently invisible to humans; make it the product's face. |
| **Canonical → Variant → Offer** | ✅ Keep | Correct model. |
| **Provider/Feed/Affiliate framework** | ✅ Keep | Right architecture for the consented-feed era (Amazon-v-Perplexity confirms). Add Salla/Zid storefront + JSON-LD adapters. |
| **Scheduler / automation** | ✅ Keep | Self-refreshing, pooler-routed, verified. Solid. |
| **Projection / search (Algolia)** | 🟡 Redesign later | Move to **hybrid BM25+dense+RRF+reranker** for Arabic recall when search becomes user-facing at volume. Not urgent at 0 users. |
| **Decision Engine (deterministic)** | ✅ Keep core, ⬆ expose | Great bones; needs a channel (WhatsApp/MCP) and Product DNA depth. |
| **Knowledge Graph / Product DNA** | 🟡 **Build (it's mostly absent)** | The moat. Start with AC. |
| **Database / RLS / provenance** | ✅ Keep | Disciplined. (Minor: `product_views` referenced in CLAUDE.md doesn't exist in prod — fix the doc.) |
| **Two-DB convergence** | ✅ Done | Stop investing narrative here. |
| **Testing (630 green)** | ✅ Keep | Strong discipline. |
| **Protocol adapters (UCP/ACP/AP2)** | 🔄 Narrow | Keep UCP *discovery* + MCP; shelve ACP/AP2 *checkout* until there are users and SAMA clarity. |
| **AI-readiness** | ✅ Strong foundation | Deterministic core + structured outputs = ideal substrate to *safely* add LLM proposal/phrasing with citations. |

**One-line engineering verdict:** *the foundation is a keeper; the mistake was pouring more foundation instead of building the one room a customer would walk into.*

---

# PART 8 — THE NEW CONSTITUTION (Version 2)

*What follows is written to stand as Tawveeri's governing strategic document upon ratification.*

## Vision
**Tawveeri is the trusted product-truth layer for Saudi commerce in the agentic era** — the Saudi-deep, evidence-cited engine that answers "what should I buy, from whom, at what real total cost, and can I trust it?" — for humans directly, and for the AI agents they increasingly shop through. In time, the canonical commerce-truth layer for the GCC.

## Mission
Construct and maintain **verifiable truth about products, prices, and merchants in Saudi Arabia**, and deliver the **judgement to act on it** — in Arabic, on the shopper's channel, with every claim traceable to evidence.

## Core Principles (12, revised)
1. **Truth before convenience.** Never fabricate a product, attribute, price, or verdict. *Unknown beats incorrect.* (Now also a KSA legal duty.)
2. **Trust is the product, and it must be *visible*.** Every verdict shows its evidence. A moat no human experiences is not a moat.
3. **Contact reality early.** *(NEW — the counterweight to #11.)* Every quarter must put the product in front of real Saudi shoppers and measure use. Foundation without a user is cost, not progress.
4. **Distribution is a first-class problem.** *(NEW.)* Being *inside* the channels and agents Saudis already use outranks owning a destination.
5. **Saudi depth is the moat.** Climate, GCC variants, installation, total cost of ownership, dialect, regulation — the knowledge global players won't build for one market.
6. **Evidence before confidence.** Confidence is earned, stored, cited; history is never discarded.
7. **Canonical knowledge.** One source of truth per question; corroborate before asserting identity (≥2 stores).
8. **Precision over recall.** A wrong merge corrupts the graph; a missing one merely defers it.
9. **Neutral by architecture.** Commercial interest never enters ranking; separation is provable, not promised. (A legal + competitive asset in KSA.)
10. **Deterministic decides; AI proposes and phrases — under runtime guardrails.** *(REVISED.)* Engines produce every verdict and gate every write. LLMs may *propose* candidate identities/links over **cited evidence** and *phrase* results; constrained decoding + citation-grounding make "never fabricate" a runtime guarantee, not a hope. AI never overrides stronger evidence.
11. **Build systems, not features — on the path to a user.** *(REVISED.)* Prefer reusable capability — but only when it shortens the path to real usage. Foundation for its own sake is rejected.
12. **Permanent, compounding improvement.** Every release strengthens the platform *and* moves a usage or revenue metric.

## Product Philosophy
Answer *tasks*, not keywords. Lead with a **decision** ("buy the X for your 30 m² Riyadh room; total cost ≈ Y incl. install; here's why; here's where") and show the **evidence** beneath it. Comparison appears where data allows; single-store truth is labelled honestly. Simple surface, cited depth on demand.

## AI Philosophy
Deterministic engines own verdicts, ranking, and identity decisions. LLMs earn three jobs: (a) **understand** the Arabic/dialect task; (b) **propose** candidate links for the unseen long tail (engine verifies, corroboration decides); (c) **phrase** the engine's verdict with inline citations. Every AI output is constrained to supplied facts. Prefer Arabic-strong models (Gemini 3.x / Claude for quality; ALLaM/Falcon-H1-Arabic where sovereignty or cost demands). No AI in the trust score.

## Data Philosophy
Provenance is sacred; observations immutable; history append-only. **Consented/official feeds first** (Amazon-v-Perplexity makes this the durable path), sanctioned public storefront data second (WooCommerce Store API; Salla/Zid JSON-LD + sitemap — the credential-free scale lever), scraping last. Never fabricate to fill a gap.

## Evidence Philosophy
Every price, verdict, identity, and recommendation carries its reason, sources, and confidence — machine-readable, so a human *and another AI* can verify it. **Verifiability is the exportable product.**

## Saudi Strategy
Own the questions global agents answer generically. Start where Saudi depth is decisive and comparison is real: **air conditioners** (climate → BTU, inverter economics, installation, total cost, genuinely multi-store). Become *the* answer to "which AC should I buy in Saudi." Then washing machines, refrigerators, mobiles — depth before breadth. Arabic-first, dialect-aware, mobile-first, showrooming-aware.

## Global Strategy
Do not compete with Google/Amazon/OpenAI for the shopper. **Interoperate:** expose the Saudi truth layer as an **MCP tool / UCP discovery source** so their agents cite Tawveeri for Saudi commerce. Be the specialist supplier to the generalist agents. GCC expansion only after KSA depth is a moat.

## Competitive Position
Not "a better Pricena." The **neutral, evidence-cited, Saudi-deep product-truth layer** — occupying the trust/verification end (where 2026 value accrues and no one is incumbent), reachable by both humans and agents. Neutrality is defensible because ad-funded incumbents legally/commercially can't copy it in KSA.

## Investor Narrative
"The world just proved decision-intelligence + trust beats owning checkout. Global agents own breadth and the shopper; **no one owns trusted, Saudi-deep, neutral product truth** — the layer agents must cite and shoppers must trust in the market with the highest fraud and the strongest AI tailwind (HUMAIN/PIF). We are that layer, Arabic-native, compliance-clean, monetized by neutral measured exits. We win a category (AC), then a market, then the GCC."

## Consumer Narrative
"Ask Tawveeri in Arabic what to buy. Get one honest answer with the reasons and the real total cost — never a paid placement, never a made-up spec. Buy wherever is genuinely best."

## Merchant Strategy
Merchant Independence: in the catalog because observed, not because they paid. Consented feeds welcomed (cleaner data, better placement *eligibility*, never ranking). Monetize exits via KSA affiliate networks (DCMnetwork/ArabClicks/Admitad) that permit comparison sites; disclose per Mawthooq. Later: sell a merchant *its own* market-mirror (never ranking).

## Partnership Strategy
The highest-leverage partnership in the country: **HUMAIN/ALLaM** — be its Saudi commerce-truth supplier (MCP/API), not its competitor. Secondary: Salla/Zid (official product API via partnership) to convert the credential-gated tail into clean feeds; affiliate networks for monetization.

## AI Roadmap
Now: LLM task-understanding (Arabic) + LLM identity-*proposal* for the single-store tail (engine-gated) + cited phrasing via constrained decoding/Citations. Next: multimodal (image-assisted dedup/identity; OCR spec sheets). Later: GraphRAG over the Product DNA graph for reasoned buying advice. Always: deterministic verdicts, sovereign-model option where required.

## Engineering Roadmap
Now: WhatsApp advisor + MCP endpoint + AC Product DNA + Salla/Zid storefront ingestion. Next: hybrid search (BM25+dense+RRF+rerank) when user-facing; consented-feed adapters (Salla/Zid OAuth on partnership). Later: UCP discovery interface; multimodal identity. Never (until users+SAMA): in-app payment.

## Product Roadmap
Wedge (AC advisor, Arabic, WhatsApp) → adjacent appliances → mobiles → a real "compare + decide" web/app surface *once demand is proven* → agent-facing API as a product.

## Data Roadmap
AC depth to completeness → Salla/Zid JSON-LD ingestion (scale the credential-free tail) → official feeds via partnership → multimodal enrichment → provenance-exportable verdicts.

## Revenue Roadmap
1) Measured affiliate exits (now — first riyal within a quarter). 2) Premium consumer (advanced alerts/advice) once there's a base. 3) Merchant market-mirror subscriptions at scale. 4) Agent/API access (MCP/UCP) as the truth-supplier business. 5) *(Far future, gated)* checkout/BNPL/installation. All ranking-blind.

## Growth Roadmap
Wedge use case (showrooming AC advisor) → word-of-mouth + Arabic content/SEO for "which X should I buy in Saudi" → agent distribution (be cited by ChatGPT/Gemini/HUMAIN) → category and channel expansion. Distribution before breadth.

## Execution Priorities (ranked)
1. **A real Saudi user asking a real question** (WhatsApp AC advisor).
2. **First measured-affiliate riyal.**
3. **Trust made visible** (evidence-cited answers a human sees).
4. **Agent distribution** (MCP endpoint; HUMAIN conversation).
5. **Saudi depth** (AC Product DNA → completeness).
6. **Credential-free scale** (Salla/Zid storefront ingestion).
7. Everything else: later.

## Milestones (next 12 months)
- **M1 (Q1):** AC Product DNA complete for corroborated + top single-store ACs; WhatsApp advisor live; first 100 real askers.
- **M2 (Q2):** 1,000 weekly askers; first affiliate revenue; MCP endpoint live; HUMAIN/partnership conversation opened.
- **M3 (Q3):** 2nd & 3rd categories (washing machines, refrigerators); Salla/Zid ingestion doubling the catalog; visible trust surface.
- **M4 (Q4):** 10k weekly askers; repeatable revenue; a fundable traction story; decision on web/app surface.

## KPIs (the only ones that matter now)
**Primary:** Weekly Active Askers · Answer→`/go` click-through · Affiliate revenue · % answers a human rates "trustworthy." **Health:** comparable-product count · identification % where comparison is possible · catalog freshness · % answers fully evidence-cited · zero-fabrication rate. **Retired vanity metrics:** raw observation count, canonical count, "stores onboarded."

## Risks & Opportunities
**Risks:** HUMAIN/Noon/Google add Saudi depth (mitigate: be their supplier, move first, go deeper); first-party-agent trust advantage (mitigate: neutrality + evidence + be *inside* trusted agents); data-access gates (mitigate: feed framework + partnerships); *the biggest risk — continuing to build supply and never shipping to a user* (mitigate: Principle #3, KPI discipline). **Opportunities:** open Arabic-AI-commerce lane; national AI tailwind; trust codified in law favoring the honest player; the global shift to "discover in AI" that Tawveeri is already architected for.

## 10-Year Vision (2036)
The default trusted answer to "what should I buy in Saudi Arabia and can I trust it" — for humans and for every agent operating in the Kingdom. The neutral commerce-truth layer of the GCC: cited by the assistants, trusted by the shoppers, independent of the sellers.

## 2040 Vision
Commerce-truth infrastructure for the Arab world — the provenance-and-verification layer under an agentic economy: every automated purchase in the region checkable against Tawveeri's evidence, no verdict for sale, unknown still beating incorrect.

---

## Final note (truth over agreement)
The most valuable thing this analysis can tell the founder is the thing hardest to hear: **the engineering is excellent and the business does not yet exist, and more engineering will not create it.** V2's entire purpose is to point the same disciplined team at the half of the problem it has avoided — a Saudi human, asking a question, getting a trustworthy answer, and clicking through. Do that on one category, and every asset already built becomes a moat. Keep perfecting the foundation instead, and Tawveeri will be the best-engineered company that never had a user.

*Proposed as Version 2.0 — pending founder ratification. Think like a founder; ship like a startup; verify like a scientist; never fabricate; contact reality early.*
