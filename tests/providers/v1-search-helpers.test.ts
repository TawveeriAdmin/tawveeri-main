// tests/providers/v1-search-helpers.test.ts
// GET /api/v1/tps/search — the display-gate fix + conditional-offer evidence mapping
// (2026-08-06, see docs/BLACKBOX-RETAILER-ONBOARDING.md). This endpoint feeds mobile/agentic
// clients and Waffar's context, so its price separation must be unit-tested independent of
// the DB-backed route.
import { mapFreeGiftToConditionalOffer, summarizeOffers } from '@/lib/tps/v1-search-helpers';

const NOW = new Date('2026-08-06T20:00:00Z');
const FRESH = '2026-08-06T18:39:26.138Z'; // ~1h20m before NOW — well inside the 72h TTL
const STALE = '2026-08-01T00:00:00Z'; // ~5.8 days before NOW — past the 72h TTL

describe('mapFreeGiftToConditionalOffer', () => {
  it('maps a real-shaped free_gifts record to conditional-offer evidence', () => {
    const payload = {
      specifications: {
        free_gifts: [
          {
            name_ar: 'فريزر افقي هايسنس', name_en: 'Hisense Freezer',
            addon_price: '959', addon_regular_price: '1799',
            url: 'hisense-2-in-1-convertible-freezer-p-131218013160102',
          },
        ],
      },
    };
    const r = mapFreeGiftToConditionalOffer(payload, FRESH, NOW);
    expect(r).toMatchObject({
      addon_name_ar: 'فريزر افقي هايسنس',
      addon_price: 959,
      addon_regular_price: 1799,
      addon_url: 'https://www.blackbox.com.sa/product/hisense-2-in-1-convertible-freezer-p-131218013160102',
      evidence_type: 'first_party_structured',
      last_verified_at: FRESH,
    });
  });

  it('returns null when there is no free_gifts evidence', () => {
    expect(mapFreeGiftToConditionalOffer({ specifications: {} }, FRESH, NOW)).toBeNull();
    expect(mapFreeGiftToConditionalOffer(null, FRESH, NOW)).toBeNull();
    expect(mapFreeGiftToConditionalOffer({ specifications: { free_gifts: [] } }, FRESH, NOW)).toBeNull();
  });

  // ── HARD INVARIANT: addon_price can never be mistaken for a standalone/current price ──
  it('always carries an explicit note that addon_price is not the offer price', () => {
    const r = mapFreeGiftToConditionalOffer(
      { specifications: { free_gifts: [{ addon_price: '1', url: 'x' }] } },
      FRESH, NOW,
    );
    expect(r!.note.toLowerCase()).toContain('never');
    expect(r!.note).toContain('current_price');
  });

  it('a literal SAR-1 addon_price is confined to its own field, never a price field name', () => {
    const r = mapFreeGiftToConditionalOffer(
      { specifications: { free_gifts: [{ addon_price: '1', addon_regular_price: '99', url: 'gift' }] } },
      FRESH, NOW,
    );
    // The object must expose exactly one price-shaped value ("1"), and only under addon_price.
    expect(r!.addon_price).toBe(1);
    const keys = Object.keys(r!).filter((k) => (r as unknown as Record<string, unknown>)[k] === 1);
    expect(keys).toEqual(['addon_price']);
  });

  // ── AUTOMATIC EXPIRY: no valid_until exists anywhere in Black Box's data, so a TTL stands
  // in for it. Stale evidence must fail closed with no manual action. ──
  it('fails closed (returns null) once the evidence is older than the freshness TTL', () => {
    const payload = { specifications: { free_gifts: [{ addon_price: '959', url: 'x' }] } };
    expect(mapFreeGiftToConditionalOffer(payload, STALE, NOW)).toBeNull();
    expect(mapFreeGiftToConditionalOffer(payload, FRESH, NOW)).not.toBeNull();
  });

  it('fails closed when there is no evidence timestamp at all (stale-without-end-date)', () => {
    const payload = { specifications: { free_gifts: [{ addon_price: '959', url: 'x' }] } };
    expect(mapFreeGiftToConditionalOffer(payload, null, NOW)).toBeNull();
  });
});

describe('summarizeOffers', () => {
  const offer = (price: number | null, slug: string) => ({ price, store_slug: slug, store_name: slug });

  it('computes lowest/highest/saving/store_count from priced offers only', () => {
    const s = summarizeOffers([offer(999, 'blackbox'), offer(1299, 'extra'), offer(0, 'noon')]);
    expect(s.store_count).toBe(2); // the 0-price offer is dropped, not counted
    expect(s.lowest_price).toBe(999);
    expect(s.highest_price).toBe(1299);
    expect(s.saving).toBe(300);
    expect(s.cheapest_store).toBe('blackbox');
    expect(s.has_comparison).toBe(true);
  });

  it('never claims has_comparison with fewer than 2 offers (F3)', () => {
    const s = summarizeOffers([offer(999, 'blackbox')]);
    expect(s.has_comparison).toBe(false);
    expect(s.store_count).toBe(1);
  });

  it('returns a zero-offer summary (not a crash) for an empty list', () => {
    const s = summarizeOffers([]);
    expect(s.store_count).toBe(0);
    expect(s.has_comparison).toBe(false);
    expect(s.lowest_price).toBeNull();
  });

  // This is the actual production shape the live leak reproduced: a projection row claims
  // has_comparison because ONE of its two contributing stores is display-excluded. The
  // display-gate filtering must already have happened before this function runs (the route
  // filters at offer-collection time) — this test proves the recompute is honest GIVEN an
  // already-filtered single-offer list (the excluded retailer's offer is simply absent).
  it('demotes to single-store once a display-excluded retailer is filtered out upstream', () => {
    // Only the displayable retailer's offer reaches this function — the excluded one never
    // gets included by the caller (see route.ts's `isDisplayableRetailer` filter).
    const s = summarizeOffers([offer(1699, 'swsg')]);
    expect(s.has_comparison).toBe(false);
    expect(s.store_count).toBe(1);
  });
});
