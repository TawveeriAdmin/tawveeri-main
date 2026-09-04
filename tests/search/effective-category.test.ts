// tests/search/effective-category.test.ts
// Amazon Campaign V1 delivery-gap fix: pins the category precedence contract —
// explicit user selection > trusted server-resolved category > null/unknown.
import { resolveEffectiveCategory } from '@/app/[locale]/(public)/search/search-client';

describe('resolveEffectiveCategory', () => {
  it('an explicit user category selection always wins over a resolved category', () => {
    expect(resolveEffectiveCategory('laptop', 'tablet')).toBe('laptop');
  });

  it('falls back to the server-resolved category when no explicit filter is selected', () => {
    expect(resolveEffectiveCategory('all', 'tablet')).toBe('tablet');
  });

  it('stays null (unknown) when neither an explicit filter nor a resolved category exists', () => {
    expect(resolveEffectiveCategory('all', null)).toBeNull();
  });

  it('never fabricates a category for an ambiguous query even with no explicit filter', () => {
    // resolvedCategoryFromApi is null exactly when the server itself could not resolve one —
    // this function must not invent a fallback of its own.
    expect(resolveEffectiveCategory('all', null)).toBeNull();
  });
});
