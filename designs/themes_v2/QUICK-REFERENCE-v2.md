# Tawveeri Quick Reference - Price Comparison Theme

## 🎨 Core Colors (Copy-Paste Ready)

### Light Mode
```css
/* Primary - Trust */
Blue:       #2563eb   /* CTAs, Links */

/* Success - SAVINGS (Most Important!) */
Green:      #22c55e   /* Best Price, Save X SAR */
Green-BG:   #f0fdf4   /* Highlight backgrounds */

/* Urgency - Deals */
Orange:     #f97316   /* Hot Deals, Limited Time */

/* Featured - Premium */
Amber:      #eab308   /* Featured stores */

/* Neutrals */
Text:       #18181b   /* Main text */
Text-2:     #52525b   /* Secondary */
BG:         #ffffff   /* Background */
BG-2:       #f4f4f5   /* Alt background */
Border:     #e4e4e7   /* Dividers */
```

### Dark Mode
```css
Blue:       #3b82f6   /* Brighter for dark */
Green:      #4ade80   /* Vibrant savings */
Green-BG:   #14532d   /* Dark green highlight */
Orange:     #fb923c   /* Brighter orange */
Amber:      #eab308   /* Same amber */
Text:       #fafafa   /* Main text */
Text-2:     #d4d4d8   /* Secondary */
BG:         #09090b   /* Deep black */
BG-2:       #18181b   /* Alt background */
Border:     #27272a   /* Dividers */
```

---

## 💰 Price Display Patterns

### Current Price (Large & Bold)
```jsx
<div className="text-4xl font-bold text-neutral-900 dark:text-neutral-50"
     style={{ fontFeatureSettings: "'tnum'" }}>
  3,299 SAR
</div>
```

### Price with Strikethrough
```jsx
<div className="flex items-baseline gap-3">
  <span className="text-4xl font-bold text-neutral-900 dark:text-neutral-50">
    3,299 SAR
  </span>
  <span className="text-xl text-neutral-500 line-through">
    3,799 SAR
  </span>
</div>
```

### Savings Badge (GREEN - Most Important!)
```jsx
<div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
                bg-success-100 text-success-700
                dark:bg-success-900 dark:text-success-300
                font-semibold text-sm">
  💰 Save 500 SAR
</div>
```

### Best Price Badge
```jsx
<div className="inline-block px-2.5 py-1 rounded-md
                bg-success-500 text-white font-semibold text-sm">
  ✓ Best Price
</div>
```

### Hot Deal Badge (with pulse)
```jsx
<div className="inline-block px-2.5 py-1 rounded-md
                bg-warning-500 text-white font-semibold text-sm
                animate-pulse">
  🔥 Hot Deal
</div>
```

---

## 🏪 Comparison Cards

### Best Price Card (GREEN HIGHLIGHT)
```jsx
<div className="rounded-xl p-6 border-2 transition-all duration-200
                border-success-500 bg-success-50
                dark:border-success-500 dark:bg-success-950
                hover:shadow-xl hover:-translate-y-1">
  
  <div className="inline-block px-2.5 py-1 rounded-md mb-3
                  bg-success-500 text-white font-semibold text-sm">
    ✓ Best Price
  </div>
  
  <h3 className="text-xl font-semibold mb-4">Extra Store</h3>
  
  <div className="flex items-baseline gap-3 mb-3">
    <span className="text-4xl font-bold">3,299 SAR</span>
    <span className="text-lg text-neutral-500 line-through">3,799 SAR</span>
  </div>
  
  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg mb-6
                  bg-success-100 text-success-700 font-semibold">
    💰 Save 500 SAR
  </div>
  
  <button className="w-full px-6 py-3 bg-primary-600 text-white
                     rounded-lg font-semibold hover:-translate-y-1
                     transition-all duration-200 shadow-md hover:shadow-lg">
    View at Extra →
  </button>
</div>
```

### Regular Price Card
```jsx
<div className="rounded-xl p-6 border-2 transition-all duration-200
                border-neutral-200 bg-white
                dark:border-neutral-800 dark:bg-neutral-900
                hover:shadow-lg hover:-translate-y-1">
  
  {/* Optional: Hot Deal Badge */}
  <div className="inline-block px-2.5 py-1 rounded-md mb-3
                  bg-warning-500 text-white font-semibold text-sm animate-pulse">
    🔥 Hot Deal
  </div>
  
  <h3 className="text-xl font-semibold mb-4">Jarir Bookstore</h3>
  
  <div className="flex items-baseline gap-3 mb-3">
    <span className="text-4xl font-bold">3,399 SAR</span>
    <span className="text-lg text-neutral-500 line-through">3,999 SAR</span>
  </div>
  
  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg mb-6
                  bg-success-100 text-success-700 font-semibold">
    💰 Save 600 SAR
  </div>
  
  <button className="w-full px-6 py-3 bg-primary-600 text-white
                     rounded-lg font-semibold hover:-translate-y-1
                     transition-all duration-200 shadow-md hover:shadow-lg">
    View at Jarir →
  </button>
</div>
```

---

## 📊 Comparison Table

```jsx
<table className="w-full border-collapse rounded-lg overflow-hidden">
  <thead>
    <tr className="bg-neutral-100 dark:bg-neutral-800">
      <th className="px-4 py-3 text-left font-semibold">Store</th>
      <th className="px-4 py-3 text-left font-semibold">Price</th>
      <th className="px-4 py-3 text-left font-semibold">Savings</th>
      <th className="px-4 py-3 text-left font-semibold">Delivery</th>
    </tr>
  </thead>
  <tbody>
    {/* Best price row - GREEN HIGHLIGHT */}
    <tr className="bg-success-50 dark:bg-success-950 font-semibold
                   text-success-700 dark:text-success-300">
      <td className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        Extra
      </td>
      <td className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        3,299 SAR
      </td>
      <td className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        500 SAR
      </td>
      <td className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        Free
      </td>
    </tr>
    
    {/* Regular rows */}
    <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-900">
      <td className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        Jarir
      </td>
      <td className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        3,399 SAR
      </td>
      <td className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        400 SAR
      </td>
      <td className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        25 SAR
      </td>
    </tr>
  </tbody>
</table>
```

---

## 🎯 Buttons

### Primary CTA (View at Store)
```jsx
<button className="w-full px-6 py-3 
                   bg-primary-600 hover:bg-primary-700
                   dark:bg-primary-500 dark:hover:bg-primary-600
                   text-white font-semibold rounded-lg
                   shadow-md hover:shadow-lg
                   transform hover:-translate-y-1
                   transition-all duration-200">
  View at Store →
</button>
```

### Secondary Button (Compare)
```jsx
<button className="px-6 py-3 
                   border-2 border-primary-600 dark:border-primary-500
                   text-primary-600 dark:text-primary-400
                   font-semibold rounded-lg
                   hover:bg-primary-50 dark:hover:bg-primary-950
                   transition-all duration-200">
  Compare Prices
</button>
```

### Icon Button (Wishlist)
```jsx
<button className="p-3 rounded-lg
                   bg-neutral-100 hover:bg-neutral-200
                   dark:bg-neutral-800 dark:hover:bg-neutral-700
                   transition-colors duration-200">
  <HeartIcon className="w-5 h-5" />
</button>
```

---

## 🔔 Status Badges

### In Stock (Green)
```jsx
<span className="inline-block px-2 py-1 rounded text-xs font-semibold
                 bg-success-100 text-success-700
                 dark:bg-success-900 dark:text-success-300">
  In Stock
</span>
```

### Out of Stock (Red)
```jsx
<span className="inline-block px-2 py-1 rounded text-xs font-semibold
                 bg-error-100 text-error-700
                 dark:bg-error-900 dark:text-error-300">
  Out of Stock
</span>
```

### Limited Stock (Orange)
```jsx
<span className="inline-block px-2 py-1 rounded text-xs font-semibold
                 bg-warning-100 text-warning-700
                 dark:bg-warning-900 dark:text-warning-300">
  Only 3 Left
</span>
```

### Featured Store (Amber)
```jsx
<span className="inline-block px-2 py-1 rounded text-xs font-semibold
                 bg-featured-100 text-featured-700
                 dark:bg-featured-900 dark:text-featured-300">
  Featured
</span>
```

---

## 🌍 RTL/LTR Support

```jsx
// Use logical properties - ALWAYS!

// ✅ CORRECT
className="ms-4"  // margin-start (auto RTL/LTR)
className="me-4"  // margin-end
className="ps-4"  // padding-start
className="pe-4"  // padding-end

// ❌ WRONG - Breaks in RTL
className="ml-4"  // Don't use left/right
className="mr-4"
```

---

## 📱 Responsive Grid

```jsx
// Mobile: 1 column, Tablet: 2, Desktop: 3, Large: 4
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 
                gap-4 md:gap-6">
  {products.map(product => <ProductCard key={product.id} {...product} />)}
</div>
```

---

## 💡 Common Patterns

### Price Comparison Container
```jsx
<div className="space-y-4">
  {/* Best price always first */}
  <ComparisonCard isBestPrice={true} {...bestPriceStore} />
  
  {/* Other stores sorted by price */}
  {otherStores.map(store => (
    <ComparisonCard key={store.id} {...store} />
  ))}
</div>
```

### Daily Deals Section
```jsx
<section className="py-8">
  <h2 className="text-3xl font-bold mb-6">
    🔥 Hot Deals Today
  </h2>
  
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {deals.map(deal => (
      <DealCard key={deal.id} {...deal} urgencyBadge />
    ))}
  </div>
</section>
```

### Price History Chart Container
```jsx
<div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
  <h3 className="text-lg font-semibold mb-4">Price History</h3>
  
  {/* Chart component here */}
  
  <div className="mt-4 flex items-center gap-2">
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
                    bg-success-100 text-success-700 font-semibold text-sm">
      ↓ Price dropped by 500 SAR this month
    </div>
  </div>
</div>
```

---

## 🎨 CSS Variables Quick Access

```css
/* Use these in your CSS */
var(--primary-600)     /* Trust blue */
var(--success-500)     /* Savings green */
var(--warning-500)     /* Urgency orange */
var(--featured-500)    /* Premium amber */

var(--bg-primary)      /* Main background */
var(--text-primary)    /* Main text */
var(--border-light)    /* Borders */

var(--shadow-md)       /* Standard shadow */
var(--radius-lg)       /* Border radius */
```

---

## ⚡ Performance Tips

1. **Tabular Numbers**: Always use for prices
   ```css
   font-feature-settings: 'tnum';
   ```

2. **Animations**: Only transform and opacity for 60fps
   ```css
   transition: transform 200ms, opacity 200ms;
   ```

3. **Lazy Load**: Comparison cards below the fold

4. **Memoize**: Price calculations and comparisons

---

## ✅ Component Checklist

Every comparison component should have:
- [ ] Clear current price (large, bold)
- [ ] Savings amount (GREEN badge)
- [ ] Best price indicator (if applicable)
- [ ] CTA to store (prominent button)
- [ ] Strikethrough original price (if discount)
- [ ] Works in both light/dark mode
- [ ] Supports RTL (Arabic) layout
- [ ] Mobile-responsive
- [ ] Touch-friendly (44px min)
- [ ] Accessible (WCAG AA)

---

## 🚀 Priority Hierarchy

When designing any component, prioritize in this order:

1. **Savings Amount** → GREEN, most visible
2. **Current Price** → Large, bold, scannable
3. **Best Price Indicator** → Clear badge
4. **CTA Button** → Easy to click
5. **Store Name** → Clear but secondary
6. **Additional Info** → Specs, delivery, etc.

---

**Remember**: This is a SAVINGS platform. GREEN should be everywhere users save money!

---

**Files**:
- Full Docs: `DESIGN-SYSTEM-v2.md`
- Preview: `theme-preview-comparison.html`
- Config: `theme-config.ts`
- Styles: `globals.css`
