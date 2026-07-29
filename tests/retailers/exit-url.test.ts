import { normalizeExitUrl } from '@/lib/retailers/exit-url';

describe('normalizeExitUrl — Almanea live-host legacy shape (measured 404)', () => {
  it('rewrites the dead live-host slug shape to the canonical product shape', () => {
    expect(normalizeExitUrl('https://www.almanea.sa/aukey-nylon-usb-2-0-to-micro-usb-cable-2m-am2-black-p-170114809999007'))
      .toBe('https://www.almanea.sa/ar/product/p-170114809999007');
  });
  it('honours the locale', () => {
    expect(normalizeExitUrl('https://www.almanea.sa/some-slug-p-170114809999007', 'en'))
      .toBe('https://www.almanea.sa/en/product/p-170114809999007');
  });
  it('leaves the already-canonical shape untouched', () => {
    const u = 'https://www.almanea.sa/ar/product/p-170114809999007';
    expect(normalizeExitUrl(u)).toBe(u);
  });
  it('leaves the dev host untouched — measured 200, not broken', () => {
    const u = 'https://m.dev-almanea.com/apple-iphone-17-256gb-black-p-170111801030090';
    expect(normalizeExitUrl(u)).toBe(u);
  });
  it('leaves other retailers untouched', () => {
    const u = 'https://www.amazon.sa/dp/B08GK1N6QL?tag=tawveeri-21';
    expect(normalizeExitUrl(u)).toBe(u);
  });
  it('handles null/empty safely', () => {
    expect(normalizeExitUrl(null)).toBeNull();
    expect(normalizeExitUrl('')).toBe('');
  });
});
