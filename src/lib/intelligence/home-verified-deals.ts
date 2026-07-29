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
}

/**
 * Top verified drops by ABSOLUTE saving — a real product first, never accessory
 * %-theatre. A 19 SAR case at 60% must not outrank an 8,800 SAR television.
 */
export async function getHomeVerifiedDeals(limit = 4): Promise<HomeVerifiedDeal[]> {
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

    return (data as unknown as Row[])
      .map((r) => {
        const price = Number(r.current_price);
        const observedMax = Number(r.observed_max);
        const trackedDays = Number(r.distinct_days);
        return {
          name: r.name ?? '',
          url: r.url ?? '',
          // Never render a raw store id to a customer (ADR-135); unresolved → no name.
          storeName: retailerDisplayName(resolveApprovedSlug(r.store_name) ?? '', 'ar'),
          price: Math.round(price * 100) / 100,
          observedMax: Math.round(observedMax * 100) / 100,
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
        d.trackedDays >= 2)
      .sort((a, b) =>
        (a._acc ? 1 : 0) - (b._acc ? 1 : 0) ||
        (b.observedMax - b.price) - (a.observedMax - a.price))
      .slice(0, limit)
      .map(({ _acc, ...d }) => { void _acc; return d; });
  } catch {
    // Deals are best-effort; the section hides itself when empty.
    return [];
  }
}
