/**
 * ADR-148 — the two retailer registries must not silently diverge.
 *
 * Tawveeri keeps two independent, hand-maintained lists in different layers:
 *   • `APPROVED_STORE_IDS` (src/lib/retailers/approved-retailers.ts) — the DISPLAY gate.
 *     A store here may appear on a customer surface.
 *   • `TPS_STORES` (scripts/tps-core/category-registry.ts) — the NORMALIZATION work-list.
 *     A store here has its observations swept into identities; a store NOT here has no
 *     progress cursor at all.
 *
 * They legitimately differ in one direction: a non-approved store can be normalized so
 * its listings corroborate identity without ever being shown (11 stores do this today).
 *
 * The other direction is always a defect. A store that is approved for display but
 * absent from the sweep ingests observations that can never become an identity, never a
 * canonical, and never a comparison — and it is INVISIBLE to the per-store lag metric,
 * because that metric iterates progress cursors and such a store has none. It is not
 * behind the queue; it is outside it.
 *
 * Measured 2026-07-30: lulu (23) held 5,854 observations and sharafdg (24) held 1,370,
 * both ingesting live, both approved for display, both with 0 normalized observations
 * and no cursor. Nothing in the codebase could have reported that.
 *
 * KNOWN-GAP LIST: entries in `KNOWN_UNSWEPT` are accepted failures with a reason. The
 * list must shrink, never grow — adding to it requires the same scrutiny as the fix.
 */
import { APPROVED_STORE_IDS } from '@/lib/retailers/approved-retailers';
import { TPS_STORES } from '../../scripts/tps-core/category-registry';

/** Approved store ids deliberately not yet in the normalization sweep, with reasons. */
const KNOWN_UNSWEPT: Record<number, string> = {
  10: 'blackbox — approved but bot-walled; zero observations ever ingested, so nothing to sweep',
  // lulu (23) and sharafdg (24) were removed on 2026-08-02: both are now in TPS_STORES
  // and sweeping (lulu holds 1,135 normalized TV observations alone), so the exemption
  // had outlived its gap — which is precisely what the test below is for.
};

describe('retailer registry coherence (ADR-148)', () => {
  const swept = new Set(TPS_STORES.map((s) => s.id));

  it('every approved-for-display store is either swept or a documented known gap', () => {
    const unswept = [...APPROVED_STORE_IDS].filter((id) => !swept.has(id));
    const undocumented = unswept.filter((id) => !(id in KNOWN_UNSWEPT));
    expect(undocumented).toEqual([]);
  });

  it('the known-gap list does not outlive its entries', () => {
    // A store listed as a known gap but now swept means the fix landed and the
    // exemption should be deleted — otherwise the list rots into permanent cover.
    const stale = Object.keys(KNOWN_UNSWEPT).map(Number).filter((id) => swept.has(id));
    expect(stale).toEqual([]);
  });

  it('every known gap names an approved store', () => {
    const notApproved = Object.keys(KNOWN_UNSWEPT).map(Number).filter((id) => !APPROVED_STORE_IDS.has(id));
    expect(notApproved).toEqual([]);
  });

  it('every swept store has a non-empty display name for price_history', () => {
    // `normalizeSweep` writes `price_history.store_name` from this name; an empty one
    // would fall back to a raw numeric id, which is the ADR-144 defect that showed a
    // customer "7" as if it were a retailer.
    expect(TPS_STORES.filter((s) => !s.name || !s.name.trim())).toEqual([]);
  });
});
