/**
 * ADR-392 — incremental listing-facts merge. The builder used to replay the whole
 * raw_observations history every hour; these tests pin the arithmetic that lets it
 * fold only NEW observations into existing rows with identical results.
 */
import {
  aggregateObservations, mergeIntoExisting, mergeObservation, verdictFor,
  type ListingFactsRow, type ListingObservation,
} from "../../src/lib/intelligence/listing-facts-merge";

const at = (s: string) => new Date(s);
const obs = (id: number, when: string, price: number | null, was: number | null = null): ListingObservation => ({
  id, listing: "https://x.sa/p/1", name: `n${id}`, brand: "B", category: "tv", price, was, at: at(when),
});

describe("aggregateObservations", () => {
  it("folds a batch: min/max/was/first/last/current, distinct days as a set", () => {
    const r = aggregateObservations("k", 2, [
      obs(1, "2026-09-01T10:00:00Z", 1000, 1500),
      obs(2, "2026-09-01T18:00:00Z", 900),
      obs(3, "2026-09-03T09:00:00Z", 950, 1400),
    ])!;
    expect(r.observed_min).toBe(900);
    expect(r.observed_max).toBe(1000);
    expect(r.claimed_was).toBe(1500);
    expect(r.current_price).toBe(950);
    expect(r.name).toBe("n3");
    expect(r.distinct_days).toBe(2);
    expect(r.observed_days).toEqual(["2026-09-01", "2026-09-03"]);
    expect(r.first_seen).toEqual(at("2026-09-01T10:00:00Z"));
    expect(r.last_seen).toEqual(at("2026-09-03T09:00:00Z"));
  });

  it("an observation without a price never becomes the current price", () => {
    const r = aggregateObservations("k", 2, [obs(1, "2026-09-01T10:00:00Z", 500), obs(2, "2026-09-02T10:00:00Z", null)])!;
    expect(r.current_price).toBe(500);
    expect(r.distinct_days).toBe(2);
    expect(r.last_seen).toEqual(at("2026-09-02T10:00:00Z"));
  });
});

describe("mergeIntoExisting", () => {
  const legacy: ListingFactsRow = {
    listing_key: "k", store_id: 2, url: "https://x.sa/p/1", name: "old", brand: "B", category: "tv",
    current_price: 1200, observed_min: 1100, observed_max: 1300, claimed_was: 1500, distinct_days: 4,
    first_seen: at("2026-08-01T00:00:00Z"), last_seen: at("2026-09-10T08:00:00Z"), observed_days: null,
  };

  it("legacy row (no day set): a same-day re-observation is NOT a new day, a later day is", () => {
    const sameDay = aggregateObservations("k", 2, [obs(9, "2026-09-10T20:00:00Z", 1150)])!;
    const m1 = mergeIntoExisting(legacy, sameDay);
    expect(m1.distinct_days).toBe(4);
    expect(m1.current_price).toBe(1150);
    expect(m1.observed_min).toBe(1100);
    expect(m1.observed_days).toEqual(["2026-09-10"]);

    const nextDay = aggregateObservations("k", 2, [obs(10, "2026-09-11T09:00:00Z", 1050)])!;
    const m2 = mergeIntoExisting(m1, nextDay);
    expect(m2.distinct_days).toBe(5);
    expect(m2.observed_min).toBe(1050);
    expect(m2.observed_max).toBe(1300);
    expect(m2.observed_days).toEqual(["2026-09-10", "2026-09-11"]);
  });

  it("is idempotent: re-applying the same batch changes nothing", () => {
    const batch = aggregateObservations("k", 2, [obs(10, "2026-09-11T09:00:00Z", 1050, 1600)])!;
    const once = mergeIntoExisting(legacy, batch);
    const twice = mergeIntoExisting(once, batch);
    expect(twice).toEqual(once);
  });

  it("monotone facts: min/max/was/first_seen never regress, claimed_was takes the greatest", () => {
    const batch = aggregateObservations("k", 2, [obs(10, "2026-09-11T09:00:00Z", 1250, 1400)])!;
    const m = mergeIntoExisting(legacy, batch);
    expect(m.observed_min).toBe(1100);
    expect(m.observed_max).toBe(1300);
    expect(m.claimed_was).toBe(1500);
    expect(m.first_seen).toEqual(legacy.first_seen);
  });

  it("with no existing row the batch is the row", () => {
    const batch = aggregateObservations("k", 2, [obs(1, "2026-09-11T09:00:00Z", 10)])!;
    expect(mergeIntoExisting(null, batch)).toBe(batch);
  });

  it("incremental merge equals a full replay of the same observations", () => {
    const all = [
      obs(1, "2026-09-01T10:00:00Z", 1000, 1500), obs(2, "2026-09-02T10:00:00Z", 950),
      obs(3, "2026-09-02T22:00:00Z", 980, 1550), obs(4, "2026-09-05T10:00:00Z", 900),
    ];
    const full = aggregateObservations("k", 2, all)!;
    const a = aggregateObservations("k", 2, all.slice(0, 2))!;
    const b = aggregateObservations("k", 2, all.slice(2))!;
    const inc = mergeIntoExisting(a, b);
    expect(inc.distinct_days).toBe(full.distinct_days);
    expect(inc.observed_min).toBe(full.observed_min);
    expect(inc.observed_max).toBe(full.observed_max);
    expect(inc.claimed_was).toBe(full.claimed_was);
    expect(inc.current_price).toBe(full.current_price);
    expect(inc.first_seen).toEqual(full.first_seen);
    expect(inc.last_seen).toEqual(full.last_seen);
    expect(verdictFor(inc)?.verdict).toBe(verdictFor(full)?.verdict);
  });
});

describe("mergeObservation / verdictFor", () => {
  it("returns no verdict until a price was observed", () => {
    const r = aggregateObservations("k", 2, [obs(1, "2026-09-01T10:00:00Z", null)])!;
    expect(verdictFor(r)).toBeNull();
    const r2 = mergeObservation(r, obs(2, "2026-09-02T10:00:00Z", 700));
    expect(verdictFor(r2)).not.toBeNull();
  });
});
