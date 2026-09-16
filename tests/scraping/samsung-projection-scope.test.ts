import { assertSamsungProjectionScope } from '../../scripts/build-tps-projection';

describe('Samsung-only projection write boundary', () => {
  it('allows only exact manufacturer identities in the scoped output', () => {
    expect(() => assertSamsungProjectionScope([{ tps_identity_key: 'samsung|MODEL:SM-R420NZAAMEA' }])).not.toThrow();
  });
  it.each(['apple|MODEL:IPHONE', 'samsung|earbuds|gray', 'lg|55|tv'])('rejects unrelated or generic output before writes: %s', key => {
    expect(() => assertSamsungProjectionScope([{ tps_identity_key: 'samsung|MODEL:SM-R420NZAAMEA' }, { tps_identity_key: key }])).toThrow('scope');
  });
});
