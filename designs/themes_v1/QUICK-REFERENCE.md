# Tawveeri Theme - Quick Reference Card

## 🎨 Most Used Colors

### Light Mode
```css
Primary:   #3a3aca   (Royal Blue - CTAs, Links)
Gold:      #eab308   (Badges, Deals)
Teal:      #14b8a6   (Secondary Actions)
Text:      #171717   (Main text)
Text-2:    #525252   (Secondary text)
BG:        #ffffff   (Main background)
BG-2:      #fafafa   (Secondary background)
Border:    #e5e5e5   (Dividers, cards)
```

### Dark Mode
```css
Primary:   #5f6ff1   (Brighter blue for dark)
Gold:      #eab308   (Same gold)
Teal:      #14b8a6   (Same teal)
Text:      #fafafa   (Main text)
Text-2:    #d4d4d4   (Secondary text)
BG:        #0a0a0a   (Main background)
BG-2:      #171717   (Secondary background)
Border:    #262626   (Dividers, cards)
```

---

## 🎯 Common Tailwind Classes

### Buttons
```jsx
// Primary Button
className="px-6 py-3 bg-primary-700 dark:bg-primary-500 text-white 
           rounded-lg font-medium shadow-md hover:shadow-lg
           hover:-translate-y-0.5 transition-all duration-200"

// Secondary (Gold) Button
className="px-6 py-3 bg-secondary-500 text-neutral-950 
           rounded-lg font-medium shadow-md hover:shadow-lg
           hover:-translate-y-0.5 transition-all duration-200"

// Outline Button
className="px-6 py-3 border-2 border-primary-700 dark:border-primary-500
           text-primary-700 dark:text-primary-500 rounded-lg font-medium
           hover:bg-primary-50 dark:hover:bg-primary-950
           transition-all duration-200"
```

### Cards
```jsx
// Basic Card
className="bg-white dark:bg-neutral-900 border border-neutral-200 
           dark:border-neutral-800 rounded-xl p-6 shadow-md"

// Hover Card
className="bg-white dark:bg-neutral-900 border border-neutral-200 
           dark:border-neutral-800 rounded-xl p-6 shadow-md
           hover:shadow-lg hover:-translate-y-1 transition-all duration-200"

// Product Card
className="bg-white dark:bg-neutral-900 border border-neutral-200 
           dark:border-neutral-800 rounded-xl overflow-hidden
           shadow-md hover:shadow-xl hover:-translate-y-1 
           transition-all duration-200 cursor-pointer"
```

### Typography
```jsx
// Page Heading
className="text-4xl font-bold text-neutral-900 dark:text-neutral-50"

// Section Heading
className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50"

// Body Text
className="text-base text-neutral-700 dark:text-neutral-300"

// Secondary Text
className="text-sm text-neutral-600 dark:text-neutral-400"

// Link
className="text-primary-700 dark:text-primary-400 hover:underline"
```

### Badges
```jsx
// Success Badge (Best Price)
className="inline-block px-2.5 py-1 text-sm font-semibold rounded-md
           bg-success-light text-success-dark
           dark:bg-success-light dark:text-success-dark"

// Gold Badge (Deal)
className="inline-block px-2.5 py-1 text-sm font-semibold rounded-md
           bg-secondary-100 text-secondary-900
           dark:bg-secondary-900 dark:text-secondary-100"

// Info Badge
className="inline-block px-2.5 py-1 text-sm font-semibold rounded-md
           bg-info-light text-info-dark
           dark:bg-info-light dark:text-info-dark"
```

### Inputs
```jsx
// Text Input
className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-700
           rounded-lg bg-white dark:bg-neutral-900
           text-neutral-900 dark:text-neutral-50
           focus:ring-2 focus:ring-primary-500 focus:border-transparent
           transition-all duration-200"

// Search Input
className="w-full px-4 py-3 ps-12 border border-neutral-300 
           dark:border-neutral-700 rounded-full
           bg-white dark:bg-neutral-900
           text-neutral-900 dark:text-neutral-50
           focus:ring-2 focus:ring-primary-500 focus:border-transparent
           transition-all duration-200"
```

---

## 🌍 RTL/LTR Quick Tips

```jsx
// Use logical properties
className="ms-4"        // margin-start (left in LTR, right in RTL)
className="me-4"        // margin-end (right in LTR, left in RTL)
className="ps-4"        // padding-start
className="pe-4"        // padding-end

// Avoid directional
❌ className="ml-4"     // Don't use left/right
❌ className="mr-4"
```

---

## 📏 Spacing Quick Reference

```jsx
xs:  p-1    (4px)
sm:  p-2    (8px)
md:  p-4    (16px)
lg:  p-6    (24px)
xl:  p-8    (32px)
2xl: p-12   (48px)
3xl: p-16   (64px)
```

---

## 🎬 Animation Classes

```jsx
// Fade In
className="animate-fade-in"

// Slide Up
className="animate-slide-up"

// Hover Effects
className="transition-all duration-200 hover:-translate-y-1"
className="transition-transform duration-200 hover:scale-105"
```

---

## 📱 Responsive Patterns

```jsx
// Mobile First
className="text-base md:text-lg lg:text-xl"
className="p-4 md:p-6 lg:p-8"
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"

// Hide/Show on Breakpoints
className="hidden md:block"       // Hide on mobile, show on tablet+
className="block md:hidden"       // Show on mobile, hide on tablet+
```

---

## 💰 Price Display Pattern

```jsx
<div className="space-y-2">
  <div className="text-3xl font-bold text-primary-700 dark:text-primary-400">
    4,299 SAR
  </div>
  <div className="flex items-center gap-2">
    <span className="text-sm text-neutral-500 line-through">
      4,799 SAR
    </span>
    <span className="inline-block px-2 py-1 text-xs font-semibold 
                     rounded-md bg-success-light text-success-dark">
      Save 500 SAR
    </span>
  </div>
</div>
```

---

## 🏪 Store Link Pattern

```jsx
<a href={storeUrl}
   target="_blank"
   rel="noopener noreferrer"
   className="inline-flex items-center gap-2 px-4 py-2
              bg-primary-700 dark:bg-primary-500 text-white
              rounded-lg font-medium shadow-md hover:shadow-lg
              hover:-translate-y-0.5 transition-all duration-200">
  View at Store
  <svg>→</svg>
</a>
```

---

## 📊 Comparison Table Pattern

```jsx
<table className="w-full border-collapse">
  <thead>
    <tr className="bg-neutral-100 dark:bg-neutral-800">
      <th className="px-4 py-3 text-start font-semibold
                     text-neutral-900 dark:text-neutral-50">
        Specification
      </th>
      <th className="px-4 py-3 text-start font-semibold
                     text-neutral-900 dark:text-neutral-50">
        Value
      </th>
    </tr>
  </thead>
  <tbody>
    <tr className="border-b border-neutral-200 dark:border-neutral-700">
      <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
        Display
      </td>
      <td className="px-4 py-3 text-neutral-900 dark:text-neutral-50
                     font-medium">
        6.7" Super Retina XDR
      </td>
    </tr>
  </tbody>
</table>
```

---

## 🎭 Theme Toggle Pattern

```jsx
// Theme Toggle Button
<button
  onClick={toggleTheme}
  className="p-2 rounded-lg bg-neutral-200 dark:bg-neutral-800
             hover:bg-neutral-300 dark:hover:bg-neutral-700
             transition-colors duration-200"
  aria-label="Toggle theme">
  {isDark ? '☀️' : '🌙'}
</button>
```

---

## ✅ Checklist for Every Component

- [ ] Works in both light and dark mode
- [ ] Supports RTL (Arabic) and LTR (English)
- [ ] Has proper hover/focus states
- [ ] Uses consistent spacing (8px grid)
- [ ] Has smooth transitions (200ms default)
- [ ] Meets accessibility standards (focus visible, touch targets)
- [ ] Responsive on mobile, tablet, desktop
- [ ] Uses semantic HTML
- [ ] Includes proper ARIA labels

---

## 🔧 CSS Variables

```css
/* Quick access */
var(--primary-700)
var(--secondary-500)
var(--accent-500)
var(--bg-primary)
var(--bg-secondary)
var(--text-primary)
var(--text-secondary)
var(--border-light)
var(--shadow-md)
var(--radius-lg)
```

---

## 📦 Component Starter Template

```jsx
export function ComponentName({ className, ...props }) {
  return (
    <div
      className={cn(
        // Base styles
        "bg-white dark:bg-neutral-900",
        "border border-neutral-200 dark:border-neutral-800",
        "rounded-xl p-6",
        "shadow-md",
        // Interactive
        "transition-all duration-200",
        // Custom
        className
      )}
      {...props}
    >
      {/* Content */}
    </div>
  );
}
```

---

**Pro Tip**: Keep this file open while developing! 🚀

**Files**:
- Full docs: `DESIGN-SYSTEM.md`
- Preview: `theme-preview.html`
- Config: `theme-config.ts` & `tailwind.config.ts`
- Styles: `globals.css`
