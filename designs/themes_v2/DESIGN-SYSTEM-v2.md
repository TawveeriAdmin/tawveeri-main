# Tawveeri Design System Documentation
## توفيري - Price Comparison Platform Theme

---

## 🎯 Design Philosophy

Tawveeri is a **price comparison platform** that helps users **save money** on electronics. The design system is built on these core principles:

1. **Savings-First** - Green highlights best deals. Users instantly see where to save money.
2. **Scannable** - Clear price hierarchy, tabular numbers, easy comparison tables
3. **Trustworthy** - Professional appearance that builds confidence in price accuracy
4. **Action-Driven** - Clear CTAs that direct users to the best deals
5. **Data-Focused** - Clean presentation of specs and prices for easy comparison

This is NOT a luxury platform - it's a smart shopper's tool!

---

## 🌈 Color System

### Primary - Trust Blue 🔵
**Purpose**: Build confidence and trust in purchase decisions

- **Light Mode Main**: `#2563eb` - CTAs, links, active states
- **Dark Mode Main**: `#3b82f6` - Brighter for visibility
- **Usage**:
  - Primary CTA buttons ("Compare Prices", "View at Store")
  - Navigation and interactive elements
  - Links to product pages
  - Active/selected states

**Psychology**: Blue is universally trusted for financial and e-commerce platforms. Users making purchase decisions need to trust your platform.

---

### Success - Savings Green 💚
**Purpose**: THE MOST IMPORTANT COLOR - highlights savings and best prices

- **Light Mode**: `#22c55e` (main), `#f0fdf4` (background)
- **Dark Mode**: `#4ade80` (bright), `#14532d` (background)
- **Usage**:
  - "Best Price" badges
  - "Save X SAR" labels
  - Savings amounts
  - Price drop indicators
  - Available/in-stock status
  - Success messages

**Psychology**: Green is universally associated with money, savings, deals, and positive outcomes. This should be the most visible accent color.

---

### Warning - Urgency Orange 🟠
**Purpose**: Create urgency and highlight time-sensitive deals

- **Light Mode**: `#f97316`
- **Dark Mode**: `#fb923c` (brighter)
- **Usage**:
  - "Hot Deal" badges
  - "Deal of the Day" sections
  - "Limited Time" offers
  - "Low Stock" warnings
  - Flash sale indicators

**Psychology**: Orange creates urgency without the negative connotation of red. Perfect for deals that users should act on quickly.

---

### Featured - Amber 🟡
**Purpose**: Premium placements and Phase 2 monetization

- **Main**: `#eab308`
- **Usage**:
  - Featured store placements
  - Premium listings
  - Sponsored content (Phase 2)
  - "Verified Store" badges
  - Special partnerships

**Psychology**: Gold/amber suggests premium value without luxury pricing. Used sparingly to highlight paid features.

---

### Error - Red 🔴
**Purpose**: Negative states that require attention

- **Main**: `#ef4444`
- **Usage**:
  - Out of stock indicators
  - Error messages
  - Price increases
  - Failed actions
  - Unavailable products

---

### Info - Cyan 💙
**Purpose**: Neutral information and comparisons

- **Main**: `#06b6d4`
- **Usage**:
  - Product information
  - Comparison highlights
  - Delivery info
  - Warranty details
  - General tips

---

## 📊 Price Display System

### Price Typography

**Current Price**:
```css
font-size: 2rem (32px)
font-weight: 700 (bold)
color: primary text (#18181b light / #fafafa dark)
font-feature-settings: 'tnum' (tabular numbers for alignment)
```

**Original/Strikethrough Price**:
```css
font-size: 1.1rem (18px)
text-decoration: line-through
color: tertiary text (#71717a light / #a1a1aa dark)
opacity: 0.6
```

**Savings Amount**:
```css
color: #22c55e (green)
font-weight: 600 (semibold)
Include "Save" text and SAR currency
```

### Price Comparison Cards

**Best Price Card**:
- Green border (`#22c55e`)
- Light green background (`#f0fdf4` light / `#14532d` dark)
- "✓ Best Price" badge in solid green
- Most prominent position

**Regular Price Card**:
- Neutral border
- White/dark background
- No special highlighting
- Show savings amount if applicable

**Deal Card**:
- Orange "Hot Deal" badge
- Pulsing animation for attention
- Show both savings and urgency

---

## 🎨 Component Patterns

### Badges

**Best Price Badge**:
```jsx
<div className="inline-block px-2.5 py-1 rounded-md
                bg-success-500 text-white font-semibold text-sm">
  ✓ Best Price
</div>
```

**Savings Badge**:
```jsx
<div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
                bg-success-100 text-success-700
                dark:bg-success-900 dark:text-success-300
                font-semibold text-sm">
  💰 Save 500 SAR
</div>
```

**Hot Deal Badge**:
```jsx
<div className="inline-block px-2.5 py-1 rounded-md
                bg-warning-500 text-white font-semibold text-sm
                animate-pulse">
  🔥 Hot Deal
</div>
```

---

### Comparison Tables

Tables must be extremely scannable with clear hierarchy:

```jsx
<table className="w-full border-collapse">
  <thead>
    <tr className="bg-neutral-100 dark:bg-neutral-800">
      <th className="px-4 py-3 text-left font-semibold">Store</th>
      <th className="px-4 py-3 text-left font-semibold">Price</th>
      <th className="px-4 py-3 text-left font-semibold">Savings</th>
    </tr>
  </thead>
  <tbody>
    {/* Best price row - highlighted in green */}
    <tr className="bg-success-50 dark:bg-success-950 
                   text-success-700 dark:text-success-300 font-semibold">
      <td className="px-4 py-3">Extra</td>
      <td className="px-4 py-3">3,299 SAR</td>
      <td className="px-4 py-3">500 SAR</td>
    </tr>
    {/* Regular rows */}
    <tr className="border-b border-neutral-200 dark:border-neutral-700">
      <td className="px-4 py-3">Jarir</td>
      <td className="px-4 py-3">3,399 SAR</td>
      <td className="px-4 py-3">400 SAR</td>
    </tr>
  </tbody>
</table>
```

---

### CTA Buttons

**Primary CTA (View at Store)**:
```jsx
<button className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700
                   dark:bg-primary-500 dark:hover:bg-primary-600
                   text-white font-semibold rounded-lg
                   transition-all duration-200 hover:-translate-y-1
                   shadow-md hover:shadow-lg">
  View at Extra →
</button>
```

**Compare Button**:
```jsx
<button className="px-6 py-3 border-2 border-primary-600 
                   dark:border-primary-500
                   text-primary-600 dark:text-primary-400
                   font-semibold rounded-lg
                   hover:bg-primary-50 dark:hover:bg-primary-950
                   transition-all duration-200">
  Compare Prices
</button>
```

---

## 📝 Typography

### Font Families

**English**:
- Primary: `Inter` - Excellent for prices and data
- Features: Tabular numbers for price alignment
- Font weights: 400 (regular), 600 (semibold), 700 (bold)

**Arabic**:
- Primary: `IBM Plex Sans Arabic` - Clear and modern
- Fallback: `Noto Sans Arabic`
- Display: `Cairo` for headings
- Slightly larger size (1.05x-1.1x) for better readability

### Type Scale

```
Price (Large):  2rem    (32px) - Current price
Price (Medium): 1.5rem  (24px) - Secondary prices
Heading 1:      2.25rem (36px) - Page titles
Heading 2:      1.5rem  (24px) - Section titles
Body:           1rem    (16px) - Regular text
Small:          0.875rem (14px) - Labels, captions
Tiny:           0.75rem  (12px) - Fine print
```

### Font Features

**Tabular Numbers** (Essential for price alignment):
```css
font-feature-settings: 'tnum';
```

This ensures all prices align perfectly in tables and comparisons.

---

## 🎭 Light vs Dark Mode

### Light Mode - Default
**Best for**: Daytime browsing, detailed price comparisons, reading specs

**Characteristics**:
- Clean white backgrounds (`#ffffff`)
- High contrast for price readability
- Green savings highly visible
- Professional appearance

### Dark Mode
**Best for**: Night browsing, reduced eye strain, modern aesthetic

**Characteristics**:
- Deep black (`#09090b`)
- Enhanced color vibrancy
- Savings green pops more
- Comfortable for extended use

**Critical**: Both modes must maintain the same information hierarchy. Savings must be equally visible in both.

---

## 📱 Responsive Design

### Mobile-First Priorities

1. **Price visibility** - Largest touch targets for price cards
2. **Quick comparison** - Swipeable comparison cards
3. **Easy filtering** - Sticky filter bar
4. **One-tap to store** - Large CTA buttons

### Breakpoints
```
Mobile:  < 640px  - Single column, stacked cards
Tablet:  768px    - Two columns, side-by-side comparison
Desktop: 1024px   - Three columns, full comparison tables
Large:   1280px+  - Four columns, enhanced features
```

---

## 🌍 RTL/LTR Support

### Automatic Handling

```javascript
// In layout
<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
```

### CSS Logical Properties

Always use logical properties:
```css
/* ✅ Good */
margin-inline-start: 1rem;
padding-inline-end: 2rem;

/* ❌ Avoid */
margin-left: 1rem;
padding-right: 2rem;
```

### Price Formatting

```javascript
// Arabic
"٣,٢٩٩ ر.س"  // With Arabic numerals (optional)
"3,299 ر.س"   // With Western numerals (default)

// English
"SAR 3,299"   // SAR prefix
"3,299 SAR"   // SAR suffix (default)
```

---

## ♿ Accessibility

### Color Contrast

All text meets WCAG 2.1 AA standards:
- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum
- Interactive elements: Clear focus states

### Focus States

```css
:focus-visible {
  outline: 2px solid var(--primary-500);
  outline-offset: 2px;
  border-radius: 4px;
}
```

### Screen Reader Support

- Proper ARIA labels for prices
- "Best price" announced for screen readers
- Savings amounts read clearly
- Store links with descriptive text

---

## 🎯 Usage Guidelines

### DO's ✅

- Use green for ANY savings indication
- Make "Best Price" immediately obvious
- Keep price hierarchy clear (big → small)
- Use tabular numbers in all price displays
- Show savings amount prominently
- Use urgency badges sparingly (only for real deals)
- Make CTA buttons large and obvious

### DON'Ts ❌

- Don't use green for anything except savings/deals
- Don't hide the best price in small text
- Don't use decorative fonts for prices
- Don't overuse urgency badges (loses effectiveness)
- Don't make comparison tables hard to scan
- Don't use too many colors - keep it simple

---

## 📊 Real-World Examples

### Product Comparison Page
```
┌─────────────────────────────────────┐
│ iPhone 15 Pro Max - 256GB           │
│ ┌─────────────────────────────┐     │
│ │ ✓ Best Price                │     │
│ │ Extra Store                 │     │
│ │ 3,299 SAR  [3,799 SAR]     │     │
│ │ 💰 Save 500 SAR            │     │
│ │ [View at Extra →]           │     │
│ └─────────────────────────────┘     │
│                                     │
│ Jarir Bookstore                     │
│ 3,399 SAR  [3,999 SAR]             │
│ 💰 Save 600 SAR                    │
│ [View at Jarir →]                   │
└─────────────────────────────────────┘
```

### Daily Deals Section
```
🔥 Hot Deals Today
┌──────────────────┬──────────────────┐
│ Samsung S24      │ MacBook Air M2   │
│ 🔥 Limited Time  │ 🔥 24h Left      │
│ 2,499 SAR        │ 4,999 SAR        │
│ Save 800 SAR     │ Save 1,000 SAR   │
└──────────────────┴──────────────────┘
```

---

## 🚀 Implementation Checklist

Core Setup:
- [ ] Install Inter font with tabular number support
- [ ] Install IBM Plex Sans Arabic / Cairo
- [ ] Configure Tailwind with theme colors
- [ ] Set up CSS variables in globals.css
- [ ] Implement theme switcher (light/dark)
- [ ] Add RTL/LTR detection

Price Display:
- [ ] Tabular numbers for all prices
- [ ] Clear hierarchy (current > original > savings)
- [ ] Green badges for best price
- [ ] Orange badges for hot deals
- [ ] Consistent SAR formatting

Components:
- [ ] Comparison cards with proper highlighting
- [ ] Scannable comparison tables
- [ ] Price history charts (Week 5 requirement)
- [ ] Deal badges with animations
- [ ] Store rating display

Responsiveness:
- [ ] Mobile-optimized price cards
- [ ] Swipeable comparisons on mobile
- [ ] Sticky filter bar
- [ ] Touch-friendly CTAs (44px minimum)

Accessibility:
- [ ] WCAG 2.1 AA compliance
- [ ] Screen reader support for prices
- [ ] Keyboard navigation
- [ ] Focus indicators
- [ ] Color-blind friendly (not just color for meaning)

---

## 📞 Files Reference

- Full Preview: `theme-preview-comparison.html`
- Configuration: `theme-config.ts`
- Tailwind Config: `tailwind.config.ts`
- Global Styles: `globals.css`
- Quick Reference: `QUICK-REFERENCE.md`

---

**Version**: 2.0.0 (Price Comparison Optimized)  
**Last Updated**: October 2025  
**Designed for**: Tawveeri - Price Comparison Platform for Electronics in Saudi Arabia

---

## 💡 Remember

This design system is optimized for ONE GOAL:
**Help users save money by finding the best prices quickly and easily.**

Every design decision should support this goal!
