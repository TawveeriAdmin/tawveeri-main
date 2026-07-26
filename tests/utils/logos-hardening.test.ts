import {
  getStoreInitials,
  getStoreDisplayName,
  hasStoreLogo,
  getSearchStoreLogoPath,
} from '@/lib/logos';

// Regression for the confirmed Critical (#2): a numeric store id reached <StoreLogo> from a search
// result and crashed the ENTIRE search page with "TypeError: display.replace is not a function"
// (getStoreInitials called .replace on a number). A display helper must tolerate any input.
describe('logos helpers — non-string slug must never throw', () => {
  const bad: unknown[] = [123, 0, null, undefined, NaN, {}];

  it.each(bad)('getStoreInitials(%p) does not throw', (v) => {
    expect(() => getStoreInitials(v as string)).not.toThrow();
  });
  it.each(bad)('getStoreDisplayName(%p) does not throw and returns a string', (v) => {
    expect(() => getStoreDisplayName(v as string)).not.toThrow();
    expect(typeof getStoreDisplayName(v as string)).toBe('string');
  });
  it.each(bad)('hasStoreLogo(%p) does not throw', (v) => {
    expect(() => hasStoreLogo(v as string)).not.toThrow();
  });
  it.each(bad)('getSearchStoreLogoPath(%p) does not throw', (v) => {
    expect(() => getSearchStoreLogoPath(v as string)).not.toThrow();
  });

  it('numeric slug coerces consistently to its string form', () => {
    expect(getStoreInitials(123 as unknown as string)).toBe(getStoreInitials('123'));
  });

  it('known slugs still resolve correctly (no behavior change)', () => {
    expect(getStoreDisplayName('amazon', 'en')).toBe('Amazon SA');
    expect(getStoreDisplayName('jarir', 'ar')).toBe('مكتبة جرير');
    expect(hasStoreLogo('amazon')).toBe(true);
    expect(hasStoreLogo('najm')).toBe(false);
  });
});
