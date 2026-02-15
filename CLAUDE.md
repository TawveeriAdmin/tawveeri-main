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
- **Scraping**: Flask/Python backend (`scripts/scraping/`) + Node.js scrapers (`src/lib/scraping/`)
- **Testing**: Jest + React Testing Library
- **Charts**: Recharts (admin analytics)

## Commands

```bash
npm run dev          # Dev server (localhost:3000, Turbopack)
npm run build        # Production build (TS/ESLint errors ignored in config)
npm run lint         # ESLint
npm test             # Run all tests
npm run test:watch   # Tests in watch mode
npm run test:db      # Database tests only (tests/database/)
npm run db:setup     # Full database setup
npm run db:schema    # Apply schema SQL
npm run db:seed      # Seed data
npm run flask:start  # Start Python scraping server (localhost:5000)
npm run flask:dev    # Flask dev mode with debug
```

## Architecture

### Routing & i18n

All pages live under `src/app/[locale]/` — the `[locale]` segment is `ar` or `en`. Locale config is in `src/i18n.ts`. The middleware (`src/middleware.ts`) combines next-intl routing with Supabase auth checks (session validation, role-based access).

**Root layout** (`src/app/layout.tsx`) is a passthrough — the real layout is `src/app/[locale]/layout.tsx`.

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

Translations are JSON files in `messages/{ar,en}/` organized by feature (common, auth, products, admin, etc.). Loaded via dynamic imports in `src/app/[locale]/layout.tsx` and provided through `SimpleIntlProvider` (`src/lib/simple-intl-provider.tsx`).

**Usage in components:**
```tsx
import { useTranslations } from '@/lib/simple-intl-provider';
const t = useTranslations();
t('products.title')              // dot-notation key lookup
t('greeting', { name: 'Ali' })   // {{name}} placeholder replacement
```

**Adding translations**: Create/edit JSON files in `messages/ar/` and `messages/en/`. If adding a new namespace file, also add the import in `src/app/[locale]/layout.tsx`.

### Authentication & Authorization

- **Client**: `useAuth()` hook from `src/lib/auth/auth-context.tsx` — provides signUp, signIn, signOut, user with role
- **Server**: `src/lib/auth/server.ts` — `getSession()`, `getUser()`, `getUserProfile()`, `requireAuth()`, `requireAdmin()`
- **Middleware**: `src/middleware.ts` handles route protection:
  - Protected routes: `/dashboard`, `/profile`, `/wishlist`, `/notifications`, `/price-alerts`
  - Admin routes: `/admin/*` (requires `admin` role)
  - Store routes: `/store/*` (requires `store` or `admin` role)
- **Roles**: `admin`, `customer`, `store`, `guest` (defined in `src/lib/database/types.ts`)

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

Use `createNotification()` from `src/lib/auth/notifications.ts` and `createAuditLog()` with standard actions from `AUDIT_ACTIONS` constant.

### Scraping Architecture

Two scraping systems:
1. **Python/Flask** (`scripts/scraping/`) — standalone scrapers for Amazon SA, Noon, Jarir. Runs on port 5000.
2. **Node.js** (`src/lib/scraping/`) — TypeScript scrapers with base class pattern, rate limiting, retry logic, caching, product matching/filtering. Called from API routes.

API routes: `src/app/api/search/scrape/route.ts`, `src/app/api/cron/update-prices/route.ts`, `src/app/api/cron/discover-products/route.ts`.

### Tailwind v4 Color Override System

`src/app/globals.css` uses `@custom-variant dark (&:where(.dark, .dark *))` for class-based dark mode. Custom theme colors (primary, success, warning, featured) are defined in `@theme` block. Extensive `!important` overrides exist because Tailwind v4's OKLCH color space produces incorrect colors — when adding new color utility combinations, you may need to add corresponding overrides.

### Component Organization

- `src/components/ui/` — Base UI components (Radix + shadcn/ui). Use `cn()` for class merging.
- `src/components/admin/` — Admin dashboard components (stats cards, data tables, charts)
- `src/components/layout/` — App shell (header)
- `src/components/comparison/` — Price comparison cards

### Key Utilities (`src/lib/utils.ts`)

- `cn(...classes)` — Tailwind class merging (clsx + tailwind-merge)
- `formatPrice(price)` — Number formatting only (no currency). Use `<Price>` component for display with SAR symbol.
- `formatPriceWithCurrency(price, locale)` — **deprecated**, use `<Price>` component instead
- `calculateSavings(original, current)` / `calculateSavingsPercentage(original, current)`

### Environment Variables

See `.env.example`. Required:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase client
- `SUPABASE_SERVICE_ROLE_KEY` — Server-side Supabase operations
- `SUPABASE_DB_URL` — Direct PostgreSQL connection for migration scripts
- `NEXT_PUBLIC_APP_URL` — App URL for auth callbacks and emails

## Styling Rules

- Use Tailwind utility classes with design tokens: `text-primary-600`, `bg-success-50`, `border-warning-300`
- Always pair light/dark: `bg-white dark:bg-gray-900`
- Use `tabular-nums` for price/number displays
- Use `cn()` for all conditional classes
- **Never** set `dir` attributes on elements — the locale layout handles `html[dir]` globally
- **Never** write separate RTL/LTR CSS — flexbox/grid auto-flip in RTL

## Path Alias

`@/*` maps to `src/*`
