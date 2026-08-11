# Saudi Shopper Language & Demand Discovery — 2026-08-11

**Status: Implemented, deployed, live-verified.** This document is the durable record of an
independent mission (not a continuation of the closed Waffar/Search-eligibility workstream,
checkpoint #70) with two connected parts: (1) how Saudi shoppers actually express purchase
intent, and (2) how Tawveeri becomes discoverable — by Google and by AI assistants — at the
moment that intent appears. See `docs/DECISIONS.md` ADR-239 for the decision record; this file
is the fuller narrative, evidence, and methodology.

## 1. The mission, in the founder's own words (paraphrased from two prompts)

Part A (original brief): discover how real Saudi shoppers phrase purchase intent — not the
founder's own example phrases, which are illustrations of a behavior, not a keyword list — and
close only the MEASURED gaps between that real language and Tawveeri's current deterministic
query understanding.

Part B (mid-mission correction): widen the objective. Internal language understanding is only
one part. The strategic goal is for Tawveeri to become **a Saudi shopping reference at the
moment of need** — the founder's explicit analogy is Tameeni, the Saudi insurance-comparison
platform, becoming the natural reference when an insurance need appears. This requires answering
three connected questions: (1) consumer language, (2) Google search discoverability, (3) AI-
assistant discoverability (ChatGPT, Gemini, Perplexity, and similar).

## 2. Governance checked before starting

Per CLAUDE.md's standing rule, `docs/DECISIONS.md` was searched before analysing anything.
Directly relevant prior ADRs, NOT re-derived, only extended:
- **ADR-189** — sitemap/robots/compare-page structured data; explicitly rejected building
  `llms.txt` (measured: 408 of 500M AI-bot visits fetched it).
- **ADR-197** — Jarir product-page scraping parses schema.org JSON-LD first (a scraping-input
  concern, not the public-facing discoverability this mission covers).
- **ADR-226** — Category decision pages (`/categories/[slug]`): `CollectionPage` +
  `BreadcrumbList` + `ItemList` JSON-LD, built from the same `findNavigableCategory`/
  `getNavigableCategories` gate (ADR-150, ≥30 comparable canonicals) already trusted for
  navigation.
- `HANDOVER.md` checkpoint #70 (Waffar workstream, closed, founder-accepted) was read and its
  invariants respected throughout — no accessory-eligibility, category-classifier, or
  DecisionState logic from that workstream was touched.

## 3. Part A — Consumer language: research, evidence quality, methodology

### 3.1 Research, evidence-graded (SAUDI vs. GLOBAL vs. HYPOTHESIS)

**Global query-structure evidence (real sources):**
- Baymard Institute usability research treats "product-type search" as one of ~4 foundational
  search modes (product-type, exact/SKU, feature, thematic).
- Academic e-commerce query-log research (arXiv 2302.06355) clusters real query logs into
  distinct behavioral goals (shallow exploration, major/minor-item shopping, targeted purchase,
  hard-choice shopping) — log-derived, not self-reported.
- "Rethinking E-Commerce Search" (arXiv 2312.03217) documents need/outcome-based queries with no
  product noun as a real, recurring failure class for keyword IR, and budget-as-approximate-
  constraint ("red wine $40" misparsed as a size) as a known failure mode.
- Amazon's own EQA research (Yang & Alonso): factoid/attribute questions are ~52% of their
  e-commerce QA dataset — the single largest category.
- Amazon Rufus's own published design rationale: goal-first, conversational, narrows via
  dialogue rather than requiring an exact query upfront.
- Klarna's shopping assistant and Perplexity Shopping are both explicitly built around
  comparative/pros-cons structures.

**Saudi/Gulf-specific evidence (thin, real, honestly graded):**
- Real Saudi/Gulf forum query phrasings found directly (not vendor-blog paraphrase): "وش أفضل
  ثلاجة تتحمل..." (best+product+durability+brand-alternatives), "أبغى أشتري جوال ومحتارة ايش
  الافضل" (recommendation-seeking), "لاب توب او ايباد ؟؟" (a real thread on the Saudi Electronic
  University's own student forum — comparative pre-purchase framing in a university context),
  "ايش يناسبني مكيف سبلت ولا شباك؟" (AC type comparison).
- An Egyptian-Arabic "cheap AC" thread was found and explicitly DISCARDED (used "عاوز" and
  "جنيه" — Egyptian dialect markers, not Saudi) — the exact false-positive class this mission's
  own instructions warned against.
- Arabic orthographic variation (hamza-variant collapse, ة/ه interchange, ى/ي interchange,
  Arabic-Latin code-switching for brand names) is well-documented in general Arabic NLP
  literature (CAMeL CODA guidelines, QCRI Arabic Normalizer) and in Gulf-Arabic-specific corpora
  (arXiv 1609.02960) — this codebase had already independently re-discovered and fixed several
  instances of exactly this class one word at a time (CHECKPOINT #17, and repeatedly across the
  closed Waffar workstream) before this mission started; the research confirms it is a known,
  general, not Tawveeri-specific, pattern.
- **Explicitly NOT found, NOT claimed as evidence:** any query-volume/frequency data
  distinguishing أبي vs. أبغى vs. احتاج by register/region/generation; any systematic Saudi-
  specific per-category attribute-language study beyond the individual forum threads above. Where
  used, these remain this project's own hypothesis, not measured fact.

### 3.2 Repo audit — what already worked vs. measured gaps

A full read of `task-parser.ts`, `decision-engine.ts` (all `decide*` functions), `clarify.ts`,
`route.ts`, `route-query.ts`, `compare-intent.ts`, `semantic-fallback.ts` across the 8 mission
categories (air conditioners, mobiles, laptops, tablets, TVs, refrigerators, washing machines,
dishwashers) found:
- Budget parsing (`parseBudget`), `CHEAPEST_MARKER`, `RECOMMENDATION_MARKERS`, and the negation/
  deprioritize/exclude polarity system are all category-agnostic and already mature — no gap.
- AC alone has a genuine numeric room-size → BTU sizing model (`requiredBtuForRoom`) — the
  most mature category.
- **No "value"/quality-price priority existed anywhere** ("رخيص وجودته عاليه", "سعره كويس/
  مناسب") — present in a majority of the founder's own illustrative examples across categories,
  and distinct from `CHEAPEST_MARKER` (a sort-to-lowest instruction) and from a numeric budget.
- **No first-turn deal-seeking signal existed** ("عليه عرض"/"عليه تخفيض") — distinct from the
  existing follow-up `DEAL_EVALUATION` intent ("is THIS specific deal good?", gated behind an
  active `DecisionState`).
- Washing-machine "combo dryer" wants were only ever read by an ad hoc raw-text regex bypassing
  the priorities[]/negation system every other category's priorities already have.
- Several smaller, cross-category spelling/morpheme gaps (possessive "كاميرته", colloquial
  "كهرب", "حديث" as a latest-synonym, bare-superlative "افضل X" without a leading "وش").

### 3.3 Corpus, baseline, implementation, measured result

New evaluation infrastructure at `scripts/shopper-demand-eval/` (`corpus-dev.ts`,
`corpus-holdout.ts`, `measure.ts`) — distinct from `scripts/waffar-eval/`'s own laptop/mobile-
skewed corpus (built for a different, closed mission). 28 dev cases + 16 holdout cases across all
8 categories, Saudi colloquial/MSA/English/code-switched, holdout written in the same sitting as
dev and never consulted while deciding what to implement.

| | Dev (28 cases) | Holdout (16 cases) |
|---|---|---|
| Baseline (before any change) | 29% (8/28) | 13% (2/16) |
| After implementation | 100% (28/28) | 88% (14/16) |

Two dev-corpus test-authoring corrections were made honestly, not silently: two cases initially
asserted `advisory: true` for "وش افضل" queries, which are actually claimed by
`compare-intent.ts`'s own pre-existing comparison-marker detection (routes to `mode: comparison`,
not advisory) — a real, already-correct, untouched routing decision from before this mission, not
a defect. The two disclosed holdout residual gaps ("ما يكون فوق اللازم", "ما تكون غاليه علي" —
both distinct paraphrases of "not overpriced" the value regex does not cover) were deliberately
**not chased** to avoid tuning against the holdout set, consistent with this codebase's existing
"unknown beats incorrect" discipline (the same standard the closed Waffar mission applied to its
own residual idioms).

### 3.4 What shipped (task-parser.ts / decision-engine.ts / decide/route.ts)

1. New `"value"` priority key — recognizes رخيص (bare)/سعره مناسب/معقول/كويس/جودته عالية/
   "reasonable price"/"good value"/"affordable" — negatable through the same polarity system
   every other priority already uses.
2. New `wants_discount` field (`DISCOUNT_MARKERS` detector, same pattern as
   `wantsRecommendation`) — wired into `/api/v1/agent/decide`'s response as an honest `deal_note`
   built from the ALREADY-fetched Discount Integrity evidence (`verified_drop` vs. none) — never
   a new claim, never a re-sort, ranking stays single-authority (suitability + trust + cost).
3. New `"dryer_combo"` priority key, replacing washing machine's ad hoc raw-text regex.
4. Smaller fixes: possessive "كاميرته"/"كاميرتها" camera match (same class as the existing
   "بطاريت" battery fix), colloquial "كهرب" for low_electricity, "حديث" for latest, bare-
   superlative "افضل X" recommendation marker.

## 4. Part B — Search & AI-assistant discoverability

### 4.1 Research

**Reference-platform patterns (Tameeni analogy):** Tameeni (Riyadh, SAMA-licensed, 2M+ users)
appears to have built dominance on regulatory-trust positioning and transaction speed, not a
documented content/SEO strategy — no public case study found. Notably it maintains a real
`llms.txt` (fetched directly) despite that ADR-189's own measurement (408/500M AI-bot fetches)
still stands — a category leader doing it anyway is not evidence it drives anything, just a
cheap-enough signal for them to keep. MENA analogs (yallacompare/Souqalmal) position as education
platforms (bilingual financial-literacy content) more than pure comparison — thin, honestly-
reported evidence.

**AI-citation evidence — corrected from EXECUTIVE_DIRECTIVE.md's first pass:** the "34,234
responses, ChatGPT 0.59%/Perplexity 13.05%/Grok 27%" figure traces to a single uncorroborated
vendor blog (leapd.ai), syndicated across ~6 other SEO blogs with no published methodology —
**downgrade this figure everywhere it is cited internally to "unverified vendor claim."** A
genuinely credible, independently-sourced figure exists on a related question (citation
*accuracy*, not rate): Columbia Journalism Review/Tow Center tested 8 AI search engines and found
>60% of AI search answers contain citation errors. Perplexity is the more realistic near-term
citation target for a small site (favors freshness, cites ~3x more sources per response, rewards
Q&A-structured content with named statistics) — ChatGPT skews toward established authority,
hardest near-term target.

**Structured data correction:** `AggregateOffer` is confirmed correct for a genuine multi-
retailer comparison of the SAME product (Tawveeri's `/compare/[key]`, already shipped per
ADR-189) — narrower than, and does not overturn, ADR-226's own correct rejection of
`AggregateOffer` on a category page grouping UNRELATED products.

**MCP as a consumer channel:** real and growing, but every 2026 adoption data point found
describes enterprise/developer tooling or early personal-productivity connectors — no evidence
of Saudi consumers discovering/connecting a shopping-comparison MCP server mid-purchase-journey
today. Remains a scope-only, forward-looking item (per EXECUTIVE_DIRECTIVE §5.3), not a 2026
build.

### 4.2 Repo audit — what already existed

- **Mature:** crawlability (`robots.ts`, no AI-bot-specific blocks — the wildcard already allows
  everything except sensitive routes), sitemap (categories/compare/products, self-verified live),
  Product+AggregateOffer JSON-LD on product/compare pages, `CollectionPage`+`ItemList`+
  `BreadcrumbList` on category pages (ADR-226).
- **Structurally missing, found this mission:** `buildWebSiteJsonLd` was defined but never
  rendered anywhere (dead code); no `Organization` schema existed at any level; the public FAQ
  page had zero structured data despite genuinely FAQ-shaped content; category pages had zero
  educational "how to choose" content — purely a transactional listing.

### 4.3 What shipped

1. `buildOrganizationJsonLd` (new) + `buildWebSiteJsonLd` (existing, now actually wired) into the
   root layout `<head>` — never fabricates a CR/VAT/address/phone number the site has no record
   of (same discipline the FAQ page's own header comment already established).
2. `FAQPage` schema on `/faq`, generated from the SAME `faqs` array already rendered (a
   plain-text `aText` companion field added only where the visible answer embeds a `Link`).
3. New `src/lib/seo/category-guide.ts` — bilingual "how to choose" content for the 8 mission
   categories plus monitor/audio/smartwatch (currently-navigable per ADR-150's live gate), each
   point grounded in a REAL priority `decision-engine.ts` already scores for that category (room
   size→BTU for AC, household size for fridge/washer, use-case for laptop/tablet/monitor/audio,
   camera/battery for mobile, screen-size/use for TV) — teaches a shopper the exact vocabulary
   Tawveeri's own search/Waffar can already act on, not disconnected marketing copy. A
   non-fabricated universal fallback (observed-price honesty, single-store disclosure — restating
   facts already on the site FAQ) covers any category without bespoke content. Rendered as a
   native `<details>` accordion (same zero-JS, fully-indexable pattern as the site FAQ) plus its
   own `FAQPage` JSON-LD block on every category page.

### 4.4 Explicitly NOT built, and why

- **`llms.txt`** — ADR-189's 408/500M measurement still stands; Tameeni having one is not
  evidence it works, just a cheap enough signal for a much larger company to maintain.
- **An MCP server** — real but not yet a consumer shopping-discovery channel; scope-only per
  EXECUTIVE_DIRECTIVE §5.3, unchanged by this mission's research.
- **A Google Merchant Center account** — Google's own documentation confirms existing on-page
  schema.org data (already shipped, ADR-189/197/226) can populate it without a manual feed file,
  making this a low-risk, no-paid-commitment candidate action. **Flagged to the founder as an
  account-registration/domain-verification action item, not executed here** — it requires the
  founder's own Google account/business identity, outside this mission's standing authority to
  create on his behalf.
- **Consolidating the two independent Product+AggregateOffer JSON-LD implementations** (compare
  page's own inline block vs. `json-ld.tsx`'s builder) — a real maintainability observation from
  the audit, not a discoverability gap; left as a disclosed, lower-priority follow-up rather than
  refactored under this mission's time bound, to avoid risking the exact "drifted duplicate
  classifier" pattern this session's Waffar work already spent real effort unwinding once, in a
  different subsystem.

## 5. Verification

- `npm test`: 1773/1773 passing (1751 pre-mission baseline + 22 new: 16 in
  `tests/agent/shopper-demand-language.test.ts`, 6 in `tests/seo/discoverability.test.ts`).
- `tsc --noEmit`: 552 errors, matching the documented pre-existing baseline, zero in any file
  this mission touched.
- `next build`: clean.
- **Live production, post-deploy** (`https://tawveeri.com`, deployment `2513ce11`):
  - `WebSite`+`Organization` JSON-LD confirmed rendering on `/ar` and `/en` homepages.
  - `FAQPage` JSON-LD confirmed on `/ar/faq`.
  - `CollectionPage`+`FAQPage` (with real, non-empty Q&A content) confirmed on
    `/ar/categories/air-conditioners` and `/ar/categories/laptops`.
  - The closed workstream's own checkpoint #70 acceptance list (5 adversarial + 4 preserve
    laptop phrases, 10 accessory-exclusion probes) re-verified with zero regression.
  - New `wants_discount`/`value` signals verified live via `POST /api/v1/agent/decide`:
    "ابي ايباد جديد وعليه تخفيض" (the founder's own illustrative example) now resolves
    `wants_discount: true` and an honest `deal_note` (no fabricated discount, since no verified
    drop exists on the live candidates right now).

## 6. Known, disclosed, non-blocking limitations

1. Two Arabic value-phrasing paraphrases ("ما يكون فوق اللازم", "ما تكون غاليه علي" — both
   meaning "not overpriced") are not covered by the `value` regex — an honest holdout finding,
   deliberately not chased to avoid whack-a-mole tuning.
2. "ما يكلف كثير" (doesn't cost much) as a value-phrasing is similarly uncovered — same class.
   Also found while spot-checking candidate founder-acceptance phrases (not in either corpus):
   "تنزيلة سعر" (colloquial "price markdown") does not match `DISCOUNT_MARKERS` — same class of
   gap, one more synonym of "خصم"/"تخفيض" not yet covered. Disclosed, not chased.
3. Google Merchant Center registration is a real, evidence-backed candidate action requiring the
   founder's own account — not executed.
4. The two independent Product+AggregateOffer JSON-LD implementations (compare page vs.
   `json-ld.tsx`) remain unconsolidated — a maintainability note, not a discoverability defect.
5. Category buying-guide content exists for 11 of the ~19 possible `PRESENTATION`-dictionary
   categories (the 8 mission categories + monitor/audio/smartwatch); any other category that
   later crosses the ADR-150 navigability threshold gets the honest universal fallback only,
   never a fabricated category-specific claim, until bespoke content is authored for it.
6. No Saudi-specific query-volume/frequency data exists for any of this — every "common"
   phrasing claim in this document and in the shipped code comments is either evidence-cited
   (see §3.1) or explicitly labeled as this project's own hypothesis.

## 7. Founder acceptance

Engineering-side verification (automated tests + live API/HTML checks) is complete per §5. Per
this project's own standing rule, real-device production evidence is the acceptance bar, not an
engineering report. A small, high-information real-iPhone acceptance set is recorded in
`HANDOVER.md`'s current checkpoint — deliberately does not reveal exact implementation wording,
to genuinely test generalization rather than confirm a known-good phrase.
