import { strongModelToken, requiredCodeTokens, carriesCodes, modelNumberPrefixFilter } from '@/lib/search/model-token-gate';

describe('model token gate (2026-10-06): the model code is the request, descriptive words never veto it', () => {
  it('finds the strong model token inside a mixed Arabic/English sentence', () => {
    expect(strongModelToken('Samsung WA21A8376GV OR غسالة سامسونج 21 كيلو')).toBe('WA21A8376GV');
    expect(strongModelToken('غسالة سامسونج WA21A8376GV')).toBe('WA21A8376GV');
    expect(strongModelToken('Philips XU2100')).toBe('XU2100');
    expect(strongModelToken('XU2100 مكنسة')).toBe('XU2100');
    expect(strongModelToken('75QNED93A6A')).toBe('75QNED93A6A');
    expect(strongModelToken('RF59A70T1SR')).toBe('RF59A70T1SR');
    expect(strongModelToken('WA21A8376GV/YL')).toBe('WA21A8376GV/YL');
  });
  it('never mistakes a spec, a product line or prose for a model code', () => {
    for (const q of ['iphone 15 pro 256gb', 'laptop rtx4060', 'غسالة سامسونج 21 كيلو', 'tv 55 inch 4k', 'مكيف 18000 وحدة', 'ddr5 ram', 'ps5', 'galaxy s24 ultra', 'i7-13700H laptop', 'macbook air m2'])
      expect(strongModelToken(q)).toBeNull();
  });
  it('weak codes (T50, N30, S24, Q70) are required as whole tokens; families and units are not', () => {
    expect(requiredCodeTokens('ECOVACS DEEBOT T50 PRO OMNI')).toEqual(['t50']);
    expect(requiredCodeTokens('galaxy s24 ultra')).toEqual(['s24']);
    expect(requiredCodeTokens('Samsung WA21A8376GV OR غسالة سامسونج 21 كيلو')).toEqual(['wa21a8376gv']);
    expect(requiredCodeTokens('WA21A8376GV/YL')).toEqual(['wa21a8376gv']);
    expect(requiredCodeTokens('iphone 15')).toEqual([]);
    expect(requiredCodeTokens('55 inch tv 120hz')).toEqual([]);
  });
  it('T50 is not T500; a suffix on the product side does not hide the code', () => {
    expect(carriesCodes(['Smart Watch T500 Plus'], ['t50'])).toBe(false);
    expect(carriesCodes(['ECOVACS DEEBOT T50 PRO OMNI'], ['t50'])).toBe(true);
    expect(carriesCodes(['Samsung WA21A8376GV/YL Top Load', 'samsung|MODEL:WA21A8376GV/YL'], ['wa21a8376gv'])).toBe(true);
    expect(carriesCodes(['eufy C20 Omni', 'ECOVACS N30 PRO'], ['t50'])).toBe(false);
    expect(carriesCodes(['anything'], [])).toBe(true);
  });
  it('the canonical lookup matches the typed code with or without a region suffix, and nothing shorter', () => {
    expect(modelNumberPrefixFilter('rf59a70t1sr')).toBe('model_number.eq.RF59A70T1SR,model_number.like.RF59A70T1SR/%,model_number.like.RF59A70T1SR-%');
    expect(modelNumberPrefixFilter('a;b')).not.toMatch(/;/);
  });
});
