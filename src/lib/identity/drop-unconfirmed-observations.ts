// src/lib/identity/drop-unconfirmed-observations.ts — ADR-405.
// The agent endpoints (`/api/v1/agent/decide`, `/api/v1/agent/home-mission`) name the stores behind a recommendation and
// pick its /go link from the newest raw observations of the canonical — with no notion of the identity verdict. For a gated
// category that let them say "compared N documented offers of the same model (store, store…)" with a store the verifier had
// marked review/reject, and hand out a /go link to it. They now read their observations through this filter: a (canonical,
// store) the verdict table marks review/reject is not an observation of that canonical here either.
// Flags off ⇒ `loadStorefrontIdentitySignals` returns an empty index without a query and the input is returned untouched.
import { loadStorefrontIdentitySignals } from '@/lib/catalog/storefront-identity-gate';
import { isUnsignaled } from '@/lib/identity/identity-signals';
import { resolveApprovedSlug } from '@/lib/retailers/approved-retailers';

export async function dropUnconfirmedObservations<T extends { canonical_product_id: string; store_id: unknown }>(db: unknown, obs: T[]): Promise<T[]> {
  if (!obs.length) return obs;
  const index = await loadStorefrontIdentitySignals(db, [...new Set(obs.map((o) => o.canonical_product_id))]);
  if (!index.size) return obs;
  return obs.filter((o) => {
    const raw = o.store_id == null ? '' : String(o.store_id).trim();
    if (!raw) return true; // no store identity: nothing to match a verdict against
    const slug = resolveApprovedSlug(raw);
    return isUnsignaled(index, o.canonical_product_id, raw) && (slug == null || isUnsignaled(index, o.canonical_product_id, slug));
  });
}
