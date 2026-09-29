/** @jest-environment jsdom */
import { serializeJsonLd } from '@/lib/seo/serialize-json-ld';
import { JsonLd } from '@/lib/seo/json-ld';
import { render } from '@testing-library/react';

describe('JSON-LD HTML boundary', () => {
  it('preserves SEO values while preventing script termination and injected HTML', () => {
    const data = {
      '@context': 'https://schema.org', '@type': 'Product',
      name: '</script><img src=x onerror="alert(1)"><script>bad()</script>',
      description: 'توفيري 日本語 "quotes" & < > \\ \u2028 \u2029',
      offers: { '@type': 'Offer', price: 125, priceCurrency: 'SAR' },
      missing: null,
    };
    const { container } = render(<JsonLd data={data} />);
    const html = container.innerHTML;
    const document = new DOMParser().parseFromString(html, 'text/html');
    const scripts = document.querySelectorAll('script');
    expect(scripts).toHaveLength(1);
    expect(scripts[0].type).toBe('application/ld+json');
    expect(document.querySelector('img')).toBeNull();
    expect(scripts[0].textContent).not.toContain('<');
    expect(JSON.parse(scripts[0].textContent!)).toEqual(data);
  });

  it.each([null, undefined, () => 1, BigInt(1)])('emits valid null for unsupported optional data: %s', value => {
    expect(JSON.parse(serializeJsonLd(value))).toBeNull();
  });

  it('does not crash a page on a cyclic object', () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(serializeJsonLd(cycle)).toBe('null');
  });

  it.each(['plain', 12, false, ['a', '<b>'], { value: '\\u003c' }])('round-trips supported JSON: %s', value => {
    expect(JSON.parse(serializeJsonLd(value))).toEqual(value);
  });
});
