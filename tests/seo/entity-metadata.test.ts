import { readFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();

describe('entity positioning metadata', () => {
  const localeLayout = readFileSync(join(root, 'src/app/[locale]/layout.tsx'), 'utf8');
  const jsonLd = readFileSync(join(root, 'src/lib/seo/json-ld.tsx'), 'utf8');

  it('locale default meta does not hero deal/coupon language', () => {
    expect(localeLayout).not.toMatch(/أفضل العروض والتخفيضات/);
    expect(localeLayout).not.toMatch(/Best deals in Saudi Arabia/);
    expect(localeLayout).toMatch(/ما نبيع/);
    expect(localeLayout).toMatch(/مساعد قرار الشراء/);
    expect(localeLayout).toMatch(/observed prices/i);
  });

  it('WebSite schema describes observed prices / non-seller', () => {
    expect(jsonLd).toMatch(/أسعار مرصودة/);
    expect(jsonLd).toMatch(/we do not sell/i);
  });

  it('Organization schema links X sameAs for entity disambiguation', () => {
    expect(jsonLd).toMatch(/https:\/\/x\.com\/Tawveeri/);
  });
});
