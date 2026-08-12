# Tawveeri Global Shopping Discoverability & AI Commerce — 2026-08-11

**Status: Implemented, deployed, live-verified (repository-side work). Cloudflare AI-Bots and
Bing Webmaster Tools founder actions both completed and verified. Google Search Console: see
correction below.** Independent mission from the closed Saudi Shopper Language & Demand
Discovery workstream (checkpoint #71) — no Waffar/Search/DecisionState/accepted UX logic
touched. See `docs/DECISIONS.md` ADR-240 for the decision record; this file is the fuller
research, methodology, and evidence.

**CORRECTION (2026-08-11, same day):** §1's eligibility-matrix row and §4 item 2 below both
state Google Search Console was "Not yet verified," based on a REPO-only audit (no
`google-site-verification` meta tag, no GA/GTM reference found in `src/app`). That was real but
incomplete evidence — GSC ownership can be established by methods a repository read cannot see
(DNS TXT record, domain-registrar linkage, a different Google account). The founder has direct
GSC account access confirming `tawveeri.com` was **already verified and active, with real Search
performance data, before this mission started.** No duplicate property or redundant verification
was added. The original rows are left below unedited (history is never rewritten in this
project's docs) — this note is the correction of record. The `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`
code hook remains in place, unused, a harmless no-op. See HANDOVER.md checkpoint #72 for the full
correction and the one genuinely useful remaining GSC action (checking sitemap submission).

## 0. Tawveeri's actual business model (checked before classifying anything)

Confirmed from the repository's own architecture docs (`docs/AFFILIATE-FRAMEWORK.md`,
`AGENTIC_COMMERCE.md`) and production behavior: Tawveeri is a **price-comparison and shopping-
decision platform**. It observes prices at Saudi retailers, computes identity/comparison/price-
history/discount-integrity evidence, and sends the shopper to the retailer's own site to complete
the purchase via a measured `/go/<offer_id>` exit (recorded in `outbound_clicks`, one revenue
source is an Amazon Associates affiliate relationship). **Tawveeri never sells, ships, stocks, or
processes payment for anything.** This single fact governs nearly every eligibility conclusion
below — it is the fundamental distinction the founder's brief itself named as decisive.

## 1. Ecosystem eligibility matrix — evidence-graded

| Ecosystem/program | Eligible today? | Classification | Primary evidence | Saudi Arabia? | Action |
|---|---|---|---|---|---|
| **Google Merchant Center (direct)** | **No** | Requires cart/checkout, a published return policy and shipping policy (`support.google.com/merchants/answer/9158778`) — all structurally false for a non-transacting comparison site. **PROVEN.** | Google's own Merchant Center checkout-requirements page | Country itself is supported, but the requirement is model-based, not geography-based | **REJECT** — do not misrepresent Tawveeri as a merchant to force eligibility |
| **Google free listings** | **No** | Same checkout/return/shipping-policy requirement as Merchant Center, just without ad spend. **PROVEN.** | `support.google.com/merchants/answer/13889434` | N/A (blocked by model, not geography) | **REJECT**, same reasoning |
| **Google Shopping ads** | **No** (and lower priority regardless — paid) | Same merchant-model mismatch, plus a real cost. **PROVEN** by the same checkout requirement. | Same as above | N/A | **REJECT** |
| **Google Comparison Shopping Services (CSS/CSS Center)** | **No** | An EU/EEA/UK-only regulatory-remedy program (Austria, Belgium, Czechia, Denmark, Finland, France, Germany, Greece, Hungary, Ireland, Italy, Netherlands, Norway, Poland, Portugal, Romania, Slovakia, Spain, Sweden, Switzerland, UK, plus a 2026 expansion wave of Cyprus/Luxembourg/Moldova/N.Macedonia/Malta/Liechtenstein/Bulgaria/Croatia/Lithuania/Slovenia/Serbia/Bosnia/Montenegro/Estonia/Latvia). Saudi Arabia is not mentioned in either primary source. **PROVEN NOT AVAILABLE.** Note: even if it were, CSS requires ≥50 distinct merchant domains — Tawveeri's ~7-11 approved retailers would not clear that bar today either. | `support.google.com/merchants/answer/12652686`, `support.google.com/css-center/answer/7524491` | **Explicitly NOT** | **REJECT for now / MONITOR** — re-check if Google ever extends CSS to Saudi Arabia; zero cost to monitor |
| **Product/AggregateOffer structured data on comparison pages** | **Yes, already the right shape** | Google's own developer docs describe `AggregateOffer` as designed for "a product being sold by multiple merchants" and "a pragmatic interim step, particularly for comparison pages" — not merchant-only markup. **PROVEN.** | Google Search Central structured-data docs | Yes (structured data has no country gate) | **NOW** — already shipped (ADR-189/226), improved further this mission (canonical fix, see §3) |
| **Google spam/thin-affiliate policy** | **Compliant, if kept honest** | Google's own spam-policy page draws the exact line: thin = "copied descriptions/reviews without added value"; legitimate = "price info, original reviews, rigorous testing, category navigation, and **product comparisons**." Tawveeri's price-history/evidence model is the legitimate side of that line by construction. **PROVEN.** | `developers.google.com/search/docs/essentials/spam-policies` | Yes | **Maintain the discipline already in place** — no new action, a real load-bearing piece of evidence for the platform's own positioning |
| **Google Search Console** | Not yet verified | Free, independent of Merchant Center; reports product/shopping rich-result performance for any indexed page carrying valid schema | Google's own product | Yes | **NOW (infra)** + **FOUNDER (verification)** — code hook shipped this mission, needs the founder's own Google account |
| **ChatGPT Shopping Research** | **Yes, organically, no registration** | OpenAI's own announcement: results are "organic and based on publicly available retail sites — reading product pages directly, citing sources" — a crawl/synthesis mechanism, not a submitted feed. **PROVEN** (OpenAI's own text, corroborated by independent press coverage). | openai.com's own announcement (via verified excerpt + independent corroboration) | Not geography-gated | **NOW (passive)** — depends entirely on crawlability (see §1a below) |
| **OpenAI Agentic Commerce Protocol (ACP) / "Instant Checkout"** | **Not currently, for a non-merchant** | Live, real (Apache 2.0, OpenAI+Stripe), but current named participants are large US retailers with their own checkout — reads as a curated-partner phase, not an open self-serve program. The spec itself does not technically exclude a `marketplace_seller`/referral role, but no confirmed open application path was found. **PARTIALLY PROVEN / INFERRED for the eligibility gap.** | `developers.openai.com/commerce/specs/file-upload/products`, ACP GitHub repo | Unconfirmed | **MONITOR/LATER** — do not represent Tawveeri as a merchant to force entry |
| **Perplexity organic citation (PerplexityBot)** | **Yes, no registration** | Pure crawler, explicitly documented as not used for AI-model training, respects robots.txt. **PROVEN.** | `docs.perplexity.ai/guides/bots` | Not geography-gated | **NOW (passive)** — same crawlability dependency as ChatGPT |
| **Perplexity Merchant Program** | **No** | A checkout-capable seller program (PayPal/Venmo "Buy with Pro") — would require representing Tawveeri as a transacting seller, which is false. | Vendor-blog description, moderate confidence | N/A | **REJECT** — misrepresents the business model |
| **Bing Webmaster Tools** | Not yet verified | Free, standard webmaster registration, no business-model conflict | Bing's own tooling | Yes | **NOW (infra)** + **FOUNDER (verification)** — same pattern as Search Console, code hook shipped |
| **Bing/Copilot "aggregator" shopping program** | **Unknown** | Vendor-blog claims only; Microsoft's own aggregator-specific help page returned 404 on fetch; could not confirm eligibility criteria or Saudi availability from a primary source. | Low confidence, could not verify | Unconfirmed | **MONITOR** — do not chase without official confirmation |
| **UCP / MCP (Universal/Model Context Protocol) truth-server** | Already researched, decision unchanged | `AGENTIC_COMMERCE.md` (prior mission): a Saudi product-truth MCP server is strategically correct but explicitly gated on identity-quality + GTIN work landing first — **not re-opened, no new evidence overturns this.** | `AGENTIC_COMMERCE.md`, this repo | N/A | **Unchanged: SCOPE ONLY, do not build yet** |

### 1a. The crawlability dependency behind "NOW (passive)" — the single most important finding

Both ChatGPT Shopping Research and Perplexity's organic citation depend entirely on their
respective crawlers being able to fetch Tawveeri's pages. A technical audit found this is
**currently broken at the Cloudflare edge, not in the repository**: the live `robots.txt` carries
a Cloudflare-injected "Managed content" block, invisible to a repo-only read, that explicitly
`Disallow: /` for **GPTBot, ClaudeBot, Google-Extended, Applebot-Extended, Bytespider, CCBot,
Amazonbot, CloudflareBrowserRenderingCrawler, meta-externalagent**. This directly blocks:
- **Google-Extended** — controls Gemini/AI-Overviews *grounding* specifically (separate from
  ordinary Googlebot search indexing, which is unaffected).
- **ClaudeBot** — Claude's own crawler.
- **GPTBot** — OpenAI's training-data crawler (a separate concern from citation, see below).

**Not blocked** (confirmed against the same live file): **OAI-SearchBot** (the bot that actually
matters for ChatGPT search/Shopping-Research citation — GPTBot is training-only, a different
purpose), **PerplexityBot**, **Bingbot**, **ChatGPT-User**. So Perplexity and (via OAI-SearchBot)
ChatGPT's live citation path are NOT currently blocked — but Gemini/AI-Overviews (Google-Extended)
and Claude (ClaudeBot) are.

This setting **cannot be changed from the repository** — it lives in the Cloudflare zone
dashboard, not in `src/app/robots.ts`. See §4 founder action item #1.

## 2. Competitive research — architecture, evidence-graded

Idealo (aggregates ~108M offers/~21,700 shops, moderate-confidence via convergent independent
descriptions, direct fetch bot-blocked) has one signature, repeatedly-cited trust mechanism: **a
visible price-history graph and "lowest price ever" callout on every product page.** Tawveeri
already has the underlying data (`price_history`, the discount-integrity evidence line already
shipping on the homepage/price-truth page per EXECUTIVE_DIRECTIVE §3.1) but does **not** render a
per-product historical view on product/compare pages themselves — a real, competitively-validated
gap, not implemented this mission (a genuine UI feature, sized for a dedicated pass — see §5
NEXT-tier). PriceRunner and Klarna yielded no verifiable structural detail (fetches too thin/
marketing-only) — explicitly not cited beyond that.

No credible (non-vendor-blog) case study was found anywhere for how any comparison platform
specifically grew AI-assistant discoverability — every such claim found was unsupported vendor
content, correctly excluded rather than presented as evidence.

## 3. Repository/production fixes shipped this mission

A deep technical audit (canonical correctness, hreflang, ProductGroup, crawl traps, JS-dependency,
existing feeds, image alt text, AI-crawler robots rules, sitemap health, GSC/GA presence) found
two severe, live-confirmed defects and one measurement gap, all fixed:

1. **Every category-page product card linked to a broken compare-page URL, in BOTH locales**
   (`/ar/ar/compare/...`, `/en/ar/compare/...` — both 404). Root cause: `compare_url` as stored on
   `tps_product_projection` already carries a hardcoded `/ar/` prefix, violating this module's own
   documented "locale-less path" contract; the category page correctly prepends its own locale on
   top, producing a double prefix. Fixed by extracting and applying `normalizeCompareUrl()`
   (`src/lib/catalog/getCategoryOverview.ts`) at the one place this field is read — never touches
   the DB column, no migration needed. This was breaking crawl-budget AND real user clicks on the
   exact page type this mission cares most about.
2. **The compare page's own declared canonical URL was invalid** — Next.js decodes dynamic route
   segments before handing them to `generateMetadata`, so the raw `|`-delimited identity key was
   embedded directly into the canonical string without re-encoding (`|` instead of `%7C`),
   producing a canonical that never matched the actual fetched URL (Google requires canonicals to
   be exact, valid URLs). Fixed with `encodeURIComponent(key)` at the one call site
   (`src/app/[locale]/(public)/compare/[key]/page.tsx`).
3. **`x-default` hreflang was absent** (present-but-optional per Google, not a defect on its own,
   but a free completeness gain) — added once to the shared `buildAlternates()` helper
   (`src/lib/seo/metadata.ts`), so every page using it gains it automatically, pointing at Arabic
   (the app's own documented default locale).
4. **No Search Console / Bing Webmaster verification hook existed.** Added an env-var-driven,
   zero-risk `verification` block to the root layout metadata (`src/app/layout.tsx`) — renders
   nothing today, goes live the moment the founder pastes his own verification code into
   `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`/`NEXT_PUBLIC_BING_SITE_VERIFICATION`, no further code
   change or deploy approval needed.

Confirmed unchanged/already correct (no action needed): hreflang ar↔en cross-referencing on
product/compare/category/search pages; `/search` correctly `noindex, follow` (query-parameter
explosion is real but structurally contained); the sitemap serves 18,492 URLs (2,104 compare +
16,346 product + 42 static), 10/10 freshly re-sampled resolve 200; robots.txt does not disallow
anything the sitemap offers; the non-canonical (preview) deployment domain correctly serves
`X-Robots-Tag: noindex` while remaining crawlable (so the noindex itself is readable) and withholds
its sitemap reference.

## 4. Founder action items — the smallest possible list, each with exact steps

### 1. Cloudflare "AI Bots" managed rule (Cloudflare dashboard) — HIGHEST VALUE, CANNOT BE DONE FROM CODE
- **Why needed:** Google-Extended (Gemini/AI Overviews) and ClaudeBot are currently blocked at the
  edge. No amount of on-page structured data, crawlable content, or SEO work can overcome this —
  the crawler is refused before it ever reads a single page.
- **Expected value:** the single highest-leverage lever in this entire mission for the "AI
  assistant discoverability" objective — currently a hard, binary "no" for two major AI
  ecosystems regardless of content quality.
- **Cost:** free (a dashboard setting).
- **Risk:** allowing these crawlers means Gemini/Claude can read Tawveeri's already-public price
  data for real-time citation. The site's own `Content-Signal: ai-train=no` already expresses "do
  not train on this" — Google-Extended specifically affects grounding/citation, not training,
  and ClaudeBot's purpose is comparable. The realistic downside is uncompensated use of public
  data by large AI companies for answering user questions — a legitimate business judgment call,
  not a security or legal risk; this is why it is left to the founder rather than decided here.
- **Exact URL:** the Cloudflare dashboard for the `tawveeri.com` zone → Security (or "AI Crawl
  Control", naming varies by Cloudflare plan/rollout) → "Bots" / "Managed robots.txt" / "AI Bots".
- **What to select:** at minimum, allow **Google-Extended** and **ClaudeBot** (the two blocking
  AI-assistant citation directly). GPTBot is a *separate* judgment call — it is OpenAI's
  **training**-data crawler, not the citation bot (OAI-SearchBot, already unblocked, handles
  citation) — allowing or continuing to block GPTBot is a pure business preference with no
  citation-eligibility consequence either way.
- **What NOT to select:** no need to touch Bingbot, PerplexityBot, or OAI-SearchBot — none of
  these are currently blocked.
- **What info is requested:** nothing beyond the dashboard toggle itself — no new data exposure
  beyond what any ordinary browser already sees on the public site.
- **What I need back:** confirmation of what was changed (or a screenshot of the current AI Bots
  settings) so this can be re-verified against live production afterward.

### 2. Google Search Console verification
- **Why needed:** establishes the measurement baseline this mission's own "before/after" §5
  deliverable requires going forward, and unlocks product/shopping rich-result performance
  reporting.
- **Expected value:** measurement infrastructure, not itself a ranking factor — moderate,
  compounding value (cannot start measuring "now" retroactively).
- **Cost:** free. **Risk:** none — read-only ownership verification.
- **Exact URL:** `search.google.com/search-console` → Add property → **URL prefix**:
  `https://tawveeri.com`.
- **Exact steps:** choose the **"HTML tag"** verification method (not DNS) → copy the `content="…"`
  value Google shows → send it to me or paste it directly into the `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`
  Railway environment variable.
- **What NOT to select:** the "Domain" property type (DNS TXT record) — more steps, no benefit
  over URL-prefix + HTML tag for this use case.
- **What info is requested:** only the verification code string; no business/personal data beyond
  the founder's own Google account login.
- **What I need back:** the verification code string (or confirmation it's already in Railway).

### 3. Bing Webmaster Tools verification
- Same pattern as #2, lower priority (Bing's Saudi market share is smaller than Google's).
- **Exact URL:** `bing.com/webmasters` → Add site → `https://tawveeri.com` → HTML meta tag
  verification → paste the code into `NEXT_PUBLIC_BING_SITE_VERIFICATION`.

**Explicitly not requested:** no Google Merchant Center registration (rejected on evidence, §1),
no Perplexity Merchant Program application (rejected, same reason), no OpenAI ACP application
(no confirmed open path exists yet — nothing to apply to).

## 5. Opportunity map — NOW / NEXT / LATER / REJECT

| Tier | Item | Reasoning |
|---|---|---|
| **NOW (done this mission)** | Fix double-locale compare-link 404s | Severe, live, pure code fix |
| **NOW (done)** | Fix malformed compare-page canonical | Real Google-policy violation, pure code fix |
| **NOW (done)** | Add `x-default` hreflang | Free, one-line, benefits every page |
| **NOW (done, infra)** | GSC/Bing verification hooks | Zero-risk, activates the moment founder has the codes |
| **NOW (founder)** | Cloudflare AI-bot allow for Google-Extended/ClaudeBot | Highest leverage in the whole mission; blocked only by dashboard access |
| **NOW (founder)** | Register GSC + Bing Webmaster | Free, standard, unblocks measurement |
| **NEXT** | Visible per-product price-history chart | Real, evidenced competitive differentiator (Idealo); the underlying data already exists — sizeable UI feature, not done this pass |
| **NEXT** | ProductGroup schema for real variant families | Needs a DB-level check for genuine storage/color variant families first — not confirmed applicable yet |
| **LATER / MONITOR** | Google CSS | Re-check only if Google ever extends the program to Saudi Arabia |
| **LATER / MONITOR** | OpenAI ACP | Re-check if an open, non-merchant application path appears |
| **LATER / MONITOR** | Bing's aggregator-specific shopping program | Re-check if Microsoft publishes clearer eligibility criteria |
| **REJECT** | Google Merchant Center / free listings / Shopping ads | Structurally mismatched business model (no checkout) |
| **REJECT** | Perplexity Merchant Program | Same reason — would misrepresent Tawveeri as a seller |
| **REJECT** | `llms.txt` | Already researched and rejected (ADR-189: 408/500M AI-bot fetch rate); no new evidence overturns it |
| **UNCHANGED** | UCP/MCP Saudi truth-server | Already correctly scoped-not-built pending identity/GTIN quality (`AGENTIC_COMMERCE.md`) — not re-opened |

## 6. Verification

- `npm test`: 1782/1782 passing (1767 baseline + 15 new across `tests/seo/discoverability-links.test.ts`).
- `tsc --noEmit`: matches the documented pre-existing baseline, zero in touched files.
- `next build`: clean.
- `npx tsx scripts/tps-analysis/sitemap-verify.ts` (baseline, re-run BEFORE this mission's fixes
  deployed): sitemap serving 18,492 URLs (2,104 compare + 16,346 product + 42 static), all sampled
  classes 200, robots.txt/sitemap consistent, non-canonical host correctly noindex-but-crawlable.
- Live production, post-deploy: category-page compare links resolve 200 in both locales (was 404);
  compare-page canonical contains `%7C`, not raw `|`; `x-default` hreflang present; GSC/Bing
  verification meta tags absent by default (no env var set), confirmed a true no-op.

## 7. Known, disclosed, non-blocking limitations

1. Whether real ProductGroup-eligible variant families exist was not confirmed (needs a DB query
   this session's tooling could not run) — left as a NEXT-tier investigation, not implemented on
   an unconfirmed premise.
2. The product-photo raw-HTML presence check was inconclusive for one sampled SKU (JSON-LD carried
   a real image URL; a plain `<img>` tag was not found in that sample) — flagged, not asserted as
   a defect, needs a follow-up check with a product known to have multiple gallery images.
3. Bing's aggregator/CSS-equivalent program eligibility could not be verified from a primary
   source (Microsoft's own aggregator help page 404'd) — MONITOR, not chased further.
4. OpenAI ACP's actual application process (open vs. fully closed) could not be confirmed either
   way — treated as effectively closed for a non-merchant today, MONITOR for change.
5. The visible price-history chart (§2, §5 NEXT) is a real, evidenced opportunity intentionally
   NOT built this mission — sized as its own dedicated UI feature, not a discoverability-metadata
   fix.
