import { parseShoppingTask } from '@/lib/agent/task-parser';
import { categorySource } from '@/lib/agent/home-mission-discovery';

/** Storefront groups fridges/washers under appliance. Refine only that known
 * group with the existing parser for the invitation; never alter search results,
 * filters, budgets or engine classification. Unknown/other appliances stay quiet. */
export function homeMissionEntrySource(category: string | null, query: string) {
  if (category !== 'appliance') return categorySource(category);
  const subtype = parseShoppingTask(query).category;
  return subtype === 'refrigerator' || subtype === 'washing_machine' ? categorySource(subtype) : null;
}
