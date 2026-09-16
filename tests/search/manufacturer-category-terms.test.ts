import { manufacturerCategoryTerms, productQueryText } from '../../src/lib/search/manufacturer-category-terms';

describe('manufacturer-evidenced phone noun', () => {
  const row = { category: 'mobile', model_number: 'SM-A276BLIIMEA', tps_identity_key: 'samsung|MODEL:SM-A276BLIIMEA',
    attributes: { manufacturer_model: 'SM-A276BLIIMEA' } };
  it('recognizes a phone whose official title omits phone/smartphone without changing its title', () => {
    const product = { name_en: 'Galaxy A27', brand: 'Samsung', _verified_category_terms: manufacturerCategoryTerms(row) };
    expect(productQueryText(product)).toContain('smartphone');
    expect(productQueryText(product)).toContain('جوال');
    expect(product.name_en).toBe('Galaxy A27');
  });
  it('rejects a weak category tag, mismatched model, or a different device category', () => {
    expect(manufacturerCategoryTerms({ ...row, attributes: {} })).toBe('');
    expect(manufacturerCategoryTerms({ ...row, model_number: 'OTHER' })).toBe('');
    expect(manufacturerCategoryTerms({ ...row, category: 'tablet' })).toBe('');
  });
  it('uses the same evidence rule for any manufacturer without commercial ranking data', () => {
    expect(manufacturerCategoryTerms({ category: 'mobile', model_number: 'VERIFIED123',
      tps_identity_key: 'other|MODEL:VERIFIED123', attributes: { manufacturer_model: 'VERIFIED123' } })).toContain('phone');
  });
});
