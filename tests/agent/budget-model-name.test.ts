import { parseShoppingTask } from '@/lib/agent/task-parser';
import { routeQuery } from '@/lib/agent/route-query';

describe('Budget extraction preserves product model names', () => {
  it.each([
    'iPhone 16 Pro Max 256',
    'iPhone 16 Pro Max 512GB',
    'iPhone 16 PRO MAX ٢٥٦',
    'ايفون 16 Pro Max ۲۵۶',
    'iPhone 16 Pro   Max 256',
    'iPhone 16 Pro-Max 256',
  ])('does not turn storage into a price ceiling: %s', (query) => {
    expect(parseShoppingTask(query).budget_total).toBeUndefined();
    expect(routeQuery(query).task?.budget_total).toBeUndefined();
  });

  it.each([
    ['iPhone 16 Pro Max 256 under 5000', 5000],
    ['ايفون 16 Pro Max 256 تحت 5000', 5000],
    ['iPhone 16 Pro Max 256 max 5000', 5000],
    ['ايفون Pro Max ٢٥٦ تحت ٤٠٠٠ ريال', 4000],
    ['iPhone 16 Pro Max 256 budget around 4,000', 4000],
    ['phone max 3000', 3000],
    ['max 2500 for a phone', 2500],
    ['مكيف لغرفة 30 متر هادئ تحت 4000', 4000],
    ['a quiet AC for a 30 m² room under 4000', 4000],
    ['جوال بحد أقصى 2000', 2000],
    ['جوال بميزانيتي 3000 ريال', 3000],
  ])('keeps an explicitly stated budget: %s', (query, budget) => {
    expect(parseShoppingTask(query as string).budget_total).toBe(budget);
  });

  it('preserves the original model text for downstream retrieval', () => {
    const query = 'iPhone 16 Pro Max 256';
    expect(parseShoppingTask(query).parsed_from_text).toBe(query);
  });
});
