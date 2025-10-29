# Tawveeri Design System Documentation
## توفيري - Theme & Design Guidelines

---

## 🎨 Design Philosophy

The Tawveeri design system is built on three core principles:

1. **Minimal** - Clean interfaces with purposeful whitespace and no unnecessary elements
2. **Professional** - Trust-building colors, refined typography, and consistent patterns
3. **Luxury** - Premium feel through elegant gold accents, smooth animations, and thoughtful details

---

## 🖌️ Color System

### Primary - Royal Blue
The primary color conveys trust, professionalism, and reliability - essential for a price comparison platform.

- **Main**: `#3a3aca` (700) - Primary buttons, links, brand elements
- **Light**: `#8196f8` (400) - Hover states, backgrounds
- **Lighter**: `#c7d7fe` (200) - Subtle backgrounds
- **Dark**: `#2a2f81` (900) - Text, strong emphasis

**Usage:**
- Primary CTAs (Call-to-Action buttons)
- Navigation active states
- Brand elements
- Links and interactive elements

### Secondary - Elegant Gold
Gold represents luxury, premium quality, and value - perfect for highlighting savings and deals.

- **Main**: `#eab308` (500) - Accent elements, deals, badges
- **Light**: `#fde047` (300) - Subtle highlights
- **Dark**: `#a16207` (700) - Text on light backgrounds

**Usage:**
- Price badges ("Best Price", "Save X%")
- Premium features
- Special offers and deals
- Emphasis on value

### Accent - Sophisticated Teal
Teal provides a fresh, modern contrast while maintaining professionalism.

- **Main**: `#14b8a6` (500) - Secondary CTAs, success states
- **Light**: `#5eead4` (300) - Backgrounds
- **Dark**: `#0f766e` (700) - Strong emphasis

**Usage:**
- Secondary actions
- Success states
- Fresh, modern accents
- Alternative CTAs

---

## 🎯 Semantic Colors

### Success (Green)
- Light Mode: `#22c55e` (main), `#dcfce7` (background)
- Dark Mode: `#22c55e` (main), `#14532d` (background)
- **Usage**: Confirmations, success messages, "available" status

### Error (Red)
- Light Mode: `#ef4444` (main), `#fee2e2` (background)
- Dark Mode: `#ef4444` (main), `#7f1d1d` (background)
- **Usage**: Errors, warnings, "out of stock" status

### Warning (Amber)
- Light Mode: `#f59e0b` (main), `#fef3c7` (background)
- Dark Mode: `#f59e0b` (main), `#78350f` (background)
- **Usage**: Cautions, limited stock, important notices

### Info (Blue)
- Light Mode: `#3b82f6` (main), `#dbeafe` (background)
- Dark Mode: `#3b82f6` (main), `#1e3a8a` (background)
- **Usage**: Information messages, tips, general notices

---

## 📝 Typography

### Font Families

**English (LTR):**
- Primary: `Inter` - Clean, modern sans-serif
- Display: `Inter` - For headings and emphasis
- Mono: `JetBrains Mono` - For code and technical data

**Arabic (RTL):**
- Primary: `Noto Sans Arabic` - Excellent Arabic readability
- Display: `Cairo` - Beautiful for headings
- Fallback: `Tajawal` - System fallback

### Font Sizes

```css
xs:   0.75rem  (12px) - Captions, labels
sm:   0.875rem (14px) - Secondary text
base: 1rem     (16px) - Body text
lg:   1.125rem (18px) - Emphasized text
xl:   1.25rem  (20px) - Section headings
2xl:  1.5rem   (24px) - Page headings
3xl:  1.875rem (30px) - Major headings
4xl:  2.25rem  (36px) - Hero text
```

### Font Weights

- Light: 300 - Rare, only for large display text
- Normal: 400 - Body text
- Medium: 500 - Emphasized body text
- Semibold: 600 - Subheadings
- Bold: 700 - Headings, CTAs
- Extrabold: 800 - Large display text

### Typography Guidelines

1. **Body Text**: 16px (1rem), weight 400, line-height 1.5
2. **Headings**: Reduce line-height (1.2-1.3) for better aesthetics
3. **Arabic Text**: Slightly larger size recommended (1.05-1.1x) for better readability
4. **Max Line Width**: 65-75 characters for optimal reading

---

## 🎭 Light vs Dark Mode

### Light Mode
**Best for:**
- Daytime browsing
- Bright environments
- Detailed product comparisons
- Reading extensive content

**Characteristics:**
- Clean white backgrounds
- High contrast for readability
- Subtle shadows for depth
- Professional appearance

### Dark Mode
**Best for:**
- Night browsing
- Low-light environments
- Reduced eye strain
- Modern, sleek appearance

**Characteristics:**
- Deep black backgrounds (#0a0a0a)
- Enhanced color vibrancy
- Subtle lighting effects
- Premium, sophisticated feel

### Switching Strategy
```javascript
// Automatic switching based on:
1. User preference (stored in localStorage)
2. System preference (prefers-color-scheme)
3. Time of day (optional feature)
```

---

## 📦 Component Guidelines

### Buttons

**Primary Button:**
```css
Background: var(--primary-700) / var(--primary-500)
Color: white
Padding: 10px 20px
Border-radius: 8px
Hover: Translate Y(-1px) + shadow
```

**Secondary Button (Gold):**
```css
Background: var(--secondary-500)
Color: var(--secondary-950) / var(--neutral-950)
Same padding and effects
```

**Outline Button:**
```css
Background: transparent
Border: 2px solid var(--primary-700)
Color: var(--primary-700)
```

### Cards

**Product Card:**
```css
Background: white / var(--bg-secondary)
Border: 1px solid var(--border-light)
Border-radius: 12px
Shadow: var(--shadow-md)
Hover: translateY(-4px) + enhanced shadow
Transition: 200ms ease-out
```

**Elevated Card:**
```css
Background: var(--bg-elevated)
Shadow: var(--shadow-lg)
Use for modals, overlays, important content
```

### Badges

**Price Badge (Best Price):**
```css
Light: background #dcfce7, color #15803d
Dark: background #14532d, color #86efac
Padding: 4px 10px
Border-radius: 6px
Font-size: 0.85rem
Font-weight: 600
```

---

## 📐 Spacing System

Based on 8px grid:

```
xs:  4px   (0.25rem)
sm:  8px   (0.5rem)
md:  16px  (1rem)
lg:  24px  (1.5rem)
xl:  32px  (2rem)
2xl: 48px  (3rem)
3xl: 64px  (4rem)
```

**Usage Guidelines:**
- Component padding: 12-20px (sm-md)
- Section spacing: 32-48px (xl-2xl)
- Page margins: 48-64px (2xl-3xl)
- Consistent vertical rhythm

---

## 🎬 Animations & Transitions

### Timing
- **Fast**: 150ms - Small UI changes, hover states
- **Base**: 200ms - Standard transitions
- **Slow**: 300ms - Modal animations, larger movements
- **Slower**: 500ms - Page transitions, complex animations

### Easing
- **Ease-out**: Default for most UI (cubic-bezier(0, 0, 0.2, 1))
- **Ease-in-out**: For bidirectional animations
- **Ease-in**: For exit animations

### Common Animations
```css
/* Fade In */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Slide Up */
@keyframes slide-up {
  from { 
    transform: translateY(10px);
    opacity: 0;
  }
  to { 
    transform: translateY(0);
    opacity: 1;
  }
}

/* Scale In */
@keyframes scale-in {
  from { 
    transform: scale(0.95);
    opacity: 0;
  }
  to { 
    transform: scale(1);
    opacity: 1;
  }
}
```

---

## 🌍 RTL/LTR Support

### Automatic Direction Switching

The theme automatically handles RTL for Arabic and LTR for English:

```javascript
// Automatic handling in layout
<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
```

### CSS Logical Properties

Use logical properties instead of directional ones:

```css
/* ✅ Good - Works for both RTL/LTR */
margin-inline-start: 1rem;
padding-inline-end: 2rem;
border-inline-start: 1px solid;

/* ❌ Avoid - Breaks in RTL */
margin-left: 1rem;
padding-right: 2rem;
border-left: 1px solid;
```

### Icons and Images

```css
/* Auto-flip icons in RTL */
[dir="rtl"] .icon-arrow {
  transform: scaleX(-1);
}

/* Don't flip product images */
.product-image {
  transform: none !important;
}
```

---

## ♿ Accessibility

### Color Contrast
- **AA Standard**: Minimum 4.5:1 for normal text
- **AAA Standard**: 7:1 for enhanced accessibility
- All text meets WCAG 2.1 AA standards

### Focus States
```css
:focus-visible {
  outline: 2px solid var(--primary-500);
  outline-offset: 2px;
  border-radius: 4px;
}
```

### Interactive Elements
- Minimum touch target: 44x44px
- Clear hover states
- Keyboard navigation support
- Screen reader friendly labels

---

## 📱 Responsive Design

### Breakpoints

```css
sm:  640px   /* Mobile landscape */
md:  768px   /* Tablet */
lg:  1024px  /* Desktop */
xl:  1280px  /* Large desktop */
2xl: 1536px  /* Extra large */
```

### Mobile-First Approach

```css
/* Base: Mobile styles */
.container { padding: 1rem; }

/* Tablet and up */
@media (min-width: 768px) {
  .container { padding: 2rem; }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .container { padding: 3rem; }
}
```

---

## 🎯 Usage Examples

### Product Price Display
```jsx
<div className="text-2xl font-bold text-primary-700 dark:text-primary-400">
  4,299 SAR
</div>
<span className="inline-block px-2.5 py-1 text-sm font-semibold rounded-md
               bg-success-light text-success-dark
               dark:bg-success-light dark:text-success-dark">
  Best Price
</span>
```

### Comparison Card
```jsx
<div className="bg-white dark:bg-neutral-900 
                border border-neutral-200 dark:border-neutral-800
                rounded-xl shadow-md hover:shadow-lg
                transition-all duration-200 hover:-translate-y-1">
  {/* Card content */}
</div>
```

### CTA Button
```jsx
<button className="px-6 py-3 bg-primary-700 dark:bg-primary-500 
                   text-white font-medium rounded-lg
                   hover:bg-primary-800 dark:hover:bg-primary-600
                   transform hover:-translate-y-0.5
                   transition-all duration-200 shadow-md hover:shadow-lg">
  Compare Prices
</button>
```

---

## 📊 Performance Considerations

1. **Lazy Load Colors**: Only load colors used on current page
2. **CSS Variables**: Instant theme switching without rerender
3. **Minimal Animation**: Only animate transform and opacity for 60fps
4. **Optimized Fonts**: Subset fonts for Arabic and English only
5. **Critical CSS**: Inline critical styles for faster FCP

---

## 🚀 Implementation Checklist

- [ ] Install required fonts (Inter, Noto Sans Arabic, Cairo)
- [ ] Configure Tailwind with theme colors
- [ ] Set up CSS variables in globals.css
- [ ] Implement theme switcher component
- [ ] Add RTL/LTR detection and switching
- [ ] Test all components in both modes
- [ ] Verify WCAG 2.1 AA compliance
- [ ] Test on multiple devices and browsers
- [ ] Optimize font loading
- [ ] Set up dark mode persistence

---

## 📞 Support

For questions or clarifications about the design system, refer to:
- Theme preview: `theme-preview.html`
- Configuration: `theme-config.ts`
- Tailwind config: `tailwind.config.ts`
- Global styles: `globals.css`

---

**Version**: 1.0.0  
**Last Updated**: October 2025  
**Designed for**: Tawveeri Price Comparison Platform
