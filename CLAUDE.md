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

The entire app automatically switches between Arabic (RTL) and English (LTR):

- **Default language**: Arabic (RTL)
- **Language switching**: Handled by `LocaleProvider` in `src/app/providers/locale-provider.tsx`
- **Font switching**: Automatic - IBM Plex Sans Arabic for Arabic, Inter for English
- **Direction switching**: Automatic via `html[dir]` attribute
- **Persistence**: User preference stored in localStorage

**Using the locale context:**
```tsx
'use client';
import { useLocale } from '@/app/providers/locale-provider';

export function MyComponent() {
  const { locale, setLocale, t, dir } = useLocale();

  return (
    <div>
      <p>{t('app.name')}</p> {/* Uses translation dictionary */}
      <button onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}>
        {locale === 'ar' ? 'English' : 'العربية'}
      </button>
    </div>
  );
}
```

**Adding translations**: Edit the `translations` object in `src/app/providers/locale-provider.tsx`

### Theme System

**Design tokens** are defined in `src/app/globals.css` using CSS custom properties:

- **Primary**: Blue (#1E40AF) - Trust, CTAs, branding
- **Success**: Green (#059669) - Best price indicators, savings
- **Warning**: Red (#DC2626) - Hot deals, urgency, alerts
- **Featured**: Amber (#F59E0B) - Premium stores, sponsored content
- **Neutrals**: Complete gray scale for text and backgrounds

**Using themes:**
```tsx
'use client';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      Toggle Theme
    </button>
  );
}
```

**Creating themed components**: Use Tailwind's dark mode classes:
```tsx
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  Content
</div>
```

### Path Aliases

TypeScript path alias `@/*` maps to `src/*`:
```tsx
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/utils';
import { useLocale } from '@/app/providers/locale-provider';
```

### Component Patterns

All UI components follow these conventions:

1. **Located in** `src/components/ui/`
2. **Built with** Radix UI primitives for accessibility
3. **Styled with** Tailwind CSS and design tokens
4. **Support** both RTL/LTR and light/dark modes automatically
5. **Export** TypeScript interfaces for props
6. **Use** `cn()` utility for conditional classes

**Example component structure:**
```tsx
import { cn } from '@/lib/utils';

interface MyComponentProps {
  variant?: 'default' | 'success';
  className?: string;
}

export function MyComponent({ variant = 'default', className }: MyComponentProps) {
  return (
    <div className={cn(
      'base-classes',
      variant === 'success' && 'success-classes',
      className
    )}>
      Content
    </div>
  );
}
```

## Available UI Components

33 production-ready components in `src/components/ui/`:

**Form & Input**: button, input, textarea, label, select, checkbox, radio-group, switch, slider
**Layout**: card, separator, accordion, tabs, breadcrumb, scroll-area, table, pagination
**Feedback**: badge, alert, progress, skeleton, spinner, empty-state
**Overlay**: dialog, dropdown-menu, tooltip, popover, command
**Notifications**: toast, toaster, use-toast
**Utility**: avatar, calendar

See `COMPLETE-COMPONENT-LIBRARY.md` for detailed usage examples.

## Key Utilities

Located in `src/lib/utils.ts`:

```tsx
// Class name merging (use for all conditional classes)
cn(...classes)

// Price formatting
formatPrice(3299, 'ar')  // "3,299 ر.س"
formatPrice(3299, 'en')  // "SAR 3,299"

// Savings calculations
calculateSavings(3799, 3299)              // 500
calculateSavingsPercentage(3799, 3299)    // 13

// Number formatting
formatCompactNumber(1000000)  // "1.0M"
```

## Design System Quick Reference

### Colors (defined in globals.css)
- Primary: `bg-primary-600`, `text-primary-600`, `border-primary-600`
- Success: `bg-success-600`, `text-success-600`, `border-success-600`
- Warning: `bg-warning-600`, `text-warning-600`, `border-warning-600`
- Featured: `bg-featured-500`, `text-featured-500`, `border-featured-500`

### Typography
- Arabic: Automatically applied when `locale='ar'`
- English: Automatically applied when `locale='en'`
- Price display: Use `tabular-nums` class for aligned numbers

### Common Patterns

**Best Price Card:**
```tsx
<Card className="border-2 border-success-600 bg-gradient-to-br from-success-50 to-white">
  <Badge variant="success">Best Price</Badge>
  {/* Card content */}
</Card>
```

**Hot Deal Badge:**
```tsx
<Badge variant="warning" className="animate-pulse">
  🔥 Hot Deal
</Badge>
```

**Featured Store:**
```tsx
<Badge variant="featured">
  ⭐ Featured
</Badge>
```

## Client vs Server Components

- **Provider components** (`LocaleProvider`, `ThemeProvider`) must be client components
- **Layout components** that use providers must include `'use client'` directive
- **Page components** can be server components unless they use hooks
- **UI components** should be client components if they use state/events

## Important Notes

### RTL/LTR Handling
- **DO NOT** manually set `dir` attributes on individual elements
- **DO NOT** use separate CSS for RTL/LTR - Tailwind handles this automatically
- The `LocaleProvider` sets `html[dir]` globally
- Flexbox and Grid layouts automatically flip in RTL mode
- Icons and arrows automatically flip direction

### Styling Guidelines
- Use Tailwind utility classes, not custom CSS
- Use design tokens (e.g., `text-primary-600`) instead of arbitrary colors
- Always use the `cn()` utility for conditional classes
- Ensure dark mode support with `dark:` prefix
- Use `tabular-nums` for all price displays

### Performance
- Next.js 15 uses Turbopack in development
- Fonts are optimized with `display: swap`
- Components use code splitting automatically
- Target: sub-3-second page loads

### Accessibility
- All Radix UI components are WCAG 2.1 compliant
- Include proper ARIA labels for icons and buttons
- Maintain keyboard navigation support
- Test with screen readers when adding complex interactions

## Common Tasks

### Adding a new page
1. Create file in `src/app/your-page/page.tsx`
2. Use `'use client'` if you need hooks or interactivity
3. Import and use `useLocale()` for translations

### Adding a new component
1. Create in appropriate directory (`src/components/ui/`, `comparison/`, or `common/`)
2. Use Radix UI primitives when possible
3. Support dark mode with `dark:` classes
4. Export TypeScript interfaces
5. Use `cn()` for class merging

### Adding translations
1. Edit `src/app/providers/locale-provider.tsx`
2. Add keys to both `ar` and `en` objects in the `translations` dictionary
3. Use via `t('your.key')` from `useLocale()` hook

### Creating themed elements
Use CSS variables for colors that need to work in both light and dark modes:
```tsx
<div className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  This adapts to theme automatically
</div>
```
