# Tawveeri — Post-E15 Strategy 2026–2040
## Saudi Arabia's Neutral Product-Decision Layer & Commerce Intelligence Operating System

**Status:** strategy synthesis for founder approval — **not an implementation mandate**. No broad implementation begins until the founder approves this package.
**Governed by:** `TAWVEERI_CONSTITUTION.md`. **Grounded by:** `docs/POST-E15-GLOBAL-RESEARCH-AUDIT.md` (evidence tiers + sources).
**Fail-loud input note:** the source `.docx` brief and attachments were not in the workspace; this is synthesized from the founder's concept enumeration + repo docs + cited web research. Source-specific details I could not read are marked **UNKNOWN/REQUIRES VALIDATION**.

---

## 1. Executive summary

Tawveeri has completed its foundational platform track (E0–E15): a corroborated, provenance-complete **TPS canonical product graph** on a single authoritative system (System A), a **hybrid search authority** (comparison + resolved-single discovery, zero false comparison), **deterministic recommendations**, and **measured merchant exits** — all production-verified, with legacy System B operationally severed (ADR-042).

The next horizon is **not more surfaces** — it is turning the corroborated knowledge graph into **Saudi Arabia's neutral, trusted product-decision layer**, and ultimately a **Commerce Intelligence Operating System**: deepest local knowledge (climate, GCC variants, installation, total cost, regulation) × global interoperability (UCP-compatible, not UCP-dependent).

The 2026 agentic-commerce landscape is now real (VERIFIED): **UCP** (Google + major retailers, merchant-centric), **ACP** (OpenAI/Stripe/Meta, live in ChatGPT), **AP2** (Google, W3C-VC payment mandates), on **MCP/A2A**. Tawveeri's opportunity is to be the **Saudi-depth intelligence layer** that these protocols cannot encode, exposed through interoperable interfaces — while **never** subordinating user neutrality to commission and **never** requiring a merchant to be a commercial partner to be in the catalog.

**Three commitments frame everything below:**
1. **Merchant Independence** — catalog participation ≠ commercial partnership. Organic recommendation is *architecturally separated* from commission.
2. **UCP-First but protocol-neutral** — adopt the convergence standard, keep interop, avoid lock-in.
3. **Saudi Context First, privacy by design** — PDPL/SDAIA compliance is a hard constraint; payment execution is SAMA-gated (REQUIRES VALIDATION).

---

## 2. Non-negotiable principles (carried from the Constitution)

- Truth over optimism · Evidence over claims · **Unknown beats incorrect** · Fail Loud.
- **Saudi Context First.** Climate, GCC variants, installation, total cost of ownership, local regulation, Arabic-first.
- **User interest & neutrality over commission.** Commercial interest never enters ranking.
- **Product identity (TPS + DNA) over similarity.** Corroborate before asserting identity (≥2 stores).
- **Total cost & suitability over sticker price.**
- **Privacy & PDPL/SDAIA compliance by design.** Consent-based, minimized, data-subject rights.
- **Configuration over custom development.** Universal Merchant Connector is config-driven.
- **UCP-compatible but not UCP-dependent.**
- **Merchant catalog participation without requiring commercial partnership.**
- **Explicit approval before irreversible actions.** Deterministic engines decide; LLMs phrase.

---

## 3. Current verified state (the real foundation — evidence)

| Capability | State (production evidence) |
|---|---|
| Canonical product identity (TPS) | 94 corroborated (≥2-store) + 812 resolved-single; deterministic, provenance-complete |
| Hybrid search authority (E14) | `/api/v1/tps/search` Layer 1 comparison + Layer 2 discovery; 0 false comparison |
| Deterministic recommendations (E13) | `/api/v1/tps/recommendations`, explainable, no fabricated certainty |
| Measured exits | `/go/{offer}` → 302 + `outbound_clicks` + affiliate attribution; absolute URLs |
| Ingestion | 135,072 raw observations, actively scraping (System A) |
| Progressive batching | Durable-cursor sweep + `/api/cron/tps-progressive` (bounded, idempotent) |
| Category coverage | mobile, ac, tv, tablet, audio, camera live; laptop precise-but-0-corroboration; appliance deferred |
| Legacy severance (E15) | Zero operational dependency on System B (ADR-042) |

**This is the substrate the Post-E15 vision extends — not replaces.**

---

## 4. Vision & evolution

`website → comparison platform → Knowledge Graph + Agent → Saudi Commerce Intelligence OS`

Each stage is **additive and incrementally shippable**. The corroborated graph already exists; the agent and intelligence layers are built *on* it. The north star (Commerce Intelligence OS) is a 2030–2040 horizon reached by compounding, not a big-bang rebuild.

---

## 5. Architecture — components (with honest tiers)

> Legend: **[EXISTS]** in production · **[EXTEND]** of an existing asset · **[NEW-PROPOSAL]** · **[GATED]** on a validation/legal dependency.

### 5.1 Merchant Independence Principle + Universal Merchant Connector — **[NEW-PROPOSAL, config-driven]**
- **Principle:** a merchant appears in the catalog because Tawveeri *observes* it (public catalog/scrape/feed/UCP), **not** because it signed a commercial deal. Commission, if any, is a *separate* commercial layer that **never** affects ranking or inclusion.
- **Universal Merchant Connector (UMC):** a **configuration-driven** ingestion contract (extends today's `StoreAdapter` + store-config JSON). A new merchant is added by **config**, not custom code. Sources, in priority: **UCP/ACP product feed → structured feed → API → sanctioned scrape.**
- **Architectural separation:** ranking reads only the neutral canonical graph; the **Revenue Graph** (commission/attribution) is a *downstream, ranking-blind* system (see 5.9). This is the mechanism that makes "organic ≠ paid" *provable*, not just promised.

### 5.2 UCP-First but protocol-neutral — **[NEW-PROPOSAL over VERIFIED protocols]**
- Adopt **UCP** as the merchant-facing convergence interface (discover/compare/checkout/post-purchase); it is merchant-centric (retailer = merchant-of-record) — aligned with Merchant Independence.
- Keep **ACP** interop (ChatGPT Instant Checkout reach) and **AP2** interop (payment mandates) behind an **adapter/flag**. Expose Tawveeri's graph via **MCP** (as a tool for other agents) and **A2A** (agent interop).
- **Never** hard-depend on one protocol; a `ProtocolAdapter` layer isolates all of them so Tawveeri survives standard churn.

### 5.3 Two-Stage Agent Model — **[NEW-PROPOSAL; Stage 1 launchable early]**
- **Stage 1 — Decision Agent (launch early):** takes a *shopping task* (not a keyword), reasons over the Knowledge Graph + Product DNA + Saudi context, returns an explainable, neutral recommendation with total-cost + suitability + trade-offs. **Deterministic engine decides; LLM phrases** (ADR-002). No external protocol needed → shippable on today's substrate.
- **Stage 2 — Action Agent (later, GATED):** executes tasks — build cart, negotiate terms, checkout — via **UCP/ACP**; **payment execution is SAMA-gated (REQUIRES VALIDATION)**. Until cleared, Stage 2 stops at a *measured, pre-filled hand-off* (`/go` + UCP cart), not a payment.
- Explicit approval before any irreversible action (purchase). The agent proposes; the human authorizes.

### 5.4 Tawveeri Knowledge Graph (⊃ Product Graph) — **[EXTEND of TPS]**
- Superset of the Product Graph: products (TPS canonicals) + **Product DNA** + stores/merchants + **Store-Department coverage** + categories + Saudi-context facts (climate suitability, GCC variant, installation needs, regulatory flags, total-cost components) + relationships (compatible-with, replaces, requires-installation, part-of-household).
- Built on the existing canonical graph + `raw_observations` provenance. Nodes are corroborated; edges are typed and evidenced.

### 5.5 Product DNA — **[EXTEND]**
- A structured, deterministic **attribute genome** per canonical: category-plugin-derived specs + derived suitability signals (e.g., AC: BTU-for-room-size, inverter-for-KSA-climate, cooling-only vs heat-pump, installation class). Extends TPS `attributes`. Enables *reasoned* comparison ("why A over B for *your* task"), not similarity.

### 5.6 Household Product Graph + Predictive Lifecycle — **[NEW-PROPOSAL / FUTURE; GATED on consented data]**
- A consented model of what a household owns → predict replacement/upgrade/maintenance windows (e.g., AC filter, phone upgrade cycle). **PDPL-gated** (lawful basis, minimization). Availability of ownership data is **UNKNOWN/REQUIRES VALIDATION**; start from explicit user input + purchase hand-offs, never inference-without-consent.

### 5.7 Consumer Digital Twin (privacy-preserving) — **[NEW-PROPOSAL; PDPL-GATED]**
- A consented, minimized representation of a user's preferences, constraints (budget, home, climate zone), and history — used only to serve the user's own decisions. **Privacy by design:** on-device / consented server storage, purpose-limited, data-subject rights (access/delete/portability), **no marketing use without consent**. Never sold; feeds only the user's Stage-1 agent.

### 5.8 Merchant Digital Twin — **[NEW-PROPOSAL over observed data]**
- A model of each merchant's observed behavior: assortment, price dynamics, availability reliability, fulfillment/installation signals, department coverage. Derived from data Tawveeri already collects. Powers merchant intelligence products + **Data Quality as a Service** — **without** requiring the merchant's participation (Merchant Independence).

### 5.9 Action Graph + Revenue Graph & Revenue Engine — **[NEW-PROPOSAL; ranking-blind]**
- **Action Graph:** typed log of agent-executable actions and outcomes (searched, compared, exited, installed, returned) — the substrate for evaluation, lifecycle, and monetization.
- **Revenue Graph (ranking-blind):** a **downstream** system that maps outcomes → revenue (affiliate, data products, marketplace fees). **It cannot read into ranking; ranking cannot read from it.** This separation is the technical guarantee of neutrality. Measured via `/go` (already live).
- **Revenue Engine:** orchestrates the revenue models in §8.

### 5.10 Sovereign & Multi-Model AI Layer — **[STRONG GLOBAL DIRECTION + NEW-PROPOSAL]**
- A model-orchestration layer that (a) routes phrasing/intent tasks to the best available model, (b) supports **sovereign / in-KSA** model options where required by data residency, (c) keeps **all decisions deterministic** (models phrase, engines decide). Vendor-swappable by design.

### 5.11 Tawveeri Agent Benchmark & Evaluation Harness — **[NEW-PROPOSAL; permanent]**
- A **permanent Saudi-context benchmark**: representative shopping tasks (the AC journey below and dozens like it) with graded rubrics (neutrality, total-cost correctness, Saudi-suitability, no-fabrication, PDPL-safe). Every agent change is evaluated against it. This is the quality moat and the anti-regression guarantee.

### 5.12 Data Quality as a Service — **[NEW-PROPOSAL]**
- Sell *corroborated, provenance-complete* product/price/availability intelligence (never raw PII) to merchants/brands/analysts — a revenue stream that *reinforces* neutrality (it's about data quality, not ranking).

### 5.13 Installation & Services Marketplace — **[NEW-PROPOSAL / FUTURE; GATED]**
- A real KSA need (AC installation, delivery, setup). Connects total-cost reasoning to fulfillment. Execution + regulatory/licensing diligence **REQUIRES VALIDATION**; sequence *after* the decision layer is trusted.

---

## 6. Representative shopping journey (true task, not keyword search)

**Task:** *"I need an air conditioner for a 30 m² bedroom in Riyadh, quiet, low electricity bill, installed, under a sensible total budget."*

**Stage-1 Decision Agent (shippable on today's substrate):**
1. Parse the **task** → constraints: room 30 m² → ~24,000 BTU; Riyadh → extreme-heat climate → **inverter** (electricity) + reliable cooling; "quiet" → noise class; "installed" → **installation is part of total cost**; budget → total-cost, not sticker.
2. Query the **Knowledge Graph + Product DNA**: canonical ACs matching BTU/inverter/noise, corroborated ≥2 stores, with Saudi-suitability (heat-tolerance, GCC variant).
3. **Reason & explain** (deterministic): shortlist with *why* — BTU-for-room-fit, inverter savings estimate, noise, **total cost = unit + installation + est. annual electricity**, availability, trusted price across stores.
4. **Neutral output:** a Smart-Pick + alternatives, each with a **measured exit** (`/go`) and a labelled single-store option if not corroborated. **No commission influenced the ranking.**
5. **Stage-2 (later, gated):** offer to assemble a cart (UCP) incl. installation service; hand off pre-filled; **purchase requires explicit user authorization** and, for in-app payment, SAMA clearance.

This is the benchmark's flagship task (§5.11).

---

## 7. Parallel workstreams (dependencies · gates · critical path)

| # | Workstream | Depends on | Gate to advance | Tier |
|---|---|---|---|---|
| **W1** | **Catalog & Merchant Coverage** (UMC config-driven; Store-Department coverage; more categories) | existing adapters/TPS | evidence-based completeness gate per store/category (extends `CATALOG-COMPLETENESS-GATE.md`) | EXTEND |
| **W2** | **Knowledge Graph + Product DNA** | W1 data; TPS | DNA schema per category with corroboration; no fabricated attributes | EXTEND |
| **W3** | **Stage-1 Decision Agent + Benchmark** | W2 | passes the Saudi Agent Benchmark (neutrality/total-cost/no-fabrication) | NEW |
| **W4** | **Protocol Interop (UCP/ACP/AP2 adapters)** | W2; W3 | UCP feed round-trip in staging; no lock-in; flag-gated | NEW |
| **W5** | **Consumer/Merchant Twins + Consent Memory** | W2; **PDPL sign-off** | lawful-basis + minimization + DSR review passes | NEW (PDPL-gated) |
| **W6** | **Revenue Graph / Engine (ranking-blind)** | W1; measured exits | proven separation from ranking (audit) | NEW |
| **W7** | **Stage-2 Action Agent + Installation Marketplace** | W3; W4; **SAMA + licensing validation** | legal clearance; explicit-authorization UX | NEW (GATED) |
| **W8** | **Sovereign/Multi-Model AI orchestration** | W3 | deterministic-decides invariant preserved; residency where required | NEW |

**Critical path to first value:** **W1 → W2 → W3** (Decision Agent on the existing graph). W4–W8 run in parallel but **W3 is the near-term prize** and needs **no external protocol or payment clearance**.

---

## 8. Revenue model (broader than affiliate; neutrality-preserving)

All revenue is **ranking-blind** (§5.9). Streams:
1. **Measured affiliate** (live today) — attribution via `/go`; does not influence ranking.
2. **Data Quality as a Service** — corroborated catalog/price/availability intelligence to merchants/brands (no PII).
3. **Aggregated market intelligence** — anonymized, privacy-preserving demand/price trends.
4. **Installation & Services Marketplace fees** — later, gated.
5. **Merchant intelligence (Merchant Twin) subscriptions** — a merchant can *buy insight about itself/market* without buying ranking (impossible to buy ranking by design).
6. **Agent/API access** — Knowledge-Graph + Decision-Agent as an API (MCP/UCP) for partners.

**Separation guarantee:** organic recommendation and commission live in different systems with a one-way, ranking-blind boundary — auditable, not merely asserted.

---

## 9. Roadmap 2.0 (beyond E15)

| Phase | Theme | Outcome | Gate |
|---|---|---|---|
| **F1** | Coverage & DNA | UMC config-onboarding; Product DNA for live categories; Store-Department coverage metric | completeness gate per store/category |
| **F2** | Decision Agent (Stage 1) + Benchmark | Task-based neutral advice live; permanent Saudi benchmark | benchmark pass; neutrality audit |
| **F3** | Protocol interop | UCP/ACP/AP2 adapters (flagged); Tawveeri graph exposed via MCP | staging round-trip; no lock-in |
| **F4** | Twins & Consent Memory | Consumer/Merchant Twins; PDPL-compliant memory | PDPL sign-off |
| **F5** | Revenue Engine | Ranking-blind Revenue Graph; Data-Quality product | separation audit |
| **F6** | Action Agent + Marketplace | Stage-2 cart/checkout hand-off; installation services | SAMA + licensing validation |
| **F7** | Commerce Intelligence OS | Sovereign multi-model; agent/API platform; ecosystem | scale + trust metrics |

Each phase is independently shippable and evidence-gated (a phase is "done" only with production evidence — Constitution Art. IX).

---

## 10. Dependency graph (text)

```
                 [TPS canonical graph + provenance]  (EXISTS, E0–E15)
                              │
                 W1 Catalog & Merchant Coverage (UMC)
                              │
                 W2 Knowledge Graph + Product DNA
                    │            │            │
        W3 Decision Agent   W4 Protocol   W6 Revenue Graph
         + Benchmark         Interop       (ranking-blind)
             │                 │
             │                 └────────┐
        W8 Sovereign/Multi-Model    W7 Action Agent + Marketplace
                                         │  (GATED: SAMA + licensing)
        W5 Twins + Consent Memory  (PDPL-gated) ── feeds W3 personalization
```
**Critical path:** TPS → W1 → W2 → **W3**. Everything user-visible and defensible starts at W3 and needs no external gate.

---

## 11. 90-day plan (F1→F2 kickoff; credential/legal-free)

| Weeks | Deliverable | Evidence of done |
|---|---|---|
| 1–2 | **Store-Department coverage metric** + extend Catalog Completeness Gate per store×category; wire `/api/cron/tps-progressive` into the dispatcher (closes E7 continuous linkage) | scheduled run rows; coverage report |
| 3–5 | **Product DNA schema v1** for 2 live categories (ac, tv) — deterministic, corroborated, no fabrication | DNA populated for corroborated canonicals; unit tests |
| 4–6 | **Saudi Agent Benchmark v1** — 20+ representative tasks + rubrics (neutrality, total-cost, Saudi-suitability, no-fabrication) | benchmark harness runs in CI |
| 6–9 | **Stage-1 Decision Agent v0** over Knowledge Graph + DNA (deterministic decides, LLM phrases) — AC journey end-to-end (advice + measured exit, no payment) | passes benchmark ≥ threshold; live demo on staging |
| 8–10 | **Revenue Graph separation audit** — prove ranking-blind boundary | audit doc + test proving no ranking read/write path to revenue |
| 10–12 | **UCP/ACP adapter spike (flagged, staging-only)** + PDPL design review for Twins/Memory | UCP feed round-trip in staging; PDPL checklist |

**Explicitly out of the 90 days (gated):** payment execution (SAMA), installation marketplace (licensing), any PII feature without PDPL sign-off.

---

## 12. Risks & mitigations

| Risk | Tier | Mitigation |
|---|---|---|
| Protocol churn (UCP/ACP/AP2 evolve) | STRONG DIRECTION | `ProtocolAdapter` isolation; UCP-first but neutral |
| PDPL/SDAIA non-compliance | VERIFIED (enforced) | Privacy-by-design; PDPL sign-off gates W5; no PII in data products |
| SAMA payment rules unknown | UNKNOWN/REQUIRES VALIDATION | Stay a decision/attribution layer; Stage-2 stops at hand-off until cleared |
| Neutrality erosion (commission pressure) | Internal | Ranking-blind Revenue Graph; separation audit; Constitution |
| Fabricated identity/attributes | Internal | TPS corroboration; deterministic DNA; benchmark no-fabrication rubric |
| Saudi-merchant protocol adoption lag | UNKNOWN | UMC (participation without partnership) does not wait for merchants |
| Over-scope / big-bang | Internal | Incremental, evidence-gated phases; W3 first |

---

## 13. Stakeholder impact

- **Consumer:** asks a *task*, gets a neutral, total-cost, Saudi-suitable recommendation with trusted cross-store prices and honest single-store labelling — no hidden commission bias. Privacy respected (PDPL).
- **Merchant:** appears in the catalog *without a deal* (Merchant Independence); can *buy intelligence about itself/market* but **cannot buy ranking**; benefits from qualified, measured referrals.
- **Investor:** a defensible **Saudi-depth × global-interop** moat; multiple ranking-blind revenue streams; a compounding knowledge-graph asset with provenance; evidence-based, measurable completeness.

---

## 14. Governance — execution authority & escalation

- **Autonomous (no escalation):** category/DNA design, agent/graph engineering, config-driven merchant onboarding, benchmark, non-PII data work, roadmap sequencing, reversible deploys.
- **Escalate to founder:** legal/regulatory (PDPL edge cases, SAMA, licensing), contracts/commercial terms, major budget, **irreversible strategic decisions**, anything touching PII lawful basis, any payment-execution feature.
- **Always:** deterministic engines decide; explicit approval before irreversible actions; leave the system stronger; evidence over claims.

---

## 15. Final Completeness Audit (30+ items)

| # | Item | Status |
|---|---|---|
| 1 | E15 closed, not reopened, third-party caveat preserved | ✅ (ADR-042) |
| 2 | Production runs exclusively on System A | ✅ evidence |
| 3 | Merchant Independence Principle defined + architecturally enforced (ranking-blind revenue) | ✅ §5.1/5.9/8 |
| 4 | Catalog participation ≠ commercial partnership | ✅ §5.1 |
| 5 | UCP-First but protocol-neutral | ✅ §5.2 (VERIFIED protocols) |
| 6 | No UCP lock-in (ProtocolAdapter) | ✅ §5.2 |
| 7 | Two-Stage Agent Model, Stage 1 early | ✅ §5.3 |
| 8 | Tawveeri Knowledge Graph ⊃ Product Graph | ✅ §5.4 |
| 9 | Product DNA | ✅ §5.5 |
| 10 | Household Product Graph + Predictive Lifecycle | ✅ §5.6 (GATED) |
| 11 | Consumer Digital Twin (privacy-preserving) | ✅ §5.7 (PDPL-gated) |
| 12 | Merchant Digital Twin | ✅ §5.8 |
| 13 | Consent-based AI Memory | ✅ §5.7 (PDPL-gated) |
| 14 | Action Graph | ✅ §5.9 |
| 15 | Revenue Graph & Engine (ranking-blind) | ✅ §5.9/8 |
| 16 | Universal Merchant Connector (config-driven) | ✅ §5.1 |
| 17 | Sovereign & Multi-Model AI layer | ✅ §5.10 |
| 18 | Tawveeri Agent Benchmark (permanent) | ✅ §5.11 |
| 19 | Data Quality as a Service | ✅ §5.12/8 |
| 20 | Installation & Services Marketplace | ✅ §5.13 (GATED) |
| 21 | Representative shopping journey as true task | ✅ §6 |
| 22 | Parallel workstreams w/ dependencies + gates + critical path | ✅ §7/10 |
| 23 | Roadmap 2.0 | ✅ §9 |
| 24 | Dependency graph | ✅ §10 |
| 25 | 90-day plan | ✅ §11 |
| 26 | Revenue model broader than affiliate | ✅ §8 |
| 27 | Separation of organic recommendation from commission | ✅ §5.9/8 |
| 28 | Risks + mitigations w/ tiers | ✅ §12 |
| 29 | Consumer/Merchant/Investor impact | ✅ §13 |
| 30 | Execution authority + escalation rules | ✅ §14 |
| 31 | Evidence tiering for every external claim | ✅ Research Audit |
| 32 | PDPL/SDAIA compliance by design | ✅ §2/5.7/12 |
| 33 | Saudi Context First (climate/GCC/installation/total-cost/regulation) | ✅ §2/5.4/6 |
| 34 | Total cost & suitability over sticker | ✅ §6 |
| 35 | Product identity (TPS+DNA) over similarity | ✅ §5.4/5.5 |
| 36 | "Do not implement until approval" honored | ✅ this is strategy only |
| 37 | Fail-loud on missing source docs + unknowns | ✅ header + tiers |
| 38 | Arabic executive brief | ✅ delivered to founder (chat) |

**Gaps flagged (fail-loud):** SAMA agentic-payment rules (REQUIRES VALIDATION); Saudi-merchant UCP/ACP adoption (UNKNOWN); household-ownership data availability (REQUIRES VALIDATION); source `.docx` specifics (UNKNOWN — not in workspace).
