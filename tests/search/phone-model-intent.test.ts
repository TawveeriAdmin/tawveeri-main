import { phoneModelIntent, matchesPhoneModel, phoneBudgetSubject } from '@/lib/search/phone-model-intent';

describe('phone model intent from live phone audit', () => {
  it('does not confuse RAM preceding storage with the commercial storage capacity', () => {
    const intent = phoneModelIntent('Galaxy S26 Ultra 512GB')!;
    expect(matchesPhoneModel(intent, '', 'Samsung Galaxy S26 Ultra 12 GB RAM, 512 GB Storage')).toBe(true);
    expect(matchesPhoneModel(intent, '', 'Samsung Galaxy S26 Ultra RAM 12GB, 256GB Storage')).toBe(false);
  });
  it('anchors a bare phone-brand budget without rewriting an explicit appliance or accessory query', () => {
    expect(phoneBudgetSubject('سامسونج تحت 1500')).toBe('جوال سامسونج تحت 1500');
    expect(phoneBudgetSubject('Samsung TV under 1500')).toBe('Samsung TV under 1500');
    expect(phoneBudgetSubject('كفر سامسونج تحت 1500')).toBe('كفر سامسونج تحت 1500');
  });
  it('rejects the S26 anti-reflecting film that surfaced at 69 SAR in the closure golden set', () => {
    expect(matchesPhoneModel(phoneModelIntent('سامسونج S26')!, '', 'Samsung Galaxy S26 Anti-Reflecting Film, Clear')).toBe(false);
  });
  it.each(['iphone 16 pro', 'iphone16 pro', 'آيفون ١٦ برو', 'ايفون16برو'])('normalizes %s', (query) => {
    expect(phoneModelIntent(query)).toEqual({ family: 'iphone', generation: '16', tier: 'pro', storage: null, network: null });
  });

  it.each(['Galaxy S26+', 'Galaxy S26 Plus', 'سامسونج S٢٦ بلس', 'جالاكسي S26 بلاس'])('preserves Plus in %s', (query) => {
    expect(phoneModelIntent(query)?.tier).toBe('plus');
    expect(matchesPhoneModel(phoneModelIntent(query)!, '', 'Galaxy S26+ White 256 GB (SM-S947BZWIMEA)')).toBe(true);
  });

  it.each([
    ['iPhone 16 Pro', 'Apple iPhone 16 Pro Max 256GB'],
    ['iPhone 16', 'Apple iPhone 16e 128GB'],
    ['Galaxy S26 Ultra', 'Samsung Galaxy S26 512GB'],
    ['Galaxy S26+', 'Samsung Galaxy S26 Ultra 512GB'],
    ['Pixel 9', 'Google Pixel 9a 128GB'],
    ['Pixel 11', 'Huawei Band 11'],
    ['Redmi Note 14', 'Redmi 15C Midnight Black 256GB'],
    ['Redmi Note 14 5G', 'Redmi Note 14 4G 256GB'],
    ['iPhone 16 Pro 256GB', 'iPhone 16 Pro 512GB'],
  ])('does not replace %s with %s', (query, title) => {
    expect(matchesPhoneModel(phoneModelIntent(query)!, '', title)).toBe(false);
  });

  it.each([
    'UGREEN 130W MacBook Car Charger Compatible for Samsung S24 iPhone 16 Pro',
    'SSK 250GB External SSD Compatible with iPhone 16 Pro',
    'Anker Prime Power Bank for iPhone 16 Pro',
    'ديفايسد، واقي شاشة زجاجي مقوى ايفون 16 برو',
  ])('rejects compatibility evidence: %s', (title) => {
    expect(matchesPhoneModel(phoneModelIntent('iPhone 16 Pro')!, title, '')).toBe(false);
  });

  it('does not read a marketing Pro elsewhere as the phone tier', () => {
    expect(matchesPhoneModel(phoneModelIntent('iPhone 16 Pro')!, '', 'iPhone 16 128GB with Pro Camera')).toBe(false);
  });

  it('retains feature-rich phones and exact regional storage variants', () => {
    expect(matchesPhoneModel(phoneModelIntent('Galaxy S26 Ultra')!, '', 'Samsung Galaxy S26 Ultra 512GB 50MP Camera AMOLED Display KSA version')).toBe(true);
    expect(matchesPhoneModel(phoneModelIntent('آيفون ١٦ برو ١ تيرا')!, '', 'Apple iPhone 16 Pro 1024GB')).toBe(true);
  });

  it('rejects contradictory bilingual titles', () => {
    expect(matchesPhoneModel(phoneModelIntent('Galaxy S26 Ultra')!, 'سامسونج جالكسي S26 512 جيجابايت', 'Samsung Galaxy S26 Ultra 512GB')).toBe(false);
  });

  it.each(['كفر آيفون 16 برو', 'Pixel 9 case', 'جوال سامسونج تحت 1500', 'Samsung WW90T554DAN', 'Galaxy Tab S10'])('leaves %s to its own intent', (query) => {
    expect(phoneModelIntent(query)).toBeNull();
  });
});
