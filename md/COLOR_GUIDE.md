# Tawveeri Color System Guide

## ⚠️ CRITICAL: Preventing OKLCH Color Issues

This project uses **Tailwind CSS v4**, which has a critical difference from v3:

### The Problem
Tailwind v4 generates colors using the **OKLCH color space** for any color NOT defined in the `@theme` section of `globals.css`. OKLCH colors can render **unexpectedly dark** even in light mode, especially in gradients.

### The Solution
**ALL colors used in the application MUST be defined in `src/app/globals.css` in the `@theme` section.**

---

## Required Colors (Already Defined)

### Base Colors
- `white`, `black`

### Gray Scale (50-950)
- Required for ALL UI elements
- Used extensively in text, backgrounds, borders

### Standard Colors (50-950)
- `blue` - Used in gradients
- `green` - Used in gradients
- `amber` - Used in gradients

### Brand Colors (50-950)
- `primary` - Trust Blue (brand color)
- `success` - Emerald Green (best price indicators)
- `warning` - Red (hot deals, urgency)
- `featured` - Amber (premium stores)

---

## Before Adding New Colors

### ✅ DO THIS:
1. Check if the color exists in `@theme` section of `globals.css`
2. If NOT, add the FULL color scale (50-950) to `@theme`
3. Use standard Tailwind color values (from Tailwind docs)
4. Never rely on Tailwind's default color generation

### ❌ DON'T DO THIS:
1. ❌ Use colors not defined in `@theme` (e.g., `bg-purple-500` if purple isn't defined)
2. ❌ Use arbitrary color values (e.g., `bg-[#abc123]`)
3. ❌ Assume Tailwind will "just work" with undefined colors
4. ❌ Add CSS overrides with `!important` - define colors in `@theme` instead

---

## Color Usage Examples

### ✅ CORRECT - All colors defined in @theme:
```jsx
// These work perfectly because they're defined
<div className="bg-white dark:bg-gray-900">
<div className="bg-gradient-to-r from-gray-50 via-blue-100 to-primary-50">
<span className="text-gray-700 dark:text-gray-300">
```

### ❌ INCORRECT - Using undefined colors:
```jsx
// These will render as DARK OKLCH colors even in light mode!
<div className="bg-purple-500">  {/* purple not defined */}
<div className="from-indigo-50"> {/* indigo not defined */}
<span className="text-rose-600">  {/* rose not defined */}
```

---

## Gradient Color Stops

Gradients are especially sensitive! All color stops MUST be defined:

```jsx
// ✅ CORRECT
bg-gradient-to-r from-blue-50 via-green-100 to-amber-50
// All three colors (blue, green, amber) are in @theme

// ❌ INCORRECT
bg-gradient-to-r from-purple-50 via-pink-100 to-rose-50
// None of these are in @theme - will render dark!
```

---

## Adding a New Color Scale

If you need a new color (e.g., purple), add it to `@theme`:

```css
@theme {
  /* ... existing colors ... */

  /* Purple Scale - [Your use case] */
  --color-purple-50: #faf5ff;
  --color-purple-100: #f3e8ff;
  --color-purple-200: #e9d5ff;
  --color-purple-300: #d8b4fe;
  --color-purple-400: #c084fc;
  --color-purple-500: #a855f7;
  --color-purple-600: #9333ea;
  --color-purple-700: #7e22ce;
  --color-purple-800: #6b21a8;
  --color-purple-900: #581c87;
  --color-purple-950: #3b0764;
}
```

---

## Troubleshooting

### Problem: Colors look dark even in light mode
**Cause**: You're using a color not defined in `@theme`
**Solution**:
1. Search codebase for the color class (e.g., `grep -r "from-purple" src/`)
2. Either replace with a defined color, or add the color scale to `@theme`

### Problem: Gradients render incorrectly
**Cause**: One or more gradient color stops not in `@theme`
**Solution**: Check ALL color stops (`from-*`, `via-*`, `to-*`) are defined

### Problem: Dark mode colors bleeding into light mode
**Cause**: Missing the full color scale (50-950) in `@theme`
**Solution**: Add the complete color scale, not just a few shades

---

## Quick Reference: Currently Defined Colors

```
✅ white, black
✅ gray (50-950)
✅ blue (50-950)
✅ green (50-950)
✅ amber (50-950)
✅ primary (50-950)
✅ success (50-950)
✅ warning (50-950)
✅ featured (50-950)

❌ purple, pink, indigo, violet, rose, etc. - NOT DEFINED
```

---

## Testing Checklist

Before committing color changes:

- [ ] All used colors are defined in `@theme`
- [ ] Test in LIGHT mode - should be BRIGHT
- [ ] Test in DARK mode - should be DARK
- [ ] Toggle between modes rapidly - colors should switch cleanly
- [ ] Check gradients render correctly in both modes
- [ ] No OKLCH-generated dark colors appear in light mode

---

## For Future Developers

**Golden Rule**: When you see a color in Tailwind docs that you want to use, ADD IT TO `@theme` FIRST.

Do NOT assume it will work without being defined. Tailwind v4's OKLCH color generation WILL cause rendering issues if colors aren't explicitly defined in the theme.

---

**Last Updated**: $(date +%Y-%m-%d)
**Maintained By**: Development Team
