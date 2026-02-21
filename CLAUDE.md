# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## RIPER-5 Operational Protocol (Terminal)

Use this protocol for Claude Code sessions in this repository.

### Core Rules

- Default mode is `FAST` if no mode was explicitly set.
- Do not switch modes unless the user explicitly commands it.
- In `EXECUTE`, follow the approved `PLAN` exactly.
- If execution needs any unplanned deviation, stop and return to `PLAN`.
- When asked to inspect or edit backend DB items (schema, edge functions, DB functions), use Supabase MCP tools.

### Mode Declaration

Start every response with the current mode tag:

- `[MODE: RESEARCH]`
- `[MODE: INNOVATE]`
- `[MODE: PLAN]`
- `[MODE: EXECUTE]`
- `[MODE: REVIEW]`
- `[MODE: FAST]`
- `[MODE: RESEARCH PLAN]`

### Transition Commands

Only these user commands change mode:

- `do res` -> `RESEARCH`
- `do inn` -> `INNOVATE`
- `do pla` -> `PLAN`
- `do exe` -> `EXECUTE`
- `do rev` -> `REVIEW`
- `do fas` -> `FAST`
- `do respla` -> `RESEARCH PLAN`

### Mode Contracts

#### RESEARCH (`do res`)

Purpose: understand existing code and gather facts.

- Allowed: read/search files, inspect context, ask clarifying questions.
- Forbidden: planning, implementation, and code changes.

#### INNOVATE (`do inn`)

Purpose: brainstorm options before choosing an approach.

- Allowed: possible approaches with pros/cons and trade-offs.
- Forbidden: final decisions, step-by-step planning, code writing.

#### PLAN (`do pla`)

Purpose: produce an exhaustive implementation plan with no open decisions.

- Allowed: exact file paths, symbols, technical steps, sequencing.
- Forbidden: code writing.
- Requirement: end with a numbered implementation checklist.

Checklist format:

1. [Specific action]
2. [Specific action]
3. [Specific action]

#### EXECUTE (`do exe`)

Purpose: implement only what was approved in `PLAN`.

- Allowed: only planned steps.
- Forbidden: unplanned improvements, refactors, or extra scope.
- If any deviation is required: stop and request return to `PLAN`.

#### REVIEW (`do rev`)

Purpose: verify implementation strictly against plan.

- Allowed: comparison and verification only.
- Forbidden: new edits.
- Must explicitly flag deviations using:
  - `DEVIATION DETECTED: <description>`
- End with one verdict:
  - `IMPLEMENTATION MATCHES PLAN EXACTLY`
  - `IMPLEMENTATION DEVIATES FROM PLAN`

#### FAST (`do fas`)

Purpose: minimal, rapid, scoped task execution.

- Allowed: smallest possible change to complete assigned task.
- Forbidden: refactors, optimizations, or behavior changes outside scope unless explicitly requested.
- Principles: KISS and YAGNI.
- If task grows beyond scope: return to `PLAN`.

Response format in FAST:

1. Problem
2. Expected outcome
3. Constraints
4. Minimal solution
5. Files changed

#### RESEARCH PLAN (`do respla`)

Purpose: deep research first, then assumption-free planning.

Phase 1 - Research:

1. Restate and clarify the problem.
2. List constraints, requirements, and context.
3. Gather only confirmed facts; ask when uncertain.
4. Compare possible approaches.
5. Note risks, edge cases, and trade-offs.
6. Choose final approach only with evidence.

Phase 2 - Plan:

- Produce exhaustive implementation plan (no code).
- Include files, functions, APIs, config, and data changes.
- End with checklist:

1. [Problem] [Expected Result] [Solution] [Files to change]
2. [Problem] [Expected Result] [Solution] [Files to change]
3. [Problem] [Expected Result] [Solution] [Files to change]

## Project Overview

**Tawveeri** (توفيري) is a bilingual (Arabic/English) price comparison platform for electronics in Saudi Arabia. Users compare prices across stores (Amazon SA, Noon, Jarir, Extra, Almanea), set price alerts, and track deals. Includes admin dashboard, store owner portal, and affiliate transaction tracking.

**Note:** The root `README.md` is outdated and describes a legacy Flask/Python architecture. This CLAUDE.md is the authoritative reference.

## Tech Stack

- **Framework**: Next.js 15 (App Router) with TypeScript
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Styling**: Tailwind CSS v4 with custom design tokens
- **UI**: Radix UI primitives + shadcn/ui patterns
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

Key tables: `users`, `products`, `stores`, `product_stores` (price per store), `price_history`, `notifications`, `admin_logs`, `transactions`, `user_wishlists`, `price_alerts`, `product_reviews`, `phone_otps`, `coupons` (store/product coupons with discount metadata).

Schema migrations are numbered SQL files in `scripts/database/`.

### Coupon System

**Table:** `coupons` — stores coupon codes with full metadata. Each coupon belongs to a `store_id` and optionally a `product_id` (null = store-wide). Fields include `code`, `discount_type` (percentage/fixed_amount/free_shipping), `discount_value`, `min_purchase`, `max_discount`, `expires_at`, `is_active`, `usage_count`.

**Types:** `DiscountType` enum in `src/lib/database/types.ts`.

**API routes (mobile-compatible via `api-auth.ts`):**
- `GET /api/coupons` — public list of active coupons with filters
- `POST /api/coupons/[id]/copy` — track coupon code copy
- `GET/POST /api/admin/coupons` — admin list + create
- `PATCH/DELETE /api/admin/coupons/[id]` — admin update + soft-delete

**Auth helper:** `src/lib/auth/api-auth.ts` supports both cookie-based (web) and Bearer token (mobile app) auth. Use `requireRequestAdmin(request)` and `getRequestUser(request)` in API routes that need mobile compatibility.

**UI component:** `CouponBadge` (`src/components/ui/coupon-badge.tsx`) — compact (for cards) and expanded (for detail pages) variants with copy-to-clipboard.

**Pages:** `/coupons` (public browsing), `/admin/coupons` (admin CRUD). Coupons also show on product detail, store detail, and deals pages.

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

### AI Recommendations System

**Architecture**: pgvector embeddings + PostgreSQL functions, callable via `.rpc()` from any Supabase SDK (web + mobile).

**Embedding pipeline** (automatic):
- Products get embeddings via OpenAI `text-embedding-3-small` (1536 dimensions, multilingual Arabic+English)
- Stored in `products.embedding` column (`halfvec(1536)` with HNSW index)
- Auto-generated on product insert/update via triggers → pgmq queue → pg_cron (every 10s) → `embed` Edge Function → OpenAI API
- Infrastructure: `util` schema with `queue_embeddings()`, `process_embeddings()`, `invoke_edge_function()` functions
- Requires `OPENAI_API_KEY` set as Supabase secret

**Recommendation functions** (all in PostgreSQL, called via `.rpc()`):
- `match_similar_products(target_product_id, match_count, match_threshold)` — pgvector cosine similarity
- `get_collaborative_recommendations(target_product_id, match_count)` — wishlist co-occurrence
- `get_personalized_recommendations(target_user_id, match_count, match_threshold)` — user profile embedding match (wishlists + price alerts + recent views averaged)
- `get_recommendations(p_user_id, p_product_id, p_type, p_limit)` — **unified orchestrator** with auto-fallback chain

**Unified API call** (same for web and mobile):
```typescript
const { data } = await supabase.rpc('get_recommendations', {
  p_user_id: userId,       // NULL for guests
  p_product_id: productId, // NULL for dashboard
  p_type: 'auto',          // 'auto' | 'similar' | 'collaborative' | 'personalized'
  p_limit: 8,
});
```

**Fallback chain** (when `p_type = 'auto'`):
- Product page: embedding similarity → collaborative → same-category popularity
- Dashboard: personalized → category-from-search-history popularity → global popularity
- Guest: global popularity by view_count

**Per-user view tracking**: `product_views` table records user-product views (deduped hourly in application code). Used by personalized recommendations for the "recent views" signal.

**Files**:
- `src/lib/recommendations/types.ts` — `RecommendedProduct` and `RecommendationOptions` types
- `src/lib/recommendations/use-recommendations.ts` — React hook wrapping `.rpc('get_recommendations')`
- Edge Function `embed` — processes embedding jobs from pgmq queue via OpenAI

**Backfilling embeddings**: Queue all products via `SELECT pgmq.send('embedding_jobs', ...)` — pg_cron processes in batches of 10.

## Path Alias

`@/*` maps to `src/*`

## Supabase Project

Project ID: `ffpsjjazsluolysgithg` (for MCP/CLI operations)
