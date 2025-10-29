# Tawveeri Design System Guide
## توفيري - Professional Price Comparison Platform

**Version**: 3.0 Final  
**Last Updated**: October 2025  
**Status**: Production Ready

---

## 📋 Table of Contents

1. [Introduction & Philosophy](#introduction--philosophy)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Components Library](#components-library)
6. [Patterns & Best Practices](#patterns--best-practices)
7. [Accessibility](#accessibility)
8. [RTL/LTR Support](#rtlltr-support)
9. [Implementation Guide](#implementation-guide)

---

## 🎯 Introduction & Philosophy

Tawveeri is a **professional price comparison platform** for electronics in Saudi Arabia. This design system ensures consistency, trust, and optimal user experience.

### Core Mission
**Help users save money by finding the best prices quickly and easily.**

### Three Design Pillars

1. **Professional Polish** - Sophisticated, trustworthy appearance
2. **Purpose-Driven** - Every element supports price comparison
3. **Performance-First** - Fast, accessible, mobile-optimized

---

## 🎨 Color System

### Primary Colors

#### 🔵 Trust Blue (#1E40AF)
**Purpose**: Reliability, primary actions, trust-building  
**When to use**: CTAs, links, navigation, focus states

```css
--primary-800: #1E40AF  /* Main */
--primary-900: #1E3A8A  /* Hover */
--primary-100: #DBEAFE  /* Light backgrounds */
```

#### 💚 Emerald Green (#059669) ⭐ MOST IMPORTANT
**Purpose**: THE savings color - best prices, deals, money saved  
**When to use**: "Best Price" badges, "Save X SAR", price drops

```css
--success-600: #059669  /* Main */
--success-700: #047857  /* Dark */
--success-100: #D1FAE5  /* Light backgrounds */
```

**Critical**: This should be the most visible accent color. Use it liberally for anything savings-related.

#### 🔴 True Red (#DC2626)
**Purpose**: Urgency, hot deals, time-sensitive offers  
**When to use**: "Hot Deal" badges, limited time, low stock

```css
--warning-600: #DC2626  /* Main */
--warning-700: #B91C1C  /* Dark */
--warning-100: #FEE2E2  /* Light backgrounds */
```

#### 🟡 Amber (#F59E0B)
**Purpose**: Featured stores, premium placements (Phase 2 monetization)  
**When to use**: Featured badges, sponsored content

```css
--featured-500: #F59E0B  /* Main */
--featured-600: #D97706  /* Hover */
--featured-100: #FEF3C7  /* Light backgrounds */
```

### Neutral Palette

```css
--gray-900: #111827  /* Primary text */
--gray-700: #374151  /* Headings */
--gray-500: #6B7280  /* Secondary text */
--gray-300: #D1D5DB  /* Borders */
--gray-100: #F3F4F6  /* Subtle backgrounds */
--gray-50:  #F9FAFB  /* Page backgrounds */
```

### Semantic Usage

**Backgrounds**:
- Primary: `#FFFFFF` (White)
- Secondary: `#F9FAFB` (Gray 50)
- Success highlight: `#ECFDF5` (Emerald 50)

**Text**:
- Primary: `#111827` (Gray 900)
- Secondary: `#4B5563` (Gray 600)
- Tertiary: `#6B7280` (Gray 500)
- Links: `#1E40AF` (Blue 800)

**Borders**:
- Light: `#E5E7EB` (Gray 200)
- Medium: `#D1D5DB` (Gray 300)
- Strong: `#9CA3AF` (Gray 400)

### Dark Mode

```css
.dark {
  --bg-primary: #111827;
  --bg-secondary: #1F2937;
  --text-primary: #F9FAFB;
  --text-secondary: #D1D5DB;
  /* ... other dark mode values */
}
```

---

## 📝 Typography

### Font Stack

**English**: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`  
**Arabic**: `'IBM Plex Sans Arabic', 'Noto Sans Arabic', system-ui`

### Type Scale

| Size | rem | px | Usage |
|------|-----|----|----|
| 3XL | 2.25rem | 36px | Hero headings |
| 2XL | 1.875rem | 30px | Page titles |
| XL | 1.5rem | 24px | Section headings |
| LG | 1.25rem | 20px | Card titles |
| Base | 1rem | 16px | Body text |
| SM | 0.875rem | 14px | Secondary text |
| XS | 0.75rem | 12px | Captions |

### Font Weights

- Regular: 400 (body text)
- Medium: 500 (emphasis)
- Semibold: 600 (subheadings, buttons)
- Bold: 700 (headings)
- Extrabold: 800 (large prices, hero text)

### Price Typography

**CRITICAL**: All prices must use tabular numbers:

```css
.price {
  font-feature-settings: 'tnum';
  font-variant-numeric: tabular-nums;
}
```

**Current Price**:
- Size: 2.5rem (40px)
- Weight: 800
- Color: Primary text
- Tabular: Required

**Original Price**:
- Size: 1.25rem (20px)
- Weight: 400
- Color: Gray 400
- Decoration: line-through

---

## 📏 Spacing & Layout

### 8px Grid System

```
0: 0px
1: 4px    (0.25rem)
2: 8px    (0.5rem)  ← Base unit
3: 12px   (0.75rem)
4: 16px   (1rem)
6: 24px   (1.5rem)
8: 32px   (2rem)
12: 48px  (3rem)
16: 64px  (4rem)
```

### Component Spacing

- **Card padding**: 16-24px
- **Button padding**: 12px 24px
- **Section gaps**: 48-64px
- **Element gaps**: 16px

### Border Radius

```css
SM: 4px    /* Small elements */
MD: 8px    /* Cards, inputs */
LG: 12px   /* Large cards */
XL: 16px   /* Feature sections */
Full: 9999px  /* Pills, badges */
```

### Breakpoints

```
SM:  640px   (Mobile landscape)
MD:  768px   (Tablet)
LG:  1024px  (Desktop)
XL:  1280px  (Large desktop)
2XL: 1536px  (Extra large)
```

---

## 🧩 Components Library

### 1. Badges

#### Best Price Badge
```html
<span class="inline-flex items-center gap-1 px-3 py-1.5 
             rounded-lg bg-success-600 text-white 
             font-semibold text-sm">
  ✓ Best Price
</span>
```

#### Savings Badge
```html
<span class="inline-flex items-center gap-2 px-3 py-1.5 
             rounded-lg bg-success-100 text-success-700 
             font-semibold text-sm">
  💰 Save 500 SAR
</span>
```

#### Hot Deal Badge
```html
<span class="inline-flex items-center gap-1 px-3 py-1.5 
             rounded-lg bg-warning-600 text-white 
             font-semibold text-sm animate-pulse">
  🔥 Hot Deal
</span>
```

### 2. Buttons

#### Primary CTA
```html
<button class="px-6 py-3 bg-primary-800 hover:bg-primary-900
               text-white font-semibold rounded-lg
               shadow-md hover:shadow-lg
               transition-all duration-200 hover:-translate-y-0.5">
  View at Store →
</button>
```

#### Large CTA (Full Width)
```html
<button class="w-full px-6 py-4 bg-primary-800 
               hover:bg-primary-900 text-white font-semibold 
               rounded-lg text-lg">
  Shop Now - Save 500 SAR
</button>
```

### 3. Comparison Card (Best Price)

```html
<div class="rounded-2xl p-6 border-2 border-success-600
            bg-gradient-to-b from-success-50 to-white
            shadow-md hover:shadow-xl transition-all">
  
  <!-- Best Price Badge -->
  <span class="badge-best-price mb-3">✓ Best Price</span>
  
  <!-- Store Header -->
  <div class="flex justify-between items-start mb-4">
    <h3 class="text-xl font-semibold">Extra Store</h3>
    <div class="text-featured-500">⭐ 4.8</div>
  </div>
  
  <!-- Price Display -->
  <div class="flex items-baseline gap-3 mb-4">
    <span class="text-5xl font-extrabold tabular-nums">3,299</span>
    <div class="flex flex-col">
      <span class="text-sm text-gray-500">SAR</span>
      <span class="text-lg text-gray-400 line-through tabular-nums">
        3,799
      </span>
    </div>
  </div>
  
  <!-- Savings Badge -->
  <div class="mb-4">
    <span class="badge-savings">💰 Save 500 SAR</span>
  </div>
  
  <!-- Metadata -->
  <div class="flex gap-2 text-sm text-gray-600 mb-4">
    <span>🚚 Free Delivery</span>
    <span>•</span>
    <span>✓ Warranty</span>
  </div>
  
  <!-- CTA -->
  <button class="btn-primary w-full">View at Extra →</button>
</div>
```

### 4. Product Card

```html
<div class="bg-white rounded-2xl overflow-hidden shadow-md
            hover:shadow-xl hover:-translate-y-1 transition-all">
  
  <!-- Image -->
  <div class="h-48 bg-gradient-to-br from-gray-100 to-gray-200
              flex items-center justify-center text-6xl">
    📱
  </div>
  
  <!-- Body -->
  <div class="p-5">
    <h3 class="text-lg font-semibold mb-1">iPhone 15 Pro Max</h3>
    <p class="text-sm text-gray-500 mb-3">Apple</p>
    
    <!-- Specs -->
    <div class="flex gap-2 mb-4">
      <span class="spec-badge">256GB</span>
      <span class="spec-badge">Blue</span>
    </div>
    
    <!-- Price & Status -->
    <div class="flex justify-between items-center">
      <div>
        <div class="text-2xl font-bold">3,299 SAR</div>
        <span class="badge-in-stock text-xs">In Stock</span>
      </div>
    </div>
  </div>
</div>
```

### 5. Comparison Table

```html
<table class="w-full border-collapse bg-white rounded-xl 
              overflow-hidden shadow-md">
  <thead class="bg-gray-50">
    <tr>
      <th class="px-4 py-3 text-left font-semibold">Store</th>
      <th class="px-4 py-3 text-left font-semibold">Price</th>
      <th class="px-4 py-3 text-left font-semibold">Savings</th>
      <th class="px-4 py-3 text-left font-semibold">Delivery</th>
    </tr>
  </thead>
  <tbody>
    <!-- Best Price Row (GREEN) -->
    <tr class="bg-gradient-to-r from-success-50 to-white 
               font-semibold text-success-700">
      <td class="px-4 py-3">Extra Store</td>
      <td class="px-4 py-3 tabular-nums">3,299 SAR</td>
      <td class="px-4 py-3 tabular-nums">500 SAR</td>
      <td class="px-4 py-3">Free</td>
    </tr>
    <!-- Regular Rows -->
    <tr class="hover:bg-gray-50 border-t border-gray-100">
      <td class="px-4 py-3">Jarir</td>
      <td class="px-4 py-3 tabular-nums">3,399 SAR</td>
      <td class="px-4 py-3 tabular-nums">400 SAR</td>
      <td class="px-4 py-3">25 SAR</td>
    </tr>
  </tbody>
</table>
```

---

## 🎨 Patterns & Best Practices

### Price Display Hierarchy

Always follow this information hierarchy:

```
1. Savings Amount (GREEN - most visible)
2. Current Price (Large, bold, tabular)
3. Best Price Indicator (if applicable)
4. CTA Button
5. Store Name
6. Additional Details
```

### Color Usage Rules

**DO's** ✅:
- Use green for ALL savings indicators
- Use blue for all primary actions
- Use red sparingly for urgent deals
- Maintain consistency

**DON'Ts** ❌:
- Don't use green for non-savings elements
- Don't use red casually
- Don't mix color meanings
- Don't overuse colors

### Mobile-First Patterns

1. **Stack vertically** on mobile
2. **Large touch targets** (44×44px minimum)
3. **Prominent prices** - always visible
4. **Simplified tables** - horizontal scroll if needed

---

## ♿ Accessibility

### WCAG 2.1 AA Compliance

**Color Contrast**:
- All text: 4.5:1 minimum ✅
- Large text: 3:1 minimum ✅
- UI components: 3:1 minimum ✅

### Focus States

```css
:focus-visible {
  outline: 2px solid var(--primary-500);
  outline-offset: 2px;
}
```

### Touch Targets

Minimum size: **44×44px** for all interactive elements

### Screen Readers

- Use semantic HTML (`<button>`, `<nav>`, etc.)
- Provide ARIA labels where needed
- Announce price changes
- Clear button text

### Keyboard Navigation

- All functionality via keyboard
- Logical tab order
- Escape to close modals
- Enter to activate buttons

---

## 🌍 RTL/LTR Support

### Automatic Direction

```html
<html lang="ar" dir="rtl">  <!-- Arabic -->
<html lang="en" dir="ltr">  <!-- English -->
```

### Logical Properties

Always use logical properties:

```css
/* ✅ CORRECT */
margin-inline-start: 1rem;
padding-inline-end: 2rem;

/* ❌ WRONG */
margin-left: 1rem;
padding-right: 2rem;
```

### Tailwind Logical Classes

```html
<!-- ✅ CORRECT -->
<div class="ms-4 pe-6">  <!-- margin-start, padding-end -->

<!-- ❌ WRONG -->
<div class="ml-4 pr-6">  <!-- margin-left, padding-right -->
```

---

## 🚀 Implementation Guide

### 1. Setup Fonts

```typescript
// app/layout.tsx
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const ibmPlexArabic = localFont({
  src: './fonts/IBMPlexSansArabic-Regular.woff2',
  variable: '--font-arabic',
});

export default function RootLayout({ children }) {
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <body className={`${inter.variable} ${ibmPlexArabic.variable}`}>
        {children}
      </body>
    </html>
  );
}
```

### 2. Import Globals CSS

```typescript
// app/layout.tsx
import './globals.css';
```

### 3. Configure Tailwind

Use the provided `tailwind.config.ts` file with all theme colors.

### 4. Create Components

Follow the component patterns in this guide. Use the HTML examples as references.

---

## 📊 Component Checklist

Every component should:
- [ ] Work in light and dark mode
- [ ] Support RTL (Arabic) and LTR (English)
- [ ] Have proper hover/focus states
- [ ] Use correct spacing (8px grid)
- [ ] Include smooth transitions (200ms)
- [ ] Meet accessibility standards
- [ ] Be responsive (mobile, tablet, desktop)
- [ ] Use semantic HTML
- [ ] Include ARIA labels where needed

---

## 💡 Quick Reference

### Most Used Colors

```
Primary Blue:    #1E40AF
Savings Green:   #059669  ⭐ Most important!
Urgency Red:     #DC2626
Featured Amber:  #F59E0B
Text Primary:    #111827
Text Secondary:  #6B7280
Background:      #FFFFFF
Alt Background:  #F9FAFB
Border:          #E5E7EB
```

### Most Used Spacing

```
Component padding: 16-24px (4-6)
Section spacing:   48-64px (12-16)
Element gaps:      16px (4)
Card radius:       16px (xl)
```

### Most Used Components

1. Best Price Card (with green border)
2. Savings Badge (green background)
3. Primary CTA Button (blue)
4. Comparison Table (green row for best)
5. Product Card (hover lift)

---

## 📚 Resources

- **Theme Preview**: `theme-preview-final.html`
- **Global Styles**: `globals-final.css`
- **Tailwind Config**: `tailwind.config.ts`
- **Theme Config**: `theme-config.ts`

---

**Version**: 3.0 Final  
**Platform**: Tawveeri - توفيري  
**Purpose**: Professional Price Comparison Platform  
**Market**: Saudi Arabia - Electronics

---

**Remember**: This design system exists to help users save money. Every decision should support clear price comparison and savings visibility!
