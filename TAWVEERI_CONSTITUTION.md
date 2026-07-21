# The Tawveeri Constitution

**Version:** 1.0 · **Status:** Founder-ratified · **Authority:** Single Source of Truth

This document is the permanent foundation of Tawveeri. It defines *what Tawveeri is* and *the principles every decision must satisfy*. It is deliberately technology-independent and slow-changing. Mechanics live in the documents it governs (see `docs/README.md` for the document hierarchy and precedence).

Amendments require founder ratification and a version increment.

---

## Preamble — What Tawveeri Is

Tawveeri is **not** a price-comparison website, an affiliate site, an e-commerce store, or a search engine. Those are visible surfaces.

**Tawveeri is the Commerce Intelligence Layer for Saudi Arabia, and in time the GCC** — the single trusted system that understands products, stores, offers, prices, availability, history, commercial differences, technical identity, market signals, user intent, merchant quality, and Saudi buying language, and reasons over all of it.

Every future capability must emerge naturally from this one foundation.

---

## Article I — Mission & Vision

**Mission:** Construct and maintain the truth about what things cost in Saudi Arabia, and give every shopper the judgement to act on it.

**Vision (5–10 years):** an AI-native commerce operating system on which comparison, price intelligence, an AI shopping advisor, recommendations, merchant intelligence, deal detection, a knowledge graph, and consumer/merchant/enterprise APIs all rest — each strengthening the platform rather than existing in isolation.

The permanent definition: **Tawveeri is the canonical record of what things cost — and the judgement to know when to buy.**

---

## Article II — Founder Principles

Every engineering, product, design, and commercial decision must satisfy these twelve principles. They are the decision filter for anything Tawveeri builds.

1. **Truth before convenience.** Never fabricate a product, attribute, offer, or price. *Unknown is better than incorrect.*
2. **Evidence before confidence.** Confidence is earned and stored; reasoning is explainable; historical evidence is never discarded.
3. **Canonical knowledge.** One canonical representation of each real thing — product, store, offer, observation, decision. One source of truth per question.
4. **AI-native.** Design every artifact so humans, machines, and LLMs can reason over it. Explicit over overloaded; explainable over implicit.
5. **Saudi-first.** Saudi language, dialects, terminology, merchants, habits, expectations, and trust come before everyone else.
6. **Precision over recall.** A wrong merge corrupts the knowledge graph; a missing one merely defers it. Corroborate before asserting identity.
7. **Long-term leverage.** Choose the architecture that compounds. Before building, ask: *does this make Tawveeri faster to improve a year from now?*
8. **Simplicity for the user.** Complex internals, simple experience. Users must never feel the complexity behind the platform.
9. **Transparency.** Every verdict, identity, offer, and price carries its reason, evidence, and lineage.
10. **Trust is the product.** Users return because they trust Tawveeri. Trust outranks features, speed, growth, and revenue — always.
11. **Build systems, not features.** Prefer reusable platform capabilities that solve future problems automatically over isolated features.
12. **Permanent improvement.** Every deployment must permanently strengthen Tawveeri. Reject changes whose benefit disappears after one release.

---

## Article III — Product Architecture Doctrine

Tawveeri is built around **knowledge**, not pages. Products are knowledge; stores are evidence; offers are observations; prices are temporary; identity is permanent.

**The three layers** (mechanics in `docs/TPS.md`):

- **Canonical Product** — the real-world product, independent of any store, price, offer, or promotion. Exactly one per real product.
- **Commercial Variant** — commercial differences that change *how a product is sold*, never its identity (region, warranty source, bundle, installation, gift, package).
- **Offer** — one store selling one commercial variant, owning price, availability, stock, coupon, delivery, and merchant URL. An offer never defines identity.

**The four data domains:** *Identity* (facts that answer "is this the same product?"), *Commercial* (what affects buying), *Experience* (what improves understanding — reviews, guides, AI explanations), *Derived* (calculated knowledge — best price, trend, confidence; never hand-entered).

Raw observations are **immutable**. Price history is **append-only**. Every identity decision is **logged and traceable**.

---

## Article IV — The Five Pillars

1. **Knowledge** — Tawveeri understands products.
2. **Commerce** — Tawveeri understands stores, offers, prices, coupons, availability.
3. **Intelligence** — Tawveeri understands relationships, predictions, recommendations, reasoning.
4. **Automation** — everything repetitive becomes automated: store and category onboarding, monitoring, validation, quality checks, deployment.
5. **Learning** — every deployment makes Tawveeri smarter, not merely bigger.

---

## Article V — The Flywheels

Growth is compounding, not linear. Four reinforcing loops:

- **Product:** better data → identity → knowledge → search → AI → UX → more users → more observations → better data.
- **Merchant:** better offers → ranking → traffic → merchant trust → integrations → better data.
- **AI:** better knowledge → better AI → better recommendations → more interaction → better signals → better AI.
- **Execution:** observe → understand → design → implement → verify → measure → improve.

Every release should feed at least one flywheel.

---

## Article VI — AI Doctrine

AI **reasons; it never invents.** The permanent division of labor:

- **Deterministic engines and rules produce every verdict** — deal quality, price assessment, identity, ranking. Verdicts are reproducible and auditable.
- **LLMs understand intent, normalize language, choose among candidates, and explain** — they never author a price, store, link, coupon, identity, or verdict.
- **Evidence hierarchy is respected** (model number → GTIN → brand → series → generation → specs → title → corroboration → history → AI). AI never overrides stronger evidence.
- **Uncertainty is stated, not hidden.** "Insufficient evidence" is a valid answer.

**Waffar** is not a chatbot; it is Tawveeri's Commerce Intelligence Assistant — it phrases and delivers engine-produced judgement in Saudi dialect, with its facts and links supplied, never generated.

---

## Article VII — Trust & Revenue

Revenue must never compromise trust.

- **Ranking is never for sale.** Order reflects user value — price, coverage, quality, confidence — never payment.
- **Sponsored placements, where they exist, are always clearly distinguishable.**
- Revenue may come from affiliate, CPA/CPC, merchant subscriptions, premium analytics, enterprise APIs, and future checkout/BNPL/delivery integrations — each only if it preserves trust.
- **Trust remains above monetization in every conflict.**

---

## Article VIII — Governance

**Autonomy.** The engineering organization operates autonomously on reversible work — reading, editing, refactoring, tests, builds, additive migrations, deploying through established pipelines, and production verification.

**Founder approval is required only for** irreversible or trust-bearing actions: deleting production data, breaking backwards compatibility, removing important architecture, security-policy or credential changes, billing, domain ownership, and anything outside Tawveeri.

**The strategic filters** applied before any significant change:
- *The ten-year question:* will this architecture still make sense at 500 stores, 100 categories, 100M observations, and external AI agents?
- *The replacement test:* a competitor should not be able to copy this in a month. Capabilities beat features; knowledge beats interfaces; trust beats knowledge.
- *The compounding rule:* prefer improvements that grow more valuable over time.
- *The platform rule:* build the reusable capability, not the isolated feature.

**The Decision Register** (`docs/DECISIONS.md`) records every significant decision — problem, alternatives, evidence, decision, consequences. History never disappears.

---

## Article IX — Definition of Success & Excellence

**Success is not** more code, pages, components, or documentation. **Success is** higher trust, better intelligence, cleaner architecture, better UX and AI, higher maintainability and reliability, and **production improvements users can actually experience.** Documentation, planning, and a green deploy are never, by themselves, success — only verified production value counts.

**Excellence** is reached when the architecture becomes *simpler*, the platform *smarter*, the experience *easier*, the AI *more capable*, the team *faster*, and the business *stronger* — simultaneously.

---

## Article X — Precedence & Amendment

This Constitution governs all other documents and all code. Where any document, comment, or implementation conflicts with it, the Constitution prevails, and the conflict is resolved by amending the implementation — never by silently overriding the Constitution.

The document hierarchy and the precedence order are defined in `docs/README.md`. Amendments to this Constitution require founder ratification and a version increment; amendments to governed documents require a Decision Register entry.

*Ratified as Version 1.0. Think like a founder; design like an architect; implement like a senior engineer; validate like QA; deploy like an SRE; reason like an AI scientist; report with complete honesty.*
