# Black Box KSA — Retailer Onboarding & Promotional Intelligence

**Status date: 2026-08-06 (three passes same day).**
**Pass 1 decision (ADR-217): BOUNDED_CATEGORY_ONBOARDING — ingestion-only, not displayed.**
**Pass 2 decision (ADR-218): RELEASED for customer display**, after a recorded production audit
passed F3, plus a real pre-existing cross-retailer display-gate leak found and fixed in the same
pass (see §14).
**Pass 3 decision (ADR-219): campaign LEVEL 2 web release** — official first-party evidence
(the retailer's own verified X post) confirmed the "مهرجان الريال" mechanism is real and active,
but not the exact SAR-1 pairing; product-level eligibility is released with automatic TTL-based
expiry (see §15).

This document is the durable record for onboarding Black Box (الصندوق الأسود, blackbox.com.sa)
into Tawveeri, superseding every prior "blackbox bot-walled" note in this repo. See ADR-217,
ADR-218, and ADR-219 in `docs/DECISIONS.md` for the decision-register entries.

---

## 1. Final decision

**BOUNDED_CATEGORY_ONBOARDING.**

- Store `10` / slug `blackbox` re-admitted to `APPROVED_STORE_IDS` (ingestion approved) and to
  `TPS_STORES` (normalization sweep) — so ingested observations are not a repeat of the
  LuLu/Sharaf DG defect (ingested, never swept, never reaches a comparison).
- Still listed in `COMPARISON_DISPLAY_EXCLUDED` — **NOT customer-displayable**. F3 applies:
  approved for ingestion is not approved for public display. Removing it from that set requires a
  recorded production audit (real product identity, real prices, real outbound links, a manual
  sample review) — not present yet, so this document does not claim one.
- Sourcing bounded to major-appliance categories via `nextjsSsr.categoryKeywords`:
  refrigerator, washing-machine, dishwasher, air-conditioner/split, television, laptop, mobile.
- The specific "buy fridge, get washer for 1 SAR" pairing the Founder observed was **not**
  independently corroborated to first-party specificity (see §7). The platform's real conditional
  "gift" mechanism (§6) was found and is captured as evidence, never as a price.
- Not CAMPAIGN_ONLY_VERIFIED_INGESTION: the specific campaign screenshot wasn't corroborated to
  the precision this task requires, so it isn't modeled as a standalone campaign feature.
- Not FULL_ONBOARDING: sourcing works well but has not yet had a production audit across the
  whole catalogue, and category scope was deliberately bounded per the Founder's own priority
  list rather than pulling everything on day one.
- Not HOLD_FOR_FEED_OR_PARTNERSHIP: a credential-free route was proven live; there is no reason to
  wait on a partnership for the standalone catalogue.
- Not REJECT_AS_UNSAFE: no legal/access/identity risk was found once the domain was corrected.

## 2. Retailer identity verification

- **Confirmed official domain:** `https://blackbox.com.sa` — Arabic homepage title "تسوق أجهزة
  منزلية, مكيفات, تلفزيونات والجوالات | الصندوق الأسود", unified number `8003022200`, email
  `online@blackbox.com.sa`, terms page at `/terms-conditions`.
- **Domain-collision finding (critical):** `blackboxksa.com` — the domain already recorded in
  this codebase's `stores` table (id 10) and in `src/lib/providers/registry.ts`/
  `src/lib/retailers/approved-retailers.ts` before this task — is a **different, unrelated
  merchant**: outdoor/camping gear, car accessories, tea/coffee brewing sets, cooling systems
  (confirmed live via direct fetch of its homepage content). Every prior "Black Box is
  bot-walled / Cloudflare 403 / zero observations" finding in `docs/DECISIONS.md`,
  `docs/RETAILER-MATRIX.md`, `docs/RETAILER-FRESHNESS.md`, `docs/PRIORITY-STORES-COVERAGE.md`,
  and `src/lib/providers/registry.ts`'s old `salla: { origin: "https://blackboxksa.com" }`
  config tested the **wrong domain and the wrong platform** (it isn't Salla either).
- **Social account relationship:** `@blackboxksa` (X/Twitter) is a legitimate account for the
  real appliance retailer — its bio/description matches blackbox.com.sa (home appliances,
  electronics, mobile phones, air conditioners, televisions, unified number 8003022200). The
  Instagram handle actually driving 167K followers of appliance content is `@blackboxsa`.
  `@blackboxksa` (the social handle) and `blackboxksa.com` (the domain) are NOT the same thing —
  the handle is real Black Box, the `.com` domain is the unrelated merchant. This is a genuine
  instance of the domain-collision risk class (ADR-135/ADR-191 precedent: names/handles are not
  proof of domain ownership).
- **Canonical retailer identity:** `stores.id = 10`, `slug = 'blackbox'`, `name_ar = 'الصندوق
  الأسود'`, `name_en = 'Black Box'` (corrected from a duplicated Arabic value), `domain =
  'blackbox.com.sa'`. No new alias/duplicate identity was created — the existing row was
  corrected in place.

## 3. What existed before this task

- **Code:** `stores.id = 10` already existed (zero `raw_observations`, zero `product_stores` —
  confirmed live via read-only query before any change). `src/lib/retailers/approved-retailers.ts`
  already listed `blackbox` with `domain: 'blackboxksa.com'`, `source: 'blocked'`, out of
  `APPROVED_STORE_IDS`, inside `COMPARISON_DISPLAY_EXCLUDED`. `src/lib/providers/registry.ts`
  already had a `blackbox` provider entry with `enabled: false` and a Salla config pointed at
  `blackboxksa.com`.
- **Database:** the `stores` row existed with the wrong domain in `link`/`website_url`, and
  `name_en` duplicating the Arabic name. Zero ingestion history of any kind.
- **Docs:** `docs/DECISIONS.md`, `docs/RETAILER-MATRIX.md`, `docs/RETAILER-FRESHNESS.md`,
  `docs/PRIORITY-STORES-COVERAGE.md`, `docs/acquisition-classification.md`, and
  `docs/acquisition-batch1-intel.csv` all recorded Black Box as bot-walled/blocked/deferred — all
  against the wrong domain (one entry, `acquisition-classification.md`, already flagged the
  discrepancy: "our prior blackboxksa.com reg was UA-gated", without resolving it).
- **Prior attempts:** ADR-095 (2026-07-25) tried a Salla sitemap+JSON-LD adapter against
  `blackboxksa.com` and found its sitemap UA-gated; registered the provider disabled pending a
  category-crawl fallback. That fallback was never built because the underlying premise (Salla,
  that domain) was wrong.

## 4. Research findings

- **Platform:** Not Salla, not Shopify, not standard Magento GraphQL. `blackbox.com.sa` is a
  Next.js-SSR frontend (`_next/static/chunks`, `id="__next"`, `__NEXT_DATA__`) over a proprietary
  REST backend at `api.ops.blackbox.com.sa` (Magento-shaped media paths, e.g.
  `store.ops.blackbox.com.sa/media/catalog/product/...`, but no public Magento GraphQL endpoint
  was used or needed).
- **Sitemap:** `https://www.blackbox.com.sa/sitemap.xml` (declared in `robots.txt`) enumerates
  ~2,183 URLs, ~1,659 of them product pages, credential-free, no auth. One transient Cloudflare
  interstitial was observed on a first sitemap fetch and resolved on a plain retry — not a JS
  challenge, treated as ordinary flake (the adapter retries once).
  `robots.txt` disallows only account/cart/checkout/search/admin/facet-parameter paths — product
  and category pages are explicitly crawlable.
- **Per-product structured data:** every product page server-renders its full commerce record into
  `<script id="__NEXT_DATA__">` → `props.pageProps.displayedProductsRatings`: `sku`, `name[]`,
  `display_price`, `prices_with_tax.{price,original_price}`, `stock.{is_in_stock,qty}`,
  `_media_.image[].image` (absolute CDN URLs), `category[]`, and — critically — `free_gifts[]`,
  `bundle_discount_products[]`, `cross_sell_products[]`, `up_sell_products[]` (see §6). No JS
  execution is required to read any of this; plain `fetch()` with a standard UA returns it.
- **No CAPTCHA/bot-wall observed on product pages** during verification (dozens of pages fetched
  via plain HTTPS GET, both via `curl` and Node's native `fetch`, with a Googlebot-style UA).
- **Campaign/affiliate findings:** see §7 and §9.

## 5. Ingestion route

**Selected:** a new sourcing adapter, `src/lib/providers/sourcing/nextjs-ssr-adapter.ts`
(`SourcingMode: "api"`), registered in `src/lib/providers/sourcing/router.ts`. Config type
`NextjsSsrConfig` added to `src/lib/providers/types.ts` (`origin`, optional `sitemapUrl`,
optional `categoryKeywords[]` for bounded-category onboarding — an English-slug substring
allow-list applied to sitemap product URLs before any page is fetched).

Route: `sitemap.xml` → filter to in-scope product URLs → bounded-concurrency (4) fetch of each
product page → extract `__NEXT_DATA__.props.pageProps.displayedProductsRatings` → map to
`ScrapedProduct`.

**Alternatives rejected:**
- *Salla API/JSON-LD* (the pre-existing config) — wrong platform entirely; blackbox.com.sa is not
  Salla, has no JSON-LD Product blocks and no Salla storefront API.
- *Magento public GraphQL* — the backend is Magento-**shaped** (media paths, `?___store=` in
  robots.txt) but does not expose a public `/graphql` the way the existing `magento-graphql-
  adapter.ts` expects; the proprietary `api.ops.*` REST API is not documented and was not
  reverse-engineered further than confirming it exists (bounded scope — the SSR JSON route
  already gives everything needed without touching an undocumented API).
- *Bounded Puppeteer rendering* — used only during **research** (to capture the `api.ops.*`
  network calls and confirm the CSR-vs-SSR question), not adopted for production ingestion: the
  SSR `__NEXT_DATA__` route is simpler, faster, and needs no browser.

**Why this route is sustainable and safe:** credential-free, no CAPTCHA/JS-challenge encountered
on the actual data path, respects `robots.txt` (no disallowed path is fetched), bounded
concurrency (4 concurrent requests), bounded category scope, bounded page count
(`opts.maxPages`), and a hard price floor (§8) that fails closed rather than risking a
fabricated price.

## 6. The real conditional-offer mechanism (verified structural evidence)

Black Box's own platform models conditional add-ons as **first-party structured data**, not
marketing copy:

- The site's own i18n dictionary (shipped in every page's `__NEXT_DATA__`) contains native
  strings for a "1 SAR Offer" cart mechanic: `"1 SAR Offer": "+ عرض ال 1 ريال"`,
  `RiyalOfferDuplicateNotAllowed`, `RiyalOfferQtyIncreaseNotAllowed` — this is a real,
  currently-shipped feature of their checkout, not a rumor.
- A campaign category exists and is **active**: `category_id 1133`, `url_key: "riyal-festival"`,
  name "مهرجان الريال", `is_active: "1"`, meta description "اشتري منتج واحصل على منتج بريال واحد
  فقط" ("buy a product and get a product for just 1 riyal"). It held ~734–736 items at time of
  verification (general merchandise + some appliances, small-appliance-heavy in the sampled page).
- Every product record carries a `free_gifts[]` array. Scanning 366 major-appliance product
  pages (refrigerator/washing-machine/dishwasher/air-conditioner/split), **16 currently have a
  populated `free_gifts[]`** — each entry: `product_name`, `product_name_ar`, `product_price`
  (regular), `product_special_price` (the conditional add-on price), `url`, `product_image`.
  Sampled `product_special_price` values: 59, 299, 555, 849, 959, 1349, 1849 SAR — **none observed
  at literally "1"** in this sample (see §7 for what this does and doesn't prove).
- `bundle_discount_products[]`, `cross_sell_products[]`, `up_sell_products[]` also exist on the
  record but were empty on every sampled product.

**How this is handled:** `free_gifts[]` is captured into `specifications.free_gifts` on the
qualifying product's `ScrapedProduct` as **preserved evidence** (provenance never dropped) — it
is read nowhere else. No schema for a `campaigns`/`promotions` table was added in this pass (see
§13) because there is not yet verified, precise pairing data to populate one responsibly, and the
task's own rule against speculative, unpopulated configuration applies here.

## 7. Campaign verification

| Question | Answer |
|---|---|
| Is a "buy X, get Y at a reduced price" mechanic active on the platform? | **Yes** — structurally confirmed (§6), currently shipping. |
| Is the *exact* Founder-observed pairing (fridge→washer SAR 1, washer→dishwasher SAR 1) confirmed first-party? | **No.** The 3 major-appliance products individually sampled (an LG fridge, an LG washer, a Thomson dishwasher) were not in the riyal-festival category and carried empty `free_gifts[]`. Of 366 appliance pages scanned, 16 had a populated `free_gifts[]`, and none of those 16 sampled pairs were fridge↔washer or washer↔dishwasher, and none showed a literal "1" SAR value. |
| Exact start/end dates for the Founder's specific pairing | **Unknown** — not found. |
| Online, in-store, or both | **Unknown** for the specific pairing. The general "1 SAR Offer" mechanic is a cart-level feature, implying it is at least available online. |
| Exact eligible models | **Unknown** for the specific pairing. |
| Branch/financing/quantity restrictions | **Not investigated** — moot without a confirmed specific pairing to investigate restrictions for. |
| Third-party coupon-aggregator claims (3orod.today, coupon sites) of "buy appliance, get one for 1 SAR" | Found, and explicitly **not** treated as evidence per this task's own rule — used only as a discovery lead that motivated the `free_gifts[]` structural investigation, which independently confirmed the underlying mechanism (though not the specific pairing). |

**Conclusion:** per the task's own instruction — "if exact eligible pairs cannot be verified, do
not create inferred pairings; surface only the level of truth actually proven" — this pass does
**not** implement a customer-facing campaign representation. What is proven (the mechanism, via
`free_gifts[]`) is preserved as evidence. What is not proven (the specific pairing/dates the
Founder saw) is not fabricated, modeled, or displayed.

## 8. SAR-1 promotion safety (the hard invariant)

Because no promotion schema was built (§6, §13), the invariant is enforced by the simplest
sufficient control: **the adapter never reads a price from anywhere except the qualifying
product's own `prices_with_tax.price` / `display_price` fields, and drops (returns `null` for)
any observation priced at or below a 5 SAR floor** (`RIYAL_OFFER_FLOOR_SAR` in
`nextjs-ssr-adapter.ts`) rather than ever writing it as a standalone price.

- `free_gifts[].product_special_price` is copied only into `specifications.free_gifts` — never
  into `current_price`, `original_price`, or any other price field. It never reaches
  `price_history` (which is written from `current_price`), never reaches `tps_product_projection`
  (built from `price_history`/`raw_observations`), never reaches search/Algolia indexing (built
  from the same chain), and can therefore never appear as a product card, a "cheapest price"
  claim, or an AI-recommendation price.
- Regression test: `tests/providers/nextjs-ssr-adapter.test.ts` — "drops (never stores) an
  observation priced at or below the SAR-1 safety floor" (asserts both a literal 1 SAR and a 5 SAR
  observation map to `null`), and "preserves free_gifts as evidence in specifications without
  touching current_price" (asserts a product with a `free_gifts[].product_special_price` of "1"
  still reports its own real price, and that "1" appears nowhere in the price fields).
- Because `blackbox` stays in `COMPARISON_DISPLAY_EXCLUDED` (§1), no Black Box price of any kind
  — standalone or otherwise — reaches a customer surface in this pass regardless.

## 9. Affiliate / attribution readiness

- No public Black Box affiliate/publisher/partner program was found during this task.
- `src/lib/providers/registry.ts`'s `blackbox` entry has `affiliate: null` → `direct` exit (no
  fabricated tag), consistent with the framework's "no program ⇒ plain direct link" invariant
  (`src/lib/providers/types.ts`). This is correct and needs no further code change if/when a
  program is later confirmed — only the registry's `affiliate` field would change.
- **Founder action, if desired:** contact Black Box's business-development/marketing team (the
  storefront lists a unified customer number `8003022200` and `online@blackbox.com.sa`; no
  dedicated affiliate/BD contact was found in this pass) to ask about (a) a formal affiliate or
  referral program, and (b) official terms for the "1 SAR" conditional-offer campaign (exact
  eligible pairs, dates, channel/branch scope) — which would let Tawveeri represent the specific
  promotion the Founder saw, safely, instead of only the general mechanism recorded here.

## 10. Known limitations

- Category scope is bounded to `categoryKeywords`: refrigerator, washing-machine, dishwasher,
  air-conditioner/split, television, laptop, mobile. Widening it is a one-line config change but
  should follow a production audit of this scope first.
- The specific Founder-observed SAR-1 pairing is unverified (§7) and is not represented anywhere.
- No promotion/campaign schema exists yet; `free_gifts[]` is preserved as evidence only, not
  surfaced to customers.
- `brand` is left blank in mapped offers (the SSR record's brand fields are attribute-option IDs,
  not names); downstream category/spec extraction from the product title is expected to recover
  it, same as other adapters that don't get a clean brand string from their source.
- Historical snapshot docs (`docs/RETAILER-MATRIX.md`, `docs/RETAILER-FRESHNESS.md`,
  `docs/PRIORITY-STORES-COVERAGE.md`, `docs/acquisition-classification.md`,
  `docs/acquisition-batch1-intel.csv`) still describe the old, wrong-domain "blocked" state —
  left as dated historical snapshots (consistent with how this repo treats past analysis passes)
  rather than rewritten; this document and `docs/DECISIONS.md` ADR-217 are the current source of
  truth.
- No public retailer count or comparable-products figure changed as a result of this task —
  Black Box is not customer-displayable, so `docs/LAUNCH_VOCABULARY.md`'s **705** comparable-
  products figure is untouched and did not need amendment (F1 verified, not silently changed).

## 11. Production metrics (bounded ingestion run)

Run via the existing `scripts/tps-core/ingest-via-provider.ts blackbox --max-pages 2` (dry-run
first per ADR-099, then a real write — both against production, `assertFingerprint`-guarded to
`vyceqrzttspyycdpojtn`). This is a single bounded one-off run, not looped and not layered under
the scheduler.

| Metric | Value |
|---|---:|
| Product pages in scope (sitemap, category-keyword-filtered) | 1,659 total product URLs on the sitemap; 376 in the bounded category scope at time of measurement |
| Pages fetched this run (`--max-pages 2` → 200 URLs) | 200 |
| Valid standalone offers parsed | 199 |
| Dropped (redirect / missing SKU or price / ≤5 SAR price-integrity floor) | 1 |
| Suspicious sub-floor prices blocked | 0 observed in this run (the 1 drop was a redirect, not a floor hit) |
| Raw observations written (`raw_observations`, store_id 10) | **199/199** from the bounded run, **+1** from a targeted round-trip verification write (§ manual audit below) = **200 total**, all verified independently via direct read-only Supabase queries |
| Price range observed | 49–12,499 SAR |
| Observations at/below the 5 SAR floor (post-write verification query) | **0** |
| Observations pointing at the wrong domain (`blackboxksa.com`) | **0** — 100% of written `product_url` values are on `blackbox.com.sa` |
| Matched canonicals / new canonicals / comparison gains | **Not yet measured** — requires running `normalize`/`build-tps-projection` (ADR-099: never run those manually concurrent with the scheduler; left for the scheduler's normal hourly sweep now that store 10 is in `TPS_STORES`) |
| Extraction error rate | 0.5% (1/200) |
| Public-surfaced products | **0** — `blackbox` stays in `COMPARISON_DISPLAY_EXCLUDED` (§1); nothing from this run is customer-visible |

### Manual audit (sample of 8, cross-checked against live source)

All 8 sampled `raw_observations` rows (ids 1184580–1184587) were cross-checked field-by-field
against the same product URLs fetched independently during adapter verification:

| Check | Result |
|---|---|
| Product identity (SKU, name) matches source | 8/8 pass |
| Price matches source (`prices_with_tax.price`) | 8/8 pass |
| Discount (`original_price`) only set when genuinely higher | 8/8 pass (e.g. LG refrigerator 3,849 vs 6,599 original — real; Panasonic washer had no original_price recorded, correctly left `null` rather than fabricated) |
| Stock state matches source (`stock.is_in_stock`) | 8/8 pass |
| Image URL resolves to the real CDN host, absolute | 8/8 pass |
| Outbound URL is a live blackbox.com.sa product page | 8/8 pass |
| No SAR-1/near-floor price leaked as standalone | 8/8 pass (`specifications` empty on all 8 sampled — none of these 8 currently carry a `free_gifts[]`; see §6 for the 16 that do, out of the 366-page appliance scan) |
| Defects found | 0 |
| Defects fixed | — |
| Remaining uncertainty | None on the round-trip question — separately verified live: one of the 16 `free_gifts`-bearing products (Hisense refrigerator, SKU `1311280113012003`) was mapped and written through the real `IngestionService.ingestBatch` path (`raw_observations.id 1184779`) and confirmed on read-back: `current_price: 2899` / `original_price: 4599` are the qualifying product's own real prices; the gift's `addon_price: "959"` lives only inside `specifications.free_gifts[0]`, confirmed absent from every price field. |

## 12. Rollback

**To remove Black Box from DISPLAY** (the release made in §14): add `'blackbox'` back to
`COMPARISON_DISPLAY_EXCLUDED` in `src/lib/retailers/approved-retailers.ts` — one line, no data
change. **To remove it from ingestion entirely:** set `PROVIDER_BLACKBOX_ENABLED=0` (env
override, no code change) or `enabled: false` in `src/lib/providers/registry.ts`. Neither action
deletes `raw_observations`, `price_history`, `tps_product_projection`, or this document's
evidence — consistent with `docs/DECISIONS.md`'s "history never disappears" precedent (ADR-004).
The `isDisplayableRetailer` fixes in `get-comparison.ts`/`search/route.ts`/`v1/tps/search/
route.ts` (§14) should NOT be rolled back even if Black Box itself is re-hidden — they are a
correctness fix that also protects lulu/sharafdg's existing exclusion.

## 13. Follow-up (not done in this pass, and why)

- **Promotion/campaign DB schema** — NOT DONE. Reason: no verified, precise SAR-1 pairing data
  exists to populate one responsibly; building unused schema would be speculative configuration,
  which this task's own rules disallow. What IS proven (real `free_gifts[]` pairs, not literally
  SAR-1) is exposed via the API layer instead — see §14.
- **Full-catalogue onboarding** — NOT DONE. Reason: bounded-category onboarding was chosen
  deliberately; widen only after measuring the released scope's real customer usage.
- **Web-UI conditional-offer badge/component** — NOT DONE. Reason: no storefront-layer product
  page exists yet for Black Box products (TPS-layer-only ingestion); see §14 for the full
  reasoning and what WAS shipped instead (API-layer `conditional_offer` evidence).
- ~~Display approval~~ — **DONE 2026-08-06, same day, second pass.** See §14 / ADR-218.

## 14. Release pass (ADR-218, same day) — display approval + a live leak found and fixed

**This section supersedes §1's "ingestion-only" framing and §11's "public-surfaced products: 0"
row — both were accurate at the time §1–§13 were written, before this pass.**

### What triggered this pass
The Founder granted authority to complete the F3 audit §13 said was still needed, and to release
the highest truthful value the evidence supports — for both the standalone catalogue (Track A)
and the conditional offer (Track B).

### Track A: a live leak found BEFORE any release decision was made
Checking the compare page for a canonical where Black Box was already `cheapest_store` (the
scheduler's normal hourly sweep had, untouched, already normalized 27/200 observations and built
`tps_product_projection` — see production metrics below) showed **Black Box already live at 899
SAR on `/ar/compare/haier|single_door|150|standard`** — hours before any deliberate audit,
bypassing `COMPARISON_DISPLAY_EXCLUDED` entirely.

**Root cause:** `src/lib/compare/get-comparison.ts` and `searchTPSCanonical`
(`src/app/api/search/route.ts`) filtered price_history/normalized-observation rows with
`resolveApprovedSlug` (the INGESTION gate) instead of `isDisplayableRetailer` (the DISPLAY gate)
— a **pre-existing defect**, not introduced by this task. Measured: **146 price_history rows**
across all three currently-excluded retailers (blackbox 22, sharafdg 64, lulu 60) were exposed to
this gap — lulu/sharafdg's F3 exclusion had been silently unenforced on these two surfaces
wherever their data reached `price_history`, this whole time.

A **third, more severe** instance was found in `GET /api/v1/tps/search` (Platform API Contract
v1 — mobile/agentic clients): **zero gating at all**, plus `cheapest_store`/`lowest_price`/
`store_count`/`has_comparison` read directly off the retailer-blind `tps_product_projection` row.

**Fix, deployed before the release decision took effect:**
- `get-comparison.ts` and `searchTPSCanonical`: added the missing `isDisplayableRetailer` check
  alongside `resolveApprovedSlug` — restores lulu/sharafdg's intended exclusion as a side effect.
- `GET /api/v1/tps/search`: offer collection now filters by `isDisplayableRetailer` at the
  source, and the whole comparison summary (`store_count`/`has_comparison`/`lowest_price`/
  `cheapest_store`/etc.) is **recomputed** from the filtered list (`summarizeOffers`, extracted
  to `src/lib/tps/v1-search-helpers.ts`) rather than trusted from the projection row — a
  projection row that claimed `has_comparison:true` on the strength of one excluded retailer's
  offer now correctly demotes to `resolved_single`. The route's stale local 5-entry `STORE_SLUG`
  map (which silently dropped every non-extra/almanea/jarir/amazon/noon store, e.g. swsg/shaker/
  najm/samsung_ksa) was replaced with the canonical `resolveApprovedSlug`/`retailerDisplayName`.

### Track A: release decision
`blackbox` removed from `COMPARISON_DISPLAY_EXCLUDED`. Evidence: 22 canonical matches, **9
genuine multi-store comparisons** against already-displayable retailers, all via the scheduler's
normal untouched sweep (ADR-099 respected — no manual normalize/projection run). `docs/
LAUNCH_VOCABULARY.md` checked — Black Box isn't on any MUST-NOT-SAY list. The public 705-
comparable-products figure was not edited (not live-rendered from code — confirmed no hit in
`src/`); the true count is now higher, flagged as an unexecuted follow-up re-measurement
(marketing-copy decision, out of this task's scope).

### Track B: conditional-offer release decision — Level 1 evidence, API-layer only
Of the 200 ingested observations, 10 carry a populated `free_gifts[]`: exact qualifying product,
exact add-on product, exact add-on price, evidence timestamp — genuinely Level-1-grade evidence,
even though none of the 10 sampled add-on prices are literally "1" (observed: 59–1,849 SAR) and
none match the Founder's specific fridge→washer/washer→dishwasher example. Per this task's own
instruction not to discard valid first-party evidence merely because the marketing description
was simplified, the REAL (if not literally-SAR-1) evidence is released — not the unverified
specific pairing.

`mapFreeGiftToConditionalOffer` (`src/lib/tps/v1-search-helpers.ts`) joins
`normalized_product_observations.normalized_payload._raw_id` back to `raw_observations.payload.
specifications.free_gifts` (same provenance-pointer pattern `get-comparison.ts` already used —
no schema change) and attaches a `conditional_offer` field to the qualifying offer in `GET /api/
v1/tps/search`'s response, with an explicit `note` stating the add-on price is never the offer's
own price.

**Not built in this pass, deliberately:** a promotion DB table (no verified SAR-1 pairing to
populate it with) and a web-UI campaign badge (no storefront-layer product page exists yet for
Black Box — `product_stores` holds 0 rows for store 10; rushing a new visual surface onto
production without RTL/mobile/desktop verification was judged higher-risk than shipping the
tested API-layer exposure mobile/agentic consumers can already use).

### Waffar
Waffar's `searchProducts` (`src/app/api/ai-assistant/route.ts`) calls `POST /api/search` — the
SAME route just fixed, so it is automatically protected from showing an excluded retailer's
price. That specific chat endpoint is independently confirmed DISABLED BY DEFAULT in this
codebase (referenced by nothing in web or mobile — see its own code comment, Constitution
Appendix F7) — the live customer-facing advisor is a separate, deterministic surface this task
did not touch. The `conditional_offer` evidence is available today only via `GET /api/v1/tps/
search`, the platform's own designed integration point for structured reasoning by
mobile/agentic/future-Waffar-class consumers.

### Regression tests
`tests/providers/v1-search-helpers.test.ts` (8 tests): conditional-offer mapping, the hard
"addon_price is never a price-field name" invariant (including a literal SAR-1 case), and
`summarizeOffers`'s F3 never-claim-comparison-below-2-stores behavior — including the exact
"excluded retailer filtered upstream → demotes to single-store" shape the live leak exhibited.
`tests/retailers/approved-scope.test.ts` and `tests/providers/nextjs-ssr-adapter.test.ts` updated
for the released state. Full suite: **93/93 suites, 1423/1423 tests** passing after this change.

### Production metrics as of this pass
| Metric | Value |
|---|---:|
| Canonical products matched (of 200 ingested) | 22 |
| Genuine multi-store comparisons (blackbox + ≥1 already-displayable retailer) | **9** |
| Black Box-only (single-store) canonicals | 13 |
| Observations carrying real `free_gifts[]` evidence | 10 of 200 |
| price_history rows exposed to the pre-existing leak, all 3 excluded retailers | 146 (blackbox 22, sharafdg 64, lulu 60) |
| Full test suite | 93/93 suites, 1423/1423 tests passing |

### Live manual-audit results (post-fix, post-release)
See the conversation/commit this section originates from for the exact live re-check of `/ar/
compare/haier|single_door|150|standard` and a sample of newly-displayable search results —
recorded at the time of the release commit rather than duplicated here to avoid this document
drifting from the actual verified commit.

## 15. Campaign release pass (ADR-219, same day) — official evidence, Level 2, automatic expiry

**This section supersedes §7's "not implemented" framing for the campaign notice** — §6/§7's
findings (the `free_gifts[]` mechanism, no exact SAR-1 pair confirmed) still stand and are not
contradicted; what changed is that the Founder supplied genuine official first-party evidence
that this pass could verify and act on.

### Official evidence
`https://x.com/blackboxksa/status/2085321446625091743` — verified organization account
(69,247 followers), posted **2026-08-06T11:05:50Z** (same day as this pass). Verbatim:

> مهرجان الريال 🔥 على الموعد بالصندوق الأسود!
> اشترِ ثلاجة ، واحصل على غسالة بـ 1 ريال فقط
> أو
> اشترِ غسالة، واحصل على غسالة صحون بـ 1 ريال فقط
> وقسّطها بالطريقة اللي تناسبك
> ✅ تقسيط بنكي حتى 12 شهر
> ✅ إمكان أو مدفوع حتى 6 دفعات
> ✅ تمارا حتى 12 دفعة
> تسوق الان

Contains a shortened campaign link, `bit.ly/45iKJ4k`, which was **resolved** (not assumed) to
`https://www.blackbox.com.sa/riyal-festival-c-1133/home-appliances-offers-c-1134?utm_source=
social&utm_medium=organic&utm_campaign=haa`. Preserved verbatim, with author/timestamp
metadata, in `src/lib/providers/campaigns/blackbox-riyal-festival.ts` (`CAMPAIGN_SOURCE`) —
this is durable evidence, kept even if the post is later deleted by the retailer.

### Verified campaign status
| Question | Answer |
|---|---|
| Active? | **Yes** — the linked category (id 1134) is live, `is_active: "1"`, and served 42 real products at verification time. |
| Start date | The post's own timestamp: 2026-08-06T11:05:50Z. No earlier evidence of this specific run was sought. |
| End date | **None found anywhere in first-party data.** `category.is_active` is a boolean, not a date. Not invented — a TTL substitutes (below). |
| Exact qualifying/add-on pairs | **Not confirmed** for a literal "1 SAR" price. 3 of 30 sampled campaign-category products carry a real, structured `free_gifts[]` pair (555–2,249 SAR — not "1"); the rest carry no pairing data at all in static product JSON. |
| Online/in-store | The campaign link is a normal storefront URL — confirmed available online. In-store availability not independently verified (no first-party statement found either way). |
| Branch/quantity restrictions | Not found in first-party data. |
| Financing | Confirmed from the post itself: bank installment up to 12 months, Emkan/Madfu up to 6 payments, Tamara up to 12 payments. |
| Delivery/installation/warranty | Not campaign-specific — governed by Black Box's normal store-wide terms (`blackbox.com.sa/terms-conditions`), not re-verified in this pass. |

### Release decision: LEVEL 2 (product-level eligibility), not Level 1
Every product whose own `category[]` array carries `category_id: 1134` **right now** (at the
time of its most recent observation) is marked eligible. Wording deliberately states NO SAR
amount:

- **AR:** «هذا المنتج مؤهل لعرض الريال من الصندوق الأسود. تختلف الهدية والموديل حسب شروط المتجر.»
- **EN:** "This product is eligible for Black Box's Riyal offer. The exact gift and model vary by the retailer's terms."

This is Level 2, not Level 1, because the retailer's own structured per-SKU data (`free_gifts[]`)
does not show a literal "1 SAR" value on any sampled campaign product — the true SAR-1 price is
most likely a cart-level rule (the `RiyalOfferDuplicateNotAllowed`/`RiyalOfferQtyIncreaseNotAllowed`
i18n strings found in ADR-217) applied only once both items are actually in a cart, which this
read-only verification pass correctly does not simulate (transacting against a live retailer
to observe checkout pricing is out of this task's scope). Where a real `free_gifts[]` pair DOES
exist (3 of 30 sampled), it continues to surface via the existing `conditional_offer` field with
its own real (non-"1") price — never merged with the Level 2 eligibility wording.

### Implementation
- `CAMPAIGN_CATEGORY_ID = 1134` in `src/lib/providers/sourcing/nextjs-ssr-adapter.ts` —
  `mapNextjsSsrProduct` now reads the product's own `category[]` and stamps
  `specifications.campaign_eligibility = { campaign_category_id: 1134, source:
  "category_membership" }` when present. Nothing hardcoded per-SKU — re-derived fresh on every
  re-observation.
- `src/lib/providers/campaigns/blackbox-riyal-festival.ts` (new) — `CAMPAIGN_SOURCE` (preserved
  official evidence), `CAMPAIGN_FRESHNESS_TTL_HOURS = 72`, `isCampaignEvidenceFresh()`,
  `deriveCampaignEligibility()`.
- `GET /api/v1/tps/search` — every offer now carries both `conditional_offer` (free_gifts-based,
  exact pair when it exists) and `campaign_eligibility` (category-based, Level 2), both
  evaluated against a single shared `now` and both TTL-gated.
- `src/lib/providers/registry.ts` — `blackbox.nextjsSsr.categoryKeywords` widened (dryer,
  freezer, oven, wash-tower) so the scheduler's normal periodic sweep keeps covering the whole
  campaign product cluster without further manual runs.

### Automatic expiry — no invented end date
No `valid_until` exists anywhere in Black Box's first-party data. Per this task's explicit
instruction not to invent one, evidence is TTL-gated instead: **72 hours** from its own
`raw_observations.scraped_at`. Once evidence exceeds that age, `campaign_eligibility` /
`conditional_offer` simply return `null` — no manual action, no Founder prompt, nothing to
delete. The TTL is re-armed automatically by the EXISTING scheduler's normal periodic
re-ingestion of store 10 (already wired via `TPS_STORES`, ADR-217) — **no new cron/service was
created**, satisfying "must not require a future Founder prompt to remove it" with
infrastructure that already exists. Early deactivation (Black Box removing a SKU from the
campaign before the TTL) is a natural consequence of the SAME mechanism: the next
re-observation of that SKU simply won't carry `category_id: 1134` at all, which is
indistinguishable from — and handled identically to — ordinary TTL expiry. No preserved
evidence is ever deleted; only the LIVE eligibility flag stops being returned.

### Production run (this pass)
30 of the 42 live campaign-category products were fetched directly and re-ingested (bounded,
targeted — not a full re-crawl): **30/30 mapped, 30/30 carry `campaign_eligibility`, 3/30 also
carry `free_gifts`.** Written to `raw_observations`; will reach `GET /api/v1/tps/search` once
the scheduler's normal (untouched, ADR-099-respecting) sweep normalizes them — the same pattern
used successfully in ADR-217/218.

### Waffar
No change beyond ADR-218's existing protection (Waffar's `/api/search` call is unaffected by
this pass — `campaign_eligibility`/`conditional_offer` are exposed via `/api/v1/tps/search`,
the platform's designed integration point for structured reasoning by future Waffar-class
consumers, same as ADR-218).

### Regression tests
`tests/providers/blackbox-riyal-festival.test.ts` (new, 12 tests): official-evidence
preservation, no-invented-`valid_until`, TTL fresh/stale/missing-timestamp/future-clock-skew,
Level-2-wording-never-states-a-SAR-amount (regex-asserted), and the "removed from campaign ≡
stale evidence" equivalence. `tests/providers/nextjs-ssr-adapter.test.ts` (+4): category-1134
detection, non-membership, no-category-array, and NOT triggering on the broader parent 1133
alone. `tests/providers/v1-search-helpers.test.ts` (+2): `conditional_offer` now also fails
closed on stale/missing evidence. **Full suite: 94/94 suites, 1441/1441 tests.**

### Known limitations (this pass)
- No Level 1 (exact SAR-1 pair) release anywhere — genuinely unconfirmed in structured data.
- ~~No web-UI badge/component~~ — **DONE, same day, §16.** The compare page now shows Level 2
  eligibility; no dedicated storefront-layer product page was needed to do it.
- Only 30 of 42 live campaign products were directly re-ingested this pass (bounded, targeted);
  the remaining 12 will be picked up by the scheduler's normal sweep now that
  `categoryKeywords` is widened.
- Branch-level/quantity restrictions and in-store availability were not found in first-party
  data and are not represented (absence is not claimed as "no restrictions" — simply not shown).

## 16. Compare-page UI release (ADR-220, same day) — bounded feasibility check → implemented

A follow-up task asked whether `campaign_eligibility` (API-only as of §15) could be shown on an
EXISTING customer surface without building new storefront architecture — and to stop and report
the blocker if not, rather than force it.

**Feasibility finding: yes, cleanly.** `src/lib/compare/get-comparison.ts` already performs the
exact `_raw_id → raw_observations` provenance join `GET /api/v1/tps/search` uses (there for
`scrapedAtByRawId`, the freshness disclosure). Reading `payload.specifications.
campaign_eligibility` off the SAME already-fetched row and running it through the same
`deriveCampaignEligibility` (reused unmodified from §15) cost one field, not a new query. The
compare page (`/ar/compare/[key]`) already renders a per-offer freshness line in exactly the
spot a conditional-offer note belongs.

**Implemented:**
- `CompareOffer.campaign_eligibility` added to `get-comparison.ts`'s output — TTL-gated
  identically to the API (72h, same `deriveCampaignEligibility`).
- `src/app/[locale]/(public)/compare/[key]/page.tsx` — a small `CampaignEligibilityNote`
  component: Level 2 wording only (no SAR amount, no exact gift), a "last verified" freshness
  line (reusing the page's existing day-count phrasing pattern), and a link to the official
  campaign page. Attached to the featured cheapest-offer panel and to each row of "All Offers."
  Deliberately secondary styling (small amber note below the price) — never positioned or
  sized to be confused with a price.

**Explicitly not done:** no new storefront/product-page architecture (none was needed); no
Level 1 claim; no change to the TTL, scheduler, or any prior decision.

**Live verification:** `/ar/compare/lg|side_by_side|660|inverter` (a canonical carrying a
freshly campaign-eligible Black Box offer from §15's targeted ingestion) — confirmed the note
renders with the correct Arabic Level-2 wording, a real freshness timestamp, and the official
campaign link, while the page's other (non-eligible) offers show nothing extra. See the
conversation/commit this section originates from for the exact captured result.

**Tests:** TypeScript clean (same pre-existing Supabase-generated-types class already tolerated
elsewhere in this file — no new error categories). Full suite unaffected: 94/94 suites,
1441/1441 tests (the UI component itself follows this codebase's existing pattern of relying on
live verification for DB-backed page/route logic rather than a mocked unit test, consistent
with `get-comparison.ts` having no pre-existing test file).
