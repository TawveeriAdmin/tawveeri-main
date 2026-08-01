// src/lib/intelligence/home-verified-deals.ts
//
// The homepage's "أفضل العروض", sourced from drops WE OBSERVED — not from a merchant's
// own "was" price.
//
// WHY THIS EXISTS: the homepage read `product_stores.original_price` and rendered
// "وفّر 62%" on a LAN cable from the merchant's own reference price. We publish that ~71%
// of advertised discounts reference a price we never observed, and were showing one of
// them as our own headline (ADR-129's gate was written before this surface existed and
// never reached it). The percentage is now gated off; this replaces it with the thing we
// can actually stand behind: the highest price we saw, and how long we watched.
//
// SERVER-ONLY. `tps_listing_price_facts` is not readable by `anon` — verified by probe,
// and correctly so — hence a server fetch threaded through as props rather than a client
// query or a new public endpoint. It is also NOT an HTTP call to our own API: that is the
// mistake the compare page made, where a self-fetch got rate-limited into rendering
// "no comparison available" for products with live offers.

import { createServerClient } from '@/lib/database';
import { resolveApprovedSlug, retailerDisplayName } from '@/lib/retailers/approved-retailers';

export interface HomeVerifiedDeal {
  name: string;
  url: string;
  storeName: string | null;
  price: number;
  observedMax: number;
  savingPct: number;
  trackedDays: number;
  /**
   * WHERE THE CARD SENDS THE SHOPPER (ADR-170).
   *
   * Never the raw retailer URL. Measured 2026-08-01: the homepage rendered 8 bare retailer
   * links and ZERO `/go/` exits, so every click left Tawveeri with no affiliate attribution
   * (`tag=tawveeri-21`) and no `go_click` — the only storefront exit signal we have — while
   * a comparison platform sent its visitor away on the first screen without a comparison.
   *
   * Preference order, decided by what we can actually deliver:
   *   compare page  → the shopper can compare (this is the product)
   *   `/go` exit    → attributed and measured, when no comparison exists
   * A deal that can offer neither is DROPPED, never rendered with a dead or unattributed link.
   */
  href: string;
  /** True when `href` is an internal compare page rather than an outbound exit. */
  internal: boolean;
}

/**
 * Top verified drops by ABSOLUTE saving — a real product first, never accessory
 * %-theatre. A 19 SAR case at 60% must not outrank an 8,800 SAR television.
 */
/**
 * Resolve each candidate URL to the offer it came from, and to a comparison when one exists.
 *
 * `tps_listing_price_facts` carries `url` and `store_id` but NO observation id and NO canonical —
 * verified against `information_schema`. The join is therefore on the observation's own raw URL
 * (`normalized_payload->>'_url'`), which is the same field `/go` reads when it builds an exit, so
 * a resolved id is guaranteed to produce a working exit rather than merely a plausible one.
 *
 * Measured: 131 of 300 candidates (43.7%) resolve. That is ample for a four-card strip, which is
 * why unresolvable deals are DROPPED rather than rendered unattributed. This is a curated strip
 * over a 300-row pool, not a result list — nothing claims a count, so filtering distorts nothing.
 * (Contrast CHECKPOINT #20, where omission was rejected because unroutable cards CONCENTRATED in
 * one query and would have shown 1 result where 14 existed.)
 */
async function resolveDestinations(
  supabase: ReturnType<typeof createServerClient>,
  urls: string[],
  locale: string,
): Promise<Map<string, { href: string; internal: boolean }>> {
  const out = new Map<string, { href: string; internal: boolean }>();
  if (!urls.length) return out;
  const sb = supabase as unknown as { from: (t: string) => { select: (c: string) => never } };

  const { data: obs } = await (sb.from('normalized_product_observations') as never as {
    select: (c: string) => { in: (k: string, v: string[]) => Promise<{ data: unknown[] | null }> };
  }).select('id, canonical_product_id, normalized_payload').in('normalized_payload->>_url', urls);

  type Obs = { id: string; canonical_product_id: string | null; normalized_payload: { _url?: string } | null };
  const byUrl = new Map<string, Obs>();
  for (const o of ((obs ?? []) as Obs[])) {
    const u = o.normalized_payload?._url;
    if (u && !byUrl.has(u)) byUrl.set(u, o);
  }
  if (!byUrl.size) return out;

  // Which canonicals can actually deliver a comparison. Asked of the projection — the same
  // source the compare page loads from — never inferred from a store count on another table.
  const canonIds = [...new Set([...byUrl.values()].map((o) => o.canonical_product_id).filter(Boolean))] as string[];
  const comparable = new Map<string, string>();
  if (canonIds.length) {
    const [{ data: proj }, { data: canon }] = await Promise.all([
      (sb.from('tps_product_projection') as never as { select: (c: string) => { in: (k: string, v: string[]) => Promise<{ data: unknown[] | null }> } })
        .select('canonical_id, has_comparison').in('canonical_id', canonIds),
      (sb.from('canonical_products') as never as { select: (c: string) => { in: (k: string, v: string[]) => Promise<{ data: unknown[] | null }> } })
        .select('id, tps_identity_key').in('id', canonIds),
    ]);
    const hasCmp = new Set(((proj ?? []) as { canonical_id: string; has_comparison: boolean }[])
      .filter((p) => p.has_comparison).map((p) => p.canonical_id));
    for (const c of ((canon ?? []) as { id: string; tps_identity_key: string | null }[])) {
      if (c.tps_identity_key && hasCmp.has(c.id)) comparable.set(c.id, c.tps_identity_key);
    }
  }

  for (const [url, o] of byUrl) {
    const key = o.canonical_product_id ? comparable.get(o.canonical_product_id) : undefined;
    out.set(url, key
      ? { href: `/${locale}/compare/${encodeURIComponent(key)}`, internal: true }
      // `source=home_deal` so this surface is separable in `outbound_clicks` from every other exit.
      : { href: `/go/${o.id}?source=home_deal`, internal: false });
  }
  return out;
}

export async function getHomeVerifiedDeals(limit = 4, locale = 'ar'): Promise<HomeVerifiedDeal[]> {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('tps_listing_price_facts')
      .select('name, url, store_name, current_price, observed_max, real_saving_pct, distinct_days, category, last_seen')
      .eq('verdict', 'verified_drop')
      .order('last_seen', { ascending: false })
      .limit(300);

    if (error || !data?.length) return [];

    type Row = {
      name: string | null; url: string | null; store_name: string | null;
      current_price: number | string | null; observed_max: number | string | null;
      real_saving_pct: number | string | null; distinct_days: number | string | null;
      category: string | null;
    };

    const isAccessory = (c: string | null) => String(c ?? '').toLowerCase().includes('accessor');

    const ranked = (data as unknown as Row[])
      .map((r) => {
        const price = Number(r.current_price);
        const observedMax = Number(r.observed_max);
        const trackedDays = Number(r.distinct_days);
        return {
          name: r.name ?? '',
          url: r.url ?? '',
          // Never render a raw store id to a customer (ADR-135); unresolved → no name.
          storeName: retailerDisplayName(resolveApprovedSlug(r.store_name) ?? '', 'ar'),
          // Whole riyals. Saudi retail prices are whole; a trailing .01 is a VAT-computed
          // float artifact, and "12,499.01" on a trust surface reads as noise rather than
          // evidence. Same convention as the ADR-129 float fix (69.000001 → 69).
          price: Math.round(price),
          observedMax: Math.round(observedMax),
          savingPct: Math.round(Number(r.real_saving_pct) || 0),
          trackedDays: Number.isFinite(trackedDays) ? trackedDays : 0,
          _acc: isAccessory(r.category),
        };
      })
      .filter((d) =>
        d.name && d.url &&
        Number.isFinite(d.price) && d.price > 0 &&
        Number.isFinite(d.observedMax) && d.observedMax > d.price &&
        // A drop we watched for a single day is not evidence of anything.
        d.trackedDays >= 2 &&
        // Accessories are excluded from trust surfaces ENTIRELY, not merely ranked last.
        // Percentage ranking is what put a 19 SAR phone case above an 8,800 SAR saving.
        !d._acc &&
        // A saving of a few halalas is float noise, not a deal. Below 50 SAR there is no
        // customer decision to support, and publishing it cheapens every real number
        // beside it.
        (d.observedMax - d.price) >= 50)
      .sort((a, b) =>
        (a._acc ? 1 : 0) - (b._acc ? 1 : 0) ||
        (b.observedMax - b.price) - (a.observedMax - a.price));

    // Resolve destinations for a WIDER slice than we render, then take the top `limit` that
    // actually resolve. Resolving only the top 4 would leave the strip short whenever one of
    // them happened to be unroutable — the pool is 300 and 44% resolve, so look further.
    const candidates = ranked.slice(0, Math.max(limit * 8, 40));
    const dest = await resolveDestinations(supabase, candidates.map((d) => d.url), locale);

    return candidates
      .filter((d) => dest.has(d.url))
      .slice(0, limit)
      .map(({ _acc, url, ...d }) => {
        void _acc;
        void url; // the raw retailer URL never reaches the client — the exit is built here
        const { href, internal } = dest.get(url)!;
        return { ...d, url, href, internal };
      });
  } catch {
    // Deals are best-effort; the section hides itself when empty.
    return [];
  }
}
