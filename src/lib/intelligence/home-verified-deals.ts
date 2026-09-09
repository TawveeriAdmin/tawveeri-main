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
import { buildGoUrl } from '@/lib/analytics/build-go-url';
import { getProvider } from '@/lib/providers';
import { hasAccessoryHint } from '@/app/api/search/route';
import { isFreshObservation } from '@/lib/intelligence/evidence-engine';

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
   * (`tag=tawveeri0f-21`) and no `go_click` — the only storefront exit signal we have — while
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

export interface VerifiedDropRow {
  name: string | null; url: string | null; store_name: string | null;
  current_price: number | string | null; observed_max: number | string | null;
  real_saving_pct: number | string | null; distinct_days: number | string | null;
  category: string | null; last_seen: string | null;
}

/** Pre-destination-resolution candidate — everything rankVerifiedDropRows can decide
 *  from the row alone, before the async DB lookups in resolveDestinations(). Exported
 *  purely for direct unit-testing (Affiliate Opportunity Recovery mission, 2026-09-09)
 *  — mirrors this codebase's own precedent of extracting pure ranking/eligibility
 *  logic (deriveCampaignStatus, isCampaignEligible) out of its async DB-touching
 *  caller so the RULES are testable without mocking a Supabase client at all. */
export interface RankedVerifiedDrop {
  name: string; url: string; storeName: string | null;
  price: number; observedMax: number; savingPct: number; trackedDays: number;
}

const isAccessoryCategory = (c: string | null) => String(c ?? '').toLowerCase().includes('accessor');

/**
 * MEASURED (Affiliate Opportunity Recovery mission, 2026-09-09) — CATEGORY
 * MISCLASSIFICATION, scoped fix. Audited ALL 258 amazon accessory-tagged
 * verified_drop rows (not a sample): 50 are genuine accessories, 37 are confirmed
 * primary products mislabeled 'accessories' (TVs overwhelmingly — Sony, Samsung,
 * Nikai, Haier, TCL, Panasonic, ARRQW, Impex — plus one projector), 171 uncertain.
 * Root cause traced to `products` rows: `category` (and `brand`) are set from the
 * DISCOVERY QUERY's own context at ingestion time, not derived from the listing's own
 * title — e.g. an "accessories"- or "Apple"-scoped Amazon search occasionally returns
 * an unrelated fuzzy match (a competitor's TV), which then inherits that query's
 * category/brand permanently. Confirmed live: the SAME Nikai 65" TV model exists as
 * two separate `products` rows — one correctly `category='tv'`, one
 * `category='accessories'` — from two different discovery runs.
 *
 * FIX SCOPE (deliberately narrow, per "quarantine beats wrong inclusion" and "do not
 * perform a blind bulk rewrite"): this is a READ-TIME override inside this evidence-
 * selection path ONLY — it never writes to `products.category`, so search/compare/
 * every other consumer of that column is completely unaffected (proven unchanged —
 * see the mission's own regression tests). It reuses the EXISTING, already-proven
 * accessory-hint detector from the search relevance system (`hasAccessoryHint`,
 * src/app/api/search/route.ts — the same function that already correctly excludes
 * real accessories platform-wide) as a VETO: an item is only ever promoted out of
 * 'accessories' when (a) that proven detector does NOT think the title looks like an
 * accessory, AND (b) the title contains an unambiguous, narrow, primary-product
 * signal. Only the TV pattern — the confirmed, dominant defect class (35 of 37) — is
 * covered; the one projector and all 171 uncertain rows are deliberately left excluded
 * (QUARANTINE, not extrapolated).
 */
const STRONG_UNAMBIGUOUS_TV_TITLE = /\b\d{2,3}["']?\s*-?\s*inch\b[^|]*\btv\b|\btv\b[^|]*\b\d{2,3}["']?\s*-?\s*inch\b|\bsmart\s+(google\s+)?tv\b/i;
export function isMiscategorizedPrimaryProduct(name: string, category: string | null): boolean {
  return isAccessoryCategory(category) && !hasAccessoryHint('', name) && STRONG_UNAMBIGUOUS_TV_TITLE.test(name);
}

/**
 * Extracts a real Amazon ASIN (10 alphanumeric chars) from a `/dp/{ASIN}/` product
 * URL segment, or null when the URL doesn't contain one — e.g. a non-Amazon URL, a
 * category/search-listing URL with no `/dp/` segment, or a malformed one. Exported
 * for direct testing of the "ambiguous/unknown ASIN fails closed" requirement
 * (Affiliate Opportunity Recovery mission, 2026-09-09, §16F) without needing a live
 * Supabase client.
 */
export function extractAmazonAsin(url: string): string | null {
  const m = url.match(/\/dp\/([A-Z0-9]{10})(?:[/?]|$)/i);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Pure ranking/filtering pipeline — takes raw `tps_listing_price_facts` rows (already
 * fetched, already merchant-filtered at the DB level when `merchantSlug` is set — see
 * getVerifiedDeals()'s own query) and decides which ones qualify for display and in
 * what order. Zero DB access — safe and fast to unit-test directly.
 *
 * `merchantSlug` re-checks `resolveApprovedSlug(store_name) === merchantSlug` as a
 * defense-in-depth belt-and-braces guard: the DB query already scopes to the right
 * `store_name`, so this should never actually filter anything out in production, but
 * a mismatch here would fail closed (empty) rather than leak a wrong-merchant row.
 */
export function rankVerifiedDropRows(data: VerifiedDropRow[], merchantSlug: string | null): (RankedVerifiedDrop & { _acc: boolean; _fresh: boolean; _slug: string | null })[] {
  return data
    .map((r) => {
      const price = Number(r.current_price);
      const observedMax = Number(r.observed_max);
      const trackedDays = Number(r.distinct_days);
      const slug = resolveApprovedSlug(r.store_name);
      const name = r.name ?? '';
      return {
        name,
        url: r.url ?? '',
        // Never render a raw store id to a customer (ADR-135); unresolved → no name.
        storeName: retailerDisplayName(slug ?? '', 'ar'),
        _slug: slug,
        // Whole riyals. Saudi retail prices are whole; a trailing .01 is a VAT-computed
        // float artifact, and "12,499.01" on a trust surface reads as noise rather than
        // evidence. Same convention as the ADR-129 float fix (69.000001 → 69).
        price: Math.round(price),
        observedMax: Math.round(observedMax),
        savingPct: Math.round(Number(r.real_saving_pct) || 0),
        trackedDays: Number.isFinite(trackedDays) ? trackedDays : 0,
        _acc: isAccessoryCategory(r.category) && !isMiscategorizedPrimaryProduct(name, r.category),
        // Freshness (mission §1/§3): the pool-starvation fix removes the (accidental,
        // undocumented) recency-sort side effect that used to keep a merchant-scoped
        // result roughly fresh by construction — an EXPLICIT gate is now required so a
        // wide, unscoped-by-recency query can never surface a genuinely stale "drop" as
        // current. Same 168h standard already established platform-wide (evidence-
        // engine.ts's PICK_FRESHNESS_MAX_HOURS, the Smart Pick's own freshness floor) —
        // not a new or different threshold.
        _fresh: isFreshObservation(r.last_seen),
      };
    })
    .filter((d) =>
      d.name && d.url &&
      // Merchant-scoped page (getMerchantVerifiedDeals): only this merchant's own
      // verified drops. null merchantSlug (getHomeVerifiedDeals) = every merchant, the
      // original unchanged behavior.
      (merchantSlug === null || d._slug === merchantSlug) &&
      d._fresh &&
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
type Obs = { id: string; canonical_product_id: string | null; normalized_payload: { _url?: string } | null };

/**
 * MEASURED (2026-09-09, Merchant Affiliate Campaign Engine mission): a `.in()` filter
 * built from real Amazon.sa URLs (each ~300-600 chars — Amazon's own `dib=`/tracking
 * query params are long, unlike jarir/extra/almanea's short paths) fails outright once
 * the combined query string crosses a size threshold PostgREST/the network path
 * enforces — live-reproduced: 25 such URLs in one `.in()` call succeeded, 37 failed with
 * a bare "fetch failed" (no partial data, silently swallowed by this function's own
 * try/catch upstream). getHomeVerifiedDeals (all merchants mixed, mostly short URLs)
 * never hit this because Amazon's long URLs were diluted among many short ones;
 * getMerchantVerifiedDeals('amazon', ...) sends ONLY long Amazon URLs and hit it
 * immediately. Fixed generically here (benefits every caller, not just the merchant
 * page) by batching into small, safely-sized chunks and merging — never a query-size
 * gamble on the caller's URL mix.
 */
const RESOLVE_BATCH_SIZE = 15;

async function resolveDestinations(
  supabase: ReturnType<typeof createServerClient>,
  urls: string[],
  locale: string,
): Promise<Map<string, { href: string; internal: boolean }>> {
  const out = new Map<string, { href: string; internal: boolean }>();
  if (!urls.length) return out;
  const sb = supabase as unknown as { from: (t: string) => { select: (c: string) => never } };

  const batches: string[][] = [];
  for (let i = 0; i < urls.length; i += RESOLVE_BATCH_SIZE) batches.push(urls.slice(i, i + RESOLVE_BATCH_SIZE));

  const byUrl = new Map<string, Obs>();
  const batchResults = await Promise.all(batches.map(async (batch) => {
    // Supabase's query builder is a thenable, not a real Promise — it has no .catch()
    // of its own, so a batch failure must be caught by awaiting it inside a real async
    // function (the bug this fixes: a bare `.catch()` chained directly on the builder
    // threw "not a function" and that throw was itself swallowed by this file's own
    // outer try/catch, silently returning [] for every caller — proven live 2026-09-09).
    try {
      return await (sb.from('normalized_product_observations') as never as {
        select: (c: string) => { in: (k: string, v: string[]) => Promise<{ data: unknown[] | null; error: unknown }> };
      }).select('id, canonical_product_id, normalized_payload').in('normalized_payload->>_url', batch);
    } catch {
      return { data: null, error: 'batch_failed' };
    }
  }));
  for (const { data } of batchResults) {
    for (const o of ((data ?? []) as Obs[])) {
      const u = o.normalized_payload?._url;
      if (u && !byUrl.has(u)) byUrl.set(u, o);
    }
  }

  // AMAZON ASIN FALLBACK (Affiliate Opportunity Recovery mission, 2026-09-09).
  //
  // MEASURED root cause: `normalized_product_observations` is populated by a legacy,
  // manually-invoked TPS normalizer script (scripts/write-observations.ts /
  // write-product-observations.ts) — not the continuous, automated pipeline that keeps
  // `products.canonical_product_id` fresh. Live-reproduced: of 37 Amazon candidates
  // that pass every quality gate, 29 have NO row in that table at all — not because
  // they're stale (the table's own most recent row is from today) but because Amazon's
  // own search-result URLs embed a session-specific `qid`/`sr` rank that changes on
  // EVERY re-scrape, so an exact-URL join between two independently-scraped snapshots
  // almost never lands, even for a listing scraped minutes apart. The stable identity
  // Amazon itself provides is the ASIN (the `/dp/{ASIN}/` segment), not the URL.
  //
  // FIX: for any Amazon URL still unresolved after the exact-URL lookup above, extract
  // its ASIN and resolve through `product_stores`/`products` instead — the SAME
  // storefront-layer authority already trusted by /deals, search, compare and /go
  // (Option B: "resolve through an existing canonical/current-offer authority already
  // trusted elsewhere," not a new or speculative one). This does not change how the
  // final link is BUILT — it is the exact existing `buildGoUrl`/compare-routing logic
  // below, fed a `product_stores.product_url` (a real, currently-scraped amazon.sa
  // product URL) in place of a `normalized_product_observations` URL. No Special Link
  // is hand-constructed from a bare ASIN+tag; the already-tag-injecting exit path
  // (buildOfferExitLink/amazon.ts) is reused unchanged, exactly as it is for every
  // other Amazon exit on the platform. Fails closed: an ASIN that cannot be extracted,
  // or that has no CURRENT (in_stock) `product_stores` row, is left unresolved —
  // exactly like today, never a guess.
  const unresolvedAsinUrls = urls.filter((u) => !byUrl.has(u) && /amazon\.[a-z.]+\//i.test(u));
  if (unresolvedAsinUrls.length) {
    const asinByUrl = new Map<string, string>();
    for (const u of unresolvedAsinUrls) {
      const asin = extractAmazonAsin(u);
      if (asin) asinByUrl.set(u, asin);
    }
    const asins = [...new Set(asinByUrl.values())];
    if (asins.length) {
      // AMAZON_STORE_ID: matches registry.ts's amazon entry (storeId: 2) — this file
      // already hard-codes numeric store ids elsewhere via resolveApprovedSlug's own
      // STORE_ID_TO_SLUG table, so this is not a new convention.
      const AMAZON_STORE_ID = 2;
      const orFilter = asins.map((a) => `product_url.ilike.%/dp/${a}%`).join(',');
      const { data: psRows } = await (sb.from('product_stores') as never as {
        select: (c: string) => { eq: (k: string, v: unknown) => { eq: (k: string, v: unknown) => { or: (f: string) => Promise<{ data: unknown[] | null }> } } };
      }).select('id, product_id, product_url, availability').eq('store_id', AMAZON_STORE_ID).eq('availability', 'in_stock').or(orFilter);

      type PsRow = { id: string; product_id: string; product_url: string; availability: string };
      const psByAsin = new Map<string, PsRow>();
      for (const r of ((psRows ?? []) as PsRow[])) {
        const asin = extractAmazonAsin(r.product_url);
        // First in_stock match wins per ASIN — this is a fallback identity lookup, not
        // a "best price" computation (that stays getVerifiedDeals' own job upstream).
        if (asin && !psByAsin.has(asin)) psByAsin.set(asin, r);
      }

      const productIds = [...new Set([...psByAsin.values()].map((r) => r.product_id))];
      const canonByProductId = new Map<string, string | null>();
      if (productIds.length) {
        const { data: products } = await (sb.from('products') as never as {
          select: (c: string) => { in: (k: string, v: string[]) => Promise<{ data: unknown[] | null }> };
        }).select('id, canonical_product_id').in('id', productIds);
        for (const p of ((products ?? []) as { id: string; canonical_product_id: string | null }[])) {
          canonByProductId.set(p.id, p.canonical_product_id);
        }
      }

      for (const [url, asin] of asinByUrl) {
        const ps = psByAsin.get(asin);
        if (!ps) continue; // no current, in-stock offer for this ASIN — fail closed
        byUrl.set(url, {
          // `ps_` prefix — the EXISTING, already-supported storefront-id convention
          // /go/[offerId]/route.ts and buildGoUrl() already branch on (see
          // build-go-url.ts's own doc comment); this is not a new capability, only the
          // first time this file's resolveDestinations() has had a reason to use it.
          id: `ps_${ps.id}`,
          canonical_product_id: canonByProductId.get(ps.product_id) ?? null,
          normalized_payload: { _url: ps.product_url },
        });
      }
    }
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
      : { href: buildGoUrl(o.id, { source: 'home_deal' }), internal: false });
  }
  return out;
}

/**
 * Merchant Affiliate Campaign Engine (Sept 2026 mission) — reuses this SAME verified-
 * drop evidence, ranking and destination-resolution logic for a single merchant's
 * evergreen offers page (`/offers/[merchant]`), instead of inventing a second deal-
 * selection engine. `merchantSlug` filters candidates by `resolveApprovedSlug(store_name)`
 * — the exact normalization the display step below already applies — never by matching
 * raw `store_name` strings directly (many scraper-side spellings exist for one retailer).
 */
export async function getMerchantVerifiedDeals(merchantSlug: string, limit = 12, locale = 'ar'): Promise<HomeVerifiedDeal[]> {
  return getVerifiedDeals(limit, locale, merchantSlug);
}

export async function getHomeVerifiedDeals(limit = 4, locale = 'ar'): Promise<HomeVerifiedDeal[]> {
  return getVerifiedDeals(limit, locale, null);
}

/**
 * MEASURED (Affiliate Opportunity Recovery mission, 2026-09-09) — POOL-STARVATION
 * DEFECT, now fixed: this query used to fetch the top 300 `verified_drop` rows
 * GLOBALLY (across every merchant combined) by `last_seen`, and only afterward filter
 * to one merchant. Live-reproduced: that 300-row window spanned barely 42 minutes of
 * the fastest-refreshing stores (jarir/amazon/extra/almanea); Noon's own freshest row
 * was ~4 days older than that window, so ALL 3,024 of Noon's real `verified_drop` rows
 * were structurally invisible before merchant-filtering ever ran — not because they
 * don't exist, but because a slower-refreshing merchant can never win a spot in a
 * globally-shared, recency-sorted top-300 against faster ones. This is Option A from
 * the mission's own candidates (filter by merchant+verdict in the database BEFORE
 * ordering/limiting) — the simplest correct fix for a SINGLE-merchant candidate set,
 * and the one actually needed: production evidence (see the mission's own report)
 * shows Noon's TRUE binding constraint today is freshness (only ~2 of its 3,024 rows
 * are within the platform's own 7-day freshness standard), not this pool architecture
 * — but the architecture bug is real regardless and would silently recur for ANY
 * future merchant whose refresh cadence is slower than its neighbors, so it is fixed
 * here at the root rather than left for the next merchant to rediscover.
 *
 * Homepage's cross-merchant getHomeVerifiedDeals() is DELIBERATELY UNCHANGED: it is a
 * neutral, merchant-agnostic "best deals platform-wide" surface, not a per-merchant
 * one — showing whichever products carry the strongest fresh evidence, regardless of
 * merchant, is the correct neutral behavior there, not starvation. (A per-merchant-
 * partitioned homepage variant was evaluated and explicitly deferred — see the
 * mission's own report for why the evidence doesn't yet justify that added
 * complexity.)
 */
async function getVerifiedDeals(limit: number, locale: string, merchantSlug: string | null): Promise<HomeVerifiedDeal[]> {
  try {
    const supabase = createServerClient();
    let query = supabase
      .from('tps_listing_price_facts')
      .select('name, url, store_name, current_price, observed_max, real_saving_pct, distinct_days, category, last_seen')
      .eq('verdict', 'verified_drop');

    if (merchantSlug) {
      const storeId = getProvider(merchantSlug)?.storeId;
      // No known store id for this slug — fail closed (empty), never fall back to the
      // unscoped global query, which would defeat the entire point of this filter.
      if (storeId == null) return [];
      query = query.eq('store_name', String(storeId));
    }

    const { data, error } = await query
      .order('last_seen', { ascending: false })
      // Merchant-scoped: no cross-merchant crowding, so a wide cap here only guards
      // against pathological data volume, never against another store's freshness.
      // Unscoped (homepage): unchanged 300, exactly as before.
      .limit(merchantSlug ? 2000 : 300);

    if (error || !data?.length) return [];

    const ranked = rankVerifiedDropRows(data as unknown as VerifiedDropRow[], merchantSlug);

    // Resolve destinations for a WIDER slice than we render, then take the top `limit` that
    // actually resolve. Resolving only the top 4 would leave the strip short whenever one of
    // them happened to be unroutable — the pool is 300 and 44% resolve, so look further.
    const candidates = ranked.slice(0, Math.max(limit * 8, 40));
    const dest = await resolveDestinations(supabase, candidates.map((d) => d.url), locale);

    // DESTINATION-RESOLUTION HEALTH (Affiliate Opportunity Recovery mission, §5) — the
    // minimum useful observability, reusing this codebase's own existing convention
    // (a structured console.warn, same as [category-enforced-zero]/[candidate-eligibility]
    // in src/app/api/search/route.ts) rather than a new dashboard/platform. Scoped to
    // merchant-page calls with a real sample (>=10 candidates) so a 1-of-2 Noon sample
    // never fires a noisy false alarm. Threshold (30%) is set from this mission's own
    // measured baseline: pre-fix Amazon resolution was ~22% (8 of 37); the ASIN
    // fallback above is expected to raise this well past 30% — a future regression back
    // toward the pre-fix rate is exactly the "95% → 20%, hidden until a Founder
    // manually notices" scenario this log exists to surface in production logs first.
    if (merchantSlug && candidates.length >= 10) {
      const resolutionRate = dest.size / candidates.length;
      if (resolutionRate < 0.3) {
        console.warn(
          `[verified-deals-resolution-health] merchant=${merchantSlug} candidates=${candidates.length} resolved=${dest.size} rate=${(resolutionRate * 100).toFixed(1)}% (below 30% baseline floor)`,
        );
      }
    }

    return candidates
      .filter((d) => dest.has(d.url))
      .slice(0, limit)
      .map(({ _acc, _slug, _fresh, url, ...d }) => {
        void _acc;
        void _slug;
        void _fresh;
        void url; // the raw retailer URL never reaches the client — the exit is built here
        const { href, internal } = dest.get(url)!;
        return { ...d, url, href, internal };
      });
  } catch {
    // Deals are best-effort; the section hides itself when empty.
    return [];
  }
}
