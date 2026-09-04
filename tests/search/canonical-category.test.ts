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

  it('buckets large-appliance subcategories under the storefront "appliance" bucket', () => {
    for (const cat of ['refrigerator', 'washing_machine', 'dishwasher', 'vacuum']) {
      expect(toStorefrontCategory(cat)).toBe('appliance');
    }
  });

  it('buckets kitchen-appliance subcategories under the storefront "kitchen" bucket', () => {
    for (const cat of ['microwave', 'oven', 'air_fryer', 'coffee_maker', 'kettle', 'toaster', 'blender', 'cooker']) {
      expect(toStorefrontCategory(cat)).toBe('kitchen');
    }
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
