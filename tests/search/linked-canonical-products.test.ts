import { linkRetrievedCanonicals } from '../../src/lib/search/linked-canonical-products';

describe('persisted storefront identity links', () => {
  const canonical = { product_id: 'canonical-silver', tps_identity_key: 'samsung|MODEL:SM-X236BZSEMEA' };
  it('links an actual legacy duplicate to its retrieved canonical', () => {
    expect(linkRetrievedCanonicals([{ product_id: 'legacy' }], [canonical],
      [{ id: 'legacy', canonical_product_id: 'canonical-silver' }])[0]).toEqual({
      product_id: 'legacy', tps_identity_key: canonical.tps_identity_key });
  });
  it('does not merge another variant, an unlinked merchant, or a non-retrieved canonical', () => {
    const rows = [{ product_id: 'gray' }, { product_id: 'extra-unlinked' }, { product_id: 'inactive' }];
    expect(linkRetrievedCanonicals(rows, [canonical], [
      { id: 'gray', canonical_product_id: 'canonical-gray' },
      { id: 'inactive', canonical_product_id: 'canonical-inactive' },
    ])).toEqual(rows);
  });
  it('preserves an already established identity', () => {
    const rows = [{ product_id: 'legacy', tps_identity_key: 'existing-key' }];
    expect(linkRetrievedCanonicals(rows, [canonical],
      [{ id: 'legacy', canonical_product_id: 'canonical-silver' }])).toEqual(rows);
  });
  it('links an exact retailer-declared Samsung MPN only to its retrieved manufacturer identity', () => {
    const rows = [{ product_id: 'retailer' }, { product_id: 'other-region' }, { product_id: 'other-brand' }];
    const result = linkRetrievedCanonicals(rows, [canonical], [
      { id: 'retailer', canonical_product_id: 'old-generic', brand: 'سامسونج', model: 'SM-X236BZSEMEA' },
      { id: 'other-region', canonical_product_id: null, brand: 'Samsung', model: 'SM-X236BZSEUSA' },
      { id: 'other-brand', canonical_product_id: null, brand: 'Unknown', model: 'SM-X236BZSEMEA' },
    ]);
    expect(result[0]).toMatchObject({ tps_identity_key: canonical.tps_identity_key });
    expect(result.slice(1)).toEqual(rows.slice(1));
  });
});
