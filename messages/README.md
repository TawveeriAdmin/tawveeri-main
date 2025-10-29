# Internationalization (i18n) - Message Files

This directory contains all translation files for the Tawveeri platform, organized by locale and namespace.

## Structure

```
messages/
├── ar/                     # Arabic translations
│   ├── common.json        # Shared across all pages (nav, footer, buttons)
│   ├── landing.json       # Landing page specific
│   └── [future namespaces]
└── en/                     # English translations
    ├── common.json        # Shared across all pages
    ├── landing.json       # Landing page specific
    └── [future namespaces]
```

## Namespace Organization

### `common.json`
Contains translations used across multiple pages:
- App branding (name, logo text)
- Navigation items
- Common buttons (search, subscribe, etc.)
- Footer content
- Shared UI elements

### `landing.json`
Contains translations specific to the landing page:
- Hero section
- Features
- How it works
- Testimonials
- CTA sections
- Statistics

## Future Namespaces (Add as needed)

### `auth.json` - Authentication pages
```json
{
  "login": { ... },
  "signup": { ... },
  "forgotPassword": { ... },
  "resetPassword": { ... }
}
```

### `products.json` - Product pages
```json
{
  "list": { ... },
  "detail": { ... },
  "compare": { ... },
  "filters": { ... }
}
```

### `dashboard.json` - User dashboard
```json
{
  "profile": { ... },
  "wishlist": { ... },
  "priceAlerts": { ... },
  "settings": { ... }
}
```

### `admin.json` - Admin panel
```json
{
  "users": { ... },
  "stores": { ... },
  "products": { ... },
  "analytics": { ... }
}
```

### `store.json` - Store dashboard
```json
{
  "dashboard": { ... },
  "products": { ... },
  "analytics": { ... },
  "settings": { ... }
}
```

## Adding New Namespaces

1. **Create the namespace files**:
   ```bash
   # Create for both locales
   touch messages/ar/products.json
   touch messages/en/products.json
   ```

2. **Add translations to each file**:
   ```json
   // messages/ar/products.json
   {
     "list": {
       "title": "المنتجات",
       "noResults": "لا توجد نتائج"
     }
   }
   ```

3. **Update `src/i18n.ts`** to load the new namespace:
   ```typescript
   const [common, landing, products] = await Promise.all([
     import(`../messages/${locale}/common.json`),
     import(`../messages/${locale}/landing.json`),
     import(`../messages/${locale}/products.json`), // Add this
   ]);

   return {
     messages: {
       ...common.default,
       ...landing.default,
       ...products.default, // Add this
     },
   };
   ```

4. **Use in components**:
   ```tsx
   const t = useTranslations();

   <h1>{t('list.title')}</h1>
   <p>{t('list.noResults')}</p>
   ```

## Best Practices

### 1. Naming Convention
- Use **camelCase** for keys: `searchPlaceholder`, not `search_placeholder`
- Use **nested objects** for related translations
- Keep **consistent structure** across locales

### 2. Key Organization
```json
{
  "section": {
    "subsection": {
      "key": "value"
    }
  }
}
```

### 3. When to Create a New Namespace
- **Create new** when:
  - Page has 20+ unique translations
  - Translations are only used in one feature
  - Want to lazy-load translations for performance

- **Use common** when:
  - Used across multiple pages
  - UI elements (buttons, labels)
  - Navigation/footer

### 4. Translation Guidelines
- **Be consistent**: Use same terminology across the app
- **Be concise**: Keep strings short and clear
- **Be contextual**: Add comments for ambiguous strings
- **Test RTL**: Ensure Arabic text displays correctly
- **Use placeholders**: For dynamic content (will add later)

### 5. File Size Guidelines
- Keep namespace files under 500 lines
- Split large namespaces into sub-namespaces
- Example: `products/list.json`, `products/detail.json`

## Current Translation Count

### Arabic (`ar/`)
- `common.json`: ~60 translations
- `landing.json`: ~90 translations
- **Total**: ~150 translations

### English (`en/`)
- `common.json`: ~60 translations
- `landing.json`: ~90 translations
- **Total**: ~150 translations

## Maintenance

### Adding a Translation
1. Add to both `ar/` and `en/` files
2. Test in both languages
3. Commit both files together

### Removing a Translation
1. Search codebase for usage first
2. Remove from both locale files
3. Update this README if namespace changes

### Updating a Translation
1. Find the key in the appropriate namespace
2. Update in both languages
3. Test the change in UI

## Translation Tools (Future)

Consider adding:
- [ ] Translation management platform (Lokalise, Crowdin)
- [ ] Automatic translation validation
- [ ] Missing translation detection
- [ ] Translation coverage reports
- [ ] CI/CD checks for translation parity

## Contact

For translation questions or to add new languages:
- Check the next-intl documentation
- Review the `src/i18n.ts` configuration
- Ensure all namespaces are loaded in i18n config
