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

// Regression for the founder-reported «اكاكسترا» on every Extra card in search results.
// Search rows carry the store's Arabic DISPLAY NAME where a slug is expected. Unresolved,
// "اكسترا" missed the logo map, so the initials fallback ran and produced "اك" — the first
// two characters of the very name printed beside it. The two rendered as one corrupted word.
describe('store identity — a display name or numeric id resolves to the canonical slug', () => {
  const aliases: [string, string][] = [
    ['اكسترا', 'extra'], ['إكسترا', 'extra'], ['4', 'extra'],
    ['أمازون السعودية', 'amazon'], ['2', 'amazon'],
    ['مكتبة جرير', 'jarir'], ['نون', 'noon'], ['المنيع', 'almanea'],
  ];

  it.each(aliases)('%s finds the same logo as its slug (%s)', (alias, slug) => {
    expect(hasStoreLogo(alias)).toBe(hasStoreLogo(slug));
    expect(getSearchStoreLogoPath(alias)).toBe(getSearchStoreLogoPath(slug));
    expect(getStoreDisplayName(alias, 'ar')).toBe(getStoreDisplayName(slug, 'ar'));
    expect(getStoreDisplayName(alias, 'en')).toBe(getStoreDisplayName(slug, 'en'));
  });

  it('Extra resolves to the bundled logo instead of falling back to initials', () => {
    expect(hasStoreLogo('اكسترا')).toBe(true);
    expect(getSearchStoreLogoPath('اكسترا')).toBe('/logos/extra.png');
  });

  it('initials are never a prefix of the Arabic name shown beside them', () => {
    // Latin-only, so the badge can never duplicate the start of the adjacent Arabic label.
    expect(getStoreInitials('اكسترا')).toBe('EX');
    for (const [alias] of aliases) {
      const initials = getStoreInitials(alias);
      const name = getStoreDisplayName(alias, 'ar');
      expect(initials).toMatch(/^[A-Z]*$/);
      expect(initials === '' || !name.startsWith(initials)).toBe(true);
    }
  });

  it('an unknown Arabic name yields no initials rather than a duplicated prefix', () => {
    expect(getStoreInitials('متجر غير معروف')).toBe('');
    expect(hasStoreLogo('متجر غير معروف')).toBe(false);
  });
});
