# Black Box KSA — Retailer Onboarding & Promotional Intelligence

**Status date: 2026-08-06. Decision: BOUNDED_CATEGORY_ONBOARDING (ingestion-only; NOT customer-displayed).**

This document is the durable record for onboarding Black Box (الصندوق الأسود, blackbox.com.sa)
into Tawveeri, superseding every prior "blackbox bot-walled" note in this repo. See ADR-217 in
`docs/DECISIONS.md` for the decision-register entry.

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

To remove Black Box from ingestion entirely: set `PROVIDER_BLACKBOX_ENABLED=0` (env override, no
code change) or set `enabled: false` in `src/lib/providers/registry.ts`. To remove it from
display (already the current state): no action needed — it is already excluded. Neither action
deletes `raw_observations`, `price_history`, or this document's evidence — consistent with
`docs/DECISIONS.md`'s "history never disappears" precedent (ADR-004).

## 13. Follow-up (not done in this pass, and why)

- **Promotion/campaign schema** — NOT DONE. Reason: no verified, precise pairing data exists to
  populate one responsibly; building unused schema would be speculative configuration, which this
  task's own rules disallow. Revisit if/when the Founder obtains official campaign terms (§9).
- **Full-catalogue onboarding** — NOT DONE. Reason: bounded-category onboarding was chosen
  deliberately; widen only after a production audit of the current scope.
- **Display approval** — NOT DONE. Reason: F3 requires a production audit (this document does not
  claim one was performed beyond the bounded ingestion metrics in §11) before flipping
  `isDisplayableRetailer('blackbox')` to true.
