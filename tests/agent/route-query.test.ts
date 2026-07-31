// P2-8 · UNIFIED SEARCH routing.
//
// The whole risk of a unified entry point is routing a query to a capability that answers
// it WORSE than the one it reaches today. These tests pin the boundary in both directions:
// what must reason, and — more importantly — what must NOT.
import { routeQuery, namesASpecificModel, ADVISABLE_CATEGORIES } from '@/lib/agent/route-query';

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
});
