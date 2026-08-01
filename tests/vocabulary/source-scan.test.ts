// §1b — KNOWN-POSITIVE FIXTURES.
//
// "A zero-result repository scan is acceptable only after the known-positive fixtures pass.
// Otherwise zero may mean clean or blind, and those are opposite conclusions."
//
// The fixtures live HERE, never in production source: proving the scanner works must not
// reintroduce retired copy into the app.
import { extractCustomerText, looksLikeProse } from '@/lib/vocabulary/source-scan';
import { checkCustomerText } from '@/lib/vocabulary';

/** Extract, then judge with the ONE approved vocabulary. No second policy. */
const scan = (src: string) =>
  extractCustomerText('fixture.tsx', src).flatMap((t) =>
    checkCustomerText(t.text).map((v) => ({ kind: t.kind, ruleId: v.ruleId, text: t.text })),
  );

describe('KNOWN POSITIVES — every newly supported surface', () => {
  // THE EXACT CLAIM THAT ESCAPED THREE SCANS. JSX text content, no quotes anywhere.
  it('catches JSX text — the how-it-works escape', () => {
    const hits = scan(`export default function P(){return <p>نجمع أسعار نفس المنتج من جميع المتاجر في صفحة واحدة</p>;}`);
    expect(hits.map((h) => h.ruleId)).toContain('comprehensive-market');
    expect(hits[0].kind).toBe('jsx-text');
  });

  it('catches JSX text in English', () => {
    expect(scan(`const P=()=><div>We compare prices from all stores in Saudi Arabia today</div>;`).map((h) => h.ruleId))
      .toContain('comprehensive-market');
  });

  it('catches an accessible name — a claim spoken aloud is still a claim', () => {
    const hits = scan(`const P=()=><img alt="Prices updated daily from every retailer" src="x" />;`);
    expect(hits.map((h) => h.ruleId)).toContain('refresh-cadence');
    expect(hits[0].kind).toBe('jsx-attribute');
  });

  it('catches aria-label and placeholder', () => {
    expect(scan(`const P=()=><input aria-label="real-time prices for you" placeholder="x" />;`).length).toBeGreaterThan(0);
    expect(scan(`const P=()=><input placeholder="Search live prices now" />;`).length).toBeGreaterThan(0);
  });

  it('catches a string literal in a shared constant', () => {
    expect(scan(`export const COPY = { hero: 'Official partnerships with top stores' };`).map((h) => h.ruleId))
      .toContain('official-partnership');
  });

  it('catches metadata / description fields', () => {
    expect(scan(`export const metadata = { description: 'We track every price in Saudi Arabia' };`).map((h) => h.ruleId))
      .toContain('comprehensive-market');
  });

  it('catches a template literal STATIC span', () => {
    expect(scan("const s = `أفضل سعر ${p} ريال — الأسعار تُحدّث يوميًا`;").map((h) => h.ruleId))
      .toContain('refresh-cadence');
  });

  it('catches a no-substitution template literal', () => {
    expect(scan("const s = `Exclusive coupon codes for you`;").map((h) => h.ruleId)).toContain('exclusive-coupon');
  });

  it('catches Arabic-Indic digits in JSX text', () => {
    expect(scan(`const P=()=><p>ابحث في منتجات ٨ متاجر سعودية وقارن</p>;`).map((h) => h.ruleId))
      .toContain('retired-retailer-count-string');
  });
});

describe('HISTORICAL §1b COVERAGE — new coverage must not weaken old', () => {
  it('still catches the quoted-literal class the regex version found', () => {
    expect(scan(`const t = isRTL ? 'السعر الحالي' : 'Current Price';`).map((h) => h.ruleId))
      .toContain('price-currency-claim');
  });

  it('still catches the retired retailer count in a literal', () => {
    expect(scan(`const s = 'Search products from 8 Saudi retailers and compare';`).map((h) => h.ruleId))
      .toContain('retired-retailer-count-string');
  });
});

describe('FALSE-POSITIVE CONTROL', () => {
  it('ignores comments — including a comment DOCUMENTING a removed claim', () => {
    // This is `about/page.tsx`'s audit trail. The regex version read it as the violation.
    expect(scan(`// 3. \`من جميع المتاجر\` — a comprehensive-market claim, also MUST NOT SAY.\nconst x = 1;`)).toEqual([]);
    expect(scan(`/* Prices updated daily — REMOVED 2026-07-30 */\nconst y = 2;`)).toEqual([]);
  });

  it('ignores class names, routes and identifiers', () => {
    expect(scan(`const c = 'grid grid-cols-2 gap-4 px-4 text-sm';`)).toEqual([]);
    expect(scan(`const r = '/ar/how-it-works';`)).toEqual([]);
    expect(scan(`const k = 'priceAlertCurrentPrice';`)).toEqual([]);
  });

  it('ignores machine attributes even when they contain claim-like text', () => {
    expect(scan(`const P=()=><div className="prices updated daily grid" id="all stores here" />;`)).toEqual([]);
  });

  it('ignores imports', () => {
    expect(scan(`import { x } from './prices-updated-daily-module';`)).toEqual([]);
  });

  it('does not treat an interpolated VALUE as copy', () => {
    // `${storeCount} متاجر` — the number is runtime data under F7, not repository copy.
    const hits = scan('const s = `متوفر في ${storeCount} متاجر`;');
    expect(hits.map((h) => h.ruleId)).not.toContain('fixed-retailer-count');
  });

  it('looksLikeProse rejects syntax and accepts sentences', () => {
    expect(looksLikeProse('grid-cols-2')).toBe(false);
    expect(looksLikeProse('{t("x")}: <Price')).toBe(false);
    expect(looksLikeProse('50/50')).toBe(false);
    expect(looksLikeProse('Compare prices across Saudi retailers')).toBe(true);
    expect(looksLikeProse('نجمع أسعار نفس المنتج')).toBe(true);
  });
});

describe('APPROVED WORDING PASSES — the gate is not "flag everything"', () => {
  it.each([
    `const P=()=><p>قارن الأسعار بين متاجر سعودية</p>;`,
    `const P=()=><p>Compare prices across Saudi retailers</p>;`,
    `const P=()=><p>آخر سعر رصدناه</p>;`,
    `const P=()=><p>Last Observed Price</p>;`,
    `const P=()=><img alt="Tawveeri — we show you the price, where it came from" src="x" />;`,
  ])('clean: %s', (src) => {
    expect(scan(src)).toEqual([]);
  });
});
