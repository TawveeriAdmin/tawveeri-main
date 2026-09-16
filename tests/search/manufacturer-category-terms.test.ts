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
  const verified = (category: string, attrs: Record<string, unknown> = {}) => ({
    category, model_number: 'COMPLETE123', tps_identity_key: 'manufacturer|MODEL:COMPLETE123',
    attributes: { manufacturer_model: 'COMPLETE123', source: 'progressive', parser_version: `${category}-v1`, ...attrs },
  });
  it('recovers the tablet noun for a verified Galaxy Tab-style title', () => {
    const terms = manufacturerCategoryTerms(verified('tablet'));
    expect(terms).toContain('تابلت');
    expect(terms).toContain('tablet');
  });
  it('does not trust a category that contradicts its recorded parser family', () => {
    expect(manufacturerCategoryTerms(verified('tablet', { parser_version: 'mobile-v1' }))).toBe('');
  });
  it('folds Arabic category nouns just like the shopper query', () => {
    expect(manufacturerCategoryTerms(verified('smartwatch'))).toContain('ساعه');
    expect(manufacturerCategoryTerms(verified('refrigerator'))).toContain('ثلاجه');
    expect(manufacturerCategoryTerms(verified('washing_machine', { is_dryer_only: false }))).toContain('غساله');
  });
  it('separates washing machines and standalone dryers and rejects unknown subtype evidence', () => {
    expect(manufacturerCategoryTerms(verified('washing_machine', { is_dryer_only: false }))).toContain('washing machine');
    const dryer = manufacturerCategoryTerms(verified('washing_machine', { is_dryer_only: true }));
    expect(dryer).toContain('dryer');
    expect(dryer).not.toContain('washer');
    expect(dryer).not.toContain('washing');
    expect(manufacturerCategoryTerms(verified('washing_machine'))).toBe('');
  });
  it('recovers the Arabic earphone noun without labeling speakers as headphones', () => {
    expect(manufacturerCategoryTerms(verified('audio', { type: 'earbuds' }))).toContain('سماعات');
    expect(manufacturerCategoryTerms(verified('audio', { type: 'speaker' }))).not.toContain('headphones');
    expect(manufacturerCategoryTerms(verified('accessories', { type: 'earbuds' }))).toBe('');
  });
  it('uses an explicit earphone title only with verified audio identity and no contradictory subtype', () => {
    const row = { ...verified('audio'), name_en: 'Samsung Type-C Earphones' };
    expect(manufacturerCategoryTerms(row)).toContain('سماعات');
    expect(manufacturerCategoryTerms({ ...row, attributes: { ...row.attributes, type: 'speaker' } })).not.toContain('earphones');
    expect(manufacturerCategoryTerms({ ...verified('accessories'), name_en: 'Earphones case' })).toBe('');
  });
});
