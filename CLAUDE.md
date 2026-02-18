# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Tawveeri** (توفيري) is a bilingual (Arabic/English) price comparison platform for electronics in Saudi Arabia. Users compare prices across stores (Amazon SA, Noon, Jarir, Extra), set price alerts, and track deals. Includes admin dashboard, store owner portal, and affiliate transaction tracking.

## Tech Stack

- **Framework**: Next.js 15 (App Router) with TypeScript
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Styling**: Tailwind CSS v4 with custom design tokens
- **UI**: Radix UI primitives + shadcn/ui patterns
- **i18n**: Custom `SimpleIntlProvider` (replaced next-intl for reliability)
- **Scraping**: TypeScript scrapers (`src/lib/scraping/`) — legacy Python/Flask in `scripts/scraping/` is unused
- **Testing**: Jest + React Testing Library
- **Charts**: Recharts (admin analytics)

## Commands

```bash
npm run dev              # Dev server (localhost:3000, Turbopack)
npm run build            # Production build (TS/ESLint errors ignored in config)
npm run lint             # ESLint
npm test                 # Run all tests
npm test -- path/to/file # Run a single test file
npm run test:watch       # Tests in watch mode
npm run test:coverage    # Tests with coverage report
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
<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
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
</html>
```

Default: Arabic (RTL), light theme, system detection disabled.

### Translation System

Translations are JSON files in `messages/{ar,en}/` organized by feature. Loaded via `Promise.allSettled` dynamic imports in `src/app/[locale]/layout.tsx` and provided through `SimpleIntlProvider` (`src/lib/simple-intl-provider.tsx`).

**Namespaces loaded** (20 files): common, landing, auth, products, dashboard, profile, stores, deals, product, store, search, wishlist, compare, settings, notifications, admin, checkout, priceAlerts, cart. If adding a new namespace file, add its dynamic import in the locale layout and spread it into the `messages` object.

**Usage in components:**
```tsx
import { useTranslations } from '@/lib/simple-intl-provider';
const t = useTranslations();
t('products.title')              // dot-notation key lookup
t('greeting', { name: 'Ali' })   // {{name}} placeholder replacement
```

**Special case**: `common.json` has a unique structure — its top-level keys (`app`, `nav`, `button`, etc.) are spread directly into messages, while its nested `common` key becomes the `common` namespace. All other files are namespaced by their filename (e.g., `auth.json` → `auth.*`).

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

### Database

Supabase with typed client. Types in `src/lib/database/types.ts`. Two client patterns:
- **Browser**: `getSupabaseBrowserClient()` from `src/lib/database/` (singleton, uses anon key)
- **Server**: `createServerClient()` from `src/lib/database/` (uses service role key, no session persistence)

Key tables: `users`, `products`, `stores`, `product_stores` (price per store), `price_history`, `notifications`, `admin_logs`, `transactions`, `user_wishlists`, `price_alerts`, `product_reviews`.

Schema migrations are numbered SQL files in `scripts/database/`.

### Required Action Pattern

Every user-facing action must include:
1. **In-App Notification** — insert into `notifications` table with bilingual `title_ar`/`title_en` and `message_ar`/`message_en`
2. **Audit Log** — insert into `admin_logs` via `createAuditLog()` from `src/lib/auth/audit.ts`

Use `createNotification()` from `src/lib/auth/notifications.ts` (types: `price_drop`, `back_in_stock`, `deal`, `system`, `account`) and `createAuditLog()` with standard actions from `AUDIT_ACTIONS` constant. Audit logging fails silently to avoid blocking user actions.

### Scraping Architecture

Two scraping subsystems, both TypeScript:
1. **Search scrapers** (`src/lib/scraping/search/`) — lightweight fetch+cheerio scrapers for Amazon SA, Noon, Jarir, Extra. Run in-process via `searchAllStores()` orchestrator. Called from `POST /api/search/scrape`.
2. **Cron scrapers** (`src/lib/scraping/stores/`) — TypeScript scrapers with base class pattern, rate limiting, retry logic, caching, product matching/filtering. Called from cron API routes.

Legacy Python/Flask scrapers (`scripts/scraping/`) still exist but are no longer used by the app.

API routes: `src/app/api/search/scrape/route.ts`, `src/app/api/cron/update-prices/route.ts`, `src/app/api/cron/discover-products/route.ts`, `src/app/api/cron/check-price-alerts/route.ts`.

### Tailwind v4 Color Override System

`src/app/globals.css` uses CSS custom properties for theming with `:root` and `.dark` scopes. Dark mode is class-based: `@custom-variant dark (&:where(.dark, .dark *))`.

**Color tokens** (CSS variables): `--color-primary-*`, `--color-secondary-*`, `--color-tertiary-*` (amber, for deals/featured), `--color-success-*`, `--color-warning-*`, `--color-error-*`. Surface hierarchy: `--color-surface-{lowest,low,high,highest}`. Domain-specific: `--color-deal`, `--color-price-savings`.

Colors are mapped in the `@theme` block. Extensive `!important` overrides exist because Tailwind v4's OKLCH color space produces incorrect colors — when adding new color utility combinations, you may need to add corresponding overrides.

### Component Organization

- `src/components/ui/` — Base UI components (Radix + shadcn/ui). Use `cn()` for class merging.
- `src/components/admin/` — Admin dashboard components (stats cards, data tables, charts)
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
- **Never** set `dir` attributes on elements — the locale layout handles `html[dir]` globally
- **Never** write separate RTL/LTR CSS — flexbox/grid auto-flip in RTL

## Path Alias

`@/*` maps to `src/*`

## Supabase Project

Project ID: `ffpsjjazsluolysgithg` (for MCP/CLI operations)
