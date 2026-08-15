// Tawveeri answerability — the HARD GATE (ADR-247 §14). Deterministic and read
// from PRODUCTION TRUTH (tps_product_projection), never a hardcoded catalog:
// a category is radar-active only if current Tawveeri can genuinely help there.

import { createServerClient } from '@/lib/database';
import type { Answerability, CategoryCapability } from './types';

// Thresholds: enough catalog to answer a recommendation usefully, enough
// comparables that "compare before you buy" is a real promise there, and
// recent observations so the answer isn't stale.
const MIN_PRODUCTS = 80;
const MIN_COMPARABLE = 20;
const MIN_FRESH_7D = 10;

let cache: { at: number; caps: Map<string, CategoryCapability> } | null = null;
const CACHE_MS = 60 * 60 * 1000;

export async function getCategoryCapabilities(): Promise<Map<string, CategoryCapability>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.caps;
  const sb = createServerClient() as any;
  const iso7d = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  // Three head-counts per category would be 60+ queries; one page of rows is
  // simpler: pull category + has_comparison + last_observed_at in pages.
  const caps = new Map<string, CategoryCapability>();
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('tps_product_projection')
      .select('category, has_comparison, last_observed_at')
      .range(from, from + 999);
    if (error) throw new Error(`capability read failed: ${error.message}`);
    for (const r of (data ?? []) as Array<{ category: string | null; has_comparison: boolean; last_observed_at: string | null }>) {
      const key = r.category ?? 'unknown';
      const c = caps.get(key) ?? { category: key, products: 0, comparable: 0, fresh7d: 0, active: false };
      c.products++;
      if (r.has_comparison) c.comparable++;
      if (r.last_observed_at && r.last_observed_at >= iso7d) c.fresh7d++;
      caps.set(key, c);
    }
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  for (const c of caps.values()) {
    c.active = c.products >= MIN_PRODUCTS && c.comparable >= MIN_COMPARABLE && c.fresh7d >= MIN_FRESH_7D;
  }
  cache = { at: Date.now(), caps };
  return caps;
}

export async function assessAnswerability(
  category: string | null
): Promise<{ answerability: Answerability; reason: string }> {
  if (!category) return { answerability: 'unknown', reason: 'لم تتحدد الفئة' };
  let caps: Map<string, CategoryCapability>;
  try {
    caps = await getCategoryCapabilities();
  } catch (e) {
    // §37: a failed capability read is UNKNOWN, never a confident yes/no.
    return { answerability: 'unknown', reason: `تعذر قراءة قدرة الكتالوج (${e instanceof Error ? e.message : 'error'})` };
  }
  const c = caps.get(category);
  if (!c) return { answerability: 'no', reason: 'فئة غير مدعومة في الكتالوج الحالي' };
  if (c.active) {
    return {
      answerability: 'yes',
      reason: `الفئة مدعومة: ${c.products} منتجًا، ${c.comparable} قابلة للمقارنة، ${c.fresh7d} حديثة خلال 7 أيام`,
    };
  }
  if (c.products >= 30) {
    return {
      answerability: 'partial',
      reason: `دعم جزئي: ${c.products} منتجًا لكن المقارنات/الحداثة تحت العتبة (${c.comparable} مقارنة، ${c.fresh7d} حديثة)`,
    };
  }
  return { answerability: 'no', reason: `كتالوج غير كافٍ (${c.products} منتجًا فقط)` };
}
