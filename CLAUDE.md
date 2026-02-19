# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Tawveeri** (توفيري) is a bilingual (Arabic/English) price comparison platform for electronics in Saudi Arabia. Users compare prices across stores (Amazon SA, Noon, Jarir, Extra, Almanea), set price alerts, and track deals. Includes admin dashboard, store owner portal, and affiliate transaction tracking.

**Note:** The root `README.md` is outdated and describes a legacy Flask/Python architecture. This CLAUDE.md is the authoritative reference.

## Tech Stack

### Web
- **Framework**: Next.js 15 (App Router) with TypeScript
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Styling**: Tailwind CSS v4 with custom design tokens
- **UI**: Radix UI primitives + shadcn/ui patterns, Lucide React icons
- **i18n**: Custom `SimpleIntlProvider` (replaced next-intl for reliability)
- **Scraping**: TypeScript scrapers (`src/lib/scraping/`) — legacy Python/Flask in `scripts/scraping/` is unused
- **Testing**: Jest + React Testing Library
- **Charts**: ECharts (`echarts-for-react`) for admin dashboard, Recharts for other analytics

### Mobile (`mobile/`)
- **Framework**: Expo SDK 52+ with Expo Router (file-based routing), TypeScript
- **New Architecture**: Enabled (`newArchEnabled: true` in app.json) — required by `react-native-reanimated` v4
- **Styling**: StyleSheet + Apple HIG typography scale (no NativeWind)
- **UI**: Lucide React Native icons, `expo-blur`, `expo-haptics`, `expo-image`
- **State**: Zustand + AsyncStorage for cart, React Context for auth/theme/i18n
- **Auth tokens**: `expo-secure-store` adapter for Supabase session persistence
- **Fonts**: Inter (English) + IBM Plex Sans Arabic — same as web, loaded via `expo-font`
- **Notifications**: `expo-notifications` with push token registration

## Commands

```bash
npm run dev              # Dev server (localhost:3000, Turbopack)
npm run build            # Production build (TS/ESLint errors ignored in config)
npm run lint             # ESLint
npm test                 # Run all tests
npm test -- path/to/file # Run a single test file
npm run test:watch       # Tests in watch mode
npm run test:coverage    # Tests with coverage report (70% threshold)
npm run test:db          # Database tests only (tests/database/)
npm run db:setup         # Full database setup (schema + policies + seed)
npm run db:schema        # Apply schema SQL
npm run db:policies      # Apply RLS policies
npm run db:seed          # Seed data
npm run db:create-admin  # Create admin user
```

Development requires only **one terminal**: `npm run dev` on port 3000. All scraping runs as TypeScript inside Next.js.

### Mobile Commands

```bash
cd mobile
npx expo run:ios              # Build and run iOS dev build (requires Xcode)
npx expo run:android          # Build and run Android dev build
npx expo prebuild --clean     # Regenerate native projects after changing app.json or native deps
npx expo start --port 8085    # Start Metro bundler on custom port (default 8081 often conflicts)
```

**Important**: The mobile app requires a native development build (`expo run:ios`), NOT Expo Go. New Architecture TurboModules (required by reanimated v4) are incompatible with Expo Go. After adding any native module (expo-blur, expo-haptics, etc.), run `npx expo prebuild --clean` then `npx expo run:ios`.

## Architecture

### Routing & i18n

All pages live under `src/app/[locale]/` — the `[locale]` segment is `ar` or `en`. Locale config is in `src/i18n.ts`. The middleware (`src/middleware.ts`) combines next-intl routing with Supabase auth checks (session validation, role-based access).

**Root layout** (`src/app/layout.tsx`) is a passthrough — the real layout is `src/app/[locale]/layout.tsx`.

**Route groups** under `src/app/[locale]/`:
- `(public)/` — Public pages (stores, deals, products) wrapped with `PublicPageShell` layout
- `(dashboard)/` — Protected user pages with `DashboardHeader`, calls `requireAuth()` server-side, redirects admins to `/admin/dashboard`
- `/admin/` — Admin routes (not grouped, protected by middleware)
- `/store/` — Store owner routes (not grouped, protected by middleware)
- `/auth/` — Login/signup (redirects away if already authenticated)

### Provider Hierarchy

`src/app/[locale]/layout.tsx` nests providers in this order — **do not reorder**:

```
<div lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
  <SimpleIntlProvider>    ← translations from messages/{locale}/*.json
    <ThemeProvider>        ← next-themes, class strategy, storageKey="tawveeri-theme"
      <MultiStoreCartProvider>
        <AuthProvider>    ← Supabase auth state, role fetching
          {children}
          <Toaster />
        </AuthProvider>
      </MultiStoreCartProvider>
    </ThemeProvider>
  </SimpleIntlProvider>
</div>
```

Note: The root `<html>` tag is in `src/app/layout.tsx` (passthrough). The locale layout uses a `<div>` wrapper with lang/dir attributes.

Default: Arabic (RTL), light theme, system detection disabled.

### Translation System

Translations are JSON files in `messages/{ar,en}/` organized by feature. Loaded via `Promise.allSettled` dynamic imports in `src/app/[locale]/layout.tsx` and provided through `SimpleIntlProvider` (`src/lib/simple-intl-provider.tsx`).

**Namespaces loaded** (19 files): common, landing, auth, products, dashboard, profile, stores, deals, product, store, search, wishlist, compare, settings, notifications, admin, checkout, priceAlerts, cart. If adding a new namespace file, add its dynamic import in the locale layout and spread it into the `messages` object.

**Usage in components:**
```tsx
import { useTranslations } from '@/lib/simple-intl-provider';
const t = useTranslations();
t('products.title')              // dot-notation key lookup
t('greeting', { name: 'Ali' })   // {{name}} placeholder replacement
```

**Special cases for message spreading**:
- `common.json` — top-level keys (`app`, `nav`, `button`, etc.) are spread directly into messages; its nested `common` key becomes the `common` namespace
- `landing.json` — also spread directly (not namespaced), so its keys are top-level
- `admin.json` — uses `extractNamespace()` to handle nested `admin` key structure
- All other files are namespaced by filename (e.g., `auth.json` → `auth.*`)

### Authentication & Authorization

- **Client**: `useAuth()` hook from `src/lib/auth/auth-context.tsx` — provides signUp, signIn (email/phone/OAuth), signOut, user with role
  - Email: `signInWithEmail(email, password)`
  - Phone OTP: `sendPhoneOtp(phone)` then `signInWithPhone(phone, token)`
  - OAuth: `signInWithOAuth('google' | 'facebook' | 'apple')`
- **Server**: `src/lib/auth/server.ts` — `getSession()`, `getUser()`, `getUserProfile()`, `requireAuth()`, `requireAdmin()`, `requireStore()`, `isAdmin()`, `isStore()`. Uses React `cache()` for request deduplication.
- **Middleware**: `src/middleware.ts` handles route protection:
  - Protected routes: `/dashboard`, `/profile`, `/wishlist`, `/notifications`, `/price-alerts`, `/settings`
  - Admin routes: `/admin/*` (requires `admin` role)
  - Store routes: `/store/dashboard`, `/store/products`, `/store/analytics` (requires `store` or `admin` role)
- **Roles**: `admin`, `customer`, `store`, `guest` (defined in `src/lib/database/types.ts`)
- **Bootstrap admin**: Env vars `ADMIN_EMAILS` / `ADMIN_EMAIL` / `NEXT_PUBLIC_ADMIN_EMAILS` auto-promote matching emails to admin role (fallback: jfr3sam@gmail.com). Applied in middleware and `getUserProfile()`.
- **Phone password reset**: 3-step flow in `forgot-password/page.tsx` (phone → OTP → new password). OTP verified server-side only at final step via `POST /api/auth/reset-password-phone`, which uses `supabase.auth.admin.updateUserById()`.

### Database

Supabase with typed client. Types in `src/lib/database/types.ts`. Two client patterns:
- **Browser**: `getSupabaseBrowserClient()` from `src/lib/database/` (singleton, uses anon key)
- **Server**: `createServerClient()` from `src/lib/database/` (uses service role key, no session persistence)

Key tables: `users`, `products`, `stores`, `product_stores` (price per store), `price_history`, `notifications`, `admin_logs`, `transactions`, `user_wishlists`, `price_alerts`, `product_reviews`, `phone_otps`, `saved_searches`, `user_preferences`.

Schema migrations are numbered SQL files in `scripts/database/` (01 through 10). Note: some prefixes are duplicated (e.g., two `04-*`, two `05-*`, two `06-*` files). When adding new migrations, use the next available number after 10.

### Required Action Pattern

Every user-facing action must include:
1. **In-App Notification** — insert into `notifications` table with bilingual `title_ar`/`title_en` and `message_ar`/`message_en`
2. **Audit Log** — insert into `admin_logs` via `createAuditLog()` from `src/lib/auth/audit.ts`

Use `createNotification()` from `src/lib/auth/notifications.ts` (types: `price_drop`, `back_in_stock`, `deal`, `system`, `account`) and `createAuditLog()` with standard actions from `AUDIT_ACTIONS` constant. Audit logging fails silently to avoid blocking user actions.

**Gotcha**: `createNotification()` accepts a `link` param in its interface but does **not** insert it — the `notifications` table has no `link` column. Do not add `link` to the insert object.

### Scraping Architecture

Two scraping subsystems, both TypeScript:

1. **Search scrapers** (`src/lib/scraping/search/`) — lightweight fetch+cheerio scrapers for Amazon SA, Noon, Jarir, Extra. Run in-process via `searchAllStores()` orchestrator. Called from `POST /api/search/scrape`. Accepts optional `category` param to filter results via `matchesCategory()`.

2. **Cron scrapers** (`src/lib/scraping/stores/`) — all 5 stores implemented, each extending `BaseScraper`:
   - `JarirScraper` — HTML scraping with cheerio
   - `NoonScraper` — Noon's internal JSON API (`/_svc/catalog/api/v3/`), falls back to HTML. Uses `fetchJson<T>()` from BaseScraper.
   - `AmazonScraper` — cheerio for search pages, Puppeteer for product pages. ASIN-based SKU.
   - `ExtraScraper` — 3-strategy parser: `__NEXT_DATA__` JSON → inline script JSON → HTML selectors (Extra is Next.js-based).
   - `AlmaneaScraper` — HTML selectors + JSON-LD (`application/ld+json`) structured data fallback.

**BaseScraper** (`src/lib/scraping/base/base-scraper.ts`) provides: `fetchPage()` (plain fetch), `fetchPageWithJS()` (Puppeteer), `fetchJson<T>()` (API calls), cheerio helpers, `validateScrapedProduct()`, rate limiting via `delay()`. Subclasses implement abstract `discoverProducts(category, maxPages?)` and `updateProductPrice(productUrl)`.

**Shared utilities**:
- `src/lib/scraping/utils/category-utils.ts` — `determineCategory(title)` (keyword-based product categorization) and `matchesCategory(product, category)` (filtering). Used by both search and cron scrapers.
- `src/lib/scraping/config/spec-configs.ts` — `CATEGORY_SPEC_FILTERS` (filter UI definitions for 6 categories) and `extractSpecsFromTitle(title)` (regex-based spec extraction from product names for RAM, storage, screen size, resolution, panel type, etc.).

Store configs are JSON in `src/lib/scraping/config/store-configs/`. The orchestrator (`src/lib/scraping/services/scraping-orchestrator.ts`) routes stores to their scraper in `getScraperForStore()`.

Legacy Python/Flask scrapers (`scripts/scraping/`) still exist but are no longer used by the app.

API routes: `src/app/api/search/scrape/route.ts`, `src/app/api/cron/update-prices/route.ts`, `src/app/api/cron/discover-products/route.ts`, `src/app/api/cron/check-price-alerts/route.ts`.

### Search & Filtering

The search pipeline flows: `SearchBar` → `search/page.tsx` → `POST /api/search/scrape` → `searchAllStores()` → per-store search scrapers → results.

**Category filtering**: Category is passed from the SearchPage through the API to `searchAllStores()`, which filters results using `matchesCategory()` from `category-utils.ts`.

**Spec filtering**: Dynamic per-category. The `FilterSidebar` component reads `CATEGORY_SPEC_FILTERS[category]` to render appropriate filter sections (e.g., smartphone shows RAM/storage, TV shows resolution/panel type). Specs are extracted client-side from product titles via `extractSpecsFromTitle()`. Additional filters: discount %, condition (new/renewed/used), shipping speed.

### Tailwind v4 Color Override System

`src/app/globals.css` uses CSS custom properties for theming with `:root` and `.dark` scopes. Dark mode is class-based: `@custom-variant dark (&:where(.dark, .dark *))`.

**Color tokens** (CSS variables): `--color-primary-*`, `--color-secondary-*`, `--color-tertiary-*` (amber, for deals/featured), `--color-success-*`, `--color-warning-*`, `--color-error-*`. Surface hierarchy: `--color-surface-{lowest,low,high,highest}`. Domain-specific: `--color-deal`, `--color-price-savings`.

Colors are mapped in the `@theme` block. Extensive `!important` overrides exist because Tailwind v4's OKLCH color space produces incorrect colors — when adding new color utility combinations, you may need to add corresponding overrides.

### Component Organization

- `src/components/ui/` — Base UI components (Radix + shadcn/ui). Use `cn()` for class merging.
- `src/components/admin/` — Admin dashboard: sidebar (`admin-sidebar.tsx`), header (`admin-header.tsx`), data tables, ECharts chart cards, stats cards
- `src/components/search/` — Search UI: `search-bar.tsx` (autocomplete), `filter-sidebar.tsx` (dynamic spec/brand/price filters)
- `src/components/layout/` — App shell (header)
- `src/components/comparison/` — Price comparison cards

### Key Utilities (`src/lib/utils.ts`)

- `cn(...classes)` — Tailwind class merging (clsx + tailwind-merge)
- `formatPrice(price)` — Number formatting only (no currency). Use `<Price>` component for display with SAR symbol.
- `formatPriceWithCurrency(price, locale)` — **deprecated**, use `<Price>` component instead
- `formatCompactNumber(num)` — K/M suffixes for large numbers
- `calculateSavings(original, current)` / `calculateSavingsPercentage(original, current)`

### Fonts

Two Google Fonts loaded in the locale layout:
- **Inter** (`--font-inter`) — English text, applied via `font-sans` class
- **IBM Plex Sans Arabic** (`--font-ibm-plex-arabic`) — Arabic text, applied via `font-sans-ar` class

The body class switches based on locale: `font-sans-ar` for Arabic, `font-sans` for English.

### Environment Variables

See `.env.example`. Required:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase client
- `SUPABASE_SERVICE_ROLE_KEY` — Server-side Supabase operations
- `SUPABASE_DB_URL` — Direct PostgreSQL connection for migration scripts
- `NEXT_PUBLIC_APP_URL` — App URL for auth callbacks and emails
- `ADMIN_EMAILS` or `ADMIN_EMAIL` — Bootstrap admin email(s), comma-separated

### Image Domains

`next.config.ts` has `remotePatterns` for store image CDNs: `**.amazon.sa`, `m.media-amazon.com`, `**.noon.com`, `f.nooncdn.com`, `**.jarir.com`, `ak-asset.jarir.com`, `**.extra.com`. Add new patterns here when integrating additional stores.

## Mobile App Architecture (`mobile/`)

Customer-facing screens only — no admin dashboard or store owner portal.

### Navigation (Expo Router)

```
mobile/app/
  _layout.tsx              # Root: providers (Intl > Theme > Auth > Navigation)
  (tabs)/
    _layout.tsx            # Tab navigator with CustomTabBar
    index.tsx              # Home (trending, deals, categories)
    search.tsx             # Search with debounce + category chips
    deals.tsx              # Deals listing
    cart.tsx               # Multi-store cart (Zustand)
    profile.tsx            # Profile/dashboard
  (auth)/
    _layout.tsx            # Modal stack (slide from bottom)
    login.tsx              # Phone OTP + email + OAuth
    signup.tsx             # Name collection for new phone users
    forgot-password.tsx    # 3-step phone reset flow
  (stack)/
    _layout.tsx            # Push stack
    product/[slug].tsx     # Product detail + price history
    store/[slug].tsx       # Store detail
    stores/index.tsx       # Store listing
    compare.tsx            # Product comparison
    wishlist.tsx           # Saved products
    notifications.tsx      # Notification list (formSheet presentation)
    price-alerts.tsx       # Price alert management
    settings.tsx           # Language, theme, account
    edit-profile.tsx       # Profile editing
  auth/callback.tsx        # OAuth deep link handler
```

### Mobile Provider Hierarchy

`mobile/app/_layout.tsx` — **do not reorder**:

```
<GestureHandlerRootView>
  <SafeAreaProvider>
    <IntlProvider>          ← i18n (AsyncStorage-persisted locale, RTL auto-reload)
      <ThemeProvider>       ← light/dark (AsyncStorage, system detection)
        <AuthProvider>      ← Supabase auth (SecureStore tokens)
          <AppContent />    ← push notifications + deep link hooks
          <Toast />
        </AuthProvider>
      </ThemeProvider>
    </IntlProvider>
  </SafeAreaProvider>
</GestureHandlerRootView>
```

### Mobile Supabase Client

`mobile/src/lib/supabase/client.ts` — uses `expo-secure-store` adapter (not SSR cookies). Auth tokens persist in the iOS Keychain / Android Keystore. `detectSessionInUrl: false` since deep links handle auth callbacks separately.

### Mobile API Client

`mobile/src/lib/api/client.ts` — HTTP client for calling the Next.js web app's API routes (`/api/search/scrape`, `/api/auth/*`, etc.). Base URL from `EXPO_PUBLIC_API_BASE_URL`. Automatically attaches Bearer token from auth session via `apiClient.setAccessToken()`.

### Mobile Auth

`mobile/src/lib/auth/auth-context.tsx` — adapted from web:
- Phone OTP: calls `/api/auth/send-phone-otp` and `/api/auth/verify-phone-otp` via apiClient with `platform: 'mobile'`
- OAuth: `expo-web-browser` + deep link redirect (`tawveeri://auth/callback`)
- Email/password: standard `supabase.auth.signInWithPassword()`
- Auto-creates user profile in `users` table on first login

### Mobile Cart (Zustand)

`mobile/src/lib/cart/cart-store.ts` — Zustand store (not React Context like web) with AsyncStorage persistence via `zustand/middleware/persist`. Pure cart functions ported from web's `multi-store-cart.ts`. Multi-store grouping: items organized by store with per-store subtotals.

### Mobile i18n

`mobile/src/lib/i18n/provider.tsx` — ported from web's `SimpleIntlProvider`. Same 19 translation namespaces as web, bundled as static `require()` imports from `messages/{ar,en}/`. Same message-spreading logic (common.json top-level, landing.json top-level, admin.json extracted namespace).

**RTL handling**: Native `I18nManager` is **disabled** (`forceRTL(false)`, `allowRTL(false)` in root `_layout.tsx`). All RTL is handled in JavaScript via the `useRTL()` hook. A one-time auto-reload in `_layout.tsx` handles the transition from old `forceRTL(true)` sessions. Default locale: Arabic.

### Mobile Theme

`mobile/src/lib/theme/` — no NativeWind/Tailwind. Uses:
- `colors.ts` — light/dark color token objects matching web's CSS custom properties (primary #0D47A1 blue, Apple HIG semantic colors like `systemGray`, `systemRed`, `separator`)
- `theme-context.tsx` — ThemeProvider with `useColorScheme()` device detection + AsyncStorage override
- `typography.ts` — Apple HIG type scale (largeTitle through caption2), spacing scale, radii, `MIN_TOUCH_TARGET = 44`

Usage: `const { colors, isDark } = useTheme()` + inline styles, not utility classes.

### Mobile UI Components

`mobile/src/components/ui/` — `Card`, `Price`, `Badge`, `EmptyState`, `Skeleton`, `SkeletonCard`, `BottomSheet`, `StatusBar` — all styled with inline StyleSheet, supporting RTL and dark mode.

`mobile/src/components/navigation/CustomTabBar.tsx` — custom tab bar with `expo-blur` frosted glass, haptic feedback, bounce animation, bilingual labels, cart badge.

### Mobile Environment Variables

```
EXPO_PUBLIC_SUPABASE_URL=<same as web>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<same as web>
EXPO_PUBLIC_API_BASE_URL=https://tawveeri.com   # or http://localhost:3000 for dev
```

### Metro Config (Monorepo)

`mobile/metro.config.js` — watches only `messages/` from the parent directory (for shared translations). Resolves `node_modules` only from `mobile/` to prevent conflicts with the parent Next.js project's dependencies.

### Mobile RTL Rules

Native `I18nManager` is **disabled**. All RTL is handled via `useRTL()` hook (`mobile/src/lib/rtl/useRTL.ts`):

```tsx
const rtl = useRTL();
// rtl.row          → 'row-reverse' for AR, 'row' for EN
// rtl.textAlign    → 'right' for AR, 'left' for EN
// rtl.writingDirection → 'rtl' for AR, 'ltr' for EN
// rtl.isRTL        → boolean
// rtl.alignStart   → 'flex-end' for AR, 'flex-start' for EN
// rtl.flipIcon     → [{ scaleX: -1 }] for AR, [] for EN
// rtl.position(16) → { right: 16 } for AR, { left: 16 } for EN
```

Key rules:
- **Do NOT** use `I18nManager.isRTL` — it's always `false`. Use `rtl.isRTL` from the hook.
- **Do NOT** use `marginStart`/`paddingStart`/`start`/`end` — they won't flip since native RTL is off. Use explicit `marginLeft`/`marginRight` with `rtl.isRTL`.
- Use `flexDirection: rtl.row` for rows that should flip in RTL.
- Add `textAlign: rtl.textAlign, writingDirection: rtl.writingDirection` to all user-facing Text.
- Swap directional icons based on `rtl.isRTL`: `ArrowLeft`↔`ArrowRight`, `ChevronRight`↔`ChevronLeft`.
- For stack headers: use `headerRight` for the back button in RTL, `headerLeft` in LTR (see `(stack)/_layout.tsx`).

### Deep Linking

URL scheme: `tawveeri://` (configured in `app.json` under `scheme`). Associated domains for universal links: `tawveeri.com`, `www.tawveeri.com`. Deep link handler in `mobile/src/lib/linking/use-deep-links.ts`.

## Styling Rules

- Use Tailwind utility classes with design tokens: `text-primary-600`, `bg-success-50`, `border-warning-300`
- Always pair light/dark: `bg-white dark:bg-gray-900`
- Use `tabular-nums` for price/number displays
- Use `cn()` for all conditional classes
- **Never** set `dir` attributes on elements — the locale layout wrapper handles `dir` globally
- **Never** write separate RTL/LTR CSS — flexbox/grid auto-flip in RTL

## Path Aliases

- **Web**: `@/*` maps to `src/*`
- **Mobile**: `@/*` maps to `mobile/` root (so `@/src/lib/...` reaches `mobile/src/lib/...`)

## Bilingual Content Convention

All user-visible text stored in the database uses paired `_ar`/`_en` suffix columns (e.g., `title_ar`/`title_en`, `name_ar`/`name_en`, `message_ar`/`message_en`). When creating new tables or columns for user-visible content, follow this pattern.

## Supabase Project

Project ID: `ffpsjjazsluolysgithg` (for MCP/CLI operations)
