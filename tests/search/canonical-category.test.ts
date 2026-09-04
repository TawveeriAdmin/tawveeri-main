// tests/search/canonical-category.test.ts
// Amazon Campaign V1 delivery-gap fix: pins the mobile→smartphone mapping (and the rest of
// the classifier→storefront taxonomy contract) so a resolved category is never passed
// downstream under a name usage_events/campaign eligibility doesn't recognize.
import { toStorefrontCategory } from '@/lib/search/canonical-category';

describe('toStorefrontCategory', () => {
  it('maps the proven mismatch: classifier "mobile" -> storefront "smartphone"', () => {
    expect(toStorefrontCategory('mobile')).toBe('smartphone');
  });

  it('passes through categories identical in both vocabularies', () => {
    for (const cat of ['tablet', 'laptop', 'tv', 'audio', 'camera', 'air_conditioner']) {
      expect(toStorefrontCategory(cat)).toBe(cat);
    }
  });

  it('buckets NOT-YET-APPROVED-campaign large-appliance subcategories under the storefront "appliance" bucket', () => {
    for (const cat of ['refrigerator', 'washing_machine', 'dishwasher']) {
      expect(toStorefrontCategory(cat)).toBe('appliance');
    }
  });

  it('buckets NOT-YET-APPROVED-campaign kitchen-appliance subcategories under the storefront "kitchen" bucket', () => {
    for (const cat of ['microwave', 'oven', 'toaster', 'cooker']) {
      expect(toStorefrontCategory(cat)).toBe('kitchen');
    }
  });

  it('multi-category expansion: approved first-wave campaign categories stay distinct (identity/renamed), never bucketed', () => {
    expect(toStorefrontCategory('vacuum')).toBe('vacuum');
    expect(toStorefrontCategory('air_fryer')).toBe('air_fryer');
    expect(toStorefrontCategory('coffee_maker')).toBe('coffee_machine');
    expect(toStorefrontCategory('kettle')).toBe('electric_kettle');
    expect(toStorefrontCategory('blender')).toBe('blender');
  });

  it('one category never collapses into another — every approved first-wave value is unique', () => {
    const approved = ['tablet', 'tv', 'smartphone', 'air_fryer', 'coffee_machine', 'vacuum', 'electric_kettle', 'blender'];
    const resolved = ['tablet', 'tv', 'mobile', 'air_fryer', 'coffee_maker', 'vacuum', 'kettle', 'blender'].map(toStorefrontCategory);
    expect(resolved).toEqual(approved);
    expect(new Set(resolved).size).toBe(approved.length);
  });

  it('returns null for null/undefined/empty input — never fabricates a category', () => {
    expect(toStorefrontCategory(null)).toBeNull();
    expect(toStorefrontCategory(undefined)).toBeNull();
    expect(toStorefrontCategory('')).toBeNull();
  });

  it('returns null for a classifier category with no confident storefront equivalent', () => {
    expect(toStorefrontCategory('air_purifier')).toBeNull();
    expect(toStorefrontCategory('some_future_category_nobody_mapped_yet')).toBeNull();
  });
});
