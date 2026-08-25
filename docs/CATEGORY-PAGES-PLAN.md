# Programmatic Category Pages — Plan (pilot: air_conditioner facets)

**Status:** plan only, no code. **Feature freeze respected** (2026-08-23 → 2026-08-30, per `docs/MATCH-CENSUS.md`/`STANDING_DIRECTIVE.md`) — nothing below touches `decision-engine.ts`, `route-query.ts`, `evidence-engine.ts`, or any `decideX()` function. **Date:** 2026-08-25. **Grounded in:** live production reads (`vyceqrzttspyycdpojtn`, read-only), `docs/MATCH-CENSUS.md` (2026-08-23), ADR-150/189/226/239/240 (the existing SEO/category-page mission), and fresh web research on Google's 2026 spam/structured-data policy (sources cited inline).

## 0. The most important finding: this brief's premise is half-built already

`/categories/[slug]` is **not new**. ADR-226 (2026-08-07) shipped real, indexable category pages — including `air-conditioners` — with `CollectionPage` + `ItemList` + `BreadcrumbList` JSON-LD, live price range / brand / freshness badges, and a `FAQPage` buying guide (ADR-239). It already deliberately does **not** assert `AggregateOffer` at the category level, citing the exact Google policy this brief asked me to check. Live code: `src/app/[locale]/(category)/categories/[slug]/page.tsx`, `src/lib/catalog/getCategoryOverview.ts`, `src/lib/intelligence/navigable-categories.ts`, `src/lib/seo/category-guide.ts`.

**So "programmatic category landing pages, pilot: air_conditioner" cannot mean the top-level page — that ships today and already ranks-safely per its own ADR.** The only genuinely new, genuinely "programmatic" (i.e., plural, scaled) surface available within the brief's scope is a **facet tier one level below** the existing category page — e.g. brand and BTU-capacity pages under Air Conditioners. That reframing is what the rest of this plan is built around. If this isn't what you meant, tell me and I'll re-scope — but building a second copy of ADR-226's page would be pure waste.

This also *resolves* the brief's own risk framing more favorably than assumed: the highest-risk move (a brand-new, unproven page template on a low-authority domain) already happened in August and is live, indexed, and has not needed a rollback. What's proposed here is a smaller, bounded extension of an already-working, already-policy-reviewed pattern — not a first attempt.

## 1. Is air_conditioner still the right pilot? (challenged, then confirmed — for a different reason than assumed)

Live counts today (`tps_product_projection`, `has_comparison=true` — the same flag `getCategoryOverview.ts`/`navigable-categories.ts` already trust for what's *actually shown to customers right now*; queried read-only, exact `count`, not row-capped):

| Category | Comparable today (2026-08-25) | vs. MATCH-CENSUS.md (2026-08-23) |
|---|---:|---:|
| **air_conditioner** | **172** | 102 multi-store / 675 total (stricter tier def.) |
| tv | 171 | 114 / 574 |
| washing_machine | 132 | 112 / 327 |
| mobile | 120 | 51 / 263 |
| refrigerator | 103 | 63 / 366 |
| laptop | 101 | 38 / 552 |

(The two counts differ because the census used a stricter, research-only status-tier filter on `tps_current_offers` on the 23rd; `has_comparison=true` on `tps_product_projection` is the live serving flag the site itself reads today, two days later, and the pipeline keeps observing — re-measure, don't quote a snapshot, per the project's own standing rule.)

**Verdict: air_conditioner is essentially tied with tv for the deepest comparable set (172 vs 171 — not a clear win by volume), and washing_machine has a genuinely higher raw corroboration *rate* per the census (34.3% vs AC's 15.1%).** So if "most data" were the only test, this would be a toss-up, not a slam dunk for AC.

**The real reason to keep AC as the pilot is structural, not volumetric.** AC's identity key is a clean, already-extracted multi-field spec key (`scripts/tps-core/category-registry.ts`: `brand|ac_type|series_or_platform|capacity_btu|technology|cooling_mode`) — every comparable AC product already carries a real brand, a real BTU number, a real type, and (mostly) a real technology flag, **with zero new parsing or data work**. TV's identity is dominated by opaque `MODEL:xxxxx` strings (per the same registry and confirmed in my facet probe — most TV rows carry no independently-meaningful sub-attribute besides brand). Mobile/laptop are similar. Washing machine *does* have a comparable spec key (`brand|type|kg|dryer`) and would be the second-best candidate — flagging it for a future category, not dismissing it.

**This is the brief's own "material difference" requirement (§2) answered at the data layer, not just the copy layer**: AC is the one category where a facet page's distinctness is provable with data Tawveeri already has, not invented from a template. That is the actual argument for AC, and it survives the challenge.

Facet depth measured live (read-only, `air_conditioner`, `has_comparison=true`, 172 rows):

| Facet | Value | Comparable count |
|---|---|---:|
| **BTU capacity band** | ~18,000 BTU | **70** |
| | ~24,000 BTU | **44** |
| | ~30,000 BTU | **28** |
| | ~12,000 BTU | **21** |
| | ≥36,000 BTU | 6 *(too thin — excluded)* |
| **Brand** | LG | **34** |
| | Gree | **28** |
| | Midea | **20** |
| | (next: aux 10, unknown 11, hisense 8, haam 8, …) | *too thin — excluded* |
| **AC type** | split | 128 |
| | window | 33 |
| | cabinet/portable/ducted/cassette | ≤5 each *(too thin)* |
| **Technology** | Inverter | 76 |
| | Standard (non-inverter, explicitly stated) | 27 |
| | *(`NO_TECH` = 66 rows — this is an "unstated" sentinel, not a confirmed value; see §5)* | — |

Price range across all 172: **1,149–9,999 SAR**. Freshness: median **0.2 days**, one outlier at 56.9 days (handled by the existing `STALE_CAVEAT_HOURS` = 72h constant, already imported as a plain constant — not a `decideX()` function — by `get-comparison.ts`; safe to reuse the same way).

## 2. Page architecture — what makes each facet page genuinely non-duplicate

Every facet page is a **filtered slice of the same live query** the category page already runs (`getCategoryOverview.ts`'s pattern: read `tps_product_projection` directly, never the site's own `/api/v1/tps/search` — a self-fetch is the exact mistake that once rate-limited the compare page into "no comparison available"). Nothing here needs a new data source, matching the brief's constraint.

What differs, genuinely, per page — not a swapped noun in a fixed sentence:
- **A different, non-overlapping (or only partially overlapping) product set** — an 18,000-BTU page and a 30,000-BTU page share almost no products.
- **A different observed price range**, computed from that facet's own rows (e.g. 18,000 BTU units cluster far cheaper than 30,000+ BTU units — this is a real, checkable claim, not decoration).
- **A different store-count / brand mix**, same computation as `getCategoryOverview`'s `brands` array, scoped to the facet.
- **A different freshest-observation timestamp**, same `freshestObservedAt` field, scoped to the facet.
- **A distinct, non-generic buying-guide question** where one exists (e.g. AC already has "How do I know the right BTU capacity for my room?" in `category-guide.ts` — a BTU-band page can answer that question *for that band specifically*, which a generic category page cannot).

This is the same test Google's own guidance draws (per my research, §5 below): the line is real per-page data vs. a template with one token swapped. Every field on a facet page changes with the facet; only the surrounding UI chrome and buying-guide prose structure are shared — same as the existing category page already does relative to other categories.

## 3. URL structure & how many pages this supports today

Proposed: `/categories/[slug]/[facet]` — one flat segment under the existing route group (`(category)/categories/[slug]/[facet]/page.tsx`), reusing `PublicPageShell`, the same alias/redirect/404 discipline `[slug]/page.tsx` already has (`permanentRedirect` for alias slugs, `notFound()` for anything that doesn't clear a threshold, `force-dynamic` for the same reason the parent page needs it — a conditional redirect/404 cannot be statically prerendered without producing the exact soft-404 defect ADR-226 already found and fixed once).

`facet` values, single dimension only (see §5 for why not combined): `18000-btu`, `24000-btu`, `30000-btu`, `12000-btu`, `lg`, `gree`, `midea`.

**A facet needs its own gate, mirrored from `navigable-categories.ts`'s own methodology (ADR-150 picked 30 by finding the largest relative gap in the sorted comparable-count list; I did the same exercise on the combined facet-count list above):** sorted candidate counts are 70, 44, 34, 28, 28, 27, 21, 20 ‖ 11, 10, 8, 8 … — the largest relative gap is between 20 and 11/10 (≈1.8–2×), the same size gap ADR-150 used to justify 30 at the category level. **Proposed `MIN_COMPARABLE_FOR_FACET = 20`**, as a constant in a new small module mirroring `navigable-categories.ts`'s pattern (not touching it).

At `20`, air_conditioner supports **7 real facet pages today**, no padding: 4 BTU bands (18k/24k/30k/12k) + 3 brands (LG/Gree/Midea). Type (split/window) and technology (Inverter/Standard) clear the count threshold too, but I'm deliberately **not** recommending them as separate URLs — see §5.

## 4. JSON-LD spec (reuses existing data fields, no new source)

Same shape as the existing category page's `CollectionPage`/`ItemList`/`BreadcrumbList` (`(category)/categories/[slug]/page.tsx` lines ~149–189), scoped to the facet's product list, plus a 4-level breadcrumb (Home → Categories → [Category] → [Facet]):

```json
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "مكيفات LG — قارن الأسعار",
  "url": "https://tawveeri.com/ar/categories/air-conditioners/lg",
  "breadcrumb": { "@type": "BreadcrumbList", "itemListElement": [ /* Home, Categories, Air conditioners, LG */ ] },
  "mainEntity": {
    "@type": "ItemList",
    "numberOfItems": 34,
    "itemListElement": [ /* same shape as today: position, url, name — one entry per comparable LG AC, linking to its own /compare/[key] */ ]
  }
}
```

Plus a facet-scoped `FAQPage` block only where a genuine, non-generic Q&A exists (e.g. the BTU-band pages can reuse/specialize AC's existing BTU question from `category-guide.ts`) — never a fabricated one, same rule that file already documents for itself.

**No `Product`/`Offer`/`AggregateOffer` at this level — confirmed correct twice over:**
1. Our own `getCategoryOverview.ts`/ADR-226/ADR-240 already established this and cited Google's structured-data policy directly.
2. Fresh research (schema.org + current guidance) confirms `AggregateOffer` is for **one product** offered by multiple sellers — not for grouping *different* products, which an `ItemList` is the correct, honest shape for.

**Where the priced schema DOES live — verified, not assumed, no gap found:** `/compare/[key]/page.tsx` asserts `Product` + `AggregateOffer` (`offers.lowPrice`/`highPrice`/`offerCount`, per-seller `Offer.price`), sourced from `getComparison()` → `get-comparison.ts`, which computes `lowest_price`/`highest_price`/each `Offer.price` directly from live current-offer rows (`latestBySlug` map). It imports exactly one thing from `evidence-engine.ts`: the plain constant `STALE_CAVEAT_HOURS` (used only for a staleness caveat label, not for any price/ranking decision) — **no `decideX()` function is in this path**, so the JSON-LD price is provably the same number rendered in the UI, and there is no freeze conflict either way. Nothing here needs to change; this satisfies the brief's price-accuracy check.

## 5. What NOT to do (from current Google policy research, named and mapped to this plan)

Sources: `developers.google.com/search/docs/essentials/spam-policies` (Google Search Central, primary — fetched directly), `schema.org/AggregateOffer` + `schema.org/Offer`, plus secondary SEO-industry reporting on 2026 core updates (flagged as secondary where used).

1. **Scaled content abuse** — "many pages generated for the primary purpose of manipulating search rankings and not helping users... little to no added value... regardless of whether the content is AI-generated, human-written, or scraped" (Google, primary source). **Avoided by:** every facet page's numbers (price range, store count, freshness, product list) are genuinely different, live-computed, and checkable — not a token swap in fixed prose. The gate in §3 exists specifically so no page ships with near-empty content.

2. **Doorway pages** — "sites or pages created to rank for specific, similar search queries [that] lead users to intermediate pages... not as useful as the final destination," including "substantially similar pages... closer to search results than a clearly defined, browsable hierarchy" (Google, primary source). **Avoided by:** facet pages are reached through a real, visible hierarchy (category page → facet page, plus the sitemap), each links to genuinely different `/compare/[key]` destinations (not one shared landing target), and none of them "funnel" anywhere — they *are* the destination for that query.

3. **Near-duplicate / combinatorial explosion** — 2026 secondary reporting (SEO-industry, not Google-primary) describes enforcement widening in 2025–2026 against "programmatic near-duplicate sets" built from token-swapped city/product-name templates. **This is exactly why I am NOT recommending brand×BTU×technology combination pages** (e.g. "LG 18,000 BTU Inverter") — those would be low-count, high-overlap, and structurally the textbook risk pattern. **Single-dimension facets only for v1.**

4. **Low-cardinality binary facets as separate URLs** — type (split/window, 2 values) and technology (Inverter/Standard, 2 values) both clear the 20-count gate numerically, but a 2-value split doesn't carry enough distinct search intent to justify its own indexable URL versus the risk of it reading as a thin variant of the parent page. **Recommendation: keep these as on-page badges/sections on the existing category page and inside facet-page copy, not new URLs.** This directly answers "how many pages without padding" — 7, not 11.

5. **Sentinel-as-fact fabrication (Tawveeri-specific, CLAUDE.md non-negotiable)** — `NO_TECH` (66 of 172 AC rows) means *technology unstated*, not *confirmed non-inverter*. **A "Standard/non-inverter AC" page must only include the 27 rows explicitly tagged `Standard`, never the 66 `NO_TECH` rows** — publishing the sentinel as a fact would be exactly the "fabricate an attribute" violation this repo forbids, independent of any SEO risk.

6. **Asserting `AggregateOffer`/`Product` schema on a multi-product listing** — schema.org and Google's own comparison-page guidance (already cited in ADR-240) reserve this for one product, many sellers. **Avoided per §4** — `ItemList` only, at both the category and facet level.

7. **Superlative/absolute price claims** ("cheapest in Saudi Arabia") — already forbidden by `docs/LAUNCH_VOCABULARY.md` and already correctly avoided by the existing category page's "observed range" phrasing. **Facet pages inherit the identical copy discipline**, no new exception.

8. **Launching a second category, or the full 11-facet set, before measuring the first 7** — see §6.

**On the secondhand "60–90% ranking drop" figure in the original brief:** I could not find that figure in any Google-primary source. Third-party 2026 SEO-industry reporting on the March and May 2026 core updates describes drops in roughly that range (30–50% for "templated/rewritten" content, 60–90% for full AI-content-farm / heavily token-swapped programmatic sites) specifically for sites built *entirely* on scaled templated pages with no other content. **Verdict: directionally real and worth the caution, but it's industry-observed pattern-matching, not a Google-stated number — I'd caveat it that way if it's quoted externally, and note it does not describe what's proposed here** (7 pages added to an 8-month-old, already-indexed, already-diversified site with real product/compare pages behind them — a very different risk profile from a site that *is* the template).

## 6. Phased rollout

- **Pilot size:** 7 facet pages (4 BTU bands + 3 brands) under `air_conditioner` only. No second category, no type/technology URLs, no combinations.
- **Wait-and-measure period:** 4–6 weeks post-deploy before any expansion decision — long enough for Search Console to show real indexation/impression data (crawl + a full re-evaluation cycle), short enough to match this project's own "measure, then act" discipline rather than open-ended waiting.
- **Go/no-go gate, in priority order:**
  1. **Indexation** (Search Console Coverage / URL Inspection): do the 7 URLs actually get indexed at all? This is the cheapest, earliest signal of a scaled-content/doorway classification — an unindexed page on a low-authority domain is the first sign something read as low-value, well before rankings would show it.
  2. **No regression on the existing 12 category pages' rankings/impressions.** Per the "weak-link" pattern in 2026 core-update reporting, thin new pages can drag down a domain's existing indexed pages, not just fail on their own. This is the actual kill-switch — if the *existing*, already-working category tier degrades, pause and roll back the facet tier regardless of how the facet pages themselves are doing.
  3. Organic impressions/clicks on the facet URLs themselves (lagging confirmation, not the primary trigger).
- **Only after a clean 4–6 week read:** consider expanding facets within air_conditioner (e.g. add type/technology as real URLs if the binary-facet judgment above turns out wrong), or moving to a second category (washing_machine is the best-supported next candidate per §1, not TV — TV lacks AC's clean spec-key structure).

## 7. Effort estimate

Reuses ~90% existing infrastructure (`getCategoryOverview.ts`'s query pattern, `PublicPageShell`, `category-guide.ts`'s content pattern, `navigable-categories.ts`'s gating pattern, `sitemap.ts`'s live-list pattern). For reference, ADR-226 shipped the entire top-level category-page tier (6 files) in one session.

| Piece | Estimate |
|---|---|
| Facet overview query (filter `getCategoryOverview`'s pattern by parsed `tps_identity_key` field — brand/BTU-band) | 0.5 day |
| Facet gating module (`MIN_COMPARABLE_FOR_FACET`, mirrors `navigable-categories.ts`) | 0.5 day |
| `/categories/[slug]/[facet]/page.tsx` route (JSON-LD, breadcrumb, product grid — reuses existing components) | 1 day |
| Sitemap entries + internal links from the parent category page to its qualifying facets | 0.5 day |
| Facet-specific copy (data-driven description strings, reusing the existing `generateMetadata` pattern; BTU buying-guide specialization) | 0.5 day |
| Tests (facet threshold logic, route 200/404/redirect — same class of check ADR-226's own route-group defect taught us to add) | 0.5 day |
| Read-only/dry-run verification, local prod build, `tsc`/lint baseline check | 0.5 day |
| **Total** | **~4 focused engineering days**, one person |

---

## Task ledger (per CLAUDE.md reporting discipline)

1. Confirm/challenge air_conditioner as pilot with real data — **DONE** (§1; confirmed, but on structural-facet-depth grounds, not raw-volume grounds; washing_machine flagged as best next candidate).
2. Page architecture / genuine non-duplication — **DONE** (§2).
3. URL/template structure + how many pages supportable today — **DONE** (§3: 7, at a data-derived `MIN_COMPARABLE_FOR_FACET=20`).
4. Exact JSON-LD spec, reusing existing fields — **DONE** (§4; also verified, read-only, that the existing `/compare/[key]` AggregateOffer price path has no gap and no freeze conflict).
5. What NOT to do, named against current Google policy — **DONE** (§5; includes one correction to the original brief's unverifiable "60-90%" figure).
6. Phased rollout with a go/no-go metric — **DONE** (§6).
7. Effort estimate — **DONE** (§7, ~4 days).

**Not done, deliberately:** no code, no route, no schema change — plan only, per your instruction to wait for a go.

**Operational note, disclosed:** while researching, a background research fork I'd spawned returned a corrupted/looping result (its own transcript showed it messaging itself in a loop, and a diagnostic call surfaced a large block of garbled data). I did not act on or relay that content anywhere — I abandoned that fork and re-ran the same research directly myself (results are what's cited in §5). Flagging in case you want to look at why that fork misbehaved; it didn't affect anything in this plan.

---

## 8. GEO + Referral Follow-ups (2026-08-25)

Read-only research + small content-only edits, same freeze boundary as the rest of this plan (`decision-engine.ts`/`route-query.ts`/`evidence-engine.ts`/any `decideX()` — untouched). Covers the 12 live category pages and the 7 facet pages shipped 2026-08-25.

### Part A — GEO (AI-answer-engine citation) readiness audit

**Research, with source calibration.** Google's own primary guidance (`developers.google.com/search/docs/fundamentals/ai-optimization-guide`, fetched directly) is notably permissive: *"There's no requirement to break your content into tiny pieces for AI to better understand it,"* *"Structured data isn't required for generative AI search, and there's no special schema.org markup you need to add,"* and it explicitly warns against *"Rewriting content just for AI systems."* Its stance is: get foundational SEO and "helpful, reliable, people-first" content right, and AI features follow from that — the same posture ADR-226/240 already took.

Secondary 2026 SEO-industry sources (SearchEngineLand, Writer, LLMrefs, Stackmatix, and others — **not Google-primary, treat as industry consensus not fact**) recommend more tactical practices: 40–60 word self-contained answer blocks near the top of a page; FAQPage/Article schema with explicit `dateModified` (content with schema markup is claimed to have a "2.5x higher chance" of AI-answer inclusion — an industry-reported figure, not independently verified here, cited with that caveat); headers phrased as literal questions matching real search queries rather than generic labels; and a freshness bias strong enough that "AI citations... drop off sharply" after ~3 months without an update.

**These two source tiers don't fully agree** (Google says schema/formatting isn't required; the industry blogs treat it as high-leverage). The practical resolution used below: only make changes that (a) are genuinely free under Google's own "helpful, people-first" bar — i.e. they'd improve the page for a human reader too, not just a machine — and (b) reuse data already fetched, so there's zero fabrication risk. That satisfies the stricter primary-source bar while still capturing the secondary sources' concrete recommendations.

**Audit against the 4 questions:**

1. **Short, quotable answer near the top, not buried?** Partially — the subtitle paragraph sat right under the H1 (position was already correct) but split the count, price range, and freshness across the paragraph *and* two separate badges below it — no single sentence stated the full claim. **Fixed directly** (see below).
2. **Prices/counts as standalone claims with visible dates?** The price-range and freshness badges already existed and were already correct/honest, but weren't combined into one lift-able sentence, and the structured data had no machine-readable `dateModified` — only a human-readable relative label ("اليوم"/"أمس"). **Fixed directly** (see below).
3. **Q&A block for 3-4 buying questions per facet, brand facets included?** No — brand facets (`lg`, `gree`, `midea`) shipped with **zero** FAQPage content; BTU facets had exactly one (the BTU-sizing question, specialized per band). **Fixed directly** (see below) — see the honest caveat on the resulting count.
4. **Cloudflare edge AI-crawler block (ADR-240) still fixed?** **Confirmed yes, verified two ways**, not just inferred: (a) the live edge-served `https://tawveeri.com/robots.txt` matches the app's own `robots.ts` output exactly — no separate Cloudflare "Managed content" block layered on top; (b) more rigorously, sent live requests to the production site with the actual crawler user-agent strings — `GPTBot`, `ClaudeBot`, `Google-Extended`, `PerplexityBot`, `OAI-SearchBot`, `Bytespider`, `Amazonbot`, `meta-externalagent` — **all 8 returned a clean 200**, not a block/challenge page. The ADR-240 fix holds today.

**Changes made directly (safe — additive, reuse already-fetched data, no new claims, improve the page for humans too):**

- **`dateModified` added to the `CollectionPage` JSON-LD** on both the category and facet pages, sourced from the same `overview.freshestObservedAt` the visible freshness badge already renders. No new query.
- **The visible subtitle paragraph rewritten into one self-contained, quotable sentence** stating count + observed price range + freshness together (previously split across the paragraph and two badges). Same "observed range" framing as `LAUNCH_VOCABULARY.md` already requires elsewhere — no absolute "cheapest" claim introduced. Live-verified render: *"نقارن أسعار 172 من مكيفات بين أكثر من متجر سعودي — نطاق سعري مرصود من 1149 إلى 14611 ريال، آخر رصد اليوم."*
- **Two new Q&A entries added to `category-guide.ts`'s `air_conditioner` bespoke list** (cooling mode hot/cold vs. cool-only; split vs. window) — both grounded directly in real hard-constraint dimensions `decision-engine.ts` already scores for AC (`cooling_mode`/`ac_type` explicit matching — confirmed by reading, not editing, that file), same discipline the file's own header already documents for the original 2 entries. Neither is a brand claim, a price/value judgment, or facet-specific invention.
- **Facet-page FAQ selection reworked**: previously only BTU-band pages got a (single, specialized) question and brand pages got none. Now every facet — BTU or brand — gets the full AC question set: the BTU-sizing question (specialized to that band on BTU pages, generic on brand pages) plus the other AC-specific questions plus the 2 site-wide "universal" honesty Q&As (price freshness, single-store disclosure) the parent category page already showed. **Honest count, not forced to exactly "3-4":** every facet page now shows **6** Q&As (4 AC-specific + 2 universal) — up from 1 (BTU facets) or 0 (brand facets). Live-verified on both a BTU facet (`18000-btu`) and a brand facet (`lg`).

**Flagged for your review, not done (questionable — closer to positioning than technical content):**

- **Brand-specific comparative copy** (e.g. "why choose LG vs. Gree") — not added. Honestly answering this needs either real distinguishing data we don't cleanly have per-brand today, or would drift into comparative/marketing claims the rest of this codebase deliberately avoids (`category-guide.ts`'s own stated rule: never invented marketing fluff). If you want this, it needs a founder call on what claim (if any) is fair to make.
- **Trimming the Q&A count from 6 down to a stricter "3-4"** — I left all 6 in for consistency with what the parent category page already showed (removing the 2 universal ones from facet pages only would make facets *less* complete than their parent, which felt like the wrong asymmetry to introduce unilaterally). If you'd rather facets show a tighter 4, say which 2 to drop and I'll make the change — it's a one-line filter.
- **The industry-reported "2.5x more likely to be cited with schema" and "3-month freshness cliff" figures** — cited above with sourcing caveats already attached; not acted on beyond what's already justified on human-readability grounds (i.e. I didn't add anything **solely** because a blog post said AI engines want it).

**Verification:** `tsc --noEmit` zero new errors; full suite 130/130 suites, 2240/2240 tests pass (including `tests/seo/discoverability.test.ts`'s existing `getCategoryGuide` grounding/parity checks, unmodified, still green against the new entries); production build clean; local `next start` render-verified (`dateModified` present, subtitle text exact-matches the design above, FAQ count/specialization correct on both a BTU and a brand facet).

### Part B — referral/share loop feasibility (research only, no build)

**What exists today, exactly:**

- **Home Mission "شارك الخطة" (ADR-257) — a real, deployed, token-based share.** `POST /api/v1/agent/home-mission/share` takes client-sent STRUCTURE only (categories, canonical ids, room labels) and re-derives every FACT (price, store, image, freshness) server-side at share time — a tampered request can't publish a fabricated price. Produces a 128-bit random capability token, stored as an **immutable snapshot** in `shared_home_plans`, viewable at `/[locale]/plan/[token]` for 30 days, no account needed. `home_share` events fire with `meta.step: created|opened|feedback`. **The token/URL carries no owner or referrer identifier at all** — nothing ties a viewed share back to who shared it.
- **The Decision Card's "شارك" button (`ShareDecisionButton`, in `advisor-answer.tsx`) is NOT a dedicated shareable link.** It calls `navigator.share()` (native share sheet) or clipboard-copies `window.location.href` — literally the current page's own URL — plus a text blurb ("توصية وفّر: {product} — {price} ({badge})"). Fires `advisor_share` with `meta.method: native_share|clipboard`. No snapshot, no token, no dedicated page. On `/products/[slug]` this is at least a stable URL; on `/search`, the shared URL's usefulness depends on how much of the search state survives in the query string — not verified further here since Part B is scoped to feasibility, not a full audit.

**Feasibility of a lightweight referral extension: high — closer to a config change than new infrastructure.** This codebase already has a complete, production-proven attribution pipeline for exactly this shape of problem, built for UTM/social-campaign tracking (`src/lib/analytics/campaign.ts`, `campaign-capture.tsx`, ADR-244):
1. `CampaignCapture` is mounted **globally** in the root layout — runs on every page already, `/plan/[token]` included, no new wiring needed.
2. It captures `utm_source`/`utm_medium`/`utm_campaign`/`utm_content` from the URL into `sessionStorage` **and** mirrors them into a session cookie.
3. Every subsequent `track()` call automatically merges the captured campaign into `meta` — so once present, it rides along on every event for that session with zero per-call code.
4. The `/go` exit route **already reads the same cookie server-side** to stamp `outbound_clicks` (ADR-244) — meaning campaign attribution already reaches the real merchant-exit ledger today, not just `usage_events`.

A referral loop could reuse this exact mechanism: append `?utm_source=<value>&utm_content=<short code derived from the share token>` when constructing the Home Mission share URL (one line in `POST .../home-mission/share`'s response, where `url` is built). No new database column, no new event type, no new capture code, no new admin-reporting code if existing campaign reports already read `meta.utm_source`/`utm_content` (worth a quick check before building, not confirmed here). The one real decision needed: `utm_source`'s documented contract today is external platforms (`x|tiktok|instagram|snapchat|youtube`) — a peer-to-peer referral isn't quite that, so it needs either a new allowed value (e.g. `utm_source=tawveeri_share`, `utm_medium=referral`) or a deliberate decision to extend the existing taxonomy. That's a naming/contract call, not an engineering one.

**Proposed follow-up spec (not built):**
1. `home-mission/share/route.ts` appends `?utm_source=tawveeri_share&utm_medium=referral&utm_content=<token-derived short code>` to the returned `url`.
2. Document the new `utm_source`/`utm_medium` values in the existing UTM contract comment (`campaign.ts`'s own header, and wherever `TAWVEERI_SOCIAL_GROWTH_SYSTEM.md §23` lives).
3. Confirm (quick check, not done here) whether existing admin campaign-reporting queries (`command-center-queries.ts`) already group by `utm_source`/`utm_content` generically — if so, referral traffic shows up for free; if not, that's the one small addition needed.
4. Nothing else — no new table, no new event type, no new capture logic.

**If it needed new infrastructure, the instruction was to say so and stop — it doesn't.** This is a genuinely small follow-up, not a project.
