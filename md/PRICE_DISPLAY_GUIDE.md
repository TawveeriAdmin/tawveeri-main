# Price Display Guide

## Overview

All prices in the Tawveeri application are displayed using the **Saudi Riyal SVG symbol** (`/public/Saudi_Riyal_Symbol.svg`) instead of text representations like "ر.س" or "SAR".

## Component Usage

### Basic Price Display

Use the `<Price>` component for any single price display:

```tsx
import { Price } from '@/components/ui/price';

// Display a price with the SAR symbol
<Price amount={3299} />
// Output: 3,299 [SAR symbol]

// Custom styling
<Price
  amount={3299}
  className="text-2xl font-bold text-primary-600"
  symbolClassName="w-5 h-5"
/>
```

### Price with Original Price (Strikethrough)

Use the `<PriceDisplay>` component for showing current and original prices:

```tsx
import { PriceDisplay } from '@/components/ui/price';

// Display current price with crossed-out original price
<PriceDisplay
  currentPrice={3299}
  originalPrice={3799}
/>
```

### In Comparison Cards

The `ComparisonCard` component already uses the Price components:

```tsx
<PriceDisplay
  currentPrice={currentPrice}
  originalPrice={originalPrice}
/>

// Savings badge
<Badge variant="success-light">
  💰 {t('price.save')} <Price amount={savings} className="text-sm font-semibold" symbolClassName="w-3 h-3" />
</Badge>
```

## Translation Files

All price-related translations should **only contain numbers** without currency symbols:

### ✅ Correct (numbers only)
```json
{
  "saved": "800",
  "price": "3,299"
}
```

### ❌ Wrong (with currency text)
```json
{
  "saved": "800 ر.س",
  "price": "SAR 3,299"
}
```

## Utility Functions

### formatPrice()

The `formatPrice()` utility now returns only the formatted number without currency:

```typescript
import { formatPrice } from '@/lib/utils';

formatPrice(3299);  // Returns: "3,299"
```

For displaying the price with the SAR symbol, use the `<Price>` component instead.

### Legacy Function (Deprecated)

`formatPriceWithCurrency()` is kept for backwards compatibility but should not be used in new code:

```typescript
// ❌ Don't use
formatPriceWithCurrency(3299, 'ar');  // "3,299 ر.س"

// ✅ Use instead
<Price amount={3299} />
```

## Component Props

### `<Price>`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `amount` | `number` | required | The price amount to display |
| `className` | `string` | - | CSS classes for the container |
| `symbolClassName` | `string` | - | CSS classes for the SVG symbol |
| `showDecimals` | `boolean` | `false` | Show decimal places (.00) |

### `<PriceDisplay>`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `currentPrice` | `number` | required | Current/sale price |
| `originalPrice` | `number` | - | Original price (shows with strikethrough) |
| `currentClassName` | `string` | `'text-5xl font-extrabold'` | Classes for current price |
| `originalClassName` | `string` | `'text-lg text-gray-400 line-through'` | Classes for original price |
| `symbolClassName` | `string` | - | Classes for both SVG symbols |

## Examples

### Product Card Header
```tsx
<div className="flex items-baseline gap-2">
  <Price
    amount={product.price}
    className="text-4xl font-bold text-gray-900 dark:text-white"
    symbolClassName="w-5 h-5"
  />
</div>
```

### Statistics Display
```tsx
<div className="text-center">
  <div className="text-gray-600 dark:text-gray-400">Total Savings</div>
  <Price
    amount={totalSavings}
    className="text-5xl font-extrabold text-success-600"
    symbolClassName="w-8 h-8"
  />
</div>
```

### Inline Text
```tsx
<p>
  You saved <Price amount={450} className="font-semibold text-success-600" symbolClassName="w-4 h-4" /> on this purchase!
</p>
```

## Design Considerations

1. **Consistency**: Always use the SVG symbol, never text representations
2. **RTL Support**: The symbol displays correctly in both LTR and RTL layouts
3. **Dark Mode**: The SVG adapts to the current theme automatically
4. **Accessibility**: The SVG includes `alt="SAR"` for screen readers
5. **Scalability**: Use `symbolClassName` to adjust symbol size relative to text

## Migration Guide

If updating existing code that uses text currency:

### Before (text currency)
```tsx
<span>{formatPrice(3299, locale)}</span>
// or
<span>{price.toLocaleString('en-US')} ر.س</span>
```

### After (SVG symbol)
```tsx
<Price amount={3299} />
```

## Testing

When adding new price displays:
1. ✅ Test in both Arabic (RTL) and English (LTR)
2. ✅ Test in both light and dark modes
3. ✅ Verify SVG symbol appears correctly at all sizes
4. ✅ Check responsive behavior on mobile devices
5. ✅ Ensure no text currency appears anywhere
