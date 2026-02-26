# Tawveeri Mobile App — PDR Status Report

**Report Date:** 2026-02-26
**Branch:** `mobile-app`
**Compared Against:** 10-Week Implementation Plan (PDR.pdf)
**Platform:** Expo SDK 54+ (React Native 0.81, New Architecture enabled)

---

## Overview

The mobile app (`mobile/`) is a customer-facing Expo React Native application covering the core price comparison experience: search, product detail, deals, wishlist, cart, notifications, and price alerts. It does **not** include admin dashboard or store owner portal — those remain web-only.

| Category | Implemented | Partial | Not Done | Completion |
|----------|:-----------:|:-------:|:--------:|:----------:|
| Authentication & Access | 6 | 0 | 0 | **100%** |
| Search & Filtering | 7 | 1 | 1 | **83%** |
| Product Experience | 5 | 1 | 1 | **79%** |
| Stores | 3 | 1 | 0 | **88%** |
| Deals & Coupons | 3 | 0 | 0 | **100%** |
| Wishlist & Personalization | 3 | 0 | 1 | **75%** |
| Cart & Commerce | 2 | 0 | 2 | **50%** |
| Notifications | 4 | 0 | 0 | **100%** |
| Price Alerts | 2 | 0 | 0 | **100%** |
| Comparison | 1 | 0 | 2 | **33%** |
| Settings & Preferences | 4 | 1 | 2 | **64%** |
| Localization & Accessibility | 5 | 1 | 0 | **92%** |
| Platform & Infrastructure | 3 | 2 | 1 | **67%** |
| Legal & Compliance | 3 | 0 | 0 | **100%** |
| **Totals** | **51** | **7** | **10** | **80%** |

---

## 1. Authentication & Access `100%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | User registration (email, phone OTP, social) | ✅ | Phone OTP primary + email/password + OAuth in `mobile/src/lib/auth/auth-context.tsx` (lines 177–273). Login screen: `mobile/app/(auth)/login.tsx` |
| 2 | Guest access | ✅ | Search, browse, deals, stores all work without auth. Auth wall only on wishlist, notifications, price alerts |
| 3 | Account management (profile editing) | ✅ | `mobile/app/(stack)/edit-profile.tsx` — avatar upload (camera + library), name field, email/phone display with verification badges |
| 4 | Multiple login options (Google, Apple, Facebook) | ✅ | OAuth via `expo-web-browser` + deep link redirect (`tawveeri://auth/callback`) in `auth-context.tsx` lines 239–273 |
| 5 | Phone-based password reset | ✅ | 3-step flow (phone → OTP → new password) in `mobile/app/(auth)/forgot-password.tsx` |
| 6 | New user signup | ✅ | Name + email collection post-OTP in `mobile/app/(auth)/signup.tsx` |

---

## 2. Search & Filtering `83%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | Product search by category | ✅ | 7 category chips (All, Phones, Laptops, Audio, TVs, Gaming, Tablets) in `mobile/app/(tabs)/search.tsx`. Category passed to `POST /api/search/scrape`. All 5 stores scraped (amazon, noon, jarir, extra, almanea) |
| 2 | Sort results (relevance, price) | ✅ | 3 sort options: relevance, price asc, price desc with haptic cycling |
| 3 | Search history | ✅ | Recent searches stored in AsyncStorage (max 8), displayed in idle state |
| 4 | Product grouping (multi-store) | ✅ | Same product from different stores grouped into one card showing store logo + "+N" store count badge. Store logos bundled locally (`assets/logos/`) |
| 5 | Search suggestions (autocomplete) | 🟡 | Popular searches hardcoded, no API-driven autocomplete from DB like web's `search-bar.tsx` |
| 6 | Brand & model filtering | ✅ | FilterSheet bottom modal with brand chips extracted from current results — `mobile/src/components/search/FilterSheet.tsx` |
| 7 | Advanced spec filtering (RAM, storage, size, resolution) | ✅ | FilterSheet with dynamic spec sections using `CATEGORY_SPEC_FILTERS` + `extractSpecsFromTitle()` ported from web — `mobile/src/lib/search/spec-utils.ts` |
| 8 | Dynamic filters by category | ✅ | FilterSheet renders different spec filter sections per selected category (smartphones show RAM/storage, TVs show resolution/panel type, etc.). Also includes price range, discount %, condition (new/renewed/used), deals-only, and free-delivery toggles |
| 9 | Search by voice / Barcode scanner | ❌ | No voice input or camera-based scanning |

---

## 3. Product Experience `79%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | Product detail page (images, specs, prices) | ✅ | Full detail with image gallery + pagination dots, 3 tabs (Specs, Reviews, History) — `mobile/app/(stack)/product/[slug].tsx` |
| 2 | Price comparison (multi-store) | ✅ | Store list sorted by price with best-price highlight (green badge) |
| 3 | User reviews & ratings | ✅ | Reviews tab with reviewer name, star rating, comment |
| 4 | Wishlist toggle + share + compare | ✅ | Heart icon toggles wishlist, share via native Share API, BarChart3 icon toggles compare list (max 4 products) with haptic feedback |
| 5 | Price history tracking | 🟡 | History tab loads data from `price_history` table and renders as a **list** (store + date + price per row). No chart visualization |
| 6 | Product videos/demos | ❌ | No video player component. Web has `ProductVideoPlayer` with YouTube embeds |
| 7 | AI-powered recommendations | ✅ | "Similar Products" horizontal FlatList on product detail page via `supabase.rpc('get_recommendations', { p_type: 'auto' })`. Falls back to same-category products if RPC fails. Compact cards with image, name, price |

---

## 4. Stores `88%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | Store listing | ✅ | Grid of store cards with logo, name, description, rating — `mobile/app/(stack)/stores/index.tsx` |
| 2 | Store detail | ✅ | Header (logo, name, rating, website link), description, coupons section (expanded CouponBadge cards from API), products list — `mobile/app/(stack)/store/[slug].tsx` |
| 3 | Redirection to store (external link) | ✅ | "Visit Store" links on product detail page and store detail page |
| 4 | Store rating display | 🟡 | Rating stars displayed from DB, but no review submission form (web has a multi-field review form) |

---

## 5. Deals & Coupons `100%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | Daily deals section | ✅ | Full deals tab with 2-column grid, savings badges, pull-to-refresh, expiry tracking — `mobile/app/(tabs)/deals.tsx`. "Coupons" quick link button in header navigates to coupons screen |
| 2 | Coupon browsing page | ✅ | Full coupons screen with search bar, store filter chips, sort toggle (newest/highest discount/expiring soon), pull-to-refresh, loading skeletons, empty state — `mobile/app/(stack)/coupons.tsx`. Fetches from `GET /api/coupons` |
| 3 | Coupon display on products/stores | ✅ | `CouponBadge` component (`mobile/src/components/ui/CouponBadge.tsx`) with compact (inline pill) and expanded (full card) variants. Copy-to-clipboard with haptic feedback, expiry display (expired/urgent/days remaining), discount formatting. Integrated in product detail (compact badges below price), store detail (expanded cards section), and deals page (navigation entry point). Copy tracking via `POST /api/coupons/{id}/copy` |

---

## 6. Wishlist & Personalization `75%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | Wishlist / save products | ✅ | Full CRUD: list view with images, names, prices, delete with confirmation — `mobile/app/(stack)/wishlist.tsx` |
| 2 | Favorites sync (cross-device) | ✅ | Supabase-backed via `user_wishlists` table, syncs on login from any device |
| 3 | Personalized recommendations | ✅ | "Recommended For You" section on home screen for authenticated users via `supabase.rpc('get_recommendations', { p_user_id, p_type: 'auto' })`. Enriched with full product data + prices. Hidden for guests or when no results — `mobile/app/(tabs)/index.tsx` |
| 4 | Saved searches (server-side) | ❌ | Only local recent searches in AsyncStorage. No server-side `saved_searches` table integration (web has this + notifications on new results) |

---

## 7. Cart & Commerce `50%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | Multi-store cart | ✅ | Zustand store with AsyncStorage persistence. Items grouped by store with subtotals — `mobile/src/lib/cart/cart-store.ts` + `mobile/app/(tabs)/cart.tsx` |
| 2 | Quantity management | ✅ | +/- controls, remove item, clear cart with confirmation dialog |
| 3 | Gift option integration | ❌ | No gift wrapping toggle or message. Web has `GiftOption` component with Web Share API |
| 4 | Delivery time/cost display | ❌ | No delivery info shown in cart or product pages. Web shows delivery estimates from `STORE_POLICIES` |

---

## 8. Notifications `100%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | In-app notification list | ✅ | Full screen with filter tabs (All, Unread, Price Drop, Deals, System), mark-as-read (single + all), bilingual content — `mobile/app/(stack)/notifications.tsx`. Presented as `formSheet` |
| 2 | Push notification registration | ✅ | Expo push token registration + storage in `user_preferences`, Android channels (price-alerts, deals, default) — `mobile/src/lib/notifications/push.ts` |
| 3 | Push notification routing | ✅ | Notification tap routes to product/deals/alerts via deep link handler |
| 4 | Price drop / back-in-stock alerts | ✅ | Notification types `price_drop`, `back_in_stock`, `deal`, `system`, `account` all supported with per-type icons |

---

## 9. Price Alerts `100%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | Price alert management | ✅ | Segmented control: Active / Triggered tabs. Cards show current vs. target price. Create from product detail, delete with confirmation — `mobile/app/(stack)/price-alerts.tsx` |
| 2 | Price alert progress indicator | ✅ | Visual progress bar showing reduction percentage toward target |

---

## 10. Comparison `33%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | Comparison table (specs & prices) | ✅ | Zustand store with AsyncStorage persistence (`mobile/src/lib/compare/compare-store.ts`), max 4 products, "Add to Compare" button (BarChart3 icon) on product detail action bar with filled state toggle. Compare screen loads products from store, "Clear All" header, haptic feedback on remove — `mobile/app/(stack)/compare.tsx` |
| 2 | Store policy comparison (warranty, shipping, returns) | ❌ | No store policy display. Web uses `STORE_POLICIES` fallback data |
| 3 | Delivery time comparison | ❌ | No delivery info in comparison view |

---

## 11. Settings & Preferences `64%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | Language selection (AR/EN) | ✅ | Toggle with visual indicators, immediate re-render — `mobile/app/(stack)/settings.tsx` |
| 2 | Theme selection (Light/Dark/System) | ✅ | 3 theme cards, AsyncStorage persistence |
| 3 | Delete account | ✅ | Alert dialog with confirmation. Calls `apiClient.post('/api/auth/delete-account')` with loading state, then `signOut()`. Disabled while deleting with ActivityIndicator |
| 4 | Notification preferences | ✅ | Toggle switches for push, price alerts, deals, stock alerts. Persisted to Supabase `user_preferences.notification_preferences` JSONB column with 500ms debounced save. AsyncStorage fallback key `tawveeri_notification_prefs` for offline resilience |
| 5 | Account actions (sign out, change password) | 🟡 | Sign out works. Change password redirects to forgot-password flow (no inline password change like web) |
| 6 | Privacy settings | ❌ | No privacy toggles. Web has 2 privacy toggles (data sharing, activity tracking) |
| 7 | Data export | ❌ | No export option. Web has data export in profile page |

---

## 12. Localization & Accessibility `92%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | Multi-language (AR/EN) | ✅ | 20 translation namespaces shared with web (including `coupons`), bundled as static `require()` imports — `mobile/src/lib/i18n/provider.tsx` |
| 2 | RTL support | ✅ | JS-based via `useRTL()` hook (native I18nManager disabled). Row flip, text alignment, icon swap all handled — `mobile/src/lib/rtl/useRTL.ts` |
| 3 | Currency (SAR) | ✅ | `<Price>` component with SAR symbol in `mobile/src/components/ui/Price.tsx` |
| 4 | Hijri/Gregorian dates | ✅ | `formatDate()` with `ar-SA-u-ca-islamic-umalqura` producing dual display "٢ شعبان ١٤٤٧ هـ (Feb 25, 2026)" — `mobile/src/lib/formatting.ts` |
| 5 | Eastern Arabic numerals | ✅ | `formatNumber()` via `Intl.NumberFormat('ar-SA')`. Prices kept in Western numerals per Saudi e-commerce convention |
| 6 | Accessibility (WCAG) | 🟡 | Basic — no explicit `accessibilityLabel` props, no `accessibilityRole` on interactive elements, no skip navigation. Touch targets follow Apple HIG minimum (`MIN_TOUCH_TARGET = 44`) |

---

## 13. Platform & Infrastructure `67%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | iOS support | ✅ | Native build with Xcode, New Architecture enabled — `app.json` |
| 2 | Android support | ✅ | Native build with Gradle, adaptive icon configured — `app.json` |
| 3 | Deep linking | ✅ | Custom scheme `tawveeri://` + universal links for `tawveeri.com`. Cold + warm start handling — `mobile/src/lib/linking/use-deep-links.ts` |
| 4 | Offline support | 🟡 | Cart persists via AsyncStorage, compare list persists via AsyncStorage, notification prefs cached in AsyncStorage, but no offline data caching for products/searches. No network connectivity detection |
| 5 | Performance optimization | 🟡 | No `FlashList` (uses `FlatList`), no image caching strategy, no lazy loading of off-screen content |
| 6 | App Store readiness (EAS) | ❌ | No `eas.json` file. EAS Project ID empty in `app.json`. No CI/CD build pipeline. App icon and splash present but no store screenshots/metadata |

---

## 14. Legal & Compliance `100%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | Privacy Policy link | ✅ | Opens `https://tawveeri.com/privacy` via `Linking.openURL()` — `settings.tsx` |
| 2 | Terms of Service link | ✅ | Opens `https://tawveeri.com/terms` via `Linking.openURL()` — `settings.tsx` |
| 3 | Legal compliance (Saudi data privacy) | ✅ | Same Supabase backend as web with RLS policies. Auth tokens in iOS Keychain / Android Keystore via `expo-secure-store` |

---

## Remaining Work (Priority Order)

| # | Gap | Impact | Effort | Notes |
|---|-----|:------:|:------:|-------|
| 1 | **Price history chart** | Medium | Medium | Currently renders as a flat list. Need a native chart library (e.g., `victory-native` or `react-native-svg` + custom) for visual trend line |
| 2 | **Delivery time/cost display** | Medium | Low | Show delivery estimates from `STORE_POLICIES` or `product_stores.delivery_time_days` on product detail, cart, and comparison |
| 3 | **Store policy comparison** | Medium | Low | Add warranty, shipping, returns info to comparison view from `STORE_POLICIES` |
| 4 | **Gift option** | Low | Low | Add gift wrapping toggle + message field to cart. Port web's `GiftOption` component logic |
| 5 | **Product videos** | Low | Medium | Need video player component (e.g., `expo-av`). Web uses YouTube embed + direct files |
| 6 | **Store review submission** | Low | Medium | Rating display exists, but no submission form. Need multi-field review form for `store_reviews` table |
| 7 | **Privacy settings** | Low | Low | Add 2 privacy toggles (data sharing, activity tracking) to settings, persist to `user_preferences` |
| 8 | **Data export** | Low | Low | Add export button in profile/settings. Call existing web API or generate client-side |
| 9 | **Saved searches (server-side)** | Low | Medium | Integrate with `saved_searches` table. Currently only local AsyncStorage recent searches |
| 10 | **Search autocomplete from DB** | Low | Medium | Replace hardcoded popular searches with API-driven suggestions from products table |
| 11 | **Voice search / Barcode scanner** | Low | High | Requires `expo-speech` or native speech recognition + `expo-camera` with barcode detection |
| 12 | **EAS build configuration** | Low | Low | Create `eas.json`, set EAS project ID, configure build profiles (dev, preview, production) |
| 13 | **Accessibility labels** | Low | Medium | Add `accessibilityLabel`, `accessibilityRole`, `accessibilityHint` to all interactive elements |

---

## Recent Changes (2026-02-26)

Features implemented in the latest development cycle, moving overall completion from 69% to 80%:

1. **Search filters** — Full FilterSheet bottom modal with brand chips, dynamic per-category spec filters (RAM, storage, screen size, resolution, panel type), price range inputs, discount % presets, condition checkboxes, deals-only and free-delivery toggles. Client-side filtering using `CATEGORY_SPEC_FILTERS` and `extractSpecsFromTitle()` ported from web.
2. **Coupon system** — Complete: `CouponBadge` component (compact + expanded variants), coupons browsing screen with search/sort/store filters, integration in product detail, store detail, and deals page. Copy-to-clipboard with haptic feedback, expiry display, discount formatting. Added `coupons` i18n namespace.
3. **Compare screen fix** — Zustand store with AsyncStorage persistence (`compare-store.ts`), "Add to Compare" BarChart3 button on product detail, working compare screen with clear all, max 4 products.
4. **AI recommendations** — "Similar Products" on product detail + "Recommended For You" on home screen via `supabase.rpc('get_recommendations')` with fallback chain.
5. **Notification preference persistence** — Toggles now persist to Supabase `user_preferences.notification_preferences` JSONB with 500ms debounced save and AsyncStorage offline fallback.
6. **Delete account API** — Now calls `POST /api/auth/delete-account` with loading state before signing out.
7. **Store logos in search** — Bundled store logo PNGs (`assets/logos/`) with mapping constant. Search cards show circular logo + store name + multi-store count badge.
8. **All 5 stores in search** — Added missing `almanea` store to mobile search scraping (was only 4 stores).

---

## Visual Summary

```
Mobile App — PDR Feature Coverage
Overall: ████████████████░░░░░ 80%

  1.  Auth & Access     ██████████████████████ 100%  (6/6)
  2.  Search & Filter   █████████████████░░░░  83%  (7.5/9)
  3.  Product Exp.      ████████████████░░░░░  79%  (5.5/7)
  4.  Stores            ██████████████████░░░  88%  (3.5/4)
  5.  Deals & Coupons   ██████████████████████ 100%  (3/3)
  6.  Wishlist & Pers.  ███████████████░░░░░░  75%  (3/4)
  7.  Cart & Commerce   ██████████░░░░░░░░░░░  50%  (2/4)
  8.  Notifications     ██████████████████████ 100%  (4/4)
  9.  Price Alerts      ██████████████████████ 100%  (2/2)
  10. Comparison        ███████░░░░░░░░░░░░░░  33%  (1/3)
  11. Settings & Prefs  █████████████░░░░░░░░  64%  (4.5/7)
  12. Localization      ████████████████████░░  92%  (5.5/6)
  13. Platform & Infra  ██████████████░░░░░░░  67%  (4/6)
  14. Legal & Compl.    ██████████████████████ 100%  (3/3)
```

---

## Key Remaining Gaps (for developers)

1. **Price history chart** — Renders as list, not chart (needs native chart library)
2. **Delivery info** — No delivery time/cost display in product detail, cart, or comparison
3. **Store policies in comparison** — No warranty/shipping/returns info
4. **App Store readiness** — No EAS config, no store metadata
5. **Search autocomplete** — Hardcoded popular searches, no DB-driven suggestions
6. **Accessibility** — Missing `accessibilityLabel`/`accessibilityRole` on interactive elements

---

*Legend: ✅ = Implemented | 🟡 = Partial | ❌ = Not Implemented*
