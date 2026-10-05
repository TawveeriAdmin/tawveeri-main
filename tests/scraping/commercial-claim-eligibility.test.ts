// Commercial claim eligibility (Amazon closure, 2026-10-05). The contract: an offer without current commercial evidence may stay
// DISCOVERABLE but can never carry a claim ("اختيار توفيري", «الأرخص بين النتائج», "متوفر بحسب آخر رصد", a cheapest price).
//   • unknown observation time ≠ fresh (one authority: isFreshObservation)
//   • historical price ≠ current price (a current offer row with no price is not replaced by price_history)
//   • an accessory is never the pick unless the query asks for an accessory
//   • the store filter filters; a legacy storefront exit leaves through /go
import fs from 'fs';
import path from 'path';
import { isFreshObservation } from '@/lib/intelligence/evidence-engine';
import { isCompatOnlyMention, isAccessoryShapedQuery } from '@/app/api/search/route';

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
  it('every Algolia result set passes through withLegacyGoExits (via dropRetiredProducts, fail-open) so no storefront product hands the shopper a raw merchant URL', () => {
    expect(routeSrc).toMatch(/async function withLegacyGoExits/);
    expect(routeSrc).toMatch(/buildGoUrl\(`ps_\$\{id\}`\) : current/);
    expect(routeSrc).toMatch(/legacy \/go exit mapping failed — direct URLs kept/);
    expect(routeSrc).toMatch(/return withLegacyGoExits\(products\.filter/);
  });
});

describe('an out-of-stock current offer cannot win "cheapest" (executive closure, 2026-10-05)', () => {
  it('latest_fresh marks a store with an out-of-stock CURRENT offer (observed no earlier than the chosen price row) as not fresh — coverage is untouched', () => {
    expect(builderSrc).toMatch(/cn\.payload->>'_availability' = 'out_of_stock'\s+and cn\.observed_at >= l\.observed_at/);
    expect(builderSrc).toMatch(/\) as is_fresh/);
  });
});
