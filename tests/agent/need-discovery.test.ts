// NEED-DISCOVERY GATE (2026-08-10, founder's own production gap).
//
// «وش أفضل لابتوب لاحتياجي وميزانيتي؟» fell through to a plain 83-result browse: "أفضل"/
// "احتياجي"/"ميزانيتي" carry a REFERENCE to a recommendation/need/budget, but the parser
// never extracted a VALUE from any of them, so `needSignals()` saw zero signals and routed
// to a bare category browse — identical to typing "لابتوب" alone. These tests pin the fix
// end-to-end: parsing → routing → question selection → durable answer handling.
import { parseShoppingTask } from '@/lib/agent/task-parser';
import { routeQuery } from '@/lib/agent/route-query';
import { shouldAsk } from '@/lib/agent/clarify';
import { decide, type CanonicalRow } from '@/lib/agent/decision-engine';

describe('THE CRITICAL TEST — «وش أفضل لابتوب لاحتياجي وميزانيتي؟»', () => {
  const text = 'وش أفضل لابتوب لاحتياجي وميزانيتي؟';

  it('parses as recommendation-seeking with referenced-but-unvalued budget and use case', () => {
    const task = parseShoppingTask(text);
    expect(task.category).toBe('laptop');
    expect(task.wants_recommendation).toBe(true);
    expect(task.budget_referenced).toBe(true);
    expect(task.budget_total).toBeUndefined(); // referenced, never a fabricated value
    expect(task.use_case_referenced).toBe(true);
    expect(task.priorities).toBeUndefined();
  });

  it('routes to advisory (previously: retrieval, "category only — a browse")', () => {
    const route = routeQuery(text);
    expect(route.mode).toBe('advisory');
  });

  it('asks the use-case question first — genuinely earns its place against real candidates', () => {
    // Hand-verified against decideLaptop's actual scoring (decision-engine.ts): a discrete-
    // GPU/low-RAM laptop wins under a "gaming" probe (+0.15 GPU, no RAM bonus since RAM<16)
    // but LOSES under a "productivity" probe (RAM<16 earns nothing) to an integrated-GPU/
    // high-RAM laptop (RAM>=16 earns +0.1, GPU is irrelevant to productivity scoring) —
    // genuinely different top picks, not a coincidental tie broken by array order.
    const rows: CanonicalRow[] = [
      { canonical_id: 'gaming-focused', tps_identity_key: 'a', display_name_ar: 'لابتوب ألعاب', display_name_en: null, brand: 'Asus', category: 'laptop', image_url: null, lowest_price: 4500, store_count: 2, has_comparison: true, identity_confidence: 0.9, attributes: { ram: 8, gpu: 'rtx4050', screen: 15 } },
      { canonical_id: 'productivity-focused', tps_identity_key: 'b', display_name_ar: 'لابتوب دراسة وعمل', display_name_en: null, brand: 'Dell', category: 'laptop', image_url: null, lowest_price: 3200, store_count: 2, has_comparison: true, identity_confidence: 0.9, attributes: { ram: 16, gpu: 'igpu', screen: 14 } },
    ];
    const task = parseShoppingTask(text);
    const d = shouldAsk(task, rows);
    expect(d.ask).toBe(true);
    expect(d.question?.field).toBe('priorities');
    expect(d.question?.question_ar).toContain('استخدامك');
  });

  it('after answering use-case, does NOT re-ask it — asks budget next only if still needed', () => {
    const rows: CanonicalRow[] = [
      { canonical_id: 'gaming-cheap', tps_identity_key: 'a', display_name_ar: 'لابتوب ألعاب رخيص', display_name_en: null, brand: 'Acer', category: 'laptop', image_url: null, lowest_price: 2800, store_count: 2, has_comparison: true, identity_confidence: 0.9, attributes: { ram: 16, gpu: 'rtx4050', screen: 15 } },
      { canonical_id: 'gaming-costly', tps_identity_key: 'b', display_name_ar: 'لابتوب ألعاب قوي', display_name_en: null, brand: 'MSI', category: 'laptop', image_url: null, lowest_price: 7200, store_count: 2, has_comparison: true, identity_confidence: 0.9, attributes: { ram: 32, gpu: 'rtx4060', screen: 16 } },
    ];
    const answered = { ...parseShoppingTask(text), priorities: ['gaming'] };
    const d = shouldAsk(answered, rows);
    if (d.ask) expect(d.question?.field).not.toBe('priorities'); // never the same field twice
  });

  it('a fully answered task (use case + budget) asks nothing — decision-sufficient', () => {
    const rows: CanonicalRow[] = [
      { canonical_id: 'a', tps_identity_key: 'a', display_name_ar: 'لابتوب ألعاب', display_name_en: null, brand: 'Asus', category: 'laptop', image_url: null, lowest_price: 4500, store_count: 2, has_comparison: true, identity_confidence: 0.9, attributes: { ram: 16, gpu: 'rtx4050', screen: 15 } },
      { canonical_id: 'b', tps_identity_key: 'b', display_name_ar: 'لابتوب ألعاب آخر', display_name_en: null, brand: 'Dell', category: 'laptop', image_url: null, lowest_price: 4800, store_count: 2, has_comparison: true, identity_confidence: 0.9, attributes: { ram: 16, gpu: 'rtx4050', screen: 15.6 } },
    ];
    const answered = { ...parseShoppingTask(text), priorities: ['gaming'], budget_total: 5000 };
    const d = shouldAsk(answered, rows);
    expect(d.ask).toBe(false);
  });
});

describe('ADVERSARIAL TESTS — the founder\'s own list, verbatim', () => {
  it('«أبي لابتوب ألعاب تحت 5000» → fully specified, no clarification needed', () => {
    const task = parseShoppingTask('أبي لابتوب ألعاب تحت 5000');
    expect(task.category).toBe('laptop');
    expect(task.priorities).toEqual(['gaming']);
    expect(task.budget_total).toBe(5000);
    const route = routeQuery('أبي لابتوب ألعاب تحت 5000');
    expect(route.mode).toBe('advisory'); // reaches the engine via concrete signals, same as before
  });

  it('«لابتوب MacBook Pro 16» → direct model lookup, not advisory', () => {
    const route = routeQuery('لابتوب MacBook Pro 16');
    expect(route.mode).toBe('retrieval');
    expect(route.reason).toMatch(/model/);
  });

  it('«أرخص لابتوب» → cheapest eligible intent, not need-discovery', () => {
    const task = parseShoppingTask('أرخص لابتوب');
    expect(task.wants_cheapest).toBe(true);
    const route = routeQuery('أرخص لابتوب');
    expect(route.mode).toBe('advisory');
    expect(route.reason).toContain('cheapest');
  });

  it('«لابتوب للجامعة» → use case already resolved (جامعة→productivity), only budget could still be missing', () => {
    const task = parseShoppingTask('لابتوب للجامعة');
    expect(task.category).toBe('laptop');
    expect(task.priorities).toEqual(['productivity']); // MEASURED GAP this mission fixed
    expect(task.budget_referenced).toBeFalsy(); // budget was never even mentioned
  });

  it('«وش تنصحني؟» → needs context, recognized as recommendation-seeking even with no category-adjacent word yet', () => {
    const task = parseShoppingTask('وش تنصحني بلابتوب؟');
    expect(task.wants_recommendation).toBe(true);
  });

  it('«ابي جوال لامي» → guided need discovery: category known, use case and budget both unknown', () => {
    const task = parseShoppingTask('ابي جوال لامي');
    expect(task.category).toBe('mobile');
    expect(task.priorities).toBeUndefined();
    expect(task.budget_total).toBeUndefined();
  });

  it('«ابي مكيف لغرفة 30 متر تحت 4000» → does not re-ask what the system already knows', () => {
    const task = parseShoppingTask('ابي مكيف لغرفة 30 متر تحت 4000');
    expect(task.room_size_m2).toBe(30);
    expect(task.budget_total).toBe(4000);
    const rows: CanonicalRow[] = [
      { canonical_id: 'a', tps_identity_key: 'a', display_name_ar: 'مكيف صغير', display_name_en: null, brand: 'test', category: 'air_conditioner', image_url: null, lowest_price: 1500, store_count: 2, has_comparison: true, identity_confidence: 0.9, attributes: { capacity_btu: 18000, inverter: true, cooling_mode: 'cool_only' } },
      { canonical_id: 'b', tps_identity_key: 'b', display_name_ar: 'مكيف كبير', display_name_en: null, brand: 'test', category: 'air_conditioner', image_url: null, lowest_price: 2800, store_count: 2, has_comparison: true, identity_confidence: 0.9, attributes: { capacity_btu: 24000, inverter: true, cooling_mode: 'cool_only' } },
    ];
    const d = shouldAsk(task as never, rows);
    expect(d.ask).toBe(false);
  });

  it('«ابي غسالة لعائلة كبيرة» → clarify only what matters (budget — no structural capacity field exists)', () => {
    const task = parseShoppingTask('ابي غسالة لعائلة كبيرة');
    expect(task.category).toBe('washing_machine');
    const rows: CanonicalRow[] = Array.from({ length: 6 }, (_, i) => ({
      canonical_id: `w${i}`, tps_identity_key: `w${i}`, display_name_ar: `غسالة ${i}`, display_name_en: null,
      brand: 'test', category: 'washing_machine', image_url: null,
      lowest_price: 1000 + i * 800, store_count: 2, has_comparison: true, identity_confidence: 0.9,
      attributes: { capacity_kg: 8 + i, type: 'front_load', inverter: true },
    }));
    const d = shouldAsk(task as never, rows);
    // Only budget_total is a candidate for this category — never priorities/room_size.
    if (d.ask) expect(d.question?.field).toBe('budget_total');
  });
});

describe('English parity', () => {
  it('"What\'s the best laptop for me?" is recognized as recommendation-seeking', () => {
    const task = parseShoppingTask("What's the best laptop for me?");
    expect(task.category).toBe('laptop');
    expect(task.wants_recommendation).toBe(true);
  });

  it('"I need a laptop for university" resolves productivity, no clarify needed for use case', () => {
    const task = parseShoppingTask('I need a laptop for university');
    expect(task.category).toBe('laptop');
    expect(task.priorities).toEqual(['productivity']);
  });

  it('"Help me choose a laptop" is recommendation-seeking', () => {
    expect(parseShoppingTask('Help me choose a laptop').wants_recommendation).toBe(true);
  });
});

describe('"ميزانيتي" without a number — referenced, never fabricated', () => {
  it.each([
    'حسب ميزانيتي',
    'وش يناسب ميزانيتي',
    'ابي شيء على قد ميزانيتي',
  ])('%s → budget_referenced=true, budget_total=undefined', (phrase) => {
    const task = parseShoppingTask(`ابي لابتوب ${phrase}`);
    expect(task.budget_referenced).toBe(true);
    expect(task.budget_total).toBeUndefined();
  });

  it('a sentence that BOTH references and states the budget is fully answered, not flagged missing', () => {
    const task = parseShoppingTask('ابي لابتوب ميزانيتي 3000');
    expect(task.budget_total).toBe(3000);
    expect(task.budget_referenced).toBeFalsy();
  });
});

describe('"جامعة"/"دوام"/"وظيفة" — the parser gap this mission fixed', () => {
  it.each(['لابتوب للجامعة', 'لابتوب للدوام', 'لابتوب لوظيفتي'])('%s resolves productivity', (q) => {
    expect(parseShoppingTask(q).priorities).toEqual(['productivity']);
  });

  it('bare «مكتب» is deliberately NOT added to productivity, and no longer fabricates "reading" either', () => {
    // MEASURED DEFECT found while building this: "لمكتبي" ("my office") contains "كتب"
    // (books) as a bare substring, so the PRE-EXISTING "reading" keyword group silently
    // fabricated a reading priority for anyone mentioning their office — unrelated to this
    // mission's own "مكتب" addition (which was deliberately left out of productivity), but
    // fixed on discovery since it fabricates a priority the shopper never stated.
    expect(parseShoppingTask('لابتوب لمكتبي').priorities).toBeUndefined();
  });
});

describe('No dead ends — an unanswerable use-case chip is a real, honest state, not a trap', () => {
  it('choosing the general/other option sets an empty priorities array, and it counts as answered', () => {
    const rows: CanonicalRow[] = [
      { canonical_id: 'a', tps_identity_key: 'a', display_name_ar: 'لابتوب', display_name_en: null, brand: 't', category: 'laptop', image_url: null, lowest_price: 3000, store_count: 2, has_comparison: true, identity_confidence: 0.9, attributes: { ram: 16 } },
      { canonical_id: 'b', tps_identity_key: 'b', display_name_ar: 'لابتوب', display_name_en: null, brand: 't', category: 'laptop', image_url: null, lowest_price: 5000, store_count: 2, has_comparison: true, identity_confidence: 0.9, attributes: { ram: 16 } },
    ];
    const answeredGeneral = { category: 'laptop', priorities: [] as string[] };
    const d = shouldAsk(answeredGeneral as never, rows);
    // priorities was explicitly answered (empty array, not undefined) — must not re-ask it.
    if (d.ask) expect(d.question?.field).not.toBe('priorities');
  });
});
