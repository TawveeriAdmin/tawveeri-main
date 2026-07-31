// P2-8 · the clarification question.
//
// Two failure modes are pinned here, and the first one already happened in production:
//   1. Asking for something the shopper ALREADY WROTE. «ابي مكيف رخيص لغرفه ٤٠ متر» was
//      answered with a request for the room area. Root cause: every numeric regex in the
//      parser uses `\d`, which does not match Arabic-Indic digits, so ٤٠ was silently
//      dropped and the field came back undefined.
//   2. Asking a question whose answer cannot change anything — friction the Constitution
//      forbids: "questions that do not improve confidence are never asked."
import { parseShoppingTask } from '@/lib/agent/task-parser';
import { shouldAsk, CLARIFY_BY_CATEGORY } from '@/lib/agent/clarify';
import type { CanonicalRow } from '@/lib/agent/decision-engine';

const row = (id: string, btu: number, price: number): CanonicalRow => ({
  canonical_id: id,
  tps_identity_key: `test|${id}`,
  display_name_ar: `مكيف ${btu}`,
  display_name_en: `AC ${btu}`,
  brand: 'test',
  category: 'air_conditioner',
  image_url: null,
  lowest_price: price,
  store_count: 2,
  has_comparison: true,
  identity_confidence: 0.9,
  attributes: { capacity_btu: btu, inverter: true, cooling_mode: 'cool_only' },
} as unknown as CanonicalRow);

describe('the recorded failure — never ask for what was already given', () => {
  it('«ابي مكيف رخيص لغرفه ٤٠ متر» — the exact phrase that failed in production', () => {
    const task = parseShoppingTask('ابي مكيف رخيص لغرفه ٤٠ متر');
    expect(task.category).toBe('air_conditioner');
    expect(task.room_size_m2).toBe(40);
    expect(task.unresolved ?? []).not.toContain('room_size_m2');

    // …and the decision must therefore refuse to ask, for the right reason.
    const d = shouldAsk(task, [row('a', 18000, 1500), row('b', 30000, 2500)]);
    expect(d.ask).toBe(false);
    expect(d.reason).toMatch(/already supplied/);
  });

  // Real Saudi phrasings: Arabic-Indic digits, «متر» / «م٢» / «م», the room noun with a
  // bare number, dialect spellings (ابي/ابغى/ودي, غرفه without the taa marbuta).
  const PHRASINGS: Array<[string, number]> = [
    ['ابغى مكيف لغرفة ٢٥ م٢ هادي', 25],
    ['مكيف اسبلت لغرفة نوم ١٨ متر', 18],
    ['ودي مكيف موفر كهرباء لصالة ٥٠ متر', 50],
    ['مكيف لغرفه ٣٠ م تحت ٣٠٠٠ ريال', 30],
    ['ابي مكيف شباك لغرفة ١٢ متر مربع', 12],
    ['مكيف لمجلس ٤٥ متر حار وبارد', 45],
    ['ابغى مكيف انفرتر لغرفتي ٢٠ متر', 20],
    ['مكيف لغرفة ٣٥', 35],
    ['I need a cheap AC for a 40 m2 room', 40],
  ];

  it.each(PHRASINGS)('%s → room size %i, and no question is asked', (text, expected) => {
    const task = parseShoppingTask(text);
    expect(task.category).toBe('air_conditioner');
    expect(task.room_size_m2).toBe(expected);
    expect(shouldAsk(task, [row('a', 18000, 1500), row('b', 30000, 2500)]).ask).toBe(false);
  });

  it('Arabic-Indic digits also reach the budget, not only the room size', () => {
    const task = parseShoppingTask('مكيف لغرفه ٣٠ م تحت ٣٠٠٠ ريال');
    expect(task.budget_total).toBe(3000);
  });

  it('an Arabic-Indic thousands separator does not truncate the budget', () => {
    // «٤٬٠٠٠» must read as 4000, not 4.
    expect(parseShoppingTask('مكيف تحت ٤٬٠٠٠ ريال').budget_total).toBe(4000);
  });
});

describe('a bare number is only a room size when the room noun licenses it', () => {
  it('does not read a budget as an area', () => {
    // «تحت 4000» is money. Reading it as 4000 m² would feed a fabricated input into a
    // capacity calculation — the failure mode that matters more than a missing question.
    const task = parseShoppingTask('مكيف تحت 4000');
    expect(task.room_size_m2).toBeUndefined();
    expect(task.budget_total).toBe(4000);
  });

  it('does not read a BTU rating as an area', () => {
    expect(parseShoppingTask('مكيف 24000 وحدة').room_size_m2).toBeUndefined();
  });

  it('does not read a 4-digit number after the room noun as an area', () => {
    expect(parseShoppingTask('مكيف لغرفة 4000').room_size_m2).toBeUndefined();
  });

  it('rejects an implausible area rather than guessing', () => {
    expect(parseShoppingTask('مكيف لغرفة 900 متر').room_size_m2).toBeUndefined();
  });
});

describe('ask only when the answer changes the recommendation', () => {
  const ambiguous = parseShoppingTask('ابي مكيف هادئ');

  it('the parser leaves the field unresolved for this query', () => {
    expect(ambiguous.category).toBe('air_conditioner');
    expect(ambiguous.room_size_m2).toBeUndefined();
    expect(ambiguous.unresolved).toContain('room_size_m2');
  });

  it('ASKS when a small room and a large room pick different machines', () => {
    // 15 m² wants ~12k BTU, 40 m² wants ~30k. With one of each in the candidate set the
    // top pick must move, so the question earns its place.
    const d = shouldAsk(ambiguous, [row('small', 12000, 1200), row('big', 30000, 2600)]);
    expect(d.ask).toBe(true);
    expect(d.question?.field).toBe('room_size_m2');
    expect(d.reason).toMatch(/differs at 15 vs 40/);
  });

  it('does NOT ask when every candidate is the same capacity — the answer changes nothing', () => {
    const d = shouldAsk(ambiguous, [row('a', 18000, 1400), row('b', 18000, 1900)]);
    expect(d.ask).toBe(false);
    expect(d.reason).toMatch(/same recommendation/);
  });

  it('does NOT ask when there is only one candidate', () => {
    const d = shouldAsk(ambiguous, [row('only', 18000, 1400)]);
    expect(d.ask).toBe(false);
  });

  it('does NOT ask when there are no candidates at all', () => {
    expect(shouldAsk(ambiguous, []).ask).toBe(false);
  });

  it('never asks for a category with no question defined', () => {
    const laptop = parseShoppingTask('لابتوب للألعاب تحت 5000');
    expect(shouldAsk(laptop, [row('a', 12000, 1200)]).ask).toBe(false);
  });
});

describe('the question set is fixed and structured, never generated', () => {
  it('every question and option label is a literal with both locales', () => {
    for (const [category, q] of Object.entries(CLARIFY_BY_CATEGORY)) {
      expect(typeof category).toBe('string');
      expect(q.question_ar.length).toBeGreaterThan(8);
      expect(q.question_en.length).toBeGreaterThan(8);
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      for (const o of q.options) {
        expect(typeof o.value).toBe('number');
        expect(o.label_ar).toBeTruthy();
        expect(o.label_en).toBeTruthy();
      }
      // The probes must bracket the offered range, or the "does it matter" test is
      // measuring something narrower than what the customer can actually answer.
      const values = q.options.map((o) => o.value);
      expect(q.probes[0]).toBeLessThanOrEqual(Math.min(...values));
      expect(q.probes[1]).toBeGreaterThanOrEqual(Math.max(...values));
    }
  });

  it('exactly ONE question exists per category — the Constitution allows one', () => {
    for (const q of Object.values(CLARIFY_BY_CATEGORY)) {
      expect(typeof q.field).toBe('string');
    }
  });
});
