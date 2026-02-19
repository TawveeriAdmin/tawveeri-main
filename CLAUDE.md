# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Tawveeri** (توفيري) is a bilingual (Arabic/English) price comparison platform for electronics in Saudi Arabia. Users compare prices across stores (Amazon SA, Noon, Jarir, Extra, Almanea), set price alerts, and track deals. Includes admin dashboard, store owner portal, and affiliate transaction tracking.

**Note:** The root `README.md` is outdated and describes a legacy Flask/Python architecture. This CLAUDE.md is the authoritative reference.

## Tech Stack

- **Framework**: Next.js 15 (App Router) with TypeScript
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Styling**: Tailwind CSS v4 with custom design tokens
- **UI**: Radix UI primitives + shadcn/ui patterns, Lucide React icons
- **i18n**: Custom `SimpleIntlProvider` (replaced next-intl for reliability)
- **Scraping**: TypeScript scrapers (`src/lib/scraping/`) — legacy Python/Flask in `scripts/scraping/` is unused
- **Testing**: Jest + React Testing Library
- **Charts**: ECharts (`echarts-for-react`) for admin dashboard, Recharts for other analytics

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

## Styling Rules

- Use Tailwind utility classes with design tokens: `text-primary-600`, `bg-success-50`, `border-warning-300`
- Always pair light/dark: `bg-white dark:bg-gray-900`
- Use `tabular-nums` for price/number displays
- Use `cn()` for all conditional classes
- **Never** set `dir` attributes on elements — the locale layout wrapper handles `dir` globally
- **Never** write separate RTL/LTR CSS — flexbox/grid auto-flip in RTL

## Path Alias

`@/*` maps to `src/*`

## Bilingual Content Convention

All user-visible text stored in the database uses paired `_ar`/`_en` suffix columns (e.g., `title_ar`/`title_en`, `name_ar`/`name_en`, `message_ar`/`message_en`). When creating new tables or columns for user-visible content, follow this pattern.

## Supabase Project

Project ID: `ffpsjjazsluolysgithg` (for MCP/CLI operations)
