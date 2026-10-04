# TAWVEERI — GLOBAL MASTER STUDY, PHASE 2: GLOBAL COMPLETION & STRATEGIC VALIDATION

**Prepared:** 2026-09-06 · **Mode:** READ-ONLY RESEARCH — RECOMMENDATIONS ONLY, NO IMPLEMENTATION.
**Relationship to Phase 1:** this document does not defend `docs/report/AI-NATIVE-GLOBAL-STUDY-SEPTEMBER-2026.md`. It corrects it where the evidence requires (§A, §AC-flagged items), and extends it into the areas the founder/reviewer identified as materially under-covered: mature global platforms (China, Korea, SEA especially), the full marketing/distribution system, actual social-account inspection, merchant acquisition economics, and "how does commerce itself change" rather than a model-price comparison.
**Method:** nine parallel external research passes across two waves (the first wave partially failed to a session-wide rate limit; five tasks were relaunched solo-mode and completed). All findings labeled `PRIMARY_SOURCE` / `INDEPENDENT_SOURCE` / `SELF_REPORTED` / `ESTIMATE` / `INFERENCE` / `ASSUMPTION` / `UNKNOWN`. Absolute words ("everyone," "nobody," "all," "market converged") are avoided or explicitly qualified per the reviewer's instruction.

---

## A. ORIGINAL-MANDATE COVERAGE AUDIT

Re-read against the original 62-section founder mandate. Ledger below; Phase 2 sections that close a gap are cited.

| Original section | Phase-1 status | Phase-2 disposition |
|---|---|---|
| 0. Verify contemporary AI claims | PARTIALLY COVERED — GPT-6 Astra/Grok/Gemini verified, but OpenAI ACP status was **wrong** | **CORRECTED** — §D.1, §AC |
| 1. Real Tawveeri baseline | FULLY COVERED | unchanged |
| 2-3. Competitor universe + AI maturity | FULLY COVERED (Saudi) / WEAK (global, China/Korea/SEA absent) | **CLOSED** — §B-F |
| 4-15. AI architecture, multi-agent model | FULLY COVERED, though role-by-role breakdown for 14 named agent roles was skipped | **PARTIALLY CLOSED** — §S |
| 16-19. AI marketing/content/social/acquisition | WEAK — thin, theoretical | **CLOSED** — §G, §H |
| 20-30. AI retention/merchant/revenue/engineering/security/governance | MOSTLY COVERED | §I extends retention |
| 31-34. Vendor dependency, data model, data needed, catalog study | WEAK/MISSING | Not deeply re-attempted this pass — flagged as still open in §Y |
| 35-37. Merchant cooperation, B2B product, commission study | COVERED | **DEEPENED** — §J-N |
| 38-40. Growth, SEO/AEO/GEO, original research | PARTIAL (growth), FULL (SEO/AEO/GEO), FULL (original research) | **Growth CLOSED** — §G |
| 41. Apps/extensions/WhatsApp/Telegram | WEAK — one line on Telegram | **CLOSED** — §G |
| 42. Social media competitive audit | MISSING — no actual inspection | **CLOSED** — §H |
| 43-51. Shoof deep dive, Saudi map, feature matrix, 30 ideas, moat, failure studies | FULLY COVERED | Feature matrix **EXTENDED** — §T |
| 50. Economics | WEAK — rate cards only, no framework | **CLOSED** — §L, §M |
| 52-60. End state, build/buy, prioritization, maturity scorecard, threat map, source quality | COVERED, though 59's AI-specific 90-day plan was merged into a general one and 60's source ledger was labels-only, no URLs | **Source ledger built** — §AC |
| 61-62. Final deliverable structure, stop condition | MATCHED | Phase-2 structure below matches the mandate's own A-AD request |

**Honest self-assessment:** Phase 1's single most consequential error was the OpenAI Instant Checkout "retirement" claim (§D.1 below) — it was wrong on the headline fact, not just imprecise. The reviewer's instinct to demand re-verification was correct. Two other claims required real correction, not just softening: the "preference-memory white space" claim (false — Google Gemini has a named, documented memory toggle) and the GitHub-stars-as-MCP-demand substitution (the specific repos cited could not even be re-located). All three are corrected below with the re-verification evidence, not silently fixed.

---

## B. GLOBAL MATURE PLATFORM MAP

Operating-model analysis (not a company list), organized by region. Each platform researched against: consumer value proposition, data model, price history, identity, AI, personalization, retention, merchant onboarding/monetization, agentic direction, what compounds, what failed, what Tawveeri should learn. Full detail in §C-F; this table is the cross-region summary.

| Platform | Region | Core insight for Tawveeri |
|---|---|---|
| Taobao/Tmall + Qwen | China | Full-stack AI layered on an existing marketplace; **profitability collapsed** (operating margin 14%→5%) funding it — a real cost signal, not just a feature list |
| SMZDM | China | Content+community+price-truth at ~$1B market cap nets only 5-6% net margin; core is shrinking, backfilled by low-margin agency services — **cautionary**, not a template |
| Manmanbuy | China | Pure price-history play; **B2B price-monitoring service line (historically $1.4K-$14K+/client per a 2020 source, current pricing unverified)** is the most directly transferable revenue *model* in this whole study |
| JD.com | China | Merchant AI tooling (AIGC, procurement agents) is **free** — confirms merchant-tooling is a platform-retention subsidy, not a sellable product at small scale |
| Google Shopping/AI Mode | US | Shopping Graph 50B+ listings; UCP/AP2 coalition (Amazon, Shopify, Walmart, Microsoft, Meta, Stripe); agentic checkout **requires explicit user approval always** — not autonomous; recurring antitrust self-preferencing findings |
| Amazon/Alexa for Shopping (renamed from Rufus, 2026-05-13) | US | Independently validated real adoption (Sensor Tower: 2.74× conversion lift); hostile to third-party agents |
| OpenAI/ChatGPT/ACP | US | **NOT retired** — live, actively committed through July 2026; but the checkout coalition consolidated around Google's UCP, not OpenAI's ACP |
| idealo, PriceSpy/Prisjakt, PriceRunner/Klarna, Geizhals, Keepa | Europe | CPC (idealo/PriceSpy/PriceRunner) is the surviving neutral model; idealo started narrow (consumer electronics only) on ~€500K; Klarna backed Google's UCP (Feb 2026), an implicit concession |
| Kakaku.com | Japan | Comparison segment flat for 29 years at 53% margin; durable value came from an adjacent UGC vertical (Tabelog), not comparison itself |
| **NAVER** | Korea | The single most relevant global precedent: comparison (2000) → payments → membership → community UGC → **AI Tab agent** (4M→10M users in 6 weeks); markets itself on **"60-70% decision-time reduction,"** not catalogue size |
| BuyHatke, MySmartPrice | India | Small, capital-efficient, ~10-year-old businesses with no institutional capital — proof a comparison site can survive indefinitely without funding |
| **Priceza** | SEA | 50M+ listings, 16 years, **zero AI features as of Sept 2026** — the clearest cautionary tale that catalogue scale does not automatically become intelligence |
| **ShopBack** | SEA | Cashback/CPA at 30M users, 13 markets; structurally immune to the Honey-style attribution scandal because its click originates at ShopBack itself, not injected at checkout |

---

## C. CHINA DEEP DIVE

### C.1 Alibaba / Taobao / Tmall / Qwen — the full-stack-plus-agent model, and its real cost

**Governance-level commitment, not just a feature (PRIMARY_SOURCE, Alibaba Q2 2026 earnings, 2026-08-20):** a June-2026 segment reorganization created a standalone **"AI Labs and Applications"** reporting segment housing the AI model labs, the Qwen Consumer Business Group, and QwenWork — "to integrate the full value chain from AI model innovation through to consumer applications."

**Scale, real not demo-stage:** "250 million users have had their first AI-driven shopping experience through Qwen app's agentic features" (PRIMARY_SOURCE, Aug 2026); independently, Wikipedia cites 234M Qwen app users (May 2026). The Qwen Shopping Assistant inside Taobao spans "idea inspiration to after-sales services," including **order management** — the agent's scope explicitly extends into transactions, though the exact autonomy level (human-confirm vs. delegated spend limit) is UNKNOWN from IR materials.

**The real cost — profitability collapsed, disclosed candidly:**
- FY2026 operating margin fell from 14% to **5%**; Q1 FY2027 operating margin 6% (down from 14% YoY), income from operations down 57% YoY.
- The AI Labs/Applications segment ran an EBITA loss of RMB13,861m in Q1 FY2027 (>4× its prior-year loss), **explicitly attributed to "higher inference cost related to Qwen app."**
- Free cash flow swung to an outflow of RMB44,670m in one quarter, driven by AI capex (+75% YoY) plus Qwen user-acquisition spend.
- Sales & marketing expense rose from 15.0% to 21.9% of revenue (Q4 YoY), **explicitly attributed to "user acquisition of Qwen app."**

**Merchant side:** Wukong (AI-native enterprise agent for merchant workflow automation) and Accio/Accio Work (AI sourcing + full-lifecycle agentic platform for cross-border SMBs) rolled out Jan-Mar 2026. A "business development program" ties platform subsidies to merchant ad spend — booked as contra-revenue, which mechanically suppressed reported Customer Management Revenue growth even as like-for-like growth also genuinely decelerated (+8% → +1% across three quarters).

**Third-party agent access: UNKNOWN, likely closed.** Alibaba's own Qwen-Agent framework is an MCP *client* (consumes external servers), not a server exposing Taobao to outside agents. No evidence either way was found for a Taobao-run MCP server or open agentic-checkout API for OpenAI/Perplexity-class agents.

**Lesson for Tawveeri (INFERENCE):** "layer AI onto an existing full-stack marketplace" is a real, executing playbook — but even a company with Alibaba's balance sheet is running it at a **real, disclosed, currently-widening loss**, driven specifically by inference cost outpacing monetization. This is direct evidence against any assumption that "add an AI agent" is a cheap or self-funding move at any scale, small or large.

### C.2 SMZDM (什么值得买, 300785.SZ) — the most directly relevant precedent, and a warning

**What it is:** founded 2010, listed on Shenzhen ChiNext 2019; a content+community+deal-curation platform (UGC deals reviewed editorially, long-form reviews, product wiki, contributor reputation tiers). Market cap ~$1.0B (INDEPENDENT_SOURCE, Sept 2026).

**Financials, the central finding:**

| FY | Revenue (CNY M) | Net income (CNY M) | Gross margin | Net margin |
|---|---|---|---|---|
| 2021 | 1,403 | 179.5 | 57.1% | 12.8% |
| 2023 | 1,452 | 74.8 | 48.4% | 5.2% |
| 2025 | 1,288 (−15.2% YoY) | 86.5 | 50.2% | 6.7% |

**A ~15-year-old, ~$1B-market-cap content+community+price-truth business nets only 5-7% net margin on 48-57% gross margin.** Gross margin has eroded from 57% (2021) to ~50% (2025).

**The segment-mix warning:** H1 2026 "运营服务" (agency operations — running Douyin/Tmall/JD storefronts *for brands*) grew +136.6% YoY to roughly **60% of total revenue**, at roughly half the group's blended gross margin. `INFERENCE`, well-supported by the margin trend: **SMZDM's content/affiliate core is shrinking and being backfilled by low-margin labor-services revenue.** The "price-truth community" is the credibility asset that lets them sell services — not the growth engine itself.

**GMV/take-rate:** H1 2025 confirmed GMV 8.784B CNY across 88.72M orders (AOV ≈ 99 CNY / ~$14). Blended revenue/GMV ≈ 6.7%, but true affiliate take rate is likely materially lower (2-4%) since agency/ad revenue inflates the numerator without matching GMV.

**AI move — the pattern worth copying, twice-independently-confirmed in China:** SMZDM launched **Haina, an MCP server exposing its consumer-content corpus** (12 billion content records, 1 billion product records, claimed) to third-party LLMs in May 2025. By H1 2026: 40+ LLMs/agents integrated (Alibaba Cloud Bailian, Moonshot/Kimi, Zhipu, Baichuan, Douyin, Huawei), **2.24 billion content-output calls in H1 2026, +474% vs. H2 2025.** AI-attributed revenue: 68.5M CNY = 11% of total, first time above 10%. **Manmanbuy launched an essentially identical MCP move four months later (Sept 2025)** — two of China's oldest price-truth platforms independently reached the same conclusion.

**What compounds:** the 15-year editorially-reviewed corpus (the only asset that got *more* valuable when LLMs arrived); contributor reputation (non-portable status); editorial review of UGC (the trust gate).
**What struggled:** affiliate-commission dependency (hostage to platform policy); deal-hunter disloyalty (structurally low retention — engagement decayed even before the AI pivot); the community-vs-commerce monetization tension (well-documented in Chinese business press).

### C.3 Manmanbuy (慢慢买) — the pure price-history play, and its B2B line

Founded 2010; explicitly positions price-history as **fake-promotion detection** ("查历史价格走势... 不让你花冤枉钱" — don't let you waste money). Claims 95%+ platform/product coverage across Taobao/Tmall/JD and 100+ platforms.

**Monetization, the single most transferable finding in this whole Phase-2 pass — with its date now correctly labeled:**
- **C-side:** CPS commissions, partially rebated to members (users are paid to route through them).
- **B-side:** **API access + a SaaS price-monitoring platform + custom projects, priced at tens of thousands to 100,000+ CNY per client (~$1,400-$14,000+)** — sold to brands/merchants who need to police unauthorized/grey-market pricing.

**Hardening correction — date the evidence correctly.** This B-side pricing figure traces to a 36Kr interview, dated **2020**, not a 2026 rate card. A narrow re-check this pass (direct fetch of `manmanbuy.com/about.aspx`) returned a 404 and surfaced no current B2B pricing or enterprise-services page. **Status: HISTORICAL VERIFIED COMMERCIAL PRECEDENT (2020), not a current 2026 rate card. Current price = UNKNOWN.** The business-model *lesson* is not weakened by this — a real company charged real brands a real five-figure sum for exactly this service, proving the model clears a commercial bar — but the specific number must not be repeated as "Manmanbuy charges this today."

This is a **five-figure-per-client (as of 2020; current pricing unverified), low-headcount revenue line that does not require consumer scale** — directly relevant to a founder-run team as a *model to validate*, not a *rate to copy*.

**Risk disclosed honestly:** cited by regulators (Nov 2023, and a 2025 security notice) for data collection beyond stated function — a live reminder that a price-comparison app's data appetite is a real regulatory exposure (directly relevant given Saudi PDPL).

**Sept 2025:** launched an MCP service exposing real-time pricing/coupon/attribute data to AI apps — the same pattern as SMZDM's Haina, independently arrived at.

### C.4 JD.com — merchant tooling is free; the procurement-agent frontier is real

- **京东商智 (JD Business Intelligence):** freemium merchant analytics; free tier standard for all JD sellers.
- **京点点 (Jingdiandian):** JD's AIGC platform for merchants (product imagery, marketing copy, livestream scripts, 20+ content types) — **free** to all JD merchants; >1 million AIGC requests/day claimed.
- **618 2026 ("first fully AI-integrated 618"):** AI supported >1 million merchants across diagnostics, merchandising, marketing, livestream conversion, customer service; "Super Brain LLM" routing across 1,000+ logistics scenarios.
- **JoyIndustrial** (announced May 2026): an AI model specifically for industrial supply-chain procurement — demand forecasting, procurement, compliance, fulfillment — trained on 10M+ industrial SKUs and 8M enterprise clients; featured in a World Economic Forum white paper (July 2026, external validation).

**Structural lesson:** both Alibaba (Business Advisor, now free per most reports) and JD made merchant analytics and AIGC content tools **free** — this is a platform-retention subsidy at hyperscale, not a viable standalone product line for a small startup. Directly informs §Q (what becomes commodity).

### C.5 Xiaohongshu (RedNote) — the discovery layer with no price-truth angle

300M+ MAU, ~$3.7B revenue (2023), ~76% ad-revenue share. Functions on **种草 ("grass-planting")** — first-person subjective-experience content, not structured price data. **No native price history, cross-merchant comparison, or price verification found.** Search-ad CPM for intent-stage inventory (~106-153 CNY) runs 2.5-3× feed-ad CPM (~39-56 CNY) — direct evidence that **intent-stage placement monetizes multiples higher than discovery-stage**, a principle that transfers directly to Tawveeri's own comparison-result-page inventory. Xiaohongshu and price-truth tools (SMZDM, Manmanbuy) are complements, not substitutes — SMZDM's financials show the cost of trying to be both.

### C.6 China — adopt / ignore for a 1-3 person, unfunded Saudi startup

| Adopt | Ignore |
|---|---|
| Keep the price-history corpus append-only forever — it's the only asset that appreciated when LLMs arrived (both SMZDM and Manmanbuy) | Do not build **generic, single-merchant** analytics as a product — the category leaders made *that specific kind* free (see §N.1 for the distinction between commoditized generic tooling and still-defensible proprietary market-wide data) |
| Expose the corpus via MCP to AI agents — proven twice, independently, within 4 months in China | Do not build AIGC listing/image generation for sellers — JD gives it away free at scale |
| Sell price-monitoring to brands (Manmanbuy's model) — a real five-figure-per-client line at zero consumer scale | Do not build a multi-platform merchant ERP — solves a cross-border pain Saudi single-market retailers don't have |
| Gate community submissions with deterministic/editorial review, always | Do not chase social-discovery content (Xiaohongshu-style) — capital-intensive, doesn't answer the price question anyway |
| Protect intent-stage placement (comparison results) — it monetizes multiples higher than discovery content | Do not assume affiliate CPS alone is a business — SMZDM at ~$1B cap nets 5-7% |
| — | Do not backfill core revenue with agency/services labor — this is what's actively hollowing out SMZDM's margin |

---

## D. US DEEP DIVE

### D.1 OpenAI / ChatGPT / ACP — CORRECTION, read this before citing anything from Phase 1 on this topic

**Phase 1 claimed:** Instant Checkout was "retired around March 2026 after ~6 months," with "~30 of a promised million merchants ever live" and "Walmart reported 3× worse in-chat conversion."

**Re-verified against OpenAI's own current developer docs (PRIMARY_SOURCE, `developers.openai.com/commerce/`, checked September 2026): this is wrong on the headline.** The Agentic Commerce Protocol (ACP) is **not retired**. The specification repo shows commits through **2026-07-18**; the latest stable release is dated **2026-04-17** with cart/feed/orders/authentication/MCP integration; governance documentation describes ongoing joint OpenAI/Stripe stewardship moving toward a neutral foundation. **Meta signed the ACP contributor CLA** (commit 2026-06-04). Status is explicitly **"beta."** Merchant onboarding remains gated ("available to approved partners," apply at `chatgpt.com/merchants`) — not closed.

**The "~30 merchants" and "Walmart 3× worse conversion" figures could not be verified against any reachable primary or independent source and should be struck**, not repeated with a caveat.

**What is real and correctly captures the underlying intuition:** the checkout coalition **forked**, and OpenAI is on the smaller side of it.
- **Shopify explicitly demotes ChatGPT to "a discovery-focused referrer platform"** — purchases complete "on your online store's checkout" via in-app browser/new tab. By contrast, Shopify says **Google AI Mode/Gemini, Microsoft Copilot, and Meta "support direct checkout if activated."**
- **Klarna's ChatGPT app (May 2026) also redirects to the merchant's site** to complete purchase — not in-chat checkout, despite Klarna building a "100M products, 400M prices" feed for it.
- **UCP (Universal Commerce Protocol, `ucp.dev`)** — co-developed by Google, Shopify, Etsy, Wayfair, Target, **Walmart**, **Amazon**, Microsoft, **Meta**, Salesforce, Stripe, plus 50+ endorsing merchants — carries the industry's checkout weight. **OpenAI is not listed as a UCP co-developer.**
- Stripe documents both protocols side by side and supports either.

**Corrected implication for Tawveeri:** the pattern that survived on ChatGPT specifically — discovery in-chat, checkout on the merchant's own site — is **structurally identical to Tawveeri's existing `/go` exit-link model.** This is a genuine tailwind for the comparison/aggregator category on the one platform (ChatGPT) that tried hardest to disintermediate it, not a reason to fear it.

**Hardening note (do not conflate these two facts):** "ACP the protocol is alive" and "the original Instant Checkout product is unchanged" are two different claims, and only the first is fully re-confirmed. OpenAI's own March 24, 2026 post, titled "Powering Product Discovery in ChatGPT," is founder-cited and describes OpenAI concluding that the initial Instant Checkout experience did not give it the flexibility it wanted, and repositioning around **product discovery** while merchants use **their own checkout**. A direct re-fetch of `openai.com/index/powering-product-discovery-in-chatgpt/` this pass returned HTTP 403 (OpenAI's marketing domain blocks this session's fetch tool), so the exact wording could not be independently re-quoted in this session — this is disclosed as `UNVERIFIED_RECALL` for the specific March 24 text, not silently treated as confirmed. It is, however, **fully consistent with, and not contradicted by**, what *was* independently verified in Wave 2 (`developers.openai.com/commerce/`, PRIMARY_SOURCE): ACP is "currently in beta," onboarding is "available to approved partners" only, and OpenAI is explicitly not merchant of record. Three separate claims should never be collapsed into one:

| Claim | Status |
|---|---|
| **ACP the protocol** (spec, cart/feed/orders/auth/MCP integration, governance) | **ACTIVE** — live commits through July 2026, PRIMARY_SOURCE |
| **The original Instant Checkout experience** (OpenAI-hosted, in-chat transaction completion as first launched Sept 2025) | **DE-EMPHASIZED / CHANGED** — per OpenAI's own cited March 24, 2026 repositioning; not independently re-quoted this session (403), so treat the exact wording as `UNVERIFIED_RECALL`, the *direction* as consistent with independently-verified evidence |
| **Merchant-owned checkout + ChatGPT-as-discovery** | **CURRENT OpenAI direction** — corroborated independently by Shopify's own characterization of ChatGPT as "a discovery-focused referrer platform" completing purchases "on your online store's checkout" |

Neither side should be overstated: ACP is not dead, and Instant Checkout was not "always fine." The corrected, decision-relevant fact for Tawveeri is the third row — merchant-owned checkout with the platform as a discovery/referral layer is where OpenAI, Shopify, and Klarna's ChatGPT integration all now sit, which is the fact that validates Tawveeri's own `/go` model.

### D.2 Google Shopping / AI Mode / Merchant Center — full operating model

**Scale:** Shopping Graph grew from 45B listings (Oct 2024) to **50B+ listings, 2B updated hourly** (Nov 2025) — SELF_REPORTED but consistent across independent disclosures.

**Product identity:** GTIN is "strongly recommended," not hard-required; Google's own docs frame GTIN's job as enabling query/category matching and cross-country/language recognition. **The actual clustering/dedup algorithm is undocumented** — Google treats it as proprietary, exactly as any serious comparison engine must. `INFERENCE`: Google's model (merchant-declared-identifier-first, corroborating opportunistically) is structurally the inverse of Tawveeri's own "corroborate ≥2 stores before asserting identity" — Tawveeri's stricter standard is a defensible precision advantage, not an inferiority, given widely-documented industry GTIN misuse.

**Agentic commerce — the current shipped state, not the aspirational one:**
- **Agentic checkout in Search/AI Mode** — live since Nov 2025, US-only, named merchants Wayfair/Chewy/Quince/select Shopify, runs on Google Pay, **"not fully autonomous" — always requires explicit user approval before purchase/shipping confirmation.**
- **"Let Google Call"** — AI phones local stores to check price/availability, discloses it is calling on the customer's behalf, merchants can opt out.
- **Universal Cart** (launched US, May 2026) — cross-surface (Search/Gemini/YouTube/Gmail), cross-day cart persistence with native price-history/drop alerts. Rollout: US → Canada/Australia "coming months" → UK later. **No Middle East date announced anywhere.**
- **AP2 (Agent Payments Protocol)** — cryptographically signed Verifiable Digital Credentials, Checkout/Payment Mandates for tamper-evident authorization, live v0.2 with code samples; FIDO Alliance committed to standards work around it.

**Regulatory pattern, recurring not historical:** a German court ordered Google to pay **€465M-€572M** (sources conflict on the exact figure — Reuters/Heise/idealo's own press release say €465M against a €3.3B claim; one independent tech-press source says €572M — **treat the precise number as unresolved pending direct verification, but the fact of a major 2025 antitrust loss on price-comparison self-preferencing is confirmed by multiple sources**) for price-comparison antitrust violations, Nov 14 2025. A fresh EU antitrust probe into Google's AI search tools opened Dec 9, 2025. **Self-preferencing risk in shopping rankings is not settled 2017 history — it recurred at Google's own scale in 2025-2026.**

**What Google itself abandoned once already:** "Shopping Actions / Buy on Google" (2018, first-party checkout via Assistant/Search) — Google tried owning checkout and moved away from it toward the current protocol-based (UCP/AP2), merchant-keeps-checkout model. **This validates Tawveeri's own never-intermediate-checkout architecture as directionally aligned with where even Google ended up**, not a limitation.

**Hardening correction — Amazon Auto-Buy already crosses into delegated, unattended execution; do not claim otherwise.** The Aug-27, 2026 internal Phase-0 research (`docs/AGENT_ERA_PHASE0_RESEARCH_2026-08-27.md`, PRIMARY-sourced at the time, re-affirmed here rather than re-fetched this pass — Amazon's own help/news domains returned 404/403 to this session's fetch tool on retry) already found and labeled CONFIRMED: Amazon offers **Auto-Buy** — a Prime user sets a target price, Alexa/Alexa-for-Shopping monitors it, and **when the condition is met, Amazon automatically places the order using the default payment method and address, checked roughly every 30 minutes, with a post-purchase notification and a defined cancellation window** — with no per-transaction human confirmation at the moment of purchase. This is a real, shipped, three-tier distinction the rest of this document must use consistently:

| Tier | Definition | Example found in this study |
|---|---|---|
| **Per-transaction human confirmation** | A human explicitly approves each specific purchase at the moment of purchase | Google's agentic checkout (Wayfair/Chewy/Quince/Shopify, "not fully autonomous"); Grok Bot's Tesla purchase (human-confirmed payment) |
| **Pre-authorized / bounded delegated authority** | A human sets the rule and bounds once (a target price, a spend cap); the system executes autonomously within those bounds with no per-purchase confirmation | **Amazon Auto-Buy** — this is the one clearly-evidenced instance in this entire study |
| **Unbounded autonomous spending** | No human-set bound of any kind | **Not found anywhere in this study, at any platform** |

Every prior claim in this document implying "every platform requires per-transaction confirmation" or "unattended checkout has not appeared" is corrected by this distinction: it should read **"per-transaction confirmation is the norm at every platform studied except Amazon, whose Auto-Buy is a bounded, pre-authorized delegation — not per-transaction, and not unbounded either."** This is decision-relevant specifically because it means the industry has already crossed into delegated execution at consumer scale, just narrowly (single-retailer, price-only trigger, defined cancellation window) — not that autonomous commerce is imminent broadly.

**What failed/struggled, current not just historical:** TechCrunch's own May 2026 coverage of Google's I/O agent rollout criticizes fragmented sub-branding, a $100/mo Ultra-tier gate on the most capable agents, and disconnection from consumers' actual daily pain points — with SMS-native competitors (Poke, Poppy, RPLY, Wingman) cited as having a lower-friction interface. **Consumer adoption of "agentic" framing is genuinely uncertain even for Google — do not assume Saudi consumers want autonomous purchasing over better-trusted comparison without evidence.**

**Merchant side:** the legacy Content API for Shopping sunset Aug 18, 2026 (progressive errors from Sept 1, 2026) — every integrated retailer must migrate to the new Merchant API, a live, current-quarter forced event as of this report. Performance Max (auction-based Shopping ads) has a well-documented "black box" transparency problem (up to 85% GA4/Google-Ads data gaps for PMax-heavy accounts).

**AI traffic is real, if unverified precisely:** "AI traffic to US retailers rose 393% in Q1 2026, and it's boosting their revenue too" (a reported/aggregated figure, methodology not independently verified this pass) — directionally the strongest available signal that AI-mediated shopping surfaces are becoming a real merchant acquisition channel, relevant to any future Tawveeri merchant pitch.

### D.3 What Tawveeri should learn from the US deep dive

1. Identity/matching is every serious player's real, undisclosed IP — Google's own GTIN-first approach still needs undocumented clustering logic behind it.
2. Google abandoned owning checkout once already; Tawveeri's `/go`-never-intermediate model is validated by where even the biggest platform ended up.
3. The emerging moat is **session/cart persistence across days and surfaces**, not any single feature — achievable at small scale via persistent comparison lists and alert-driven re-engagement, without needing Google's surface breadth.
4. Self-preferencing risk is not hypothetical or dated — Tawveeri's constitutional "commercial interest never enters ranking" is cheap insurance against the exact failure mode regulators fined Google for in 2025-2026.
5. Do not over-index on "AI agent" positioning for Tawveeri's own roadmap without in-market evidence Saudi consumers want autonomous purchasing — Google's own I/O 2026 critique shows this is unproven even at Google's scale.

---

## E. EUROPE DEEP DIVE

Extends Phase 1's idealo/PriceSpy/PriceRunner/Geizhals/Keepa coverage with operating-model detail not previously captured.

- **idealo's founding shape is the direct precedent for Tawveeri's stage:** launched 2000 on roughly €150K equity plus a €350K KfW loan, **deliberately restricted to consumer electronics only** before broadening to household/garden/auto. Reached ~39,000 merchants and €113.3M revenue (2018) from that narrow start. Merchants choose contractually between **fixed CPC or a percentage of realized revenue** — the merchant, not idealo, picks the settlement model.
- **PriceSpy's own words on neutrality, confirmed direct from its own site:** "nobody can pay their way to a higher ranking" — this coexists with being CPC-funded (pay-per-click to merchants), i.e. **neutrality is a governance claim independent of the revenue model**, not a contradiction.
- **PriceRunner is confirmed pure pay-per-click** ("financed by advertisers, who pay on a pay per click model").
- **Klarna backed Google's UCP** (Feb 2026 press release) — six weeks after launching its own "Agentic Product Protocol" (100M products, 400M prices, Dec 2025) with zero disclosed adoption metrics. `INFERENCE`: this reads as Klarna implicitly conceding a single-vendor protocol was not going to win, six weeks after launching one.
- **The 2025 antitrust wave is bigger than idealo alone:** PriceRunner won **US$1.97 billion** from Google (July 2026, damages+interest, ~2× its reported acquisition price) — subject to appeal and heavily shared with former shareholders and a litigation funder, cash-in-hand assumed at zero.

**Merchant-onboarding precedent directly reusable:** Google's own 2020 pivot to free Shopping listings ("It's now free to sell on Google") was explicitly to rebuild merchant *supply* when it needed it — paired with Shopify/WooCommerce/BigCommerce platform partnerships so merchants needed zero engineering to participate. This is the direct precedent for Tawveeri's own merchant-onboarding tiering (§J, §K).

---

## F. JAPAN / KOREA / INDIA / SEA

### F.1 Kakaku.com (Japan) — unchanged from Phase 1; the lesson stands (comparison segment flat 29 years at 53% margin, real value came from Tabelog, an adjacent UGC vertical, being fought over at ~$4.9B in a live bidding war).

### F.2 NAVER (Korea) — the single most important new finding in Phase 2

**A 26-year compounding arc, each step verified (PRIMARY/INDEPENDENT_SOURCE, Wikipedia + NAVER's own press releases):**

| Year | Step |
|---|---|
| 2000-09 | Naver Shopping launches **as a price-comparison service** — the identical entry wedge Tawveeri occupies |
| 2003 | Comparison merges into general search ("Knowledge Shopping") |
| 2014 | Store Farm — **zero entry fees** for merchants, a supply-side land grab |
| 2015-06 | Naver Pay launches, closing the comparison→checkout→payment loop first-party |
| 2018 | Smart Store rebrand; **Biz Advisor** merchant analytics |
| 2020-06 | **Naver Plus Membership** — up to 4-5% Naver Pay points, a loyalty flywheel that makes leaving to compare elsewhere economically irrational |
| 2025-03 | **NAVER Plus Store** launches as a standalone app, AI recommendations via HyperCLOVA X |
| 2026-04→06→07 | **AI Tab** beta → launch → agentic shopping |

**AI Tab — the North Star metric Tawveeri should adopt:**
- Beta (April 2026) → 4M cumulative users (June 26, 2026) → **10M users (July 15, 2026)** — 2.5× in under a month.
- Product/place-card CTR **exceeded 20%** in beta; heavy users showed **2.7× more product clicks**.
- Personalization corpus explicitly named: "**purchase data, shopping reviews, and a wide range of user-generated content**."
- **Headline consumer-value metric: "search-to-decision time reduced by as much as 60-70%."** This — not catalogue size, not listing count — is what NAVER leads with in its own press materials.
- Explicit differentiation claim against "global general-purpose AI models": Korean context and first-party UGC.

**Lesson for Tawveeri (INFERENCE, well-grounded):**
1. Comparison is the *entry* product, not the endgame — NAVER's business today is payments+membership+seller-tooling+ads, not referral fees.
2. The moat is proprietary behavioral+UGC data, explicitly stated by NAVER itself as its differentiator versus global models — not the model.
3. **Decision latency, not catalogue size, is the correct North Star metric** for a decision-intelligence product, and it is directly measurable in Tawveeri's own funnel (time from search to a confident recommendation/exit).
4. Loyalty points convert comparison into retention (Plus Membership).
5. Zero-friction merchant onboarding (2014, zero entry fees) preceded the data advantage — supply first, intelligence second.

Merchant commission rates could not be verified this pass (blocked domains) — flagged, not invented.

### F.3 BuyHatke, MySmartPrice (India) — unchanged from Phase 1: small (~29 employees, BuyHatke), capital-efficient (~10 years, no institutional round since 2016), proof that a comparison business can survive indefinitely without funding, though neither has meaningfully scaled either.

### F.4 Priceza (Thailand/SEA) — the sharpest cautionary tale in this entire study

Founded January 2010; 50,000,000+ product listings across Thailand, Indonesia, Malaysia, Singapore, Philippines, Vietnam; once reported at 85% Thai comparison-market share (dated, treat with caution); Priceza Money (2017) expanded into insurance/credit-card/loan comparison. **Last reported funding round: 2016.** As of September 2026, **its own homepage shows no AI/agent/assistant feature of any kind.**

**Sixteen years of catalogue accumulation, category-one position in its home market, and zero AI layer.** `INFERENCE`: catalogue scale does not automatically become decision intelligence — it requires deliberate investment that a 50M-listing incumbent evidently has not made. This is the clearest available proof that Tawveeri's smaller catalogue is not itself the binding constraint; deliberate product intelligence investment is.

### F.5 ShopBack (SEA) — cashback done structurally right, contrasted with Honey

30M users, 13 markets, founded 2014, ~$85M total funding, CPA/affiliate-commission model rebated to consumers as cashback. **No attribution-fraud controversy recorded** (its only documented incident is a 2020 data breach). Structural comparison with Honey:

| | Honey | ShopBack |
|---|---|---|
| Insertion point | Browser extension **at checkout** — can silently overwrite an attribution cookie set by another publisher earlier | **Destination the user starts from** — the click originates at ShopBack |
| Whose commission at risk | Potentially a third party's already-earned commission | Its own, earned on a click it originated |
| Consumer visibility | Invisible link rewriting | Affirmative navigation to claim cashback |
| Recorded controversy | Extensive (2024-2026), network removal | None |

`INFERENCE`: **the Honey scandal was never fundamentally about affiliate revenue — it was about capturing attribution at a moment the user did not initiate.** ShopBack's model survives scrutiny because click and commission originate at the same, user-chosen point — which is exactly the property of Tawveeri's own `/go` exit-ledger architecture (the user clicks to leave for a merchant; nothing is silently rewritten upstream). This is the strongest available external evidence that Tawveeri's existing constitutional rule is existential risk management, not merely ethical hygiene.

---

## G. GLOBAL MARKETING SYSTEM

A genuinely complete, evidence-grounded distribution system across 31 channels (not a social-media list). Full per-channel detail (job, global proof, cost, fit-now/later, dependency, metric) is preserved in the research transcripts; the operative synthesis follows.

### G.1 The governing constraint — TWO bottlenecks, not one

At ~400 sessions/month with ~89% single-store products, Tawveeri faces **two simultaneous constraints, not a single one**:

- **(A) Limited comparable supply / merchant breadth** — most listings cannot be compared against anything, which caps what programmatic SEO (§G.2) or any content strategy can responsibly index.
- **(B) Very small distribution/traffic** — even the comparable inventory that exists is not reaching many people.

**Hardening correction:** the earlier framing ("the problem is not discoverability, it's inventory") was too binary. The correct reading is sequenced, not either/or: **pouring distribution effort into weak inventory wastes the effort (A gates B's ceiling), but treating distribution as already solved, or as not worth investing in until A is fixed, is equally wrong** — a few real distribution channels (§G.2) cost near-zero and should run in parallel with, not after, supply growth. The 90-day plan (§Z) is sequenced to grow both simultaneously: §G.2's affiliate-network item targets (A), while email/push/X target (B) using only the inventory that already exists. Every other deferred channel (paid social, retargeting, partnerships, cashback, CTV) is deferred because the arithmetic doesn't support it at current scale on *either* axis — not because one bottleneck excuses ignoring the other.

### G.2 INVEST — four channels, real sustained effort

| Channel | Why, tied to evidence |
|---|---|
| **Programmatic SEO over comparable products ONLY** | NerdWallet built an $836.6M-revenue business on comparison content ($836.6M rev, 650 employees, PRIMARY_SOURCE). The 2026 discriminator Google applies is **original data** — 70+ companies were demoted in early 2026 for scaled templated content with no proprietary evidence behind it. Tawveeri's observed, timestamped, multi-merchant price data is exactly what survives. **Hard rule: never generate a page for a single-store product** — that's precisely the thin-page pattern that gets penalized. |
| **Email + push price alerts as one retention system** | Both infrastructures already exist; marginal cost ≈ 0. E-commerce push CTR (Android 3.78%/iOS 3.05%) is *above* the all-industry average specifically because price/stock events are time-sensitive (verified benchmark data). CamelCamelCamel proves an entire price-alert business runs on ~$11K/month. This converts the 400 existing sessions into a returning base — a precondition for every other channel. |
| **Apply to a MENA affiliate network as a SUPPLY + MONETIZATION EXPERIMENT** (Boostiny/ArabyAds-class) — downgraded from "join as a supply channel," see hardening note below | Not for distribution — potentially for comparable-product-count growth and a first real revenue signal, **if and only if verification confirms real catalogue/feed access, which is not yet established.** |
| **X as the database's own broadcast surface** | Saudi Arabia's X reach (43.1%) is unusually high vs. global norms. Text format means the product publishes itself with zero production cost, automatable from existing `price_alerts` infrastructure — the only social channel a 1-3 person team can sustain without a persona. |

### G.3 CHEAP EXPERIMENT — time-boxed, kill-by-default

| Channel | Experiment | Kill criterion |
|---|---|---|
| Data PR / Saudi Price Truth Index (see §N) | One quarterly report from `price_history`, Arabic-first, every figure reproducible | <3 referring Saudi/Gulf domains from report #1 |
| Telegram deal channel | Auto-post verified drops; near-zero cost | <200 subscribers or <2% post→`/go` in 60 days — **note KSA Telegram penetration was not measurable in this pass (absent from the one platform-reach dataset found); verify before scaling past experiment** |
| **WhatsApp pull-mode price-lookup bot** | User asks a price, bot answers — confirmed **free under Meta's 24-hour service-window rule**; do NOT build a broadcast list, which is billed per-message | <30 inbound queries/month |
| KOC seeding + unconditional merchant price badge | Free "cheapest today" data pulls to Saudi micro-creators (unpaid); an unconditional (never-flattering-only) price badge offered to existing feed partners | No creator citation in 60 days / no merchant embeds the unconditional version |

### G.4 DEFER — explicitly, with the reason, so it isn't relitigated

| Channel | Deferred until |
|---|---|
| Google Shopping / Merchant Center as a Tawveeri listing | One question answered first: is the EU's CSS remedy (which lets a comparator monetize inside Google Shopping) available outside the EEA? Merchant Center presumes a merchant with checkout — Tawveeri has none. **Not a channel decision — a research ticket.** |
| TikTok / Instagram / YouTube (as content-production channels) | A second person exists, or a repeatable no-face content format is proven — production capacity, not platform reach, is the blocker |
| Reddit-style community | Saudi Reddit reach measured at only 4.9% (lowest of all platforms tested) — the substrate doesn't exist locally; Telegram/X are the local substitutes, already in the experiment tier |
| Referral programs, cashback/reward loops | Both are reward-denominated; Tawveeri has no affiliate revenue yet to fund a reward |
| Partnerships (telco/bank/BNPL distribution) | Distribution is priced off *your* audience — at 400 sessions there is nothing to trade. Likely the single largest Saudi lever once there IS something to trade |
| Paid social, retargeting | Cannot be priced without a known commission-LTV; retargeting pool is arithmetically below most platforms' minimum audience size at current traffic |
| CTV/TV | Every precedent found (Trivago, MoneySuperMarket) is corporate-parent-funded national advertising with no small-scale form |
| Retail media (as something Tawveeri sells) | Direct collision with the constitutional "commercial interest never enters ranking" rule — requires a founder-level ADR resolving the boundary before any design work, let alone build |

### G.4a Hardening — MENA affiliate network verification (narrow check performed this pass)

A direct fetch of Boostiny's own homepage this pass confirms: "5,000+ Premium Supply Partners," "300+ Brands Partnered," "8+ Categories," and **"100% Deterministic Attribution" via "coupon attribution technology."** This is real, but it answers only some of the questions that matter for Tawveeri specifically:

| Question | Answer from public verification |
|---|---|
| Publisher eligibility for a comparison site | Not described publicly — homepage is advertiser-facing, not publisher-facing |
| Product feed available? | **Not confirmed** — no mention of feed/catalogue delivery to publishers |
| API? | **Not confirmed** |
| Deeplink-only, or richer? | Attribution is via **coupon-code technology**, which is structurally deeplink/code-adjacent, not catalogue-feed-adjacent — this is a meaningful negative signal, not a neutral unknown |
| Price/stock fields? | **Not confirmed** |
| GTIN/MPN? | **Not confirmed** |
| KSA electronics merchants specifically named? | **Not confirmed** on the public page |
| Data reuse rights for comparison pages? | **Not addressed anywhere public** |
| Commission/tracking model | Coupon/deterministic attribution confirmed; commission structure not published |
| Can it actually increase comparable-product supply? | **Unproven from public information — do not assume yes.** |

**Correction applied:** the 90-day plan and §G.2 no longer say "join the network as a supply channel." They say **"apply to / verify with a network as a supply + monetization experiment"** — the founder must confirm, before relying on it for comparable-product growth, whether the network provides an actual product/price/stock feed (not just deeplinks and coupon codes) and whether its terms permit reuse of merchant catalogue data in a public comparison page. Coupon-attribution networks are historically built for *coupon and deal sites*, not price-comparison catalogues — this is a real structural mismatch risk that must be checked before any commitment, not after.

### G.5 A finding not in the original mandate's channel list, worth flagging — with a measurement caveat

**Snapchat's DataReportal figure (72.9%) is potential advertising reach as a percentage of total population — not verified monthly active users, and not proof of actual usage penetration.** DataReportal itself explicitly cautions that ad-platform reach figures are not the same as active-user counts (the same caveat applies to every other percentage cited from that source in this study — Instagram 52.4%, X 43.1%, YouTube 79.2%, Reddit 4.9% — all should be read as *potential ad reach*, not confirmed active usage). With that caveat stated plainly: Snapchat's reach figure is still higher than Instagram's or X's, and second only to YouTube's, among all platforms measured — it was not in the original mandate's channel list and is worth adding to future channel audits **as a channel to test and watch, not as a proven-penetrated channel to invest in on the strength of this number alone.**

### G.6 The one positioning finding worth stating out loud

Two of the highest-profile shopping-savings brands of the decade (Honey — $4B, lost ~8M of 20M users; and elsewhere in this study, Phia) were maimed for the identical act: silently capturing attribution. Google rewrote Chrome Web Store policy specifically to ban commission-claiming without a delivered discount (March 2025). **Tawveeri's existing `/go`-measured, never-intermediate exit architecture is not just engineering hygiene — it is a market position an incumbent just vacated**, and it costs nothing to state publicly in Arabic across the SEO, PR, and X channels above.

---

## H. SOCIAL DISTRIBUTION AUDIT

Real inspection, not fabricated analytics. Several platforms structurally blocked automated audit this session (X: 402 paywall to every fetch, universal; TikTok: perpetual client-render wall, universal; Reddit: tool-level block) — **these are honest UNKNOWNs, not evidence of absence**, and apply equally to every company tested.

| Company | Verified findings |
|---|---|
| **idealo** | The only unambiguously "social-as-real-strategy" account found: Instagram **175K followers** (verified live), video-dominant (reels every 1-3 days), entertainment-crossover content (gaming/League-of-Legends tie-ins, "song comparisons"); LinkedIn **27,570 followers**, active PR/advocacy posting (EU DMA advocacy, IFA Berlin, gamescom). Self-reported "560M+ offers from ~50,000 shops." |
| **ShopBack** | LinkedIn **95,336 followers**, active weekly B2B/product news; YouTube channel confirmed to exist (subscriber count unrenderable); consumer Instagram/TikTok/X **could not be verified** (a guessed handle collided with an unrelated account — a real risk of false-negative, not evidence ShopBack lacks consumer social) |
| **Slickdeals** | LinkedIn (8,638 followers) is a recruiting/culture channel, **not** its actual distribution engine — its real moat (Reddit community-vetted deal threads) is exactly the channel this session's tooling could not access. Its "social" is a UGC marketplace, not a follower-count strategy — the most instructive model for Tawveeri's own stage |
| **Kakaku, Keepa** | No confirmed presence on any platform tested — genuinely UNKNOWN, not confirmed absent |
| **Rakhys (Saudi)** | Confirmed, brand-consistent Instagram + Facebook presence exists ("تطبيق راخص") — but scale/cadence/content unverifiable this session. Do not treat this as "no social strategy"; treat it as unmeasured |
| **Shoof, Sa3rha (Saudi)** | No positive evidence of any social account found — consistent with, but not independently re-confirming, Phase 1's earlier finding |

**Implication for Tawveeri's near-term plan:** idealo's is the only unambiguous proof-point, and it required decades and a real content/PR team — not a comparable reference for Tawveeri's stage. Nothing in the direct Saudi competitive set shows confirmed, at-scale, resourced social presence — social media is not currently a contested battleground in this specific niche, which lowers the opportunity cost of Tawveeri also not prioritizing paid/produced social content yet. Slickdeals' model (community/UGC substituting for a follower-count strategy) is the more capital-efficient direction at Tawveeri's scale — consistent with §G's channel-system conclusion (Telegram/X experiments over Instagram/TikTok content production).

---

## I. RETENTION SYSTEMS

Extends Phase 1 §AA with the verified benchmark data and the NAVER loyalty-flywheel finding.

- **Price alerts (email + push) remain the single highest-evidence retention mechanism in this entire study, globally, across every region researched** — Keepa, CamelCamelCamel, idealo, ShopSavvy, NAVER (implicitly, via Plus Membership) all converge on it. E-commerce push CTR beats the cross-industry average specifically because price/stock events are inherently time-sensitive (verified benchmark: 3.05-3.78% vs. all-industry norm).
- **NAVER's Plus Membership (4-5% Naver Pay points on every purchase) is the clearest evidence that a loyalty-points layer converts comparison into retention** — it makes leaving to compare elsewhere economically irrational. Tawveeri has no revenue to fund an equivalent yet (§L/§M), but this is the natural next retention layer once affiliate revenue exists.
- **Preference-memory with visible consent is real, not a "global white space"** (§AC correction) — Google Gemini's "Personal Intelligence" toggle explicitly names product comparisons as a beneficiary. The differentiated, still-open opportunity is not "memory exists" but **"memory is inspectable per-decision"** — consistent with Tawveeri's own evidence-cited trust model, and a natural extension of it rather than a novel feature.
- **Community/UGC reputation systems (SMZDM's 值友 tiers) are the one retention mechanism that is genuinely non-portable** — a competitor with equal features starts with zero reviewer standing. Not immediately actionable at Tawveeri's current scale (needs a seeded crowd first, per §G.4), but the correct target shape for a future community feature, not a generic forum.

---

## J. MERCHANT ACQUISITION PLAYBOOK

Twelve objections, each with global precedent, Tawveeri answer, proof required, and — critically — what NOT to promise. Full detail preserved in the research transcript; condensed table below. A governing frame precedes all twelve: **the industry's founding convention was that the platform, not the merchant, absorbed cold-start risk** — 1998-99 comparison engines listed free and charged only per click; Google itself reverted Shopping to free listings in 2020 specifically to rebuild merchant supply. Tawveeri's posture should inherit this: the merchant's downside is capped at zero until Tawveeri has produced evidence.

| # | Objection | Global precedent | Tawveeri answer (never promise) |
|---|---|---|---|
| 1 | "Your traffic is too small" | idealo launched 2000 on ~€500K, restricted to consumer electronics only, before scaling | Lead with intent *composition* (query/budget/product), not totals — do not promise traffic figures or growth rates |
| 2 | "We already have Google Shopping" | Google formally recognizes Comparison Shopping Services as a distinct partner category, implying coexistence, not substitution | Reuse the merchant's *existing* Google feed as the zero-effort ingestion path — do not claim to beat or replace Google |
| 3 | "We already advertise elsewhere" | ShopBack attaches to merchants' *existing* affiliate infrastructure rather than creating a new channel | Zero-cost pilot, settle through whatever the merchant already runs if it ever becomes commercial — do not promise incrementality vs. a named channel |
| 4 | "Don't want comparison next to competitors" | idealo's default sort is popularity, not price; PriceSpy publishes "nobody can pay their way to a higher ranking" | Non-price ranking signals (stock truth, trust, delivery) let a merchant win without being cheapest — **never hint at preferential placement; this is a constitutional line, not a sales tactic** |
| 5 | "Don't want to expose our feed" | The industry's data-sourcing methods (feed/crawl/API) are openly documented; ShopSavvy shows the real risk category is commercial resale of catalogue data | Scope data use in writing (comparison-only, no resale, deletion on termination) — do not claim data is never stored or never informs any future product |
| 6 | "No engineering resources for integration" | Google accepts plain text feeds explicitly for low-capability merchants, paired with Shopify/WooCommerce partnerships requiring zero merchant code | Four tiers, cheapest is "give us the URL of your existing Google feed" — do not promise real-time sync or zero future maintenance |
| 7 | "Don't want affiliate/commission" | idealo lets merchants choose CPC *or* revenue-share contractually; PriceSpy/PriceRunner are pure CPC | Pilot has zero fee of any kind; post-pilot menu is a merchant choice, never bundled with ranking |
| 8 | "Don't want to pay CPC" | Google itself went free→paid (2012)→free again (2020) specifically to manage merchant participation | Free listing now; a CPC number is only rational once click→order conversion is known — do not invent one today (§L) |
| 9 | "Don't trust your attribution" | Amazon's Search Query Performance report is the industry's model for a rigidly specified, auditable metric schema | Publish the exact measurement definition; merchant's own count binds in any paid phase — do not promise exact match or 100% accuracy |
| 10 | "Don't want prices publicly compared" | Comparison has been unavoidable since 1995 (BargainFinder); the mature-market answer is accuracy control via feed, not opt-out | A feed relationship gives a correction channel and non-price attributes — **legal review required before this line is used at all; Saudi comparative-advertising/consumer-protection rules are a founder/legal decision, not an engineering one** |
| 11 | "No engineering resources at all" | Same as #6, escalated | Tier 0 (existing platform API, zero merchant action) already works for at least one live Tawveeri merchant today |
| 12 | "Don't want to share conversion data" | Amazon's SQP report proves aggregate, non-identifying demand-data exchange is possible without exposing customers | A four-rung ladder (L0 nothing → L4 full postback); **be explicit that without at least L1, Tawveeri cannot compute conversion rate and therefore cannot rationally price anything** — this is a real limitation to state, not a negotiating tactic |

---

## K. QUANTIFIED MERCHANT PILOT

**Design principle, drawn directly from every verified cold-start precedent:** narrow vertical, free to the merchant, platform absorbs integration and risk, monetization deferred until traffic exists. Duration: 60-90 days. Merchant cost: zero. Merchant obligations: one feed URL or permission, one named contact, two 20-minute readouts (day 30, day 60).

**Ingestion tiers, ranked by merchant effort** (0 = existing platform commerce API, credential-free, already proven in Tawveeri production for at least one merchant; 1 = reuse the merchant's existing Google Shopping feed URL; 2 = CSV/XML upload; 3 = direct API/OAuth; 4 = public observation as fallback). **Recommended cadence: scheduled, not real-time** — Tawveeri's own incident history (a concurrent-heavy-job DB overload, a disk-IO SEV-1) argues for a fail-closed, budgeted retrieval schedule as a *reliability* choice, framed to merchants as such.

**What the merchant keeps, stated first, in writing:** checkout, payment, the customer relationship and all customer data, pricing authority, fulfillment, delivery, returns, warranty, support. Tawveeri never takes an order or becomes merchant of record.

**The measurement split — the single most important design decision:**

| Tawveeri can measure UNILATERALLY (own logs) | REQUIRES merchant cooperation (unknown until shared) |
|---|---|
| Qualified outbound visits, product-level exits | Click→order conversion rate |
| Query→exit paths, top search intents | Order count, GMV |
| Budget bands/price points at exit | Contribution margin per order |
| Price gap at moment of exit | Return/cancellation rate (incl. COD failure) |
| **Lost demand** (queries with no matching listing) | New-customer vs. returning split |
| **Stock gaps** (demand hitting out-of-stock SKUs) | **Incrementality** — requires a designed holdout, jointly |
| Impression/exit share within comparison sets | Cost per incremental order (downstream of incrementality) |
| Feed/data-quality defects on the merchant's own catalogue | — |

**The weekly report, modeled directly on Amazon's Search Query Performance report** (a real, documented, field-by-field-specified template: query, impressions, clicks, cart-adds, purchases, each paired total-vs.-yours to produce a *share*, plus median price at every funnel stage). Tawveeri's version reports the top half honestly and leaves the outcomes row blank by design — "orders, conversion, GMV and incrementality require your data; here is what we would report if shared" — which doubles as the ask for data-sharing rung L1.

---

## L. MERCHANT ECONOMICS

**What the real rate cards actually say, and their honest limits:**

| Company | Model | Rate | Status |
|---|---|---|---|
| idealo | Merchant elects CPC or % of revenue | Not publicly retrievable this pass | Model `INDEPENDENT_SOURCE`; rate `UNKNOWN` |
| PriceSpy/Prisjakt | Confirmed CPC, no paid ranking | Not published | Model `PRIMARY_SOURCE`; rate `UNKNOWN` |
| PriceRunner | Confirmed CPC | Not published | `INDEPENDENT_SOURCE` |
| Kakaku.com | Setup + monthly + per-click (Phase 1 citation) | **Could not be re-verified this pass** — treat Phase 1's specific ¥ figures as unconfirmed pending an IR-document check |
| Keepa | Subscription + metered API | **Range conflicting across sources (€19-29/mo)** — quote as a range, not a point figure |
| ShopSavvy Data API | Metered credits | **Confirmed exact:** $49/mo=1,000 credits · $199/mo=10,000 · $499/mo=50,000; ~4 credits per product+offers lookup ≈ $0.20/$0.08/$0.04 per lookup by tier | `PRIMARY_SOURCE` |
| ShopBack | CPA/affiliate, rebated as cashback | No published rate card; merchant commission is at minimum the advertised consumer cashback (2-15%) plus ShopBack's margin | Model `INDEPENDENT_SOURCE`; exact rate `INFERENCE` (floor only) |
| SMZDM | Affiliate CPS + "intelligent marketing" (brand services) | No split published | Segments confirmed `PRIMARY_SOURCE`; that advertising/services is a first-class line (not just CPS) is `INFERENCE` |

**Two derived patterns worth carrying forward:** (1) CPC dominates among *neutral* comparison sites (idealo, PriceSpy, PriceRunner all confirmed CPC); CPA dominates only where a consumer rebate must be funded (ShopBack) — the model follows the consumer promise, not the technology, and Tawveeri's ranking-neutrality constitution places it in the CPC/flat-fee family. (2) ShopSavvy's rate card actually prices *catalogue/API data access*, not merchant clicks — a structurally separate revenue line worth keeping open as a question (§N).

### The affordability framework — a formula, not a number

```
CPO (contribution per retained order) = AOV × m − c_var
CPA_max (break-even, per order)       = CPO × (1 − r) × I
CPC_max (break-even, per click)       = CPA_max × CVR
CPC_bid (rational bid at target k)    = CPC_max × k
```
Where `AOV` = average order value, `m` = contribution margin rate, `c_var` = per-order variable costs (payment/COD/packing/last-mile/CS), `r` = return+cancellation+COD-failure rate, `I` = incrementality (0-1, would the sale have happened anyway), `CVR` = click→order conversion rate, `k` = the fraction of contribution the merchant wants to retain.

**A fully-labeled worked illustration exists in the research transcript (AOV 2,000 SAR, m 10%, CVR 2%, r 12%, I 0.5 — every input explicitly `ASSUMPTION`, not a Saudi finding) producing CPC_bid ≈ 0.37 SAR.** This number must never be quoted as a Saudi benchmark — its only purpose is to show the formula is linear in every input, meaning a 2× error in any one input (especially `I` and `CVR`, the two Tawveeri cannot currently observe) is a 2× error in the answer.

**Why a European or Japanese CPC cannot be imported directly:** it is a demand-side auction *output*, not a supply-side *cost* — it encodes that market's AOV, margin structure, returns/COD norms, VAT base, and incrementality (which is a function of market maturity and typically runs in the *opposite* direction from a young market's). Converting currency does not convert purchasing-power or market structure.

**What Tawveeri has today vs. needs:** qualified exits, query/intent structure, and lost-demand/stock-gap data are all **already instrumented** (own logs). Click→order CVR, AOV on referred traffic, contribution margin, return/COD-failure rate, and incrementality are **all unknown and require merchant cooperation or a jointly-designed holdout** — incrementality specifically cannot be obtained unilaterally under any circumstance.

**Honest conclusion: given zero confirmed affiliate revenue today, Tawveeri is not currently in a position to set a defensible CPC or CPA, and any number published today would be invented.** The correct sequence: free listing (industry cold-start norm) → instrument and give away the unilateral half weekly (SQP-shaped) → trade demand data for outcome data one rung at a time → only then apply the framework with *that merchant's real inputs*.

---

## M. TAWVEERI LOW/MEDIUM/SCALE ECONOMICS

Conceptual only; every input explicitly labeled. No forecast is offered as fact.

| Scenario | Sessions/mo | Comparable products | Affiliate revenue | Merchant-data/B2B revenue | Basis |
|---|---|---|---|---|---|
| **LOW (current)** | ~400 (`PUBLISHED — August 2026 actual`) | 1,384 (`PUBLISHED — live`) | SAR 0 confirmed (`PUBLISHED`) | SAR 0 | The verified present |
| **MEDIUM** | 10,000-50,000 | 5,000-10,000 (via affiliate-network supply, §G.2) | Requires: real CVR + AOV known (currently unknown, §L); illustrative only, using the worked CPC_bid ≈0.37 SAR/click framework structure — **do not treat any resulting revenue figure as a forecast** | A Manmanbuy-style B2B price-monitoring line to 3-5 Saudi brands at an unverified but directionally analogous few-thousand-SAR/month/client price point (`ASSUMPTION`, modeled on Manmanbuy's *2020-dated* $1.4K-$14K/client range — see §C.3 correction — not a current rate or a Saudi quote) | `MODEL ASSUMPTION` throughout |
| **SCALE** | 500,000+ | Tens of thousands (multi-merchant-network) | CPC/CPA at a merchant-negotiated, evidence-derived rate; possibly a Universal-Cart-style price-alert product if Google/Amazon have not pre-empted it in KSA by then (§O/§Q) | Merchant-intelligence SaaS at a Rakhys-comparable Saudi price point (SAR 1,250-3,500/mo, `SELF_REPORTED`, unproven willingness-to-pay); possibly a Keepa-style metered data API | `MODEL ASSUMPTION` throughout |

**What is real vs. modeled, stated plainly:** the LOW row is the only row with any `PUBLISHED`/real data behind it. Every number in MEDIUM and SCALE is either a global benchmark applied by analogy or a bare assumption — none is a Tawveeri forecast, and none should be repeated outside this document as if it were one.

---

## N. GLOBAL REVENUE MODELS

Synthesizing across every region researched, six distinct models were found in active use, not four:

1. **Pure CPC** (idealo, PriceSpy, PriceRunner) — the surviving neutral-comparison model; requires known merchant economics to price rationally (§L).
2. **CPA/affiliate rebated to consumer** (ShopBack, Rakuten) — requires an order-level event and a reward to fund; structurally safe *only* if attribution originates at the platform's own click (ShopBack), not injected at checkout (Honey's failure mode).
3. **B2B price-monitoring/data-licensing to brands** (Manmanbuy — the single most transferable finding: historically $1,400-$14,000+/client per a 2020-dated source, zero consumer scale required; current pricing unverified — see §C.3).
4. **Merchant-intelligence SaaS** (Rakhys in Saudi — SAR 1,250-3,500/mo, unproven willingness-to-pay, 25 days live at last check; DataWeave/Profitero-class enterprise players globally).
5. **Subscription + metered API on proprietary catalogue/price data** (Keepa, ShopSavvy — sells *coverage*, not audience; the only model that scales down to a tiny team, per Phase 1's Keepa-vs-CamelCamelCamel finding).
6. **Agency/services revenue backfilling a shrinking core** (SMZDM — explicitly flagged as a warning, not a model to adopt: it hollows out margin and converts an asset-light data business into a labor business).

**Cross-region convergence, honestly bounded:** CPC/CPA/subscription-API together account for essentially all real, sustained comparison-business revenue found across US/Europe/Japan/Korea/India/SEA/China in this study. Retail media and pure agentic-checkout commission were **not found operating as a real revenue line for any independent (non-platform-owned) comparison site anywhere** — both remain platform-owned patterns (Google/Amazon) with no smaller-scale analogue, consistent with §G.4's decision to defer them.

### N.1 Hardening — separate commoditizing generic merchant AI from still-defensible proprietary market-wide data

Phase 2's China findings (§C.4, §C.6) risk over-generalizing from "Alibaba/JD gave their generic merchant tools away free" to "merchant-facing data products are not viable." That is too broad, and it matters directly to Tawveeri's future B2B thesis. Two categories, not one:

| **COMMODITIZING / FREE** (single-merchant-scoped, generic AI capability) | **POTENTIALLY DEFENSIBLE** (requires proprietary, cross-merchant, market-wide data) |
|---|---|
| Generic single-store analytics dashboards (Alibaba's 生意参谋, JD's 商智 — both now free) | **Cross-retailer price monitoring** — requires observing many merchants at once, which no single merchant's own dashboard can do |
| Generic AI-written summaries of a merchant's own sales | **Historical price-truth / discount-integrity verification** — requires the append-only, cross-time observation ledger, not a snapshot |
| AI-generated listing copy/images (JD's 京点点, Alibaba's Huiwa) | **Unauthorized/grey-market price detection** — requires seeing a brand's price across every merchant selling it, which the brand itself often cannot easily do |
| Generic store-operation chat assistants | **Lost-demand intelligence** (queries with no matching listing) and **category demand-gap analysis** — requires aggregate, cross-merchant search-log data no single merchant has |
| — | **Saudi search-intent intelligence** — a market-specific corpus (dialect, budget language, use-case phrasing) that generic global AI tooling does not have and is not building (§C, §F.2) |
| — | **Cross-market competitive price position** — requires simultaneous visibility into multiple sellers of the same product, structurally unavailable to any one of them |

**The distinguishing test:** does the value come from AI processing *one merchant's own data* (commoditizing fast, evidenced by Alibaba/JD giving it away), or from **aggregating across merchants/markets** (the thing only an independent comparator is structurally positioned to do, and the thing Manmanbuy's B2B line and Rakhys's Saudi SaaS both actually sell)? Tawveeri's B2B thesis belongs entirely in the second column — this is the correct, narrower claim, not "avoid merchant data products."

---

## O. 2026 AI COMMERCE FRONTIER — how commerce itself is changing

Organized by the categories the mandate specified, using only evidence gathered in this study (not speculation):

| Frontier | Current 2026 evidence | Status |
|---|---|---|
| **Intent-first shopping** | NAVER AI Tab explicitly reframes search as "action-oriented," reducing decision time 60-70% | Live, real usage (10M users) |
| **Conversational commerce** | Klarna's assistant (Search/Recommend/Compare/Find); Amazon's Alexa for Shopping; NAVER AI Tab | Live, mixed depth |
| **Proactive agents** | Grok Bot's Haggle Bot found >$100K savings across 125 vendors autonomously (research/negotiation, not payment) | Real but payment-gated everywhere found |
| **Multimodal shopping** | Google Lens (order of 10¹⁰ visual searches/month, ~20% shopping); virtual try-on (Google, May 2025) | Real, mass-adopted for photo; voice remains a documented, repeated failure (Alexa: ~2% ever shopped by voice) |
| **Personal memory** | Google Gemini's Personal Intelligence toggle (named, documented, explicitly covers product comparisons) — corrects Phase 1's "white space" claim | Real, but purpose-specific (shopping-only) consent surfaces are still genuinely absent |
| **Price monitoring** | Universal Cart (Google), NAVER, Keepa, Manmanbuy's B2B monitoring product | Mature, converging on native platform features |
| **Auto-buy** | **Amazon Auto-Buy is the one confirmed exception to per-transaction gating in this study** — target price set once, Alexa/Alexa-for-Shopping monitors, order placed automatically (default payment/address) when the condition is met, checked ~every 30 min, post-purchase notification, defined cancellation window (re-affirmed from the Aug-27 Phase-0 research, PRIMARY-sourced at the time). Grok Bot's Tesla purchase, by contrast, was human-confirmed at payment. | **Bounded, pre-authorized delegated execution — real and shipped, not merely per-transaction-gated** (see the three-tier distinction in §D.2) |
| **Agentic checkout** | Live at Google (US, Wayfair/Chewy/Quince/Shopify, Google Pay, always human-approved per-purchase) and via UCP/AP2; ChatGPT's ACP is alive but the market consolidated around UCP for actual checkout (§D.1 correction) | Real, narrow, per-transaction-gated **except Amazon's Auto-Buy** |
| **Post-purchase service** | JD's "Super Brain LLM" across 1,000+ logistics scenarios; Qwen Shopping Assistant's stated "after-sales services" scope | Real at platform scale, not yet observed at independent-comparator scale |
| **Product-knowledge graphs / structured product data** | Google's Shopping Graph (50B+ listings); Google's 2026 attribute additions (`question_and_answer`, `related_product`, `popularity_rank`) explicitly designed "for conversational experiences" | Actively being built out by every major platform as the substrate agents query |
| **Merchant AI operating teams** | Alibaba's Wukong, JD's 京点点/JoyIndustrial, Google's Business Agent | Real, and **already commoditized to free at hyperscale** (§C.4, §Q) |
| **Autonomous catalog operations** | Google Merchant Center's "Use AI to add products" (beta, May 2026 — one-time website scan, no auto-refresh, a real limitation) | Real but immature; the refresh gap is the opportunity |
| **AI content/marketing at scale** | JD's 京点点 (>1M AIGC requests/day, free); Alibaba's Huiwa | Commoditized |
| **AI merchant analytics** | Alibaba's 生意参谋 (now free for most merchants, exact transition date conflicting across sources), JD's 商智 (free) | Commoditized at hyperscale — confirms §Q |
| **Agent protocols/machine-readable commerce** | UCP (broad coalition: Google/Amazon/Shopify/Walmart/Microsoft/Meta/Stripe), ACP (OpenAI/Stripe, narrower), AP2 (Google, payment authorization layer), MCP (transport layer used by both) | Real, actively converging on UCP as the dominant checkout-adjacent standard |

**The synthesis, stated once, corrected:** commerce is changing on **both sides simultaneously** — consumer-side toward faster, more confident decisions (NAVER's metric), with checkout staying **per-transaction human-gated at every platform studied except one**; merchant-side toward AI-operated catalog/content/analytics functions that hyperscale platforms are giving away for free specifically to deepen merchant lock-in. **Amazon's Auto-Buy is the one confirmed instance of bounded, pre-authorized delegated execution at consumer scale** — a real, narrow crossing into unattended transaction completion, not a per-transaction confirmation. The correct load-bearing fact is therefore not "nobody has automated the transaction" but **"delegated execution exists today, narrowly, single-retailer, price-triggered, cancellable — and nothing broader (multi-retailer, unbounded, or without a human-set trigger) was found anywhere in this research."**

---

## P. 12/24/36-MONTH AI TRAJECTORY (scenario-based, not certain)

| Horizon | Likely commoditized | Likely still hard | Confidence |
|---|---|---|---|
| **12 months** | Basic merchant-facing AIGC (listing copy/images); simple catalog-extraction-from-website onboarding (Google's beta already exists); generic conversational search UX | Reliable Saudi-dialect intent parsing at production quality; cross-merchant product identity/corroboration at Tawveeri's precision bar; any real Saudi merchant AI-tooling market (China/US show this commoditizes fastest at hyperscale, which Saudi lacks) | MEDIUM |
| **24 months** | Multimodal (photo) product search as a standard feature, not a differentiator; personal-preference-memory toggles as table stakes across major assistants | Purpose-specific, per-decision-inspectable consent UX (still absent everywhere checked); a genuinely deep, multi-year Saudi price-history corpus (time-earned — hard and slow to reconstruct, not instantly replicable by any amount of capital or engineering); Saudi merchant feed/GTIN hygiene (unresolved industry-wide per Phase 1) | LOW-MEDIUM |
| **36 months** | Agentic research/negotiation assistants (Grok Bot-class) becoming mainstream consumer tools; UCP-class protocols reaching broad Western retailer adoption; **bounded, pre-authorized delegated purchasing (Amazon Auto-Buy's shape) extending to more retailers/categories** — this is an extrapolation of an already-shipped pattern, not a new one | **Multi-retailer or unbounded autonomous spending at any real scale** — every platform researched still gates on either per-transaction human confirmation or a narrow, single-retailer, human-bounded delegation (Amazon); nothing broader was found. Saudi/GCC-specific agentic commerce rollout by any global platform (no announced roadmap found anywhere in this study) | LOW (scenario, not forecast) |

**What Tawveeri must own regardless of scenario (§R):** the accumulated, verified, time-locked price-observation corpus; the Saudi shopping-intent/dialect corpus; the corroboration/identity engine tuned to Saudi retail's specific messiness; direct merchant relationships (however few); the constitutional trust/neutrality discipline as a brand asset.
**What Tawveeri should rent regardless of scenario:** LLM phrasing/translation, vision/OCR for photo search, generic coding/QA assistance, video/image generation for social content — all of these are being commoditized fastest, at hyperscale, by companies with no reason to charge a small Saudi startup a premium for them.

---

## Q. WHAT BECOMES COMMODITY

Directly evidenced in this study, not theorized:

| Already commoditized (2026 evidence) | Evidence |
|---|---|
| Merchant analytics dashboards | Alibaba's 生意参谋 (2M+ merchants, now free for most), JD's 商智 (free) |
| AIGC listing/image/copy generation for merchants | JD's 京点点 (>1M requests/day, free), Alibaba's Huiwa (metered but cheap pay-per-use) |
| One-time website-to-catalog extraction | Google Merchant Center's "Use AI to add products" beta |
| Generic conversational shopping UX | Klarna, Amazon, NAVER, Google AI Mode all ship a version; the differentiator has moved to the data behind it, not the chat interface itself |
| Basic MCP/agent-server exposure | 9+ actively-versioned shopping MCP servers exist in the official registry; supply is cheap, demand is unmeasured everywhere (§AC correction) |

| Still genuinely hard (2026 evidence) | Evidence |
|---|---|
| Elapsed, verified price history | Every platform researched (Google, Amazon, Alibaba, idealo) builds live price pull, not historical discount-claim verification — this remains the one asset requiring real calendar time |
| Cross-merchant product identity/corroboration at high precision | Every platform's public documentation stops at "GTIN recommended" — the actual clustering logic is undisclosed everywhere, including at Google's scale |
| A deep, native Saudi shopping-intent/dialect corpus | Shoof is the only competitor building this; no global platform has any verified Arabic-dialect claim |
| Purpose-specific, inspectable-per-decision consent for preference memory | Not found anywhere, including at Google, despite general memory toggles existing |
| Saudi merchant feed/GTIN hygiene | Unresolved industry-wide (Phase 1 finding, unchanged) |
| Genuine consumer trust in an intermediary's neutrality | Honey's collapse shows trust, once broken, does not return even after a legal win — it must be built and maintained deliberately, is not a technology |

---

## R. WHAT TAWVEERI MUST OWN VS. RENT

| OWN (do not outsource, ever) | RENT (buy from vendors, expect it to get cheaper) |
|---|---|
| The price-observation ledger (append-only, immutable, time-locked) | LLM phrasing/translation for customer-facing text |
| The identity/corroboration engine's precision calibration | Vision/OCR for photo-to-product matching |
| The Saudi shopping-intent and dialect corpus | Generic coding/QA/engineering assistance (Claude/Astra/Grok, per §S) |
| Direct merchant relationships and their feed/API access | Video/image generation for social content (Grok Imagine-class) |
| The trust/evidence-engine weight calibration (never expose the formula) | Basic demand/competitor-monitoring data collection (X API, now materially cheaper per Phase 1) |
| The constitutional neutrality discipline as a brand asset | Merchant-facing AIGC content tooling, if ever offered (build cheaply on a commoditized base, don't invest in differentiating it) |

---

## S. AI-NATIVE INTERNAL OPERATING MODEL

Not agent-built — a conceptual allocation, extending Phase 1 §V's four-role model (Grok for social/demand signals, Claude for engineering/QA/internal ops, Astra situationally for deep research/computer-use, Founder Intelligence as synthesis) with explicit gates per function, per the mandate's request.

| Function | AI role | Deterministic gate | Human gate | Readiness | Do now / later |
|---|---|---|---|---|---|
| Engineering | Claude (primary), Astra (situational, deep research/browser QA) | Test suite, `tsc`, existing ADR-002 boundary | Code review before merge (existing) | HIGH — already operating | NOW |
| QA / catalog operations | Claude's `ultrareview`-class verification; extend existing Saudi Agent Benchmark (do not build a parallel "test shopper") | Benchmark rubric (already exists, ADR-047) | Founder review of benchmark drift | HIGH | NOW (extend, don't duplicate) |
| Merchant feed mapping/onboarding | AI-assisted field mapping (Google's beta pattern, adapted) | Product Truth gates (ADR-298-300) must run on every ingested row regardless of source | Founder or single ops person reviews first batch per new merchant | MEDIUM | LATER (after §G.2's affiliate-network supply channel produces real feeds to map) |
| Merchant diagnostics/reporting | AI-drafted, human-reviewed weekly SQP-style reports (§K) | Report content is 100% derived from real logged data, never LLM-invented figures | Founder approves report template once; per-merchant sends can be automated | MEDIUM | NOW, as a manual/semi-automated process |
| Competitive intelligence | Grok/Claude research passes (as run in this very study) | Every claim labeled by evidence type | Founder reviews before any external use | HIGH | NOW |
| Marketing research / content creation | Grok for social content generation (image/video, cheap); Claude for written content drafting | Price-truth publications (§N) must be 100% reproducible from `raw_observations` — never AI-generated numbers | Founder approves every publication before it goes out (per Constitution's fabrication rule) | HIGH | NOW |
| SEO | Programmatic page generation gated to comparable products only (§G.2) | Never index a single-store product page | Spot-check monthly | HIGH | NOW |
| PR research | AI-assisted drafting of the price-truth report | Same as marketing research | Founder sign-off, always | HIGH | NOW |
| Social intelligence | X API-based demand monitoring (materially cheaper now, Phase 1 finding) | N/A — read-only | Founder reviews weekly digest | MEDIUM | NOW |
| Analytics | Existing Founder Command Center (already real, ADR-277-279) | `tps:sanity` weekly checks (already exists, ADR-282) | Founder reads the digest | HIGH — already operating | NOW |
| Affiliate reconciliation | AI-assisted CSV/report parsing once a report is imported | Match-tier logic already built and tested (ADR-216-era schema) | Founder must actually obtain and hand over the first real report — this is the #1 blocker, not an AI-readiness gap | Infrastructure HIGH, input BLOCKED | NOW (blocked on founder action, not on AI) |
| Sales preparation (merchant pitches) | AI-drafted objection responses using §J's playbook | Never promise anything in §J's "do not promise" columns | Founder or a designated person delivers every pitch personally at this scale | MEDIUM | NOW |
| Security triage | AI-assisted log/anomaly review (as already partially exists per Health Watch/ADR-296) | Deterministic thresholds decide; AI drafts the explanation, never the block/allow decision | Founder reviews any AI-flagged anomaly before action | MEDIUM | NOW, cautiously |
| Support | Not evidenced as a near-term priority — Tawveeri has no support volume yet | N/A | N/A | LOW readiness need | LATER |

**Explicitly reject, per Phase 1's own finding reconfirmed here:** naming more specialized agent roles than there is real, evidence-backed recurring work for. ADR-297 already audited the Grok×Claude operating question and found nearly everything proposed already existed — the discipline holds.

### S.1 Closing the remaining original-mandate gaps (§A: sections 31-34, and the skipped 14-role mapping) — using only Phase 1 + Phase 2 evidence already gathered, no new research

**(a) AI vendor dependency.** Already effectively answered by Phase 1 §V and reconfirmed here: **multi-vendor, not single or dual.** No one vendor (Claude/OpenAI/Google/xAI) leads on every axis Tawveeri needs (§S's table shows Claude ahead on engineering/QA at half Astra's price, Grok ahead on cheap social video and X-based demand data, Astra situational for deep research). **What must remain vendor-neutral:** the deterministic engines (identity, condition, price, ranking) — no vendor's model ever touches these (ADR-002, reconfirmed by this entire study's finding that every credible platform keeps a similar deterministic/generative boundary). **Fallback principle:** any AI-assisted process (content drafting, research, code review) must have a manual/deterministic fallback path that does not depend on any single vendor being available — already implicitly true of Tawveeri's current architecture, since AI only phrases, never decides.

**(b) Data needed for intelligence.** What to capture, extending the existing `usage_events`/`outbound_clicks` contract: search intent and resolved constraints (already captured); the unilateral merchant-pilot metrics in §K's split table (already loggable from existing infrastructure); a content-object-ID field for social posts (already added per ADR-297). **What NOT to capture:** anything beyond what §K's "requires merchant cooperation" column lists — Tawveeri should never scrape or infer a merchant's margin, conversion rate, or customer data without explicit sharing; Manmanbuy's regulatory citations for over-collection (§C.3) are a direct, evidenced warning. **Privacy/minimization:** PDPL-consistent by construction if the above boundary is respected — collect what the shopper explicitly gives (a search, a click, an alert signup), never infer or purchase what they didn't. **Outcomes required for merchant economics specifically:** at minimum, aggregate CVR (rung L1 in §K) — without it, §L's affordability framework cannot be populated with real numbers, a limitation to keep stating honestly rather than filling with an invented figure.

**(c) AI-native data model.** Tawveeri's current model (relational tables + a search index, per the existing architecture) is **directionally sufficient for its current scale and does not need a vector or graph database rebuilt around it now.** Where each pattern actually earns its place, per this study's own evidence: **relational** — the identity/corroboration/price-history ledger (already correct, and matches how every serious comparator studied — Google, idealo, NAVER — structures this layer, none of which publicly disclosed a graph-database identity layer). **Search index** — product/query matching (already exists). **Vector embeddings** — only where genuinely justified by a specific feature (e.g., a future photo-to-product matching feature, §Phase-1 N, would need one) — not a platform-wide rebuild. **Graph** — relationship modeling (successor products, accessories, substitutes) is a real future candidate (Google's `related_product` attribute types are effectively a lightweight graph), but **should not be rebuilt now**; the existing relational schema can encode simple typed relationships without a new database technology. **What should NOT be rebuilt:** the core identity/price-history schema — it is Tawveeri's actual moat (§X), and every region researched confirms the winning pattern is "protect and deepen this," not "re-architect it."

**(d) Global catalog strategy.** Reconfirms Phase 1's existing finding, sharpened by this study's China/Google evidence: **scraper/feed/API hybrid remains correct**, with an explicit **feed-first transition trigger**: move a merchant from scraper to feed the moment they (i) already maintain a Google Shopping feed (§J objection #2's zero-effort tier) or (ii) run a platform with a public commerce API (WooCommerce Store API-class, already Tawveeri's proven credential-free path). GTIN/MPN/SKU: pursue via merchant onboarding (free), not paid identity-resolution services (Icecat, already rejected per existing memory) — Google's own GTIN-first-but-undisclosed-clustering model (§D.2) confirms this is the right posture, not a compromise. Freshness: scheduled, budgeted retrieval (§K), never real-time, per Tawveeri's own SEV-1 history. Condition, shipping, warranty: already the subject of Tawveeri's most rigorous, most-recently-hardened engineering (ADR-298-300) — ahead of every competitor studied, Saudi or global. Marketplace sellers (multi-seller-per-listing): not deeply evidenced as a current Tawveeri problem in this pass — flag as open, not solved. **Smallest merchant integration:** confirmed again by this study (§J, §K) as "give us the URL of your existing Google feed" — zero new artifact required from the merchant.

**(e) Mapping the original 14 named agent roles — not creating new agents, closing the coverage gap honestly.**

| Original proposed role | Disposition |
|---|---|
| Founder Intelligence Agent | **EXISTING SYSTEM** — Founder Command Center, Daily Truth (ADR-277-279) |
| Product Truth Agent | **DETERMINISTIC PIPELINE** — condition/identity/category gates (ADR-298-300); never an LLM agent, by design |
| Engineering Agent | **CLAUDE** |
| Quality Agent | **CLAUDE** (`ultrareview`) extending the **EXISTING SYSTEM** (Saudi Agent Benchmark, ADR-047) |
| Market Research Agent | **CLAUDE or ASTRA** (situational, per §S's table) |
| X/Social Intelligence Agent | **GROK** (X API-based monitoring, now materially cheaper per Phase 1) |
| Content Agent | **GROK** (cheap video/image generation) + **CLAUDE** (written drafts), both founder-approved before publish |
| SEO Agent | **DETERMINISTIC PIPELINE** (programmatic page generation gated to comparable products, §G.2) — not an agent decision |
| Merchant Intelligence Agent | **NOT NEEDED as a separate agent** — folds into the existing analytics/reporting pipeline (§S table row "Merchant diagnostics/reporting") |
| Partnership Research Agent | **NOT NEEDED** — no evidence of enough recurring partnership-research volume to justify a dedicated role; use Claude/Astra ad hoc, as this very study did |
| Affiliate Reconciliation Agent | **EXISTING SYSTEM** — the match-tier schema/importer is already built (ADR-216-era); blocked on a founder action, not an AI-readiness gap |
| Price Anomaly Agent | **DETERMINISTIC PIPELINE** — `tps:sanity` (ADR-282) already does this; do not duplicate with an LLM agent |
| Security/Health Agent | **DETERMINISTIC PIPELINE** (Health Watch, ADR-296) with **CLAUDE**-assisted triage of flagged anomalies only |
| Customer Insight Agent | **NOT NEEDED yet** — no support/customer-contact volume exists to analyze (§S table, "Support" row) |

**Net effect: zero new agents recommended.** Every one of the 14 roles maps to something that already exists, to one of the three vendors already in use, to a deterministic pipeline that should never be an LLM agent in the first place, or to "not needed yet" for lack of volume — exactly the discipline ADR-297 already established and this study reconfirms rather than overturns.

---

## T. FULL GLOBAL FEATURE/BUSINESS MATRIX

| | Tawveeri | idealo | PriceSpy | Kakaku | ShopSavvy | Keepa | Klarna/PriceRunner | Manmanbuy | SMZDM | Taobao/Qwen | JD | NAVER | BuyHatke | ShopBack | Google | Amazon | OpenAI | Rakhys (Saudi) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Price history | Yes, append-only | Yes | Yes (implied) | Yes | Degraded | Yes, deep | Yes | Yes, core | Partial | UNKNOWN | UNKNOWN | Implied via Universal Cart parity | Yes | No (cashback-focused) | Yes (Universal Cart) | No (own catalog) | No | No |
| Product identity/corroboration | Rigorous, tested | Undisclosed but real | Undisclosed | Undisclosed | Basic | Undisclosed | Undisclosed | Claims 95%+ coverage | UGC-based, not structured | SPU-based (unverified 2026 detail) | Unknown | Strong (26yr) | Basic | N/A | GTIN-first, undisclosed clustering | Own catalog only | GTIN-required (feed) | **Weak/absent ("From 1 store")** |
| Consumer AI/dialect | Deterministic + LLM phrasing | Own AI-company repositioning | None | None | None | None | Full assistant (Search/Recommend/Compare/Find) | Xiaozhi-class chatbot | 小值 chatbot | Qwen Shopping Assistant | JoyInside | AI Tab (real, 10M users) | None | None | AI Mode, extensive | Alexa for Shopping | ChatGPT Shopping (discovery) | Basic Rashed assistant |
| Retention mechanism | Price alerts | Price alerts | Price alerts | UNKNOWN | Trends/alerts (degraded) | Price alerts, deep | Personalized recs | Alerts | Community/UGC | 88VIP membership | UNKNOWN | Plus Membership (loyalty points) | UNKNOWN | Cashback | Universal Cart persistence | Purchase history | N/A | None |
| Merchant model | Free, infra built, unused | CPC or rev-share | CPC | Setup+monthly+click (unverified) | Metered API | Sub+metered API | Advertising services | CPS + B2B monitoring SaaS | CPS + agency services | Free tools, ad subsidy program | Free tools | Zero entry fee → payments/membership | UNKNOWN | CPA/affiliate | Free listings + paid ads | Feed partners only | Approved-partner feed | SAR 1,250-3,500/mo SaaS |
| Confirmed revenue | **SAR 0** | Real, ~€113M (2018) | Real | Real, flat 29yr | Small, real | Real | Real but underperforming (+5.6%/yr vs 25% group growth) | Real, growing | Real but declining core (−15.2% 2025) | Real, but AI segment losing money | Real | Real, +26.2% commerce | Real, small (<$1.2M) | Real, ~$500M+ GMV | N/A (ads, not disclosed separately) | N/A | N/A | Unconfirmed |
| Agentic-commerce posture | None | Live MCP (low traction, real supply) | None | None | Live MCP (low traction) | None official | Live "Agentic Product Protocol" (no adoption data) | Live MCP (2025) | Live MCP, real usage (2.24B calls H1'26) | Central strategic bet, unprofitable | Real (JoyIndustrial) | Real (AI Tab) | None | None | Central (UCP/AP2, live but human-gated) | Central (Alexa for Shopping) | Live (ACP, human-gated) | None |

---

## U. WHAT TAWVEERI IS DOING RIGHT

- **Product Truth/condition-gate rigor exceeds every Saudi competitor and is more conservative than most global ones** (Perplexity excludes ungrounded products; Tawveeri labels them UNKNOWN and keeps them — a defensible, disclosed choice).
- **The `/go`-never-intermediate exit architecture is structurally identical to where the entire industry, including Google and OpenAI, ended up converging** (§D.1, §D.2) — this was not obvious in advance and is now externally validated.
- **The append-only price-history ledger is the one asset every region's research confirms as time-earned and hard/slow to reconstruct — not instantly replicable regardless of capital or engineering effort** (China, Europe, Korea, US all converge on this finding independently; no technical proof of literal impossibility was sought or found, so "non-reconstructable" is avoided as an overstatement).
- **The constitutional "commercial interest never enters ranking" rule is not just ethics — it is the exact property that separates ShopBack's survival from Honey's collapse**, and the exact property regulators are actively fining Google for lacking.
- **The already-operating Grok×Claude loop (ADR-297) is more disciplined than most of what was found being attempted globally** — no agent sprawl, a real audit-before-build habit, a documented capability contract.

---

## V. WHERE TAWVEERI IS OFF-TRACK

- **Zero confirmed revenue after a full month of real, budget-anchored traffic** — the single largest unresolved item, unchanged since the August 2026 review, and still blocked purely on a founder action (obtaining one real affiliate report), not an engineering gap.
- **Merchant/catalog breadth is behind the leading Saudi competitor by a wide margin** (8 active stores vs. Rakhys's 38) — though Phase 1 already showed breadth-without-identity is close to worthless, this gap is still real and worth closing via the affiliate-network supply channel (§G.2), not via scraping more stores directly.
- **No visible neutrality/disclosure feature** — the constitutional policy exists but is not shown to the shopper, while two Saudi rivals (Shoof, Sa3rha) already make this a homepage feature.
- **No published original research despite having the exact data asset (price history + discount-integrity engine) that the highest-ROI idea in this entire study requires** — this is pure execution lag, not a capability gap.
- **No merchant economics framework existed until this document** — Tawveeri could not have set a defensible CPC or CPA before now, and still cannot until the unilateral-vs-cooperative measurement split (§K/§L) is actually run with a real pilot merchant.

---

## W. WHAT TO STOP

- Scaling any content/spend investment on categories with known-inflated demand data (AC/refrigerator) until the post-fix demand baseline is re-measured for two clean weeks (unchanged from Phase 1).
- Any temptation to build a **full MCP platform** or a new multi-agent orchestration platform ahead of *Tawveeri-specific* evidence of demand. This is narrower than Phase 1's original framing: China's SMZDM Haina (2.24B content-output calls in H1 2026, +474% YoY, 40+ integrated LLMs/agents/devices, real AI-attributed revenue) proves **global agent-data distribution is real and material at a mature, deep data-corpus scale** — the old "MCP demand is near-zero globally" claim does not survive that evidence and is retracted. What remains true and unretracted: **no Saudi-specific or Tawveeri-specific signal of agent-data demand exists yet**, and building a full platform now would be speculative. Keep the owned commerce/price-data architecture exportable (cheap, a config choice) and watch for measurable demand — do not build the platform. "No priority now" is not "no future value."
- Agentic checkout beyond Amazon's Auto-Buy shape — every platform studied gates on per-transaction confirmation or Amazon's narrow, bounded, single-retailer delegation (§D.2); nothing broader exists to emulate yet.
- Treating "AI agent" as a positioning axis for Tawveeri's own roadmap without in-market evidence Saudi consumers want autonomous purchasing over better-trusted comparison — even Google's own 2026 rollout faces this exact adoption skepticism.
- Building merchant analytics dashboards or AIGC content tools as sellable products — both are already free at hyperscale (§Q).

## X. WHAT TO DOUBLE DOWN ON

- The append-only price-history ledger and the condition/identity engine — confirmed, repeatedly, across every region, as the one durable asset class in this entire industry.
- Programmatic SEO strictly scoped to comparable products, paired with a published, reproducible price-truth report (§G.2, §N) — the single highest-ROI-per-riyal idea surfaced anywhere in this study, requiring publication, not engineering.
- Joining a real MENA affiliate network as a supply channel for comparable-product growth and a first revenue signal (§G.2) — this is the one action that unblocks the SEO ceiling, the merchant-economics framework, and the affiliate-revenue question simultaneously.
- Email + push price alerts as the retention system — already built, near-zero marginal cost, the single most-evidenced retention mechanism globally.

## Y. WHAT TO WATCH

- Google's Universal Cart and CSS-remedy timeline reaching the Middle East (currently no announced date, but the largest structural threat identified across both phases of this study).
- Amazon's Alexa-for-Shopping Saudi/Arabic availability — genuinely unknown in both phases, and the single most consequential unknown for the entire consumer-comparison thesis if it ships.
- Rakhys's and Shoof's respective B2B/merchant-lock-in motions (§D-Saudi, Phase 1 §D.3) — both are ahead of Tawveeri on distribution and could foreclose the merchant relationships Tawveeri needs.
- Whether Saudi Telegram penetration is actually large enough to justify more than an experiment (unmeasured in this pass — a genuine open question, not a settled negative).
- Whether Kakaku's ongoing $4.9B bidding war resolves in a way that changes its ownership's strategic priorities away from pure comparison (a live situational watch item, deadline was days after this research).

---

## Z. 90-DAY REBALANCING PLAN

Supersedes Phase 1 §BB where they conflict; both agree on item 1.

1. **Import one real Amazon or Noon commission report** — unchanged #1 priority, now the single blocker on the entire merchant-economics framework (§L) as well as every revenue claim.
2. **Publish a Saudi electronics price-truth/fake-discount report** using existing data — the single highest-ROI item across both phases of this study.
3. **Apply to and verify terms with a real MENA affiliate network** (Boostiny/ArabyAds-class) — confirm actual product/price/stock feed access and data-reuse rights (§G.4a) before counting on it for comparable-product-count growth; if verified, it unblocks supply growth, a first revenue signal, and merchant-economics data simultaneously — if not, it remains a monetization-only experiment.
4. **Surface the existing neutrality/disclosure policy as a visible homepage feature** — closes the gap to the local Saudi bar (Shoof, Sa3rha) at near-zero cost.
5. **Design and offer the Tier-0/Tier-1 merchant pilot (§K) to 2-3 existing feed-partner merchants** — no new engineering, reuses the existing provider framework; the goal is one real weekly report cycle and, ideally, one merchant willing to share aggregate conversion data (rung L1).
6. **Do NOT** build an MCP server, agentic checkout, voice shopping, a new multi-agent platform, or any merchant-facing AIGC/analytics product — no evidence anywhere in this two-phase study supports prioritizing any of these now.

## AA. 12-MONTH DIRECTION

Build toward, contingent on the 90-day items landing first: a Manmanbuy-style B2B price-monitoring line to a handful of Saudi brands (the single most transferable revenue idea from the China deep dive); a Saudi dialect lexicon layer under the existing deterministic parser; explicit-consent preference memory framed as a decision-inspectable extension of the trust engine (not a generic assistant-memory clone); a compounding, quarterly price-truth publication cadence. Continue monitoring, not building toward: Google's Middle East commerce timeline, Amazon's Saudi Alexa-for-Shopping status, and the two Saudi AI-native rivals' merchant-lock-in progress.

## AB. 3-5 YEAR PLAUSIBLE END STATE

The evidence across both phases points to one coherent, non-flattering-label-chasing shape: **a Saudi-specific decision-intelligence layer, monetized through a CPC/flat-fee merchant base plus a B2B price-monitoring/data line, with a narrow, evidence-gated agent-data exposure (MCP-class) kept cheap and optional rather than central** — structurally closest to NAVER's *shape* (comparison as entry point → payments/loyalty/community as the retention layer → an AI agent as the decision-speed differentiator) at a fraction of NAVER's scale and ambition, and closest to Manmanbuy's *revenue* pattern (consumer CPS + B2B monitoring) rather than SMZDM's cautionary agency-backfill pattern. This is not the most exciting available label ("AI commerce infrastructure," "Saudi's OpenAI for shopping") — it is the one every piece of global survivor evidence, in both phases of this study, actually supports.

## AC. SOURCE LEDGER

A durable pointer list for decision-critical claims in this document (full citation lists, with dates accessed, are preserved in the underlying research-agent transcripts referenced in this session; the entries below are the load-bearing ones for Phase 2's corrections and headline findings).

| Claim | Source | Accessed | Label |
|---|---|---|---|
| ACP not retired, live commits through 2026-07-18 | github.com/agentic-commerce-protocol/agentic-commerce-protocol | 2026-09 | PRIMARY_SOURCE |
| ACP commerce docs, approved-partner onboarding | developers.openai.com/commerce/ | 2026-09 | PRIMARY_SOURCE |
| UCP coalition membership | ucp.dev | 2026-09 | PRIMARY_SOURCE |
| Shopify demotes ChatGPT to referral-only | help.shopify.com/en/manual/online-sales-channels/agentic-storefronts | 2026-09 | PRIMARY_SOURCE |
| Klarna ChatGPT app redirects to merchant | klarna.com/international/press (2026-05-20 release) | 2026-09 | PRIMARY_SOURCE |
| Claude/OpenAI model pricing tables | platform.claude.com/docs, developers.openai.com/api/docs/pricing | 2026-09 | PRIMARY_SOURCE |
| Google Gemini "Personal Intelligence" memory toggle | support.google.com/gemini/answer/16598469, /16598623 | 2026-09 | PRIMARY_SOURCE |
| Amazon rebrand Rufus → Alexa for Shopping (2026-05-13) | aboutamazon.com | 2026-09 | PRIMARY_SOURCE |
| MCP registry shopping-server population, no usage telemetry | registry.modelcontextprotocol.io | 2026-09 | PRIMARY_SOURCE |
| Alibaba financial disclosures, Qwen app scale, AI segment losses | data.alibabagroup.com (Q2 2026, FY2026 releases) | 2026-09 | PRIMARY_SOURCE |
| SMZDM financials | stockanalysis.com/quote/SHE/300785, futunn.com | 2026-09 | INDEPENDENT_SOURCE |
| Manmanbuy MCP launch, B2B pricing | 36kr (via proxy), manmanbuy.com | 2026-09 | INDEPENDENT_SOURCE/PRIMARY_SOURCE |
| JD JoyIndustrial, 618 AI integration | jdcorporateblog.com | 2026-09 | PRIMARY_SOURCE |
| NAVER AI Tab user growth, decision-time metric | navercorp.com press releases (2026-06-26, 2026-07-15) | 2026-09 | PRIMARY_SOURCE |
| Priceza current scale, no AI feature | priceza.com | 2026-09 | PRIMARY_SOURCE |
| ShopBack facts, Honey comparison | en.wikipedia.org/wiki/ShopBack, /wiki/Honey_(browser_extension) | 2026-09 | INDEPENDENT_SOURCE |
| Google Shopping Graph scale, UCP/AP2, agentic checkout human-gating | techcrunch.com (multiple 2025-2026 dated articles, see full list in transcript) | 2026-09 | INDEPENDENT_SOURCE |
| Google antitrust rulings (idealo, PriceRunner) | reuters.com, heise.de, klarna press | 2026-09 | INDEPENDENT_SOURCE (figure conflict noted in §D.2) |
| Amazon Search Query Performance report schema | Amazon SP-API GitHub schema | 2026-09 | PRIMARY_SOURCE |
| idealo/PriceSpy/PriceRunner CPC model confirmation | pricespy.co.uk/information/about-pricespy, en/de.wikipedia | 2026-09 | PRIMARY_SOURCE/INDEPENDENT_SOURCE |
| ShopSavvy Data API pricing | shopsavvy.com/data | 2026-09 | PRIMARY_SOURCE |
| Saudi platform-reach data (Snapchat 72.9%, X 43.1%, Reddit 4.9%) | DataReportal Digital 2026: Saudi Arabia | 2026-09 | INDEPENDENT_SOURCE |
| idealo Instagram/LinkedIn follower counts | instagram.com/idealo, linkedin.com/company/idealo-internet-gmbh (live fetch) | 2026-09 | PRIMARY_SOURCE |
| OpenAI Instant Checkout de-emphasis, "Powering Product Discovery in ChatGPT" | Founder-cited as `openai.com/index/powering-product-discovery-in-chatgpt/`, dated 2026-03-24. **Direct re-fetch attempted this hardening pass — returned HTTP 403 (OpenAI's marketing domain blocks this session's fetch tool).** Direction is corroborated by the independently-verified `developers.openai.com/commerce/` (beta status, approved-partner gating) and by Shopify's own "discovery-focused referrer platform" characterization of ChatGPT | 2026-09 | `UNVERIFIED_RECALL` for exact wording; direction `INDEPENDENT_SOURCE`-corroborated |
| Amazon Auto-Buy (bounded delegated purchase at target price) | Originally confirmed in `docs/AGENT_ERA_PHASE0_RESEARCH_2026-08-27.md` §1.5 (internal research, CONFIRMED label at the time). **Re-fetch attempted this hardening pass at two guessed aboutamazon.com URLs — both returned 403/404.** Not independently re-quoted this pass; treated as previously-confirmed internal evidence, not newly verified | 2026-08-27 (original), 2026-09 (re-attempted) | Internal `PRIMARY`-labeled-at-capture; re-verification `NOT POSSIBLE` this pass |
| NAVER AI Tab: 4M users (2026-06-26), 10M users (2026-07-15), "60-70% decision-time reduction" | navercorp.com/en/media/pressReleasesDetail (seq=10034442, seq=10034523) | 2026-09 | PRIMARY_SOURCE |
| SMZDM Haina MCP: 2.24B calls H1 2026 (+474.36%), 40+ integrations, 11% AI revenue share | 163.com/dy/article (via proxy), cnfin.com m.cnfin.com/gs-lb (via proxy), zhihu.com/p/1911118043951654284 | 2026-09 | `INDEPENDENT_SOURCE`/`SELF_REPORTED` (snippet-level via reader-proxy fetch, not a direct financial-filing read) |
| Manmanbuy B2B pricing (tens-of-thousands to 100,000+ CNY/client) | 36Kr interview, **dated 2020** — re-checked this hardening pass via direct fetch of `manmanbuy.com/about.aspx` (404, no current pricing page found) | 36Kr: 2020; re-check: 2026-09 | `HISTORICAL VERIFIED COMMERCIAL PRECEDENT (2020)`; current price `UNKNOWN` |
| Boostiny/ArabyAds publisher-side capability (feed/API/GTIN/data-reuse) | boostiny.com homepage, direct fetch this hardening pass | 2026-09 | `PRIMARY_SOURCE` for what the page shows (5,000+ supply partners, 300+ brands, coupon-attribution technology); publisher feed/API/GTIN/data-reuse terms `UNKNOWN` — not published |
| DataReportal Saudi Arabia platform-reach caveat ("potential ad reach ≠ active users") | DataReportal Digital 2026: Saudi Arabia, methodology notes | 2026-09 | `INDEPENDENT_SOURCE`, caveat is DataReportal's own stated methodology limitation |

**Note on source durability:** several of the above (TechCrunch article URLs, GitHub commit hashes, live follower counts) are time-sensitive and will drift; treat the *finding* as the durable artifact and the URL as the September 2026 pointer to it.

---

## AD. FINAL FOUNDER DECISION

**Overall: CONTINUE_BUT_REBALANCE** (upgraded in specificity from Phase 1's CONTINUE_BUT_REPOSITION — the underlying direction was right; Phase 2's evidence sharpens *where* the rebalancing effort goes).

| Decision axis | Verdict | Evidence |
|---|---|---|
| **Product architecture** | **CONTINUE, unchanged.** The deterministic/AI boundary (ADR-002), the condition/identity engine, and the `/go`-never-intermediate exit model are all independently validated by this study — not just defensible, but ahead of most global peers on rigor. | §D, §U |
| **Business model** | **REBALANCE.** Stop assuming pure CPC/affiliate is sufficient (SMZDM's 5-7% margin at $1B scale is a warning); add a B2B price-monitoring line (Manmanbuy's proven pattern) as the next real revenue target once real merchant-cooperation data exists. | §L, §N |
| **Marketing/distribution** | **REBALANCE, sharply.** Move from theoretical channel coverage to the specific invest/experiment/defer system in §G — programmatic SEO on comparable products, price-truth publication, email/push, X, and MENA-affiliate-network supply are the five real near-term levers; everything else is correctly deferred by evidence, not neglect. | §G |
| **Merchant** | **REBALANCE.** A real objection-handling playbook, pilot design, and economics framework did not exist before this document — they now do, and the 90-day plan operationalizes them. | §J, §K, §Z |
| **AI** | **CONTINUE, cautiously.** The existing Grok×Claude/Founder-Intelligence model is sound and should not be expanded into more specialized agent roles without a named recurring task each role would uniquely cover (§S.1's 14-role mapping confirms zero new agents are justified). The corrected evidence (Amazon's real bounded-delegation Auto-Buy, SMZDM's real agent-data traction) argues against complacency, but the corrected MCP framing (§AC hardening) still argues against building a full platform now — "no priority now" is not "no future value." | §S, §S.1, §D.2, §AC |

**Re-evaluated after this hardening pass: the overall verdict does not change.** CONTINUE_BUT_REBALANCE stands. None of the six corrections in this hardening pass (OpenAI, Amazon Auto-Buy, MCP, Manmanbuy dating, the merchant-data distinction, the MENA-network downgrade) alter the direction — several sharpen it. The clearest net effect of this pass is that **the world has moved slightly further into delegated AI commerce than Phase 2's first draft acknowledged** (Amazon's bounded delegation, China's real agent-data revenue) — which raises, not lowers, the value of Tawveeri's underlying asset (verified, structured, fresh product truth) as the substrate any such delegation would need to trust.

**Answering the founder's real question — "are we building the right company for the next 3-5 years, not just is today's website good":** yes, directionally, with the rebalancing above. Every region researched in Phase 2 converges on the same structural lesson Phase 1 found in the West alone: **the durable asset is a time-locked, verified observation corpus, monetized through some combination of neutral-CPC consumer traffic and B2B data/monitoring services sold to brands — never through hidden attribution, never through owning checkout, and increasingly not through catalogue breadth alone.** Tawveeri already has the hardest-to-build piece of that shape (the corpus and the discipline protecting it). What was missing, and what this two-phase study now supplies, is the distribution system, the merchant economics, and the honest global calibration of what to build next versus what every larger, better-funded competitor has already tried and abandoned.

### AD.1 What Tawveeri must be ready for if bounded delegated AI shopping becomes normal in Saudi Arabia

**Not a recommendation to build checkout now.** Amazon's Auto-Buy (§D.2) proves bounded delegation is already real at consumer scale, narrowly, in one market. If a Saudi-relevant version of this pattern (a shopper sets a target price/spec, an agent — Tawveeri's own or a third party's — monitors and acts within bounds) becomes normal, what Tawveeri would need to already have in place, none of which requires building the delegated-execution feature itself:

- **Machine-readable product truth** — the existing `AggregateOffer`/`ItemList` schema work (Phase 1 §P) is the same substrate a delegated agent would need to trust a price claim; keep investing here regardless of whether Tawveeri itself ever executes a purchase.
- **Structured constraints** — the existing shopper-constraint model (ADR-290's fridge/lock example) is directly the shape a delegation-bound needs ("never buy above X," "must have feature Y") — this is not new work, it is the same discipline already built for conversational search, exposed the same way to a future agent.
- **Fresh, verified prices** — the append-only price-history ledger, unchanged as the moat (§X), becomes *more* valuable, not less, if agents start acting on stale prices elsewhere and a verified-fresh source becomes the trust differentiator.
- **Monitoring and alerts** — already built (price_alerts); a bounded-delegation feature is, mechanically, an alert with a pre-authorized action attached — the alert infrastructure is the harder half, and Tawveeri already has it.
- **Permissions and delegated-action scoping** — not built, and correctly not recommended for building now; but the design principle to hold ready is Amazon's own: a human sets the bound once (price, spec, budget), the system never exceeds it, and every action is notified and cancellable within a window. If this is ever built, it must sit **behind** the deterministic Product Truth layer, never inside an LLM's discretion (ADR-002, unchanged).
- **Merchant-owned transaction, always** — every platform studied, including the one with bounded delegation (Amazon), keeps the transaction itself on the seller's own systems. Tawveeri's `/go`-never-intermediate model requires no change to remain compatible with this future.
- **Provenance and auditability** — the existing evidence-citation discipline (never assert a fact without its source) is exactly what an auditable delegated-purchase trail requires; this is already Tawveeri's default behavior, not a gap.

**The honest summary: Tawveeri does not need to build anything new to be ready for this future — it needs to keep building what §X already recommends doubling down on (the corpus, the identity engine, the constraint model, the alerts system, the evidence discipline) and resist the temptation to build the delegated-execution feature itself before there is Saudi-specific evidence anyone wants it from a comparison site rather than from the merchant or the platform directly.**

---

*End of Phase 2, hardened. Read-only throughout; no code, data, migration, campaign, contact, or publication was made in its preparation. This hardening pass corrects six specific issues identified by independent review (OpenAI's ACP-vs-Instant-Checkout conflation, the Amazon Auto-Buy human-gating overstatement, the MCP-demand reconciliation, the Manmanbuy pricing date, the generic-vs-proprietary merchant-data overgeneralization, and the MENA-affiliate-network supply assumption) plus two smaller precision fixes (the Snapchat ad-reach-vs-active-users distinction, and "non-reconstructable" softened to "time-earned/hard-to-reconstruct"), each disclosed with its verification status rather than silently applied. Founder + advisor will review before any execution decision. No Phase 3 is proposed or begun.*
