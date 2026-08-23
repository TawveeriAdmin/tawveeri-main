// P2-8 · UNIFIED SEARCH routing.
//
// The whole risk of a unified entry point is routing a query to a capability that answers
// it WORSE than the one it reaches today. These tests pin the boundary in both directions:
// what must reason, and — more importantly — what must NOT.
import { routeQuery, namesASpecificModel, ADVISABLE_CATEGORIES } from '@/lib/agent/route-query';

// ONE TAWVEERI BRAIN (2026-08-09): comparison intent used to be detected only inside
// src/app/api/search/route.ts, independently of this shared classifier — so a comparison
// sentence with no explicit model number (e.g. a "which type is better" question) had
// nothing here to recognize it, and would fall through to whatever the category/need-signal
// rules happened to produce. `routeQuery` now classifies comparison intent FIRST, before the
// "named model" retrieval rule — which matters because many comparison sentences (both sides
// naming a model) would otherwise satisfy that rule by accident and lose their comparison
// framing entirely.
describe('routeQuery — comparison intent is classified explicitly, checked before "named model"', () => {
  const comparisons: Array<[string, string]> = [
    ['S25 ولا iPhone 17؟', 'both sides name a model — must NOT fall through to plain retrieval'],
    ['ايهما افضل ايفون 17 برو ولا S25 الترا', 'pair marker + two named models'],
    ['قارن اسعار ايفون 16', 'single-product price comparison marker'],
    ['which is better iphone 17 or galaxy s25', 'English pair marker'],
    ['الفرق بين مكيف جري ومكيف ال جي', 'comparison of two named things with no digits at all'],
  ];
  it.each(comparisons)('%s → comparison (%s)', (query) => {
    const route = routeQuery(query);
    if (route.mode !== 'comparison') throw new Error(`expected comparison, got ${route.mode}: ${route.reason}`);
    expect(route.compareIntent.kind).not.toBe('none');
  });

  it('a plain named-model query (no comparison marker) still routes to retrieval, not comparison', () => {
    const route = routeQuery('iphone 15');
    expect(route.mode).toBe('retrieval');
  });

  it('a needs-based query with no comparison marker still routes to advisory, not comparison', () => {
    const route = routeQuery('مكيف لغرفة 30 متر هادئ تحت 4000');
    expect(route.mode).toBe('advisory');
  });
});

describe('routeQuery — need-based queries reach the reasoning engine', () => {
  const advisory: Array<[string, string]> = [
    ['مكيف لغرفة 30 متر هادئ وموفر للكهرباء تحت 4000', 'AC with room size, priorities and budget'],
    ['a quiet energy-saving AC for a 30 m² room under 4000', 'the same in English'],
    ['لابتوب للألعاب خفيف تحت 5000', 'laptop with priorities and budget'],
    ['غسالة صحون كبيرة للعائلة', 'dishwasher with a "large/family" priority and no budget'],
    ['تلفزيون للألعاب والأفلام تحت 3000', 'TV with use priorities'],
    ['a large family dishwasher', 'English appliance need'],
    ['قلاية هوائية كبيرة', 'appliance from APPLIANCE_META with a priority'],
  ];
  it.each(advisory)('%s → advisory (%s)', (query) => {
    const route = routeQuery(query);
    if (route.mode !== 'advisory') throw new Error(`expected advisory, got ${route.mode}: ${route.reason}`);
    expect(route.task.category).toBeTruthy();
    expect(route.reason).toMatch(/need signals/);
  });
});

describe('routeQuery — exact product queries go straight to comparison, never to advice', () => {
  // Each of these has a category the engine COULD advise on. They must still route to
  // retrieval: the customer already decided what to buy and is asking where and how much.
  const retrieval: Array<[string, string]> = [
    ['iphone 15', 'named series + number'],
    ['ايفون 15 برو', 'Arabic named series + number'],
    ['galaxy s24 ultra', 'model token'],
    ['macbook air m2', 'model token'],
    ['asus vivobook 15', 'series + number'],
    ['G835LW-SA081W', 'a bare SKU'],
  ];
  it.each(retrieval)('%s → retrieval (%s)', (query) => {
    expect(routeQuery(query).mode).toBe('retrieval');
  });

  it('a bare category is a browse, not a described need', () => {
    for (const q of ['لابتوب', 'مكيف', 'tv', 'washing machine']) {
      const route = routeQuery(q);
      expect(route.mode).toBe('retrieval');
      expect(route.reason).toMatch(/browse/);
    }
  });

  it('an unclassifiable query never reaches the engine', () => {
    const route = routeQuery('هدية لأخوي');
    expect(route.mode).toBe('retrieval');
    expect(route.reason).toMatch(/no category/);
  });

  it('empty input routes without throwing', () => {
    expect(routeQuery('').mode).toBe('retrieval');
    expect(routeQuery('   ').mode).toBe('retrieval');
  });
});

describe('routeQuery — the categories the engine cannot advise on must not be routed to it', () => {
  // audio and camera ARE parsed as categories but `decide()` returns supported:false for
  // them. Routing there would replace working results with "not supported yet".
  it('audio and camera are not advisable', () => {
    expect(ADVISABLE_CATEGORIES.has('audio')).toBe(false);
    expect(ADVISABLE_CATEGORIES.has('camera')).toBe(false);
  });

  it('a need-shaped audio query still routes to retrieval', () => {
    const route = routeQuery('سماعات للألعاب تحت 500');
    expect(route.mode).toBe('retrieval');
    expect(route.reason).toMatch(/not advisable/);
  });

  it('every advisable category is one the engine dispatches explicitly or via APPLIANCE_META', () => {
    // Guards against someone widening the set without widening the engine.
    for (const c of ['air_conditioner', 'tv', 'tablet', 'mobile', 'laptop', 'refrigerator', 'washing_machine']) {
      expect(ADVISABLE_CATEGORIES.has(c)).toBe(true);
    }
    expect(ADVISABLE_CATEGORIES.has('dishwasher')).toBe(true);
    expect(ADVISABLE_CATEGORIES.has('air_fryer')).toBe(true);
  });
});

describe('namesASpecificModel', () => {
  it('a standalone number is a budget or a size, never a model', () => {
    // This is the trap: treating "4000" as a model would send every budget query to
    // retrieval and the reasoning engine would never run at all.
    expect(namesASpecificModel('تحت 4000')).toBe(false);
    expect(namesASpecificModel('30 متر')).toBe(false);
    expect(namesASpecificModel('under 5000')).toBe(false);
  });

  it('detects alphanumeric model tokens and known series', () => {
    expect(namesASpecificModel('s24 ultra')).toBe(true);      // letters+digits in one token
    expect(namesASpecificModel('G835LW-SA081W')).toBe(true);
    expect(namesASpecificModel('iphone 15')).toBe(true);      // known series + a number
  });

  it('does NOT treat a bare "<word> <number>" as a model, and that is deliberate', () => {
    // "rtx 4080" is two tokens, neither alphanumeric, and "rtx" is not a series word — so
    // this returns false. It does not matter: "rtx 4080" classifies to no category and
    // routes to retrieval by the first rule anyway.
    //
    // The general rule is REJECTED on purpose. "<letters> <number>" also describes
    // «مكيف 30 متر» and "laptop 5000" — a room size and a budget. Treating those as model
    // names would send every unprefixed need query to retrieval and the reasoning engine
    // would go dark for exactly the customers it exists to serve. Precision here is worth
    // more than recall, because the fallback is the results page we already ship.
    expect(namesASpecificModel('rtx 4080')).toBe(false);
    expect(routeQuery('rtx 4080').mode).toBe('retrieval');
    expect(routeQuery('مكيف لغرفة 30 متر').mode).toBe('advisory');
  });

  it('does not fire on ordinary words', () => {
    expect(namesASpecificModel('quiet energy saving air conditioner')).toBe(false);
    expect(namesASpecificModel('مكيف هادئ وموفر')).toBe(false);
  });

  // MEASURED DEFECT (2026-08-10, D→E mission Part F — live network-capture verification):
  // "laptop with 8gb ram under 2000" never reached the advisor at all — /api/v1/agent/decide
  // was never called, only the literal catalog search ran (which matched nothing and showed
  // an honest-but-wrong "No results found"), even though posting the identical text straight
  // to the decide endpoint returns a real answer (count 4, supported true). "8gb" mixes a
  // digit and letters exactly like a model token ("s24"), so it wrongly forced retrieval mode
  // before the budget signal ever got a chance to route this to advisory.
  it('a number+unit spec token ("8gb", "6000mah", "4k") is a need signal, never a model', () => {
    expect(namesASpecificModel('laptop with 8gb ram under 2000')).toBe(false);
    expect(namesASpecificModel('phone with 6000mah battery')).toBe(false);
    expect(namesASpecificModel('4k tv under 3000')).toBe(false);
    expect(namesASpecificModel('128gb storage phone')).toBe(false);
    expect(routeQuery('laptop with 8gb ram under 2000').mode).toBe('advisory');
    // A genuine model code must still be detected even when a spec token sits right next to it.
    expect(namesASpecificModel('galaxy s24 with 256gb storage')).toBe(true);
  });

  // MEASURED DEFECT (2026-08-10, same session, re-verification sweep): the SAME failure class
  // reproduced live with a unit missing from the original fix's list — "400l" (liters, common
  // for refrigerator/washer capacity). Broadened the unit list rather than special-casing one
  // more token; these appliance-spec units recur across categories this mission touches.
  it('other appliance spec units (liters, kg, rpm, dB, mAh, W) are never treated as models', () => {
    expect(namesASpecificModel('refrigerator 400l under 3000')).toBe(false);
    expect(routeQuery('refrigerator 400l under 3000').mode).toBe('advisory');
    expect(namesASpecificModel('washing machine 8kg under 1500')).toBe(false);
    expect(namesASpecificModel('quiet ac under 40db')).toBe(false);
    expect(namesASpecificModel('phone with 5000mah battery')).toBe(false);
    expect(namesASpecificModel('microwave 900w under 500')).toBe(false);
  });
});

// Intent Router follow-up #1 (ADR-270 consolidated list, 2026-08-23): a stated TV screen
// size is a describable constraint exactly like storage_min/ram_min — `needSignals` was
// simply never wired to read `screen_size_requested`, even though task-parser.ts has parsed
// it since ADR-270 §5 for the (unrelated) size-mismatch disclosure.
describe('routeQuery — a stated TV screen size routes to advisory (Intent Router follow-up #1)', () => {
  it('«تلفزيون 43 بوصة للمطبخ» — the exact query that motivated this fix — now routes to advisory', () => {
    const route = routeQuery('تلفزيون 43 بوصة للمطبخ');
    expect(route.mode).toBe('advisory');
    if (route.mode === 'advisory') {
      expect(route.task.category).toBe('tv');
      expect(route.task.screen_size_requested).toBe(43);
      expect(route.reason).toMatch(/screen_size_requested/);
    }
  });

  it('size stated together with a budget still routes advisory (both signals present)', () => {
    const route = routeQuery('تلفزيون 55 بوصة تحت 3000 ريال');
    expect(route.mode).toBe('advisory');
  });

  it('a bare size+brand TV query (no other signal) now routes to advisory too — intentional: any stated size is a real constraint', () => {
    const route = routeQuery('تلفزيون سامسونج 50 بوصة');
    expect(route.mode).toBe('advisory');
    if (route.mode === 'advisory') expect(route.task.screen_size_requested).toBe(50);
  });

  it('a bare TV browse with no size still stays a browse', () => {
    const route = routeQuery('تلفزيون سوني');
    expect(route.mode).toBe('retrieval');
  });
});

// Bare-keyword control group — must NEVER over-route to advisory, before or after any of the
// Intent Router follow-up fixes. A brand name alone (no size/budget/priority/use-case) is
// browsing, not a described need.
describe('routeQuery — bare brand/model queries never over-route to advisory', () => {
  const bareKeyword: Array<[string, string]> = [
    ['سامسونج 65', 'brand + bare number, no unit/category word — no category resolves at all'],
    ['ايفون 15', 'named model — claimed by the model rule before need-signals ever run'],
    ['غسالة LG', 'category + bare brand, no need word'],
    ['ثلاجة سامسونج', 'category + bare brand, no need word'],
    ['مكنسة شارك', 'category + bare brand, no need word'],
  ];
  it.each(bareKeyword)('%s → retrieval (%s)', (query) => {
    expect(routeQuery(query).mode).toBe('retrieval');
  });
});

// Regression (2026-08-04, docs/baselines/2026-08-04-ac-basket-query): the exact failing
// production query routed to RETRIEVAL because the budget parser missed «بميزانيتي … ريال»,
// so the advisor was silently never called (Waffar state: not-routed) while the identical
// English sentence routed to advisory. The route must be language-independent.
describe('routeQuery — basket query reaches the advisor in BOTH languages', () => {
  it('«ابي 3 مكيفات بميزانيتي 5000 ريال» → advisory on the budget signal', () => {
    const route = routeQuery('ابي 3 مكيفات بميزانيتي 5000 ريال');
    expect(route.mode).toBe('advisory');
    if (route.mode === 'advisory') {
      expect(route.task.category).toBe('air_conditioner');
      expect(route.task.budget_total).toBe(5000);
      expect(route.task.quantity).toBe(3);
      expect(route.reason).toMatch(/budget/);
    }
  });
  it('the English equivalent routes the same way', () => {
    const route = routeQuery('I want 3 air conditioners with a budget of 5000 SAR');
    expect(route.mode).toBe('advisory');
  });
});
