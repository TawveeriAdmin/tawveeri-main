# Tawveeri Mobile App — PDR Status Report

**Report Date:** 2026-02-25
**Branch:** `mobile-app`
**Compared Against:** 10-Week Implementation Plan (PDR.pdf)
**Platform:** Expo SDK 54+ (React Native 0.81, New Architecture enabled)

---

## Overview

The mobile app (`mobile/`) is a customer-facing Expo React Native application covering the core price comparison experience: search, product detail, deals, wishlist, cart, notifications, and price alerts. It does **not** include admin dashboard or store owner portal — those remain web-only.

| Category | Implemented | Partial | Not Done | Completion |
|----------|:-----------:|:-------:|:--------:|:----------:|
| Authentication & Access | 6 | 0 | 0 | **100%** |
| Search & Filtering | 4 | 1 | 4 | **50%** |
| Product Experience | 4 | 1 | 2 | **64%** |
| Stores | 3 | 1 | 0 | **88%** |
| Deals & Coupons | 1 | 0 | 2 | **33%** |
| Wishlist & Personalization | 2 | 0 | 2 | **50%** |
| Cart & Commerce | 2 | 0 | 2 | **50%** |
| Notifications | 4 | 0 | 0 | **100%** |
| Price Alerts | 2 | 0 | 0 | **100%** |
| Comparison | 0 | 1 | 2 | **17%** |
| Settings & Preferences | 3 | 2 | 2 | **57%** |
| Localization & Accessibility | 5 | 1 | 0 | **92%** |
| Platform & Infrastructure | 3 | 2 | 1 | **67%** |
| Legal & Compliance | 3 | 0 | 0 | **100%** |
| **Totals** | **42** | **9** | **17** | **69%** |

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

## 2. Search & Filtering `50%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | Product search by category | ✅ | 7 category chips (All, Phones, Laptops, Audio, TVs, Gaming, Tablets) in `mobile/app/(tabs)/search.tsx` lines 58–66. Category passed to `POST /api/search/scrape` |
| 2 | Sort results (relevance, price) | ✅ | 3 sort options: relevance, price asc, price desc with haptic cycling — `search.tsx` lines 79, 602–607 |
| 3 | Search history | ✅ | Recent searches stored in AsyncStorage (max 8), displayed in idle state — `search.tsx` lines 115–143 |
| 4 | Product grouping (multi-store) | ✅ | Same product from different stores grouped into one card showing "from X SAR across N stores" — `search.tsx` lines 156–161 |
| 5 | Search suggestions (autocomplete) | 🟡 | Popular searches hardcoded (lines 68–75), no API-driven autocomplete from DB like web's `search-bar.tsx` |
| 6 | Brand & model filtering | ❌ | No brand filter UI. Web has checkbox filters in `filter-sidebar.tsx` |
| 7 | Advanced spec filtering (RAM, storage, size, resolution) | ❌ | No spec filter UI. Web uses `CATEGORY_SPEC_FILTERS` + `extractSpecsFromTitle()` |
| 8 | Dynamic filters by category | ❌ | No `FilterSidebar` equivalent. Web renders different filter sections per category |
| 9 | Search by voice / Barcode scanner | ❌ | No voice input or camera-based scanning |

---

## 3. Product Experience `64%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | Product detail page (images, specs, prices) | ✅ | Full detail with image gallery + pagination dots, 3 tabs (Specs, Reviews, History) — `mobile/app/(stack)/product/[slug].tsx` (656 lines) |
| 2 | Price comparison (multi-store) | ✅ | Store list sorted by price with best-price highlight (green badge) — `product/[slug].tsx` lines 331–437 |
| 3 | User reviews & ratings | ✅ | Reviews tab with reviewer name, star rating, comment — `product/[slug].tsx` lines 471–513 |
| 4 | Wishlist toggle + share | ✅ | Heart icon toggles wishlist, share via native Share API — lines 118–151 |
| 5 | Price history tracking | 🟡 | History tab loads data from `price_history` table and renders as a **list** (store + date + price per row). No chart visualization — `product/[slug].tsx` lines 515–566 |
| 6 | Product videos/demos | ❌ | No video player component. Web has `ProductVideoPlayer` with YouTube embeds |
| 7 | AI-powered recommendations | ❌ | No `get_recommendations` RPC integration. No "Similar Products" or "Recommended For You" sections |

---

## 4. Stores `88%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | Store listing | ✅ | Grid of store cards with logo, name, description, rating — `mobile/app/(stack)/stores/index.tsx` (101 lines) |
| 2 | Store detail | ✅ | Header (logo, name, rating, website link), description, 20 most recent products — `mobile/app/(stack)/store/[slug].tsx` (182 lines) |
| 3 | Redirection to store (external link) | ✅ | "Visit Store" links on product detail page and store detail page |
| 4 | Store rating display | 🟡 | Rating stars displayed from DB, but no review submission form (web has a multi-field review form) |

---

## 5. Deals & Coupons `33%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | Daily deals section | ✅ | Full deals tab with 2-column grid, savings badges, pull-to-refresh, expiry tracking — `mobile/app/(tabs)/deals.tsx` (130 lines) |
| 2 | Coupon browsing page | ❌ | No equivalent of web's `/(public)/coupons/` page. Zero coupon-related code in mobile (`grep` returns no matches) |
| 3 | Coupon display on products/stores | ❌ | No `CouponBadge` component, no coupon copy functionality, no coupon integration in product detail or store detail |

---

## 6. Wishlist & Personalization `50%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | Wishlist / save products | ✅ | Full CRUD: list view with images, names, prices, delete with confirmation — `mobile/app/(stack)/wishlist.tsx` (162 lines) |
| 2 | Favorites sync (cross-device) | ✅ | Supabase-backed via `user_wishlists` table, syncs on login from any device |
| 3 | Personalized recommendations | ❌ | No `useRecommendations` hook, no `get_recommendations` RPC call, no "For You" section on home screen |
| 4 | Saved searches (server-side) | ❌ | Only local recent searches in AsyncStorage. No server-side `saved_searches` table integration (web has this + notifications on new results) |

---

## 7. Cart & Commerce `50%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | Multi-store cart | ✅ | Zustand store with AsyncStorage persistence. Items grouped by store with subtotals — `mobile/src/lib/cart/cart-store.ts` + `mobile/app/(tabs)/cart.tsx` (234 lines) |
| 2 | Quantity management | ✅ | +/- controls, remove item, clear cart with confirmation dialog — `cart.tsx` lines 32–41, 159–182 |
| 3 | Gift option integration | ❌ | No gift wrapping toggle or message. Web has `GiftOption` component with Web Share API |
| 4 | Delivery time/cost display | ❌ | No delivery info shown in cart or product pages. Web shows delivery estimates from `STORE_POLICIES` |

---

## 8. Notifications `100%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | In-app notification list | ✅ | Full screen with filter tabs (All, Unread, Price Drop, Deals, System), mark-as-read (single + all), bilingual content — `mobile/app/(stack)/notifications.tsx` (206 lines). Presented as `formSheet` |
| 2 | Push notification registration | ✅ | Expo push token registration + storage in `user_preferences`, Android channels (price-alerts, deals, default) — `mobile/src/lib/notifications/push.ts` (196 lines) |
| 3 | Push notification routing | ✅ | Notification tap routes to product/deals/alerts via deep link handler — `push.ts` lines 150–168 |
| 4 | Price drop / back-in-stock alerts | ✅ | Notification types `price_drop`, `back_in_stock`, `deal`, `system`, `account` all supported with per-type icons |

---

## 9. Price Alerts `100%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | Price alert management | ✅ | Segmented control: Active / Triggered tabs. Cards show current vs. target price. Create from product detail, delete with confirmation — `mobile/app/(stack)/price-alerts.tsx` (218 lines) |
| 2 | Price alert progress indicator | ✅ | Visual progress bar showing reduction percentage toward target — `price-alerts.tsx` lines 162–165 |

---

## 10. Comparison `17%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | Comparison table (specs & prices) | 🟡 | UI structure exists (horizontal scroll, up to 4 columns, spec rows, best-price highlight) but **products array starts empty with no loading mechanism** — `useState<any[]>([])` at line 28 with no `useEffect` to load from storage or params. Screen is effectively non-functional — `mobile/app/(stack)/compare.tsx` (180 lines) |
| 2 | Store policy comparison (warranty, shipping, returns) | ❌ | No store policy display. Web uses `STORE_POLICIES` fallback data |
| 3 | Delivery time comparison | ❌ | No delivery info in comparison view |

---

## 11. Settings & Preferences `57%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | Language selection (AR/EN) | ✅ | Toggle with visual indicators, immediate re-render — `mobile/app/(stack)/settings.tsx` lines 141–154 |
| 2 | Theme selection (Light/Dark/System) | ✅ | 3 theme cards, AsyncStorage persistence — `settings.tsx` lines 169–211 |
| 3 | Delete account | ✅ | Alert dialog with confirmation — `settings.tsx` lines 367–401. Note: currently calls `signOut()` only, does not call `/api/auth/delete-account` endpoint |
| 4 | Notification preferences | 🟡 | Toggle switches for push, price alerts, deals, stock alerts — `settings.tsx` lines 219–281. **UI-only** — toggles are not persisted to AsyncStorage or backend `user_preferences` table |
| 5 | Account actions (sign out, change password) | 🟡 | Sign out works. Change password redirects to forgot-password flow (no inline password change like web) |
| 6 | Privacy settings | ❌ | No privacy toggles. Web has 2 privacy toggles (data sharing, activity tracking) |
| 7 | Data export | ❌ | No export option. Web has data export in profile page |

---

## 12. Localization & Accessibility `92%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | Multi-language (AR/EN) | ✅ | 19 translation namespaces shared with web, bundled as static `require()` imports — `mobile/src/lib/i18n/provider.tsx` |
| 2 | RTL support | ✅ | JS-based via `useRTL()` hook (native I18nManager disabled). Row flip, text alignment, icon swap all handled — `mobile/src/lib/rtl/useRTL.ts` |
| 3 | Currency (SAR) | ✅ | `<Price>` component with SAR symbol in `mobile/src/components/ui/Price.tsx` |
| 4 | Hijri/Gregorian dates | ✅ | `formatDate()` with `ar-SA-u-ca-islamic-umalqura` producing dual display "٢ شعبان ١٤٤٧ هـ (Feb 25, 2026)" — `mobile/src/lib/formatting.ts` lines 40–68 |
| 5 | Eastern Arabic numerals | ✅ | `formatNumber()` via `Intl.NumberFormat('ar-SA')`. Prices kept in Western numerals per Saudi e-commerce convention — `formatting.ts` lines 75–78 |
| 6 | Accessibility (WCAG) | 🟡 | Basic — no explicit `accessibilityLabel` props, no `accessibilityRole` on interactive elements, no skip navigation. Touch targets follow Apple HIG minimum (`MIN_TOUCH_TARGET = 44`) |

---

## 13. Platform & Infrastructure `67%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | iOS support | ✅ | Native build with Xcode, New Architecture enabled — `app.json` line 10 |
| 2 | Android support | ✅ | Native build with Gradle, adaptive icon configured — `app.json` lines 29–31 |
| 3 | Deep linking | ✅ | Custom scheme `tawveeri://` + universal links for `tawveeri.com`. Cold + warm start handling — `mobile/src/lib/linking/use-deep-links.ts` (99 lines) |
| 4 | Offline support | 🟡 | Cart persists via AsyncStorage, but no offline data caching for products/searches. No network connectivity detection |
| 5 | Performance optimization | 🟡 | No `FlashList` (uses `FlatList`), no image caching strategy, no lazy loading of off-screen content |
| 6 | App Store readiness (EAS) | ❌ | No `eas.json` file. EAS Project ID empty in `app.json` line 84. No CI/CD build pipeline. App icon and splash present but no store screenshots/metadata |

---

## 14. Legal & Compliance `100%`

| # | Feature | Status | Evidence |
|---|---------|:------:|----------|
| 1 | Privacy Policy link | ✅ | Opens `https://tawveeri.com/privacy` via `Linking.openURL()` — `settings.tsx` line 351 |
| 2 | Terms of Service link | ✅ | Opens `https://tawveeri.com/terms` via `Linking.openURL()` — `settings.tsx` line 362 |
| 3 | Legal compliance (Saudi data privacy) | ✅ | Same Supabase backend as web with RLS policies. Auth tokens in iOS Keychain / Android Keystore via `expo-secure-store` |

---

## Remaining Work (Priority Order)

| # | Gap | Impact | Effort | Notes |
|---|-----|:------:|:------:|-------|
| 1 | **Search filters** (brand, specs, dynamic per-category) | High | Medium | Biggest UX gap vs web. Need `FilterSidebar` equivalent with `CATEGORY_SPEC_FILTERS` + `extractSpecsFromTitle()`. Consider bottom sheet UI pattern |
| 2 | **Coupon system** (browsing + display + copy) | High | Medium | Entire coupon feature missing. Need: coupons list screen, `CouponBadge` component, copy-to-clipboard, integration on product/store detail pages. API routes exist (`/api/coupons`) |
| 3 | **Compare screen fix** (product loading) | High | Low | Screen renders but `products` array starts empty with no loading mechanism. Need: shared compare state (Zustand/AsyncStorage like cart), "Add to Compare" button on product cards, load products on screen mount |
| 4 | **AI recommendations** | Medium | Medium | Need `useRecommendations` hook calling `supabase.rpc('get_recommendations')`. Add "Similar Products" to product detail, "Recommended For You" to home screen. Types exist in `src/lib/recommendations/types.ts` |
| 5 | **Notification preference persistence** | Medium | Low | Toggles in settings are UI-only. Need to read/write `user_preferences.notification_preferences` JSONB on toggle change |
| 6 | **Delete account API call** | Medium | Low | Currently just signs out. Need to call `POST /api/auth/delete-account` endpoint with Bearer token auth |
| 7 | **Price history chart** | Low | Medium | Currently renders as a flat list. Need a native chart library (e.g., `victory-native` or `react-native-svg` + custom) for visual trend line |
| 8 | **Delivery time/cost display** | Low | Low | Show delivery estimates from `STORE_POLICIES` or `product_stores.delivery_time_days` on product detail and cart |
| 9 | **Gift option** | Low | Low | Add gift wrapping toggle + message field to cart. Port web's `GiftOption` component logic |
| 10 | **Product videos** | Low | Medium | Need video player component (e.g., `expo-av`). Web uses YouTube embed + direct files |
| 11 | **Store review submission** | Low | Medium | Rating display exists, but no submission form. Need multi-field review form for `store_reviews` table |
| 12 | **Privacy settings** | Low | Low | Add 2 privacy toggles (data sharing, activity tracking) to settings, persist to `user_preferences` |
| 13 | **Data export** | Low | Low | Add export button in profile/settings. Call existing web API or generate client-side |
| 14 | **Saved searches (server-side)** | Low | Medium | Integrate with `saved_searches` table. Currently only local AsyncStorage recent searches |
| 15 | **Search autocomplete from DB** | Low | Medium | Replace hardcoded popular searches with API-driven suggestions from products table |
| 16 | **Voice search / Barcode scanner** | Low | High | Requires `expo-speech` or native speech recognition + `expo-camera` with barcode detection |
| 17 | **EAS build configuration** | Low | Low | Create `eas.json`, set EAS project ID, configure build profiles (dev, preview, production) |
| 18 | **Accessibility labels** | Low | Medium | Add `accessibilityLabel`, `accessibilityRole`, `accessibilityHint` to all interactive elements |

---

## Visual Summary

```
Mobile App — PDR Feature Coverage
Overall: ██████████████░░░░░░░ 69%

  1.  Auth & Access     ██████████████████████ 100%  (6/6)
  2.  Search & Filter   ██████████░░░░░░░░░░░  50%  (4.5/9)
  3.  Product Exp.      █████████████░░░░░░░░  64%  (4.5/7)
  4.  Stores            ██████████████████░░░  88%  (3.5/4)
  5.  Deals & Coupons   ███████░░░░░░░░░░░░░░  33%  (1/3)
  6.  Wishlist & Pers.  ██████████░░░░░░░░░░░  50%  (2/4)
  7.  Cart & Commerce   ██████████░░░░░░░░░░░  50%  (2/4)
  8.  Notifications     ██████████████████████ 100%  (4/4)
  9.  Price Alerts      ██████████████████████ 100%  (2/2)
  10. Comparison        ████░░░░░░░░░░░░░░░░░  17%  (0.5/3)
  11. Settings & Prefs  ████████████░░░░░░░░░  57%  (4/7)
  12. Localization      ████████████████████░░  92%  (5.5/6)
  13. Platform & Infra  ██████████████░░░░░░░  67%  (4/6)
  14. Legal & Compl.    ██████████████████████ 100%  (3/3)
```

---

## Key Gaps Summary (for developers)

1. **Search filters** — No brand/spec/advanced filters (biggest UX gap vs web)
2. **Coupons** — Entire coupon system missing from mobile (0 code)
3. **Compare screen** — UI exists but products never load (broken state management)
4. **AI Recommendations** — No recommendation UI or RPC integration
5. **Notification prefs** — Toggles are cosmetic, not persisted
6. **Delete account** — Signs out instead of calling delete API
7. **Price history** — Renders as list, not chart
8. **App Store readiness** — No EAS config, no store metadata

---

*Legend: ✅ = Implemented | 🟡 = Partial | ❌ = Not Implemented*
