# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Tawveeri** (توفيري) is a bilingual (Arabic/English) price comparison platform for electronics in Saudi Arabia. Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Radix UI + shadcn/ui patterns.

## Commands

```bash
npm run dev      # Start dev server (localhost:3000, uses Turbopack)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

No test framework is configured yet.

## Architecture

### Provider Hierarchy

The root layout (`src/app/layout.tsx`) nests providers in this order — **do not reorder**:

```
<html lang="ar" dir="rtl">
  <LocaleProvider>        ← manages language, dir, font class on <html>
    <ThemeProvider>        ← next-themes with class strategy, storageKey="tawveeri-theme"
      {children}
      <Toaster />
    </ThemeProvider>
  </LocaleProvider>
</html>
```

Default: Arabic (RTL), light theme, system detection disabled.

### Bilingual RTL/LTR System

This is the most important architectural pattern. The `LocaleProvider` (`src/app/providers/locale-provider.tsx`) controls everything:

- Sets `html[lang]`, `html[dir]`, and font class (`font-sans-ar` / `font-sans`) on the document element
- Provides `useLocale()` hook returning `{ locale, setLocale, dir, t }`
- Translations are an inline dictionary in the same file — add keys to both `ar` and `en` objects
- User preference persisted to `localStorage` under key `locale`

**Critical rules:**
- Never set `dir` attributes on individual elements — `LocaleProvider` sets it globally
- Never write separate RTL/LTR CSS — Tailwind + flexbox/grid auto-flip in RTL
- Always use `useLocale()` for any text that needs to be bilingual

### Tailwind v4 Color Override System

`src/app/globals.css` contains extensive `!important` utility overrides because Tailwind v4 uses OKLCH color space, which produces incorrect colors for the design system. The custom theme colors (primary, success, warning, featured) are defined in `@theme` block, and then **every utility usage is re-declared** with hex `!important` for both `html:not(.dark)` and `html.dark` selectors.

When adding new color utilities that use the custom palette, you may need to add corresponding overrides in `globals.css` to ensure colors render correctly.

### Component Organization

- `src/components/ui/` — 33 base UI components (Radix + shadcn/ui pattern). Each uses `cn()` for class merging, supports dark mode via `dark:` prefix.
- `src/components/comparison/` — Domain-specific components (e.g., `ComparisonCard`)
- `src/components/layout/` — App shell components (e.g., `Header`)
- `src/components/common/` — Shared business components

### Key Utilities (`src/lib/utils.ts`)

- `cn(...classes)` — Tailwind class merging (clsx + tailwind-merge). Use for all conditional classes.
- `formatPrice(price, locale)` — Returns `"3,299 ر.س"` (ar) or `"SAR 3,299"` (en)
- `calculateSavings(original, current)` / `calculateSavingsPercentage(original, current)`
- `formatCompactNumber(num)` — `1000` → `"1.0K"`, `1000000` → `"1.0M"`

## Styling Rules

- Use Tailwind utility classes, never custom CSS (unless extending `globals.css` overrides)
- Use design tokens: `text-primary-600`, `bg-success-50`, `border-warning-300`, `text-featured-500`
- Use `tabular-nums` class for all price/number displays
- Always pair light and dark mode: `bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100`
- Fonts: IBM Plex Sans Arabic (var: `--font-ibm-plex-arabic`) for Arabic, Inter (var: `--font-inter`) for English — switching is automatic

## Path Alias

`@/*` maps to `src/*`
