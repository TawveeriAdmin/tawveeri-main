# AGENTIC_COMMERCE — UCP / ACP / MCP: our exposure and position

**ADRs checked:** ADR-090, ADR-095, ADR-102, ADR-104, ADR-105, ADR-106, ADR-107, ADR-108 (credential-free feed onboarding + the credential deadlock). Labels: **[MEASURED today]** (primary evidence — I fetched the actual files) / **[TRAINING]** (my prior knowledge) / **[FOUNDER — UNVERIFIED THIS TURN]** (WebSearch budget was exhausted 200/200; could not corroborate externally).

---

## P1-6 — What the protocols are (verified where possible)

- **UCP is live and real [MEASURED].** I fetched real `/.well-known/ucp` files. They declare `"ucp": { "version": "2026-04-08", … }`, list a `dev.ucp.shopping` service, reference OpenAPI/OpenRPC schemas at **`ucp.dev`**, and one store (sonyworld) lists **two supported versions (2026-01-23 and 2026-04-08)** — consistent with a Jan-2026 launch that evolved by April. So UCP exists, is decentralised (a JSON profile on each merchant's own domain), and is versioned.
- **UCP is built ON MCP [MEASURED].** The profiles expose an **MCP transport** endpoint (najm → `https://najm.store/_app/ucp`; sonyworld → `https://sony-mea-ksa.myshopify.com/api/ucp/mcp`). This directly confirms MCP (Anthropic) is the real-time agent transport — and matters for P1-9.
- **Decentralised, no gatekeeper [MEASURED].** Each store hosts its own profile; any agent can read it. Salla (najm/aletawik → `accounts.salla.com` identity), Shopify (sonyworld → `myshopify.com`), and Zid platforms **auto-publish** it for their merchants.
- **[FOUNDER — UNVERIFIED THIS TURN]:** exact launch date 2026-01-11, Google+Shopify attribution, the Tech-Council membership (Amazon/Meta/Microsoft/Salesforce/Stripe, 2026-04-24), and OpenAI+Stripe **ACP** powering ChatGPT shopping at ~50M queries/day. I could not run WebSearch (budget 200/200 exhausted). The *core* (UCP live, decentralised, MCP-based, transactional) is verified by the files; the ecosystem/volume claims are plausible and consistent but unconfirmed by me this turn.

---

## P1-7 — OUR EXPOSURE (the decisive measurement) [MEASURED today]

I probed `https://{domain}/.well-known/ucp` for all registered stores.

| Publishes UCP (200 + JSON) | Does NOT (404 / non-JSON) |
|---|---|
| **najm.store**, **blackboxksa.com**, **hdf.com.sa**, **goldenstore99.com**, **aletawiksa.com**, **pcpalace.com.sa**, **sonyworld.sa** (7) | jarir.com (404), **amazon.sa (404)**, **noon.com (200 html)**, **extra.com (404)**, **almanea.com/.sa (404)**, samsung.com (404), shakersa.com (200 html), mhzm.sa (200 html), luluhypermarket.com (406), sharafdg.com (200 html) |

**Two decisive facts:**
1. **All 7 UCP publishers are our mid-market Salla/Shopify/Zid stores** (the ones we onboarded credential-free via ADR-095/104/106/107/108). Their **platforms auto-publish UCP** — we get it for free.
2. **ZERO of the blocked majors publish UCP** (Amazon, Noon, Jarir, Extra, Almanea, Samsung, LuLu, Sharaf DG). **∴ The credential deadlock for the majors (ADR-090/105) is NOT solved by UCP.** Plainly: a public file does not open the majors — they run enterprise platforms / their own walled agent programs, not the open `.well-known` standard.

**What a UCP profile exposes [MEASURED]** (najm, sonyworld, aletawik): `catalog.search` + `catalog.lookup` (product discovery), `cart` + `checkout` + `order` + `fulfillment` + `discount` (an agent can BUY, via embedded checkout), **seller/merchant identity** (e.g. "Sony World - KSA", merchant_id), payment handlers (Apple/Google Pay, Tamara). **Prices and stock are served via the catalog API the profile points to (real-time), not inline.** **Warranty is NOT present** in the profiles checked.

**Quality vs our scraping [INFERRED]:** for the 7 UCP stores, the UCP catalog API is **structured, real-time price + stock + availability + checkout, credential-free** — strictly better than scraping (it also fixes the unreliable stock signal, C2, for these stores). **What it would replace:** the scraper/feed adapters for those 7 stores → direct UCP catalog reads. **But** these are mid-market with low comparison overlap (ADR-105/106) — so this is a **data-quality** win, not a comparison-breadth win.

---

## P1-8 — Threat assessment (honest, no reassurance)

**The threat is real.** If Saudi retailers adopt UCP broadly, agents (Google/OpenAI) can discover, compare and buy by reading merchants' UCP directly — **the raw comparison function is being commoditised**, and our mid-market tail already exposes it publicly.

**What remains defensible — verified against the actual UCP schema, not assumed [MEASURED]:** UCP is **per-merchant, current-state, and transactional**. It contains none of:
- **Cross-merchant Saudi product identity (TPS + GTIN).** `catalog.lookup` is a *per-merchant SKU*; no merchant's UCP says "this is the same product Jarir sells." The Saudi-wide canonical linking layer is inherently third-party. **Defensible.**
- **Observed Saudi price HISTORY.** UCP gives the current price; it cannot say "this was 69 last week." Our `price_history` + `verified_drop` is not, and cannot be, in a single merchant's profile. **Defensible — our #1 asset (item 1).**
- **Discount integrity** (advertised "was" vs what we observed). A cross-time, cross-source judgment. Not in UCP. **Defensible.**
- **Warranty / installation / regional-variant knowledge.** Absent from the profiles checked (may appear inside catalog product data — unverified). **Partially defensible.**

**The sharpest risk:** an agent can aggregate *many* merchants' UCP and become the comparison layer itself. Our defence is not "we compare" (agents can) — it is **the intelligence an agent cannot cheaply compute**: Saudi canonical identity, price history, and trust verdicts. The moment an agent wants "is this discount real / which Saudi store is cheapest for the *same* product / what's the price trend," it needs a Saudi truth source. That is the only durable position.

---

## P1-9 — Position: the Saudi product-truth MCP server (SCOPE ONLY — do not build)

**Thesis:** don't compete with global agents on discovery/checkout (UCP/ACP already own that, and the majors are walled). Become **the Saudi product-truth layer the agents call** — via MCP (which UCP already uses as transport, so it's the native plug).

**Exposable TODAY from production [MEASURED — the tables exist]:** canonical identity (`canonical_products`), observed price history (`price_history`), discount-integrity verdicts (`tps_listing_price_facts` — the 925 verified drops), per-merchant trust (`tps_merchant_trust`), regional/warranty facts (`stores.*` + specs).

**Missing before it's sellable/safe:** a hardened public MCP endpoint (auth, rate-limit); **GTIN linking** (item 9 / 11I) to make identity authority-grade; and — critically — **the data-quality bar must be met first**: the identity-merge defect (white-vs-black, first-party-vs-marketplace) and the Extra listing issues mean an MCP server today would serve wrong merges. **Serving bad identity to 50M agent queries is worse than not serving.** Fix identity first.

**Risk vs reach:** giving away the asset (agents read our history/identity, stop sending users) **vs** being the *cited Saudi source* inside high-volume agent queries (brand/attribution + a B2B licensing line — the ADR-051 merchant-intelligence thesis). The honest call: the MCP server is strategically correct **and** premature until identity quality + GTIN land. Scope it now; gate the build on those.

---

## Bottom line for the founder

- **UCP does not rescue the majors** (0/8 publish it) — the credential deadlock stands for Amazon/Noon/Jarir/Extra/Almanea.
- **UCP is a free data-quality upgrade for our 7 mid-market stores** (structured real-time price/stock/checkout) — an ingestion opportunity, not a comparison-breadth one.
- **The moat is confirmed to be exactly what we already hold** — Saudi identity, price history, discount integrity — none of which any merchant's UCP contains.
- **The strategic move is an MCP truth-server**, gated on fixing identity quality and landing GTIN. Do not build yet.

> Primary sources (fetched today): `najm.store/.well-known/ucp`, `sonyworld.sa/.well-known/ucp`, `aletawiksa.com/.well-known/ucp`, and the 22-domain probe. No web-search sources (budget exhausted).
