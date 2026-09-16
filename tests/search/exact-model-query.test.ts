import { exactModelQuery } from '../../src/lib/search/exact-model-query';

describe('whole manufacturer model queries', () => {
  it.each(['AR18TSECCWK/MG', 'WD12TP34DSX/YL', 'HW-Q990F/SA', 'SM-X400NZSAMEA', 'HAF-QIN/EXP', 'HAFEX/EXP', 'SKK-ALE/SC'])('preserves every discriminator in %s', model => {
    expect(exactModelQuery(` ${model.toLowerCase()} `)).toBe(model);
  });
  it.each(['Samsung Galaxy', '256GB', '18000 BTU', '123456789', 'refrigerator', 'battery-pack', 'ارخص مكيف'])('does not convert %s into an exact model lookup', query => {
    expect(exactModelQuery(query)).toBeNull();
  });
});
