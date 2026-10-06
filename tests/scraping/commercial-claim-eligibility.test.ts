// Commercial claim eligibility (Amazon closure, 2026-10-05). The contract: an offer without current commercial evidence may stay
// DISCOVERABLE but can never carry a claim ("اختيار توفيري", «الأرخص بين النتائج», "متوفر بحسب آخر رصد", a cheapest price).
//   • unknown observation time ≠ fresh (one authority: isFreshObservation)
//   • historical price ≠ current price (a current offer row with no price is not replaced by price_history)
//   • an accessory is never the pick unless the query asks for an accessory
//   • the store filter filters; a legacy storefront exit leaves through /go
import fs from 'fs';
import path from 'path';
import { isFreshObservation } from '@/lib/intelligence/evidence-engine';
import { isCompatOnlyMention, isAccessoryShapedQuery, isOffGradeTitle, scopeProductToStores, absorbMissingStores } from '@/app/api/search/route';
import { amazonSponsoredToProduct, normalizeExitUrl } from '@/lib/retailers/exit-url';

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), 'utf8');
const routeSrc = read('src', 'app', 'api', 'search', 'route.ts');
const builderSrc = read('scripts', 'build-tps-projection.ts');

describe('observation time is evidence, not an assumption', () => {
  const now = Date.parse('2026-10-05T12:00:00Z');
  it('null / unparseable / older-than-168h observation is not fresh; a recent one is', () => {
    expect(isFreshObservation(null, now)).toBe(false);
    expect(isFreshObservation(undefined, now)).toBe(false);
    expect(isFreshObservation('not-a-date', now)).toBe(false);
    expect(isFreshObservation('2026-09-16T01:36:38Z', now)).toBe(false);   // Almanea S90H, 19 days
    expect(isFreshObservation('2026-10-04T13:22:19Z', now)).toBe(true);    // Amazon S90H, 22 h
  });
  it('the decision-card gate uses that single predicate (null no longer reads as "live")', () => {
    expect(routeSrc).toMatch(/const pickTooStale = !isFreshObservation\(pickObservedAt\)/);
    expect(routeSrc).not.toMatch(/pickAgeHours != null && pickAgeHours > PICK_FRESHNESS_MAX_HOURS/);
  });
  it('the reason line never claims cheapest / last-observation on an unobserved entry', () => {
    expect(routeSrc).toMatch(/if \(priceEntry && !isFreshObservation\(priceEntry\.observed_at\)\) return 'سعر مرجعي/);
  });
});

describe('historical price is never the current price', () => {
  it('projection: a current offer row with no usable price blocks a historical price observed no later than it', () => {
    expect(builderSrc).toMatch(/coalesce\(cn\.price, 0\) <= 0/);
    expect(builderSrc).toMatch(/cn\.observed_at >= ph\.observed_at/);
    expect(builderSrc).toMatch(/is distinct from 'out_of_stock'/);
  });
});

describe('device intent: an accessory never becomes the pick', () => {
  it('the exact PS5 case: a gaming headset that names PS5 only as "for PS5" is an accessory OF the query; the console itself is not', () => {
    expect(isCompatOnlyMention('ASA A20 Pro Wired Gaming Headset with Noise-Isolating Microphone for PS5, PS4, Xbox Series X|S, PC, Switch', '', 'ps5')).toBe(true);
    expect(isCompatOnlyMention('PlayStation 5 Console Slim Digital Edition PS5', '', 'ps5')).toBe(false);
    expect(isCompatOnlyMention('Sony PS5 DualSense Wireless Controller', '', 'ps5')).toBe(false);   // device name at the head: not guessed away
    expect(isCompatOnlyMention('Wireless Controller for PS5 White', '', 'ps5')).toBe(true);
    expect(isAccessoryShapedQuery('ps5')).toBe(false);
  });
  it('a query that asks for an accessory may still get one', () => {
    expect(isAccessoryShapedQuery('جراب ايفون')).toBe(true);
    expect(isAccessoryShapedQuery('iphone case')).toBe(true);
  });
  it('the pick gate is keyed on the query asking for an accessory, not on queryIsMainProduct alone', () => {
    expect(routeSrc).toMatch(/!\(bestIsAccessory && !isAccessoryShapedQuery\(rawQuery\)\)/);
  });
});

describe('store filter and legacy exits', () => {
  it('stores[] is applied to the result set through the approved-slug resolver (unknown store ⇒ honest zero)', () => {
    expect(routeSrc).toMatch(/const wanted = new Set\(body\.stores\.map\(\(s\) => resolveApprovedSlug\(s\)\)/);
    expect(routeSrc).toMatch(/wanted\.size === 0 \? \[\]/);
  });
  it('a storefront (legacy) offer leaves through /go/ps_<id>, with the direct URL only as a no-id fallback', () => {
    expect(routeSrc).toMatch(/product_url: ps\.id \? buildGoUrl\(`ps_\$\{ps\.id\}`\)/);
  });
});

describe('Algolia (legacy) hits also leave through /go', () => {
  it('every Algolia result set passes through applyLegacyGoExits (via dropRetiredProducts, fail-open) so no storefront product hands the shopper a raw merchant URL', () => {
    expect(routeSrc).toMatch(/function applyLegacyGoExits/);
    expect(routeSrc).toMatch(/buildGoUrl\(`ps_\$\{id\}`\) : current/);
    expect(routeSrc).toMatch(/legacy \/go exit mapping failed — direct URLs kept/);
    expect(routeSrc).toMatch(/return applyLegacyGoExits\(kept, psRows\)/);
  });
});

describe('an out-of-stock current offer cannot win "cheapest" (executive closure, 2026-10-05)', () => {
  it('latest_fresh marks a store with an out-of-stock CURRENT offer (observed no earlier than the chosen price row) as not fresh — coverage is untouched', () => {
    expect(builderSrc).toMatch(/cn\.payload->>'_availability' = 'out_of_stock'\s+and cn\.observed_at >= l\.observed_at/);
    expect(builderSrc).toMatch(/\) as is_fresh/);
  });
});

describe('new is not refurbished (executive closure, 2026-10-05)', () => {
  it('detects renewed / used / refurbished titles in both scripts, with script-aware boundaries', () => {
    expect(isOffGradeTitle('Renewed - MacBook Air A1466 (2015) Laptop')).toBe(true);
    expect(isOffGradeTitle('Apple iPhone 13 Refurbished 128GB')).toBe(true);
    expect(isOffGradeTitle('ماك بوك اير تم تجديده')).toBe(true);
    expect(isOffGradeTitle('لابتوب مجدد ديل')).toBe(true);
    expect(isOffGradeTitle('جوال مستعمل')).toBe(true);
  });
  it('does not flag new units or look-alike words', () => {
    expect(isOffGradeTitle('Apple MacBook Air M2 13-inch 256GB')).toBe(false);
    expect(isOffGradeTitle('Samsung unused-slot SSD Tray')).toBe(false);
    expect(isOffGradeTitle('مستخدمين متعددين جهاز جديد')).toBe(false);
    expect(isOffGradeTitle('')).toBe(false);
  });
  it('the pick pool drops off-grade listings unless the query asks for one', () => {
    expect(routeSrc).toMatch(/const wantsOffGrade = isOffGradeTitle\(rawQuery\)/);
    expect(routeSrc).toMatch(/wantsOffGrade \? ranked : ranked\.filter/);
  });
});

describe('Amazon sponsored-ad click URLs never reach the shopper as a destination (executive closure, 2026-10-05)', () => {
  const sspa = 'https://www.amazon.sa/-/en/sspa/click?ie=UTF8&spc=MTo1ODU3&url=%2FPortable-Conditioner-Cooling%2Fdp%2FB0ABCDE123%2Fref%3Dsspa_dk_detail_0%3Fpsc%3D1';
  it('resolves to the plain /dp/<ASIN> of the ad\'s own product', () => {
    expect(amazonSponsoredToProduct(sspa)).toBe('https://www.amazon.sa/dp/B0ABCDE123');
    expect(normalizeExitUrl(sspa)).toBe('https://www.amazon.sa/dp/B0ABCDE123');
  });
  it('leaves everything else untouched: normal PDPs, other hosts, ad URLs without an ASIN', () => {
    const pdp = 'https://www.amazon.sa/-/en/Some-Product/dp/B0H6Y5NTKZ/ref=sr_1_61?dib=abc';
    expect(amazonSponsoredToProduct(pdp)).toBeNull();
    expect(normalizeExitUrl(pdp)).toBe(pdp);
    expect(amazonSponsoredToProduct('https://example.com/sspa/click?url=%2Fdp%2FB0ABCDE123')).toBeNull();
    expect(amazonSponsoredToProduct('https://www.amazon.sa/-/en/sspa/click?url=%2Fno-asin-here')).toBeNull();
  });
});

describe('store filter scopes the CARD (2026-10-06)', () => {
  const entry = (store: string, price: number, observed_at: string | null) => ({ store, store_name: store, current_price: price, original_price: null, availability: 'in_stock', product_url: `/go/${store}`, observed_at }) as never;
  const now = new Date().toISOString();
  const product = (stores: unknown[]) => ({ name_ar: 'x', name_en: 'x', best_price: 973, current_price: 973, store: 'amazon', store_name: 'amazon', product_url: '/go/amazon', stores, store_count: stores.length }) as never;

  it('the card price/store/exit become those of the SELECTED store (Noon 1,299, not Amazon 973)', () => {
    const p = scopeProductToStores(product([entry('amazon', 973, now), entry('noon', 1299, now)]), new Set(['noon'])) as unknown as { best_price: number; store: string; product_url: string; stores: unknown[]; store_count: number };
    expect(p.best_price).toBe(1299); expect(p.store).toBe('noon'); expect(p.product_url).toBe('/go/noon'); expect(p.stores).toHaveLength(1); expect(p.store_count).toBe(1);
  });
  it('a product with no offer from the selected stores is dropped; a fresh offer beats a cheaper stale one', () => {
    expect(scopeProductToStores(product([entry('amazon', 973, now)]), new Set(['noon']))).toBeNull();
    const stale = new Date(Date.now() - 20 * 86_400_000).toISOString();
    const p = scopeProductToStores(product([entry('noon', 800, stale), entry('extra', 1000, now)]), new Set(['noon', 'extra'])) as unknown as { best_price: number; store: string };
    expect(p.best_price).toBe(1000); expect(p.store).toBe('extra');
  });
  it('the route wires it, the off-grade demotion and the device flag', () => {
    expect(routeSrc).toMatch(/scopeProductToStores\(product, wanted\)/);
    expect(routeSrc).toMatch(/products\.filter\(\(p\) => !isOffGradeTitle\(/);
    expect(routeSrc).toMatch(/const deviceNotFound = deviceIntent && !products\.some\(\(p\) => isDeviceItself\(/);
    expect(routeSrc).toMatch(/\n    deviceNotFound,\n/);
  });
});

describe('one identity keeps one card but never loses an offer (2026-10-06)', () => {
  const e = (store: string, price: number, observed_at: string | null) => ({ store, store_name: store, current_price: price, original_price: null, availability: 'in_stock', product_url: `/go/${store}`, observed_at }) as never;
  const card = (name: string, stores: unknown[], best: number) => ({ name_ar: name, name_en: name, best_price: best, current_price: best, store: 'x', store_name: 'x', product_url: '', stores, store_count: stores.length, tps_identity_key: 'samsung|top_load|21|washer' }) as never;
  const now = new Date().toISOString();

  it('stores the surviving card lacks are absorbed; a fresher cheaper one becomes the best price; titles stay searchable', () => {
    const base = card('samsung top load washer 21kg', [e('extra', 4799, now), e('amazon', 3262, now)], 3262);
    const dup = card('Samsung WA21A8376GV/YL Top Load', [e('amazon', 3272, now), e('سامسونج السعودية', 4799, now), e('noon', 2999, now)], 2999);
    const out = absorbMissingStores(base, dup) as unknown as { stores: { store: string }[]; store_count: number; best_price: number; _absorbed_text: string };
    expect(out.stores.map((s) => s.store)).toEqual(['extra', 'amazon', 'سامسونج السعودية', 'noon']);
    expect(out.store_count).toBe(4); expect(out.best_price).toBe(2999);
    expect(out._absorbed_text).toContain('WA21A8376GV');
  });
  it('an absorbed offer of UNKNOWN age never becomes the claimed best price', () => {
    const base = card('a', [e('extra', 4799, now)], 4799);
    const dup = card('b', [e('amazon', 100, null)], 100);
    const out = absorbMissingStores(base, dup) as unknown as { stores: unknown[]; best_price: number };
    expect(out.stores).toHaveLength(2); expect(out.best_price).toBe(4799);
  });
  it('a duplicate that adds no store changes no offer or price, but its title stays searchable on the surviving card', () => {
    const base = card('a', [e('extra', 4799, now)], 4799);
    const out = absorbMissingStores(base, card('ثلاجة ميديا MDRS710FGU50D', [e('extra', 4000, now)], 4000)) as unknown as { stores: unknown[]; best_price: number; _absorbed_text: string };
    expect(out.stores).toHaveLength(1); expect(out.best_price).toBe(4799); expect(out._absorbed_text).toContain('MDRS710FGU50D');
  });
});
