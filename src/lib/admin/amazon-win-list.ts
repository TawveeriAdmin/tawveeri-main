// src/lib/admin/amazon-win-list.ts — ADR-398 (point ج): where Amazon actually wins today.
//
// The growth surface needs a list the founder can publish from WITHOUT guessing: products where
// amazon's offer is (1) confirmed from the detail page within 48 h, (2) paired with a valid
// extra or almanea offer (the comparison a Saudi shopper makes), and (3) cheaper than every
// other valid offer — ranked by the saving. Reads the TPS current-state table only (never the
// raw storefront rows), paginated per ADR-172/285, and joins the projection for the display name
// and the compare URL. Deterministic; no LLM; nothing commercial enters the ranking except the
// price gap itself.
import { createServerClient } from '@/lib/database';
import { fetchAllPaginated } from '@/lib/database/paginated-fetch';

export interface AmazonWin {
  identityKey: string; category: string; nameAr: string | null; compareUrl: string | null;
  amazonPrice: number; bestOtherPrice: number; bestOtherStore: string; savingSar: number; savingPct: number;
  amazonObservedAt: string; otherStoresCount: number;
}
export interface AmazonWinList { wins: AmazonWin[]; byCategory: Array<{ category: string; wins: number }>; keysCompared: number; implausibleExcluded: number; generatedAt: string; reason: string | null }

/** A same-product price gap wider than this is far more likely an identity mismatch (two sizes/
 *  tiers sharing a key) than a real deal — ADR-200's 4x bound for a single offer, tightened for
 *  something the founder may PUBLISH. Measured live 2026-10-01: the top raw "win" was a 75-inch
 *  TCL at 4,179 vs 20,999 (5x) — not a deal to post. Excluded and counted, never shown. */
export const MAX_PLAUSIBLE_RATIO = 2.5;

type Row = Record<string, unknown>;
type Client = { from: (t: string) => any };
const STORE_AR: Record<string, string> = { 4: 'إكسترا', 5: 'المنيع', 3: 'نون', 1: 'جرير', 6: 'سامسونج', 18: 'النخيل', 9: 'نجم', 10: 'بلاك بوكس', 7: 'شاكر', 8: 'الشتاء والصيف' };

/** Pure ranking over already-fetched offers. */
export function rankAmazonWins(amazon: Array<{ identity_key: string; category: string; price: number; observed_at: string }>, others: Array<{ identity_key: string; store_id: number; price: number; observed_at: string }>, names: Map<string, { nameAr: string | null; compareUrl: string | null }>, now = Date.now(), freshHours = 48, counters?: { implausible: number }): AmazonWin[] {
  const byKey = new Map<string, Array<{ store_id: number; price: number; observed_at: string }>>();
  for (const o of others) byKey.set(o.identity_key, [...(byKey.get(o.identity_key) ?? []), o]);
  const wins: AmazonWin[] = [];
  for (const a of amazon) {
    const ageH = (now - Date.parse(a.observed_at)) / 3_600_000;
    if (!Number.isFinite(ageH) || ageH > freshHours) continue;
    const comp = (byKey.get(a.identity_key) ?? []).filter((o) => o.price > 0 && (now - Date.parse(o.observed_at)) / 3_600_000 <= 168);
    const anchored = comp.filter((o) => o.store_id === 4 || o.store_id === 5);
    if (!anchored.length) continue;
    const best = comp.reduce((m, o) => (o.price < m.price ? o : m));
    if (!(a.price > 0 && a.price < best.price)) continue;
    if (best.price / a.price > MAX_PLAUSIBLE_RATIO) { if (counters) counters.implausible++; continue; }
    const n = names.get(a.identity_key);
    wins.push({
      identityKey: a.identity_key, category: a.category, nameAr: n?.nameAr ?? null, compareUrl: n?.compareUrl ?? null,
      amazonPrice: a.price, bestOtherPrice: best.price, bestOtherStore: STORE_AR[String(best.store_id)] ?? String(best.store_id),
      savingSar: Math.round((best.price - a.price) * 100) / 100, savingPct: Math.round(((best.price - a.price) / best.price) * 1000) / 10,
      amazonObservedAt: a.observed_at, otherStoresCount: new Set(comp.map((o) => o.store_id)).size,
    });
  }
  return wins.sort((x, y) => y.savingPct - x.savingPct || y.savingSar - x.savingSar);
}

export async function fetchAmazonWinList(limit = 12): Promise<AmazonWinList> {
  const generatedAt = new Date().toISOString();
  try {
    const sb = createServerClient() as unknown as Client;
    const amazon = await fetchAllPaginated<Row>((from, to) => sb.from('tps_current_offers').select('identity_key, category, price, observed_at').eq('store_id', 2).eq('status', 'valid')
      .order('category', { ascending: true }).order('identity_key', { ascending: true }).range(from, to));
    const keys = [...new Set(amazon.map((r) => String(r.identity_key)))];
    const others: Row[] = [];
    for (let i = 0; i < keys.length; i += 150) {
      const slice = keys.slice(i, i + 150);
      const { data, error } = await sb.from('tps_current_offers').select('identity_key, store_id, price, observed_at').in('identity_key', slice).neq('store_id', 2).eq('status', 'valid');
      if (error) throw new Error(error.message);
      others.push(...((data ?? []) as Row[]));
    }
    const winKeys = rankAmazonWins(amazon as never, others as never, new Map()).map((w) => w.identityKey);
    const names = new Map<string, { nameAr: string | null; compareUrl: string | null }>();
    for (let i = 0; i < winKeys.length; i += 150) {
      const slice = winKeys.slice(i, i + 150);
      const { data, error } = await sb.from('tps_product_projection').select('tps_identity_key, display_name_ar, compare_url').in('tps_identity_key', slice);
      if (error) throw new Error(error.message);
      for (const r of (data ?? []) as Row[]) names.set(String(r.tps_identity_key), { nameAr: (r.display_name_ar as string | null) ?? null, compareUrl: (r.compare_url as string | null) ?? null });
    }
    const counters = { implausible: 0 };
    const wins = rankAmazonWins(amazon as never, others as never, names, Date.now(), 48, counters);
    const byCat = new Map<string, number>();
    for (const w of wins) byCat.set(w.category, (byCat.get(w.category) ?? 0) + 1);
    return { wins: wins.slice(0, limit), byCategory: [...byCat].map(([category, n]) => ({ category, wins: n })).sort((a, b) => b.wins - a.wins), keysCompared: keys.length, implausibleExcluded: counters.implausible, generatedAt, reason: null };
  } catch (e) {
    return { wins: [], byCategory: [], keysCompared: 0, implausibleExcluded: 0, generatedAt, reason: e instanceof Error ? e.message : 'unknown error' };
  }
}
