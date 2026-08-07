// P0 price-truth incident (2026-08-07): corroboratePass used to pick the CHEAPEST
// priced offer ever staged for a (identity_key, store) pair, not the most recently
// observed one. Because staging accumulates a store's ENTIRE observation history
// (never pruned — see 019_progressive_batching.sql), a price could only ever fall to
// its historic minimum and get stuck there forever: a later genuine price rise lost
// to an older, cheaper staging row on every single corroboration pass.
//
// Reproduced live: an Amazon LG-fridge listing was correctly re-scraped at 4,164.15
// SAR twice on 2026-08-06, yet price_history (and the public compare page) kept
// showing 3,919 SAR — a staging row from 2026-07-23 — as "cheapest". Platform-wide
// measurement the same day found every major retailer's price_history median
// "freshest" observation was 100+ hours old despite scraping running every 6-24h.
//
// selectCurrentOffer is the extracted, unit-testable core of that selection.
import { selectCurrentOffer, type StagedOfferForSelection } from '../../scripts/tps-core/progressive-engine';

function offer(raw_obs_id: number, price: number | null, observed_at: string | null): StagedOfferForSelection {
  return { raw_obs_id, price, observed_at };
}

describe('selectCurrentOffer — current price is the most recently observed price', () => {
  it('picks the NEWER, higher price over an older, cheaper one (the exact P0 regression)', () => {
    const old3919 = offer(139349, 3919, '2026-07-23T00:08:39.650Z');
    const new4164 = offer(1184431, 4164.15, '2026-08-06T18:07:21.762Z');
    // Order must not matter — this is what broke before (reduce ran over full history).
    expect(selectCurrentOffer([old3919, new4164], old3919)).toBe(new4164);
    expect(selectCurrentOffer([new4164, old3919], old3919)).toBe(new4164);
  });

  it('picks the newer, LOWER price when a genuine price drop is the latest evidence', () => {
    const old4749 = offer(1, 4749, '2026-08-05T00:00:00Z');
    const new4037 = offer(2, 4037, '2026-08-07T00:00:00Z');
    expect(selectCurrentOffer([old4749, new4037], old4749)).toBe(new4037);
  });

  it('does not get permanently stuck on a historic minimum across many staged rows', () => {
    const rows = [
      offer(1, 3919, '2026-07-23T00:00:00Z'),
      offer(2, 3919, '2026-07-24T00:00:00Z'),
      offer(3, 3919, '2026-08-05T00:00:00Z'),
      offer(4, 4164.15, '2026-08-06T06:07:41Z'),
      offer(5, 4164.15, '2026-08-06T18:07:21Z'),
    ];
    expect(selectCurrentOffer(rows, rows[0]).price).toBe(4164.15);
    expect(selectCurrentOffer(rows, rows[0]).raw_obs_id).toBe(5);
  });

  it('breaks ties on identical observed_at by keeping the first-seen row', () => {
    const a = offer(1, 100, '2026-08-06T00:00:00Z');
    const b = offer(2, 200, '2026-08-06T00:00:00Z');
    expect(selectCurrentOffer([a, b], a)).toBe(a);
  });

  it('falls back to the given fallback when there are no priced offers', () => {
    const fallback = offer(9, null, '2026-08-06T00:00:00Z');
    expect(selectCurrentOffer([], fallback)).toBe(fallback);
  });

  it('treats a missing observed_at as older than any timestamped offer', () => {
    const noTimestamp = offer(1, 50, null);
    const timestamped = offer(2, 999, '2026-08-01T00:00:00Z');
    expect(selectCurrentOffer([noTimestamp, timestamped], noTimestamp)).toBe(timestamped);
  });
});
