# Final Tasks — Tawveeri Platform

**Client:** Mohammed Abdullah Al-Quraini
**Review Date:** April 16, 2026
**Deadline:** April 22, 2026
**Reference:** PDR (10-Week Implementation Plan) + Client Review Notes
**Post-deadline:** UAT begins immediately, followed by official handover and project closure.

---

> **Update — 2026-04-19:** Per client direction, active store list narrowed to **8 stores**: Amazon SA, Noon, Jarir, Extra, Almanea, Shaker, Samsung KSA, Al-Shetaa Wal-Saif (SWSG). All references below to 17/15 stores, and the store tables listing Zagzoog, Alesayi, Alkhunaizan, Bukhamsen, Alghanim, Alsaif Gallery, Lulu GCC, Najm Store, AliExpress AR are **historical context only** — those stores are deactivated in the DB and removed from the code registry. See `CLAUDE.md` for current active list.

---

## Context

The client reviewed the platform and found gaps between the progress report (100% completion claimed) and the actual state. Additionally, cross-referencing the PDR requirements document against the codebase reveals further incomplete items. All tasks below must be resolved by **April 22, 2026** for UAT and contractual close-out.

> Remaining payment installments have been waived as compensation for the delivery delay (originally due February 2026).

---

## Client-Reported Issues

### CR-1: Search Stability — HTTP 504 Timeouts and Error Handling
**Priority:** Critical | **Complexity:** Medium | **Source:** Client Review #2

**Problem:** Searching in the "Home Appliances" category triggers "Store load failed" and "Load failed" errors caused by HTTP 504 backend timeouts. Some scrapers exceed their timeout window (60-90s) for certain product categories, causing the entire search to appear broken.

**Root Cause (from code analysis):** The search orchestrator (`search-orchestrator.ts`) runs all 17 store scrapers in parallel. Stores that fail to respond are caught but the error surfacing to users is poor — a single slow store can make the whole search appear broken.

**Required:**
- [ ] Investigate and fix 504 timeouts on Home Appliances category searches (likely scraper-specific timeout or upstream store issues)
- [ ] Ensure partial results are displayed even when some stores fail (graceful degradation — the orchestrator catches errors but the UI may not handle partial results well)
- [ ] Suppress or improve error messages shown to users — show "X of Y stores loaded" instead of "Load failed"

**Key Files:**
- `src/lib/scraping/search/search-orchestrator.ts` — timeout handling
- `src/app/api/search/scrape/route.ts` — error response format
- `src/app/[locale]/(public)/search/search-client.tsx` — error display logic

---

### CR-2: Duplicate Search Bar on Homepage
**Priority:** Medium | **Complexity:** Low | **Source:** Client Review #2

**Problem:** The client reports seeing the search bar twice on the homepage.

**Root Cause (from code analysis):** The landing page has a hero search bar (`landing-client.tsx:169-182`) and the header shell (`public-page-shell.tsx:272-294`) has a desktop search bar. Both are visible simultaneously on desktop. This is likely by design (hero for discovery, header for quick access from any page), but the client perceives it as a bug.

**Required:**
- [ ] Hide the header search bar on the landing page (when the hero search is already visible) — OR — confirm with client that the header search across all pages is intentional and only the landing page overlap needs fixing

**Key Files:**
- `src/app/[locale]/landing-client.tsx` — hero search bar
- `src/components/public/public-page-shell.tsx` — header search bar

---

### CR-3: Store Scraper Activation — Only 4-5 of 17 Stores Return Results
**Priority:** Critical | **Complexity:** High | **Source:** Client Review #3

**Problem:** 17 store scrapers are registered in code (`store-registry.ts` + `extended-merchants-registry.ts`), but only 4-5 return results during searches. The remaining scrapers either fail silently, time out, or return empty results. The client also reports that clicking "Alibaba" (likely AliExpress) returns a 404 page.

**Current Store Scrapers (17 total):**
| # | Store | Scraper File | Type |
|---|-------|-------------|------|
| 1 | Amazon SA | `amazon-search-scraper.ts` | Primary |
| 2 | Noon | `noon-search-scraper.ts` | Primary |
| 3 | Jarir | `jarir-search-scraper.ts` | Primary |
| 4 | Extra | `extra-search-scraper.ts` | Primary |
| 5 | Almanea | `almanea-search-scraper.ts` | Primary |
| 6 | Samsung KSA | `samsung-ksa-search-scraper.ts` | Extended |
| 7 | Shaker | `shaker-search-scraper.ts` | Extended |
| 8 | Zagzoog | `zagzoog-search-scraper.ts` | Extended |
| 9 | Al Esayi | `alesayi-search-scraper.ts` | Extended |
| 10 | SWSG | `swsg-search-scraper.ts` | Extended |
| 11 | Al Khunaizan | `alkhunaizan-search-scraper.ts` | Extended |
| 12 | Bu Khamsen | `bukhamsen-search-scraper.ts` | Extended |
| 13 | Al Ghanim | `alghanim-search-scraper.ts` | Extended |
| 14 | Al Saif Gallery | `alsaif-gallery-search-scraper.ts` | Extended |
| 15 | Lulu GCC | `lulu-gcc-search-scraper.ts` | Extended |
| 16 | Najm Store | `najm-store-search-scraper.ts` | Extended |
| 17 | AliExpress AR | `aliexpress-ar-search-scraper.ts` | Extended |

**Required:**
- [ ] Test each of the 17 scrapers individually and fix those that fail or return empty results
- [ ] Fix or remove AliExpress AR store if its scraper/page is broken (404 issue)
- [ ] Ensure the stores listing page does not show stores that have no working scraper
- [ ] Add per-store error logging so failures can be diagnosed in production

**Key Files:**
- `src/lib/scraping/search/store-registry.ts`
- `src/lib/scraping/search/extended-merchants-registry.ts`
- Each scraper file in `src/lib/scraping/search/`

---

### CR-4: Guest Access to Comparison Page
**Priority:** High | **Complexity:** Low | **Source:** Client Review #4

**Problem:** Clicking "Compare" redirects guests to a mandatory login page. The PDR specifies "Guest Access: Customers can search without creating an account." The comparison page lives under the `(dashboard)` route group which calls `requireAuth()`, blocking unauthenticated users.

**Root Cause:** The compare page is at `src/app/[locale]/(dashboard)/compare/page.tsx` — the `(dashboard)` layout enforces authentication via `requireAuth()` server-side. Guests can add products to the compare list (stored in localStorage) but cannot view the comparison page.

**Required:**
- [ ] Move the compare page out of `(dashboard)` into `(public)` route group — OR — create a public compare route that allows guest viewing
- [ ] Keep authentication prompts only for persistent features (save comparison, enable price alerts, wishlist)
- [ ] Ensure the compare navigation button in the header links to the public route instead of redirecting to login

**Key Files:**
- `src/app/[locale]/(dashboard)/compare/page.tsx` — current protected page
- `src/app/[locale]/(dashboard)/layout.tsx` — auth enforcement (line 22-26)
- `src/components/public/public-page-shell.tsx` — compare nav button

---

### CR-5: Affiliate Commission System — Amazon & Noon Integration
**Priority:** High | **Complexity:** Medium | **Source:** Client Review #5

**Problem:** Affiliate links are not activated. The tracking infrastructure exists (`src/lib/transactions/tracking.ts` with `generateAffiliateUrl()`, `trackProductClick()`, `trackConversion()`), but actual affiliate codes are not wired in. The `stores` table has `commission_rate` but no fields for affiliate codes. The Admin Panel has no UI for managing these codes.

**Client Affiliate Codes:**
- **Amazon SA:** Associate tag `tawveeri-21`
- **Noon:** Affiliate code `DNC160`

**Required:**
- [ ] Add `affiliate_config` JSONB column to the `stores` table (or individual fields) to store per-store affiliate parameters
- [ ] Implement affiliate URL generation logic per store:
  - Amazon: append `?tag=tawveeri-21` to product URLs
  - Noon: append affiliate tracking parameter with code `DNC160`
- [ ] Wire `generateAffiliateUrl()` in `tracking.ts` to read affiliate codes from the database instead of relying on hardcoded `affiliate_url` fields on `product_stores`
- [ ] Add an "Affiliate Settings" section in the Admin Panel store detail page (`/admin/stores/[id]`) with editable fields for affiliate codes per store
- [ ] Ensure all "View at Store" / "Buy" buttons across the platform use the generated affiliate URLs

**Key Files:**
- `src/lib/transactions/tracking.ts` — affiliate URL generation
- `src/components/search/store-comparison-panel.tsx:55` — URL usage
- `src/components/products/comparison-table.tsx` — "View at Store" buttons
- `src/app/[locale]/admin/stores/[id]/page.tsx` — admin store detail (needs affiliate fields)
- `scripts/database/01-schema.sql` — stores table schema

---

### CR-6: Incorrect Store Name — SWSG (Winter & Summer)
**Priority:** Low | **Complexity:** Low | **Source:** Client Review #6

**Problem:** The store "الشتاء والصيف" (Winter & Summer / SWSG) displays with an incorrect Arabic name "سواسق" in the UI.

**Root Cause:** The display name mapping in `src/lib/scraping/product-adapter.ts` (line 25, `SEARCH_STORE_DISPLAY_NAMES`) has the wrong Arabic name for SWSG.

**Required:**
- [ ] Update `SEARCH_STORE_DISPLAY_NAMES` in `product-adapter.ts`: change `name_ar` from `"سواسق"` to `"الشتاء والصيف"` and `name_en` to `"Winter & Summer"`
- [ ] Update the store config in `src/lib/scraping/config/store-configs/swsg.json` if it has the wrong name
- [ ] Update the database `stores` record for SWSG if the name is wrong there too

**Key Files:**
- `src/lib/scraping/product-adapter.ts` — display name mapping
- `src/lib/scraping/config/store-configs/swsg.json` — store config

---

### CR-7: Brand Identity — Apply New Visual Guidelines
**Priority:** Medium | **Complexity:** Medium | **Source:** Client Review #7

**Problem:** The client sent updated Brand Guidelines last week. The current platform uses a green primary color (`#55B295`) with Cairo font. All interfaces must be updated to match the new brand guidelines exactly (colors, fonts, logo).

**Current State:**
- Primary color: `#55B295` (green) — defined in `src/app/globals.css`
- Font: Cairo (single family) — loaded in `src/app/[locale]/layout.tsx`
- Logo: `public/logos/Tawveeri.png` (recently added)

**Required:**
- [ ] Obtain and review the Brand Guidelines file from the client (verify if already received)
- [ ] Update CSS custom properties in `globals.css` to match new brand colors
- [ ] Update font family if the brand guidelines specify different fonts
- [ ] Replace/verify logo across all pages (header, footer, favicon, OG images)
- [ ] Verify consistency across all public pages: landing, search, product detail, stores, deals, comparison, auth, error pages

**Key Files:**
- `src/app/globals.css` — all color tokens and design system
- `src/app/[locale]/layout.tsx` — font loading
- `src/components/public/public-page-shell.tsx` — header logo
- `src/components/layout/footer.tsx` — footer logo
- `public/logos/Tawveeri.png` — logo asset

---

## PDR Gap Analysis — Additional Tasks

The following items are required by the PDR but are missing or incomplete in the current codebase.

### PDR-1: "Top Stores" / Featured Stores Page — Product Click-Through
**Priority:** High | **Complexity:** Medium | **Source:** PDR Week 4 + Client Review #1

**Problem:** The landing page shows a "Supported Stores" section with 17 store cards. Clicking a store navigates to its detail page, which loads products from the `product_stores` database table. If a store has no products in the DB (only scraper-based), clicking it shows an empty page. The client specifically mentions clicking stores with products like refrigerators but getting no results.

**Required:**
- [ ] Ensure store detail pages trigger a live search (scraper) for the store's products when the DB has no pre-loaded products — OR — run a background product discovery cron to populate stores with products
- [ ] Add a "Search in this store" feature on the store detail page that queries that specific store's scraper
- [ ] Verify all 17 featured store cards on the landing page link to working store detail pages

**Key Files:**
- `src/app/[locale]/(public)/stores/[slug]/store-detail-client.tsx` — store detail page
- `src/app/[locale]/landing-client.tsx` — featured stores section

---

### PDR-2: Store Self-Registration / Onboarding Portal
**Priority:** Medium | **Complexity:** High | **Source:** PDR Week 4

**Problem:** The PDR requires a "Store onboarding portal: self-service for stores." The current system has a store owner dashboard (`/store/dashboard`) with product management, analytics, and coupons — but no self-registration flow. Stores must be pre-created in the database and users must be manually assigned the `store` role.

**Required:**
- [ ] Create a store registration flow: form to apply as a store owner (business name, CR number, contact info)
- [ ] Admin approval workflow: admin receives notification, can approve/reject store applications
- [ ] On approval: create `stores` record, assign `store` role to user, send confirmation email

**Key Files:**
- `src/app/[locale]/store/layout.tsx` — current store access control
- `src/app/[locale]/admin/stores/` — admin store management

---

### PDR-3: Hijri Date Support
**Priority:** Low | **Complexity:** Low | **Source:** PDR Week 10

**Problem:** The PDR requires "Localization: Support Hijri and Gregorian dates, Arabic numerals." Arabic numerals are supported via `toLocaleString('ar-SA')`, but Hijri calendar dates are not implemented anywhere.

**Required:**
- [ ] Add Hijri date display alongside Gregorian dates in Arabic locale (use `Intl.DateTimeFormat` with `calendar: 'islamic'` option)
- [ ] Apply to: product listings (date added), price history timestamps, notifications, deals expiry dates

---

### PDR-4: Loyalty Program / Cashback System
**Priority:** Low | **Complexity:** High | **Source:** PDR Week 8

**Problem:** The PDR lists "Loyalty program / Cashback" under Week 8 (Monetization). No implementation exists — zero references to loyalty or cashback in the codebase. The transaction tracking infrastructure (`transactions` table) could serve as a foundation.

**Required:**
- [ ] Determine with client if this is required for the current delivery or deferred to a future phase
- [ ] If required: design points/cashback system on top of existing transaction tracking

---

### PDR-5: Premium Store Listings
**Priority:** Low | **Complexity:** Medium | **Source:** PDR Week 8

**Problem:** The PDR lists "Premium store listings" under Week 8. The `stores` table has `is_featured` and `is_premium` boolean fields, and the store listing page can filter by these — but there is no mechanism for stores to purchase or activate premium status, and no visual differentiation for premium stores in search results.

**Required:**
- [ ] Add visual distinction for premium/featured stores in search results and store listings (badge, priority positioning)
- [ ] Determine if premium store management is needed in admin panel for current delivery

---

## Priority Summary

| # | Task | Priority | Complexity | Status | Source |
|---|------|----------|------------|--------|--------|
| **CR-1** | Search Stability — 504 Timeouts | Critical | Medium | **Done** (Apr 18) | Client |
| **CR-3** | Activate Store Scrapers (15 active) | Critical | High | **Done** (Apr 18) | Client |
| **CR-4** | Guest Access to Comparison Page | High | Low | Pending | Client |
| **CR-5** | Affiliate System (Amazon + Noon) | High | Medium | Pending | Client |
| **PDR-1** | Store Pages — Product Click-Through | High | Medium | Pending | PDR + Client |
| **CR-7** | Brand Identity / Visual Guidelines | Medium | Medium | Pending | Client |
| **CR-2** | Duplicate Search Bar on Homepage | Medium | Low | Pending | Client |
| **PDR-2** | Store Self-Registration Portal | Medium | High | Pending | PDR |
| **CR-6** | Fix SWSG Store Name | Low | Low | Pending | Client |
| **PDR-3** | Hijri Date Support | Low | Low | Pending | PDR |
| **PDR-4** | Loyalty / Cashback System | Low | High | Pending | PDR |
| **PDR-5** | Premium Store Listings | Low | Medium | Pending | PDR |

**Progress:** 2/12 tasks completed (2 Critical done, 3 days remaining)

---

## Completed Work Log

### CR-1: Search Stability (Completed Apr 18, 2026)
- Reduced scraper timeouts (60s → 30s default, 20s for WooCommerce stores, 45s for Puppeteer stores)
- Added per-store timing logs and `totalStores`/`successfulStores` metadata in API response
- Replaced raw HTTP error messages with localized user-friendly messages (Arabic/English)
- Removed error banner from UI — store errors logged to console only
- Increased search rate limit from 15 → 30 req/min

### CR-3: Store Scraper Activation (Completed Apr 18, 2026)
- Fixed 6 Puppeteer-based scrapers by increasing timeouts to 45s, switching to `domcontentloaded`, reducing `extraWaitMs`
- Added stealth headers to Puppeteer (updated Chrome UA v126, webdriver detection bypass, Accept-Language)
- Increased Puppeteer concurrency from 3 → 4 (7 stores use Puppeteer)
- Switched alsaif_gallery from plain fetch to Puppeteer (plain fetch gets HTTP 418 from Huawei WAF)
- Removed 2 permanently blocked stores: alsaif_gallery (418 WAF), lulu_gcc (403 blocked) — scrapers preserved for future re-enable
- **Result:** 15 active stores, 10-15 returning results per query (was 4-5 before)

---

## Delivery Timeline

- **April 22, 2026** — All client-reported issues (CR-1 through CR-7) resolved
- **Post April 22** — UAT begins immediately
- **After UAT** — Official handover: final delivery sign-off, source code, documentation, and all project assets per contract
- **PDR gaps (PDR-1 through PDR-5)** — Discuss with client which are required for final delivery vs. deferred

---

## Features Verified as Complete (No Action Needed)

These PDR requirements have been verified as fully implemented in the current codebase:

| Feature | PDR Week | Status |
|---------|----------|--------|
| User registration (email/phone/OAuth) | Week 2 | Complete |
| Guest search access | Week 2 | Complete |
| Account management (profile, password reset, delete) | Week 2 | Complete |
| Product search by category | Week 3 | Complete |
| Brand & model filtering | Week 3 | Complete |
| Dynamic search filters (per category) | Week 3 | Complete |
| 5 major store integrations (Amazon, Noon, Jarir, Extra, Almanea) | Week 4 | Complete |
| Store rating system | Week 4 | Complete |
| Product detail page (images, specs, prices) | Week 5 | Complete |
| Product availability checker (per store) | Week 5 | Complete |
| Product videos/demos | Week 5 | Complete |
| Price comparison engine (search results) | Week 5 | Complete |
| Price history tracking | Week 5 | Complete |
| Multi-language (Arabic/English) | Week 5 | Complete |
| Currency (SAR) | Week 5 | Complete |
| Wishlist / save products | Week 6 | Complete |
| Search history log | Week 6 | Complete |
| AI-powered recommendations (pgvector) | Week 6 | Complete |
| Notification system (price drop, back in stock) | Week 7 | Complete |
| Email alerts (SendGrid) | Week 7 | Complete |
| Push notifications (web + mobile) | Week 7 | Complete |
| Daily deals section | Week 7 | Complete |
| Coupon integration | Week 7 | Complete |
| Store dashboard (merchant analytics) | Week 8 | Complete |
| Admin analytics dashboard | Week 8 | Complete |
| SEO optimization (JSON-LD, sitemaps, meta) | Week 8 | Complete |
| Comparison tables (specs & prices) | Week 9 | Complete |
| Delivery time comparison | Week 9 | Complete |
| Multi-store cart | Week 9 | Complete |
| Gift option integration | Week 9 | Complete |
| Mobile app (iOS & Android via Expo) | Week 10 | Complete |
| Voice search (Arabic + English) | Functional Req | Complete |
| Barcode/QR scanner | Functional Req | Complete |
| Search suggestions / autocomplete | Functional Req | Complete |
| Redirection to store (click-through) | Functional Req | Complete |
| Commission tracking infrastructure | Functional Req | Complete |
| User reviews & ratings | Functional Req | Complete |
| Sentry error monitoring | Non-Functional | Complete |
| RLS (Row-Level Security) | Non-Functional | Complete |
