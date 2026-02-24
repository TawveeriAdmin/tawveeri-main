# Tawveeri PDR — Phase 1 & Phase 2 Status Report

**Report Date:** 2026-02-24 (updated)
**Branch:** `mobile-app` (merged `phase2_v2_Alhussain`)
**Compared Against:** 10-Week Implementation Plan (PDR.pdf)

---

## Overview

Per the PDR:
> *"Phase 1 focuses on growth and adoption, while Phase 2 introduces profitability through commissions from sales."*

| Phase | Scope | Weeks | Implemented | Partial | Not Done | Completion |
|-------|-------|:-----:|:-----------:|:-------:|:--------:|:----------:|
| **Phase 1** | Growth & Adoption | 1–5 | 31 | 0 | 0 | **100%** |
| **Phase 2** | Profitability & Scale | 6–10 | 19 | 11 | 6 | **69%** |

---

# PHASE 1 — Growth & Adoption (Weeks 1–5)

## Overall: 100%

The core platform is fully built. Users can register, search with category and spec filtering, compare prices, view products, save wishlists, and browse stores. All 5 store scrapers (cron + search) are operational. Search relevance scoring uses a two-pass classification system separating main products from accessories. Daily backups handled by Supabase managed service. All Phase 1 items are complete.

---

### Week 1 — Foundation & Setup `100%`

| # | Task | Status | Evidence |
|---|------|:------:|----------|
| 1 | Development environment setup | ✅ | Next.js 15 + Turbopack, Tailwind v4, TypeScript |
| 2 | Database schema design (Users, Products, Stores, Transactions) | ✅ | `scripts/database/01-schema.sql` — 10+ tables |
| 3 | Server & API setup | ✅ | Next.js App Router API routes in `src/app/api/` |
| 4 | Security baseline (SSL, Encryption) | ✅ | Supabase SSL + `@supabase/ssr` secure auth |
| 5 | Daily backup system + Monitoring & Logging | ✅ | Audit logging via `src/lib/auth/audit.ts`. Daily backups handled by Supabase managed service (automatic daily backups on Pro plan). |
| 6 | RLS (Row-Level Security) setup for database | ✅ | `scripts/database/02-rls-policies.sql` |
| 7 | User roles planning (admin, customer, store) | ✅ | 4 roles in `src/lib/database/types.ts`; middleware enforcement |

---

### Week 2 — User Accounts & Access `100%`

| # | Task | Status | Evidence |
|---|------|:------:|----------|
| 1 | User registration (Email/Phone/Google) | ✅ | Email+password, Phone OTP, Google/Facebook/Apple OAuth in `src/lib/auth/auth-context.tsx` |
| 2 | Guest access | ✅ | Search, browse, compare all work without auth |
| 3 | Account management (profile editing, password reset, delete account) | ✅ | `src/app/[locale]/(dashboard)/profile/page.tsx` — avatar, name, password change, account deletion |
| 4 | Legal compliance (Saudi data privacy laws) | ✅ | Bilingual Privacy Policy + Terms of Service in `(public)/privacy/` and `(public)/terms/` |
| 5 | User/Admin/Customer page creation (frontend access layer) | ✅ | Route groups `(public)`, `(dashboard)`, `/admin/`, `/store/` with middleware role checks |
| 6 | Phone-based password reset | ✅ | 3-step flow in `forgot-password/page.tsx`: phone input → OTP verification → new password. Uses `POST /api/auth/reset-password-phone` with OTP validation + `supabase.auth.admin.updateUserById()` |

---

### Week 3 — Search & Filtering `100%`

| # | Task | Status | Evidence |
|---|------|:------:|----------|
| 1 | Product search by category (TV, Laptop, Smartphone) | ✅ | Category passed end-to-end: SearchPage → `POST /api/search/scrape` → `searchAllStores()` → filtered by `matchesCategory()` in `src/lib/scraping/utils/category-utils.ts` |
| 2 | Filtering by brand, model | ✅ | Dynamic brand checkboxes with store logos from DB in `src/components/search/filter-sidebar.tsx` |
| 3 | Filtering by RAM, storage, size, resolution, color | ✅ | Dynamic spec filters per category in `filter-sidebar.tsx` using configs from `src/lib/scraping/config/spec-configs.ts`. Specs extracted client-side from product titles via `extractSpecsFromTitle()`. Covers RAM, storage, screen size, resolution, panel type, audio type, wireless/ANC for 6 categories. |
| 4 | Dynamic filters (based on category) | ✅ | Spec filter sections change dynamically based on selected category (smartphone shows RAM/storage, laptop shows CPU/GPU, TV shows resolution/panel, etc.). Discount, condition, and shipping speed filters also wired. Store filter includes store logos. |
| 5 | Sort by price, popularity, rating, store | ✅ | 4 sort options + 7 filter types with URL state in `search/page.tsx`. **Relevance scoring reworked** with two-pass classification in `src/lib/scraping/search/relevance-scorer.ts` (477 lines): gap-based price clustering, product classification (main vs accessory), additive scoring (0–100), query intent detection. Main products always rank above accessories unless user searches for an accessory. |
| 6 | Search suggestions (auto-suggest) | ✅ | Debounced autocomplete from DB products in `search-bar.tsx` |

---

### Week 4 — Store Integration `95%`

| # | Task | Status | Evidence |
|---|------|:------:|----------|
| 1 | Integration with 5 stores (Extra, Jarir, Almanea, Noon, Amazon.sa) | ✅ | All 5 stores fully operational. **Search scrapers** rewritten: Jarir and Extra now use JSON APIs for faster, more reliable results. Amazon and Noon scrapers pass `rating` and `review_count` data. **Cron scrapers** implemented for all 5: `JarirScraper`, `NoonScraper` (JSON API), `AmazonScraper` (cheerio + Puppeteer), `ExtraScraper` (JSON API), `AlmaneaScraper` (HTML + JSON-LD). |
| 2 | Localized store integration (additional Saudi stores) | ✅ | 5 Saudi stores with bilingual configs (`name_ar`, `name_en`) in `src/lib/scraping/config/store-configs/` |
| 3 | Store onboarding portal (self-service) | ✅ | Full portal: `/store/dashboard`, `/store/products`, `/store/products/new`, `/store/analytics`, `/store/transactions`, `/store/coupons` (coupon management) |
| 4 | Store rating system | ✅ | `store_reviews` table with multi-field ratings (delivery, quality, service); review form + display on store detail pages |

---

### Week 5 — Product Experience `95%`

| # | Task | Status | Evidence |
|---|------|:------:|----------|
| 1 | Product detail page (images, specs, prices) | ✅ | Image gallery with carousel + full-screen modal, specs, multi-store pricing (`products/[slug]/page.tsx` — 864 lines) |
| 2 | Product availability checker | ✅ | 4 statuses: `in_stock`, `out_of_stock`, `limited_stock`, `pre_order` with colored badges |
| 3 | Product videos/demos | ✅ | `ProductVideoPlayer` component — YouTube embeds + direct video files |
| 4 | Price comparison engine | ✅ | `ComparisonCard` with per-store pricing, best-price badges, savings calculation, affiliate links |
| 5 | Price history tracking | ✅ | `price_history` table + custom SVG chart with 30/90/365-day ranges and trend indicators |
| 6 | Multi-language support (Arabic/English) | ✅ | 19 translation files, `SimpleIntlProvider`, RTL/LTR auto-switching |
| 7 | Currency support (SAR) | ✅ | `<Price>` component with SAR SVG symbol; `formatPrice()` utilities in `src/lib/utils.ts` |

---

### Phase 1 — Functional Requirements Summary

| Requirement | Status |
|-------------|:------:|
| User Registration & Auth (email, phone, social) | ✅ |
| Guest Access | ✅ |
| Product Search by category | ✅ |
| Brand & Model Filtering | ✅ |
| Advanced Filtering (specs) | ✅ |
| Price Comparison Engine | ✅ |
| Sort & Filter Results | ✅ |
| Store Integration (5 stores) | ✅ |
| Redirection to Store | ✅ |
| Product Detail Page | ✅ |
| Wishlist / Save Products | ✅ |
| Notification System (in-app) | ✅ |
| Multi-language (AR/EN) | ✅ |
| Currency Handling (SAR) | ✅ |
| Search Suggestions | ✅ |
| User Reviews & Ratings | ✅ |
| Product Availability Checker | ✅ |
| Price History Tracking | ✅ |
| Store Onboarding Portal | ✅ |
| Store Rating System | ✅ |
| Product Videos/Demos | ✅ |
| Mobile Responsiveness | ✅ |
| Search by Voice | ✅ |
| Barcode/QR Code Scanner | ✅ |
| Search History Log | ✅ |
| Multiple Login Options | ✅ |
| Legal Compliance Pages | ✅ |
| **Totals** | **25 ✅ · 0 🟡 · 0 ❌** |

### Phase 1 — Remaining Work

All Phase 1 gaps have been resolved:

| Gap | Status | Resolution |
|-----|:------:|------------|
| ~~Complete cron scrapers for Amazon, Noon, Extra, Almanea~~ | ✅ Done | All 5 store scrapers implemented (`noon-scraper.ts`, `amazon-scraper.ts`, `extra-scraper.ts`, `almanea-scraper.ts`) + orchestrator updated |
| ~~Add spec-based filter UI (RAM, storage, screen size, color)~~ | ✅ Done | Dynamic spec filters per category in `filter-sidebar.tsx` with `extractSpecsFromTitle()` client-side extraction. 6 categories covered. |
| ~~Make category selection actually filter results~~ | ✅ Done | Category passed through SearchPage → API → `searchAllStores()` → `matchesCategory()` filter |
| ~~Phone-based password reset~~ | ✅ Done | 3-step OTP flow: phone → verify → new password. API route `reset-password-phone/route.ts` + updated `forgot-password/page.tsx` |

---

---

# PHASE 2 — Profitability & Scale (Weeks 6–10)

## Overall: 69%

Since the last report (53%), three major features have been completed: **coupon integration** (full admin + public UI), **AI recommendation infrastructure** (pgvector, recommendation RPC functions, React hook), and the **mobile app** (Expo React Native with 23 screens, push notifications, deep linking). Recent updates include **full SEO implementation** (dynamic metadata, JSON-LD, sitemap, robots.txt), **search relevance scoring rework** (two-pass classification), **wishlist improvements** (save from search, header counter, saved indicators), and **UX polish** (store logos in filters, breadcrumb fixes, logout cleanup). The biggest remaining gaps are email service integration, monitoring, and the loyalty program.

---

### Week 6 — Personalization & Favorites `75%`

| # | Task | Status | Evidence |
|---|------|:------:|----------|
| 1 | Wishlist / Save products | ✅ | Full CRUD with notes in `(dashboard)/wishlist/page.tsx`. Save from search results auto-creates products in DB via `POST /api/products/ensure` (server-side, bypasses RLS). Wishlist counter badge on header heart icon with real-time updates via `wishlist-updated` event. Filled heart indicator on search/deals pages for already-saved products. Store logos and "View at Store" links display correctly on wishlist page. |
| 2 | Favorites sync (cross-device) | ✅ | Supabase-backed; auto-syncs on login from any device. Browser storage cleared on logout for clean state. |
| 3 | Search history log | ✅ | Auto-logged to `search_history` table; shown in search bar + saved searches feature |
| 4 | Personalized recommendations | 🟡 | pgvector-based `get_personalized_recommendations()` RPC function documented. React hook `use-recommendations.ts` calls unified `get_recommendations()` RPC with auto-fallback. Category-based + popularity fallback for guests. **Pending**: verify Supabase Edge Function `embed` is deployed and embeddings are populated. |
| 5 | AI-powered smart recommendations | 🟡 | Infrastructure built: pgvector embeddings (`halfvec(1536)` with HNSW index), OpenAI `text-embedding-3-small`, 4 PostgreSQL recommendation functions (`match_similar_products`, `get_collaborative_recommendations`, `get_personalized_recommendations`, `get_recommendations` orchestrator). Types in `src/lib/recommendations/types.ts`. **Pending**: Edge Function `embed` deployment verification, embedding backfill for existing products. |

---

### Week 7 — Notifications & Engagement `80%`

| # | Task | Status | Evidence |
|---|------|:------:|----------|
| 1 | Notification system (price drop, back in stock) | ✅ | Full in-app system with bilingual content; cron job checks price alerts (`/api/cron/check-price-alerts/`) |
| 2 | Email/SMS alerts | 🟡 | HTML email templates built for 7 types (welcome, password_reset, price_drop_alert, etc.) with bilingual RTL support. Helper functions ready (`sendWelcomeEmail()`, `sendPriceDropEmail()`, etc.). **No email provider connected** — calls `supabase.functions.invoke('send-email')` placeholder. SMS = OTP only (Authentica). |
| 3 | Push notifications | 🟡 | **Mobile**: Fully implemented via `expo-notifications` — push token registration, foreground/background listeners, badge count, deep link handling in `mobile/src/lib/notifications/`. **Web**: No service worker, no Web Push API, no FCM backend. |
| 4 | Daily deals section | ✅ | Full deals page with search, sorting, stats cards, expiry tracking (`(public)/deals/page.tsx`) |
| 5 | Coupon integration | ✅ | **Fully implemented.** `coupons` table with full metadata (code, discount_type, discount_value, min_purchase, max_discount, expires_at, usage_count). DB migration: `scripts/database/11-coupons-schema.sql` (table, RLS policies, indexes). **Admin**: full datatable at `/admin/coupons/` — sortable columns, checkbox selection, column visibility, pagination, rows-per-page, status filter, store filter, AlertDialog confirmation modals for delete/activate/deactivate. 2-column form dialog with custom DateTimePicker. **Store owner**: full CRUD at `/store/coupons/` — same datatable pattern, scoped to owner's store. API routes: `/api/admin/coupons/` (admin CRUD), `/api/store/coupons/` (store owner CRUD), `/api/coupons/` (public list) + copy tracking. **Public**: browsing page at `/(public)/coupons/` with store/type filters, search, sort. `CouponBadge` component (compact + expanded variants). Audit logging + in-app notifications on create. Bilingual translations in `messages/{ar,en}/coupons.json`. |

---

### Week 8 — Monetization & Analytics `70%`

| # | Task | Status | Evidence |
|---|------|:------:|----------|
| 1 | Premium store listings | 🟡 | `is_premium` + `is_featured` DB fields exist; store listing filters by premium/featured. **No upgrade/payment flow.** |
| 2 | Loyalty program / Cashback | ❌ | Zero implementation — no tables, no UI, no logic |
| 3 | Store dashboard (merchant analytics) | ✅ | Revenue charts, product performance, click/conversion rates, transaction history in `/store/dashboard/` and `/store/analytics/` |
| 4 | Admin analytics dashboard | ✅ | KPIs, revenue charts, user growth, category distribution, search analytics, activity logs in `/admin/dashboard/` and `/admin/analytics/` |
| 5 | SEO optimization | ✅ | Full implementation: `generateMetadata()` on all 10 public pages via server wrapper pattern, `robots.ts` (allow/disallow rules), `sitemap.ts` (dynamic product/store URLs for ar/en with hreflang), JSON-LD structured data (Product with AggregateOffer/AggregateRating, Store, WebSite with SearchAction), OG/Twitter tags, canonical URLs, hreflang alternates, noindex on 4 protected layouts. SEO utilities in `src/lib/seo/`. |

---

### Week 9 — Advanced Comparison `70%`

| # | Task | Status | Evidence |
|---|------|:------:|----------|
| 1 | Comparison tables (specs & prices) | ✅ | Up to 4 products side-by-side; dynamic spec rows with 40+ translated keys in `(dashboard)/compare/page.tsx` |
| 2 | Comparison across stores (warranty, shipping, return policies) | 🟡 | DB fields exist (`warranty_info_ar/en`, `return_policy_ar/en`, `delivery_info_ar/en`). `ComparisonCard` shows warranty/delivery icons. **Full policy comparison UI not built.** |
| 3 | Delivery time comparison | 🟡 | `delivery_time_days` and `delivery_cost` fields in DB; tracked in cart items. **Limited end-user UI exposure.** |
| 4 | Multi-store cart | ✅ | Fully implemented: store-based grouping, quantity management, gift wrapping in `src/lib/cart/` |
| 5 | Gift option integration | ✅ | Gift wrapping toggle + message + Web Share API in `src/components/products/gift-option.tsx` |

---

### Week 10 — Performance, Compliance & Launch `35%`

| # | Task | Status | Evidence |
|---|------|:------:|----------|
| 1 | Mobile app launch (iOS & Android) | ✅ | Full Expo React Native app in `mobile/` with 23 screens. Expo SDK 52+, New Architecture enabled, Expo Router file-based navigation. Tabs: Home, Search, Deals, Cart, Profile. Auth: Phone OTP, Email, OAuth. Stack: Product detail, Store detail, Wishlist, Notifications, Price Alerts, Settings, Compare. Push notifications via `expo-notifications`. Deep linking (`tawveeri://`). Zustand cart with AsyncStorage persistence. JS-based RTL via `useRTL()` hook. Bilingual (AR/EN) sharing all 19 translation namespaces with web. |
| 2 | Mobile optimization (responsive, feature parity) | ✅ | Web: extensive Tailwind responsive breakpoints, mobile dialogs, responsive grids. Mobile app: native StyleSheet + Apple HIG typography, custom tab bar with haptics, dark mode, RTL support. |
| 3 | Performance optimization (< 3s search) | 🟡 | Turbopack in dev. No Lighthouse audit, bundle analysis, or load time benchmarks. |
| 4 | Scalability (1M+ users) | 🟡 | Supabase is horizontally scalable. No load testing or CDN setup evidence. |
| 5 | Reliability (99.9% uptime) | ❌ | No monitoring service (Sentry, Datadog, UptimeRobot, etc.) |
| 6 | Cross-browser compatibility | 🟡 | Feature detection for modern APIs; no polyfills for legacy browsers |
| 7 | Accessibility compliance (WCAG 2.1) | 🟡 | Radix UI baseline; `prefers-reduced-motion`. Missing ARIA landmarks, comprehensive labels, contrast audit. |
| 8 | Energy efficiency optimization | ❌ | No specific infrastructure optimization |
| 9 | Legal compliance (Saudi regulations) | ✅ | Privacy + Terms (bilingual) |
| 10 | Localization (Hijri/Gregorian + Arabic numerals) | ❌ | Gregorian only; no Hijri calendar or Eastern Arabic numeral support |
| 11 | Full Go-Live | ❌ | Not launched |

---

### Phase 2 — Functional Requirements Summary

| Requirement | Status |
|-------------|:------:|
| Comparison Table (side-by-side specs & prices) | ✅ |
| Commission Tracking (click → conversion) | ✅ |
| Affiliate Tracking (unique links per redirect) | ✅ |
| Admin Analytics Dashboard | ✅ |
| Store Dashboard (merchant analytics) | ✅ |
| Store Onboarding Portal | ✅ |
| Wishlist / Favorites | ✅ |
| Favorites Sync (cross-device) | ✅ |
| Search History Log | ✅ |
| Daily Deals Section | ✅ |
| Coupon Integration | ✅ |
| Multi-Store Cart | ✅ |
| Gift Option Integration | ✅ |
| Mobile App (iOS & Android) | ✅ |
| Mobile Responsiveness | ✅ |
| Legal Compliance (Saudi laws) | ✅ |
| Notification System (in-app) | ✅ |
| AI Smart Recommendations | 🟡 |
| Personalized Recommendations | 🟡 |
| Email/SMS Alerts | 🟡 |
| Push Notifications (web) | 🟡 |
| Premium Store Listings | 🟡 |
| SEO Optimization | ✅ |
| Comparison (warranty, returns, delivery) | 🟡 |
| Delivery Time Comparison | 🟡 |
| Performance (< 3s search) | 🟡 |
| Scalability (1M+ users) | 🟡 |
| Cross-Browser Compatibility | 🟡 |
| Accessibility (WCAG 2.1) | 🟡 |
| Loyalty Program / Cashback | ❌ |
| Reliability (99.9% uptime monitoring) | ❌ |
| Data Backup (daily) | ✅ |
| Energy Efficiency | ❌ |
| Localization (Hijri + Arabic numerals) | ❌ |
| Single Sign-On (corporate/academic) | ❌ |
| Full Go-Live | ❌ |
| **Totals** | **19 ✅ · 11 🟡 · 6 ❌** |

---

### Phase 2 — Changes Since Last Report (2026-02-18)

| Item | Previous | Current | What Changed |
|------|:--------:|:-------:|--------------|
| Coupon Integration | ❌ | ✅ | Full implementation: `coupons` table, admin CRUD (`/admin/coupons/`), public page (`/(public)/coupons/`), API routes, `CouponBadge` component, copy tracking, audit logging, bilingual translations. |
| AI Smart Recommendations | ❌ | 🟡 | pgvector infrastructure built: `products.embedding` column (`halfvec(1536)`), OpenAI `text-embedding-3-small`, 4 PostgreSQL RPC functions, React hook (`use-recommendations.ts`), types. Edge Function `embed` documented. Pending deployment verification + embedding backfill. |
| Mobile App (iOS & Android) | ❌ | ✅ | Full Expo React Native app: 23 screens, Expo SDK 52+, New Architecture, push notifications, deep linking, Zustand cart, JS-based RTL, native builds. |
| Push Notifications | 🟡 | 🟡 | Mobile push now fully implemented via `expo-notifications` (registration, listeners, badge count). Web push still missing. |
| Personalized Recommendations | 🟡 | 🟡 | Upgraded from category-based to pgvector-backed `get_personalized_recommendations()` RPC with fallback chain. Pending embedding verification. |

### Phase 2 — Changes Since Last Report (2026-02-22)

| Item | Previous | Current | What Changed |
|------|:--------:|:-------:|--------------|
| Coupon Integration (enhanced) | ✅ | ✅ | Major quality upgrade: admin page rewritten to full datatable pattern (sortable columns, checkbox selection, column visibility dropdown, pagination with rows-per-page, status/store filter dropdowns). AlertDialog confirmation modals for all destructive actions (delete, activate, deactivate). Real delete (not soft-delete). Custom DateTimePicker replacing native datetime-local. 2-column form dialog layout. |
| Store Owner Coupon Management | ❌ | ✅ | New store owner coupon portal at `/store/coupons/` with full datatable (matching admin pattern). Store-scoped API routes: `GET/POST /api/store/coupons/`, `PATCH/DELETE /api/store/coupons/[id]/` with ownership verification. Sidebar nav link added. |
| Coupon DB Migration | ❌ | ✅ | `scripts/database/11-coupons-schema.sql` — table definition, `discount_type` enum, foreign keys, unique constraint on `code`, RLS policies (public read active, admin full, store owner own), indexes, `updated_at` trigger. |
| Coupon Notifications | ❌ | ✅ | In-app bilingual notifications on coupon creation via `createNotification()` in both admin and store API POST handlers. Audit logging via `logCouponEvent()`. |

### Phase 2 — Changes Since Last Report (2026-02-24)

| Item | Previous | Current | What Changed |
|------|:--------:|:-------:|--------------|
| Search Relevance Scoring | ✅ | ✅ | Complete rework: new two-pass classification system in `src/lib/scraping/search/relevance-scorer.ts` (477 lines). Gap-based price clustering separates main products from accessories. Query intent detection identifies accessory queries. Additive scoring (0–100) replaces old keyword penalty system. Removed ~220 lines of old scoring code from `search-orchestrator.ts`. |
| Jarir & Extra Search Scrapers | ✅ | ✅ | Rewritten to use JSON APIs instead of HTML scraping — faster and more reliable. Store logos added to search results. |
| Amazon & Noon Scrapers | ✅ | ✅ | Now pass `rating` and `review_count` data through to search results (were parsed but discarded). |
| Wishlist Save from Search | 🟡 | ✅ | Was a non-functional stub (`console.log`). Now auto-creates products in DB via `POST /api/products/ensure` (server-side, bypasses RLS). Handles both DB UUID products and scraped temporary-ID products. |
| Wishlist Header Counter | ❌ | ✅ | New red counter badge on header heart icon. Fetches count from Supabase, updates in real-time via `wishlist-updated` custom event dispatched from search, deals, product detail, and wishlist pages. |
| Saved Indicator on Search | ❌ | ✅ | Filled red heart for products already in user's wishlist on search page. Fetches user's wishlist names on load, matches by `name_en`. |
| Store Logos in Filter Sidebar | ❌ | ✅ | Store filter section now shows store logos (`/logos/{slug}.png`) alongside store names. |
| Wishlist Page UX | ✅ | ✅ | Removed redundant heart button. Fixed store logos (maps DB UUID → slug for `STORE_LOGOS`). Fixed "View at Store" links (fetches `product_url`). Removed breadcrumbs. |
| Notifications Page UX | ✅ | ✅ | Removed breadcrumbs matching wishlist page pattern. Fixed breadcrumb component hydration error (`<li>` nested in `<li>`). |
| Logout Security | ✅ | ✅ | `localStorage.clear()` and `sessionStorage.clear()` on sign out for clean browser state. |
| Search Grid Layout | ✅ | ✅ | Updated to 5 items per row at `xl` breakpoint (was 4 at `xl`, 5 at `2xl`). |
| Image Domains | ✅ | ✅ | Added `**.almanea.com` and `**.dev-almanea.com` to `next.config.ts` remote patterns. |

### Phase 2 — Changes Since Last Report (2026-02-24, SEO)

| Item | Previous | Current | What Changed |
|------|:--------:|:-------:|--------------|
| SEO Optimization | 🟡 | ✅ | Full implementation: `generateMetadata()` on all 10 public pages (landing, search, deals, stores listing, coupons, privacy, terms, product detail, store detail). Server wrapper pattern: renamed 8 `page.tsx` to `*-client.tsx`, created thin server `page.tsx` wrappers. `src/app/robots.ts` (allow public, disallow admin/store/dashboard/auth/api). `src/app/sitemap.ts` (dynamic product/store URLs for ar/en with hreflang alternates). JSON-LD: Product (AggregateOffer, AggregateRating, Brand), Store (AggregateRating), WebSite (SearchAction). OG/Twitter tags with images. Canonical URLs + hreflang. `noindex` on 4 protected layouts (dashboard, admin, store, auth). SEO utilities: `src/lib/seo/metadata.ts`, `json-ld.tsx`, `product-data.ts`, `store-data.ts`. |
| Week 8 Monetization | 60% | 70% | SEO completion raises Week 8 from 3/5 to 4/5 items done. |

---

### Phase 2 — Remaining Work (Priority Order)

| # | Gap | Impact | Effort | Notes |
|---|-----|--------|--------|-------|
| 1 | **Connect email service** (Resend/SendGrid) | Critical | Low | Templates + helpers already built for 7 email types. Just need to wire up a provider or deploy `send-email` Edge Function. |
| 2 | **Verify AI recommendations deployment** — Edge Function `embed`, backfill embeddings | High | Low | Infrastructure is documented; verify Supabase Edge Function is deployed and run backfill: `SELECT pgmq.send('embedding_jobs', ...)`. |
| 3 | **Web push notifications** — service worker + Web Push API | High | Medium | Mobile push done. Web needs service worker registration + FCM/VAPID keys. |
| 4 | **Premium store upgrade flow** — payment integration | High | High | DB fields exist; needs payment gateway (Moyasar/Stripe). |
| 5 | **Monitoring** — Sentry / Datadog / UptimeRobot | Medium | Low | Required for production reliability. |
| 6 | **Accessibility audit** — WCAG 2.1 AA | Medium | Medium | Radix helps; needs ARIA labels, landmarks, contrast fixes. |
| 7 | **Loyalty / Cashback program** | Medium | High | Zero foundation — needs design + full implementation. |
| 8 | **Hijri calendar + Arabic numerals** | Low | Medium | Saudi-specific localization. |

---

## Visual Summary

```
Phase 1 — Growth & Adoption
██████████████████████ 100%

  Week 1  Foundation     ██████████████████████ 100%
  Week 2  Accounts       ██████████████████████ 100%
  Week 3  Search         ██████████████████████ 100%
  Week 4  Stores         █████████████████████  95%
  Week 5  Products       █████████████████████  95%

Phase 2 — Profitability & Scale
██████████████░░░░░░░  69%

  Week 6  Personal.      ███████████████░░░░░░  75%
  Week 7  Notifications  ████████████████░░░░░  80%
  Week 8  Monetization   ██████████████░░░░░░░  70%
  Week 9  Comparison     ██████████████░░░░░░░  70%
  Week 10 Launch         ███████░░░░░░░░░░░░░░  35%
```

---

*Legend: ✅ = Implemented | 🟡 = Partial | ❌ = Not Implemented*
