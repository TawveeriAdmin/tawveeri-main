// src/lib/catalog/storefront-identity-gate.ts — ADR-405.
// The storefront layer (products / product_stores) holds ONE store per product row, so the only way it ever
// asserts "the same product across stores" is by merging sibling rows through a verified
// `storefront_identity_links` canonical (get-cross-canonical-offers.ts on the product page,
// merge-verified-canonical-search-results.ts on search cards). Those links predate the identity verifier,
// so a merge could present a listing the verifier calls review/reject as "the same product".
//
// This applies the SAME verdict table every other grouping surface reads (tps_offer_identity_signals, via
// loadIdentitySignals) to those two merge points — nothing else is re-derived. Flags off ⇒ no query, behaviour
// unchanged. A read failure fails OPEN (loudly) exactly like every other reader; the producer fails closed.
import { identityAnyGateEnabled } from '../../../scripts/tps-core/identity-flags';
import { EMPTY_SIGNAL_INDEX, loadIdentitySignals, type IdentitySignalIndex } from '@/lib/identity/identity-signals';

type CanonicalReader = {
  from(table: string): { select(cols: string): { in(col: string, vals: string[]): PromiseLike<{ data: unknown }> } };
};

export async function loadStorefrontIdentitySignals(db: unknown, canonicalIds: string[]): Promise<IdentitySignalIndex> {
  const ids = [...new Set(canonicalIds.filter(Boolean))];
  if (!ids.length || !identityAnyGateEnabled()) return EMPTY_SIGNAL_INDEX;
  try {
    const { data } = await (db as CanonicalReader).from('canonical_products').select('id, category').in('id', ids);
    return await loadIdentitySignals(db, (data ?? []) as { id: string; category: string | null }[]);
  } catch (e) {
    console.error('[storefront-identity-gate] read failed — merging WITHOUT the identity gate for this request:', e instanceof Error ? e.message : e);
    return EMPTY_SIGNAL_INDEX;
  }
}
