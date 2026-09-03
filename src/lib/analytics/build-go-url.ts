// src/lib/analytics/build-go-url.ts
// ADR-286 — the ONE place that builds a `/go/<id>` href for a server-rendered API/page
// response. Before this, every call site built the string inline (`/go/${o.id}`), duplicated
// across ~7 files with no shared token-minting hook. Centralizing it here is what makes the
// interaction-provenance fix (src/lib/analytics/go-token.ts) possible without threading a
// token through every caller's business logic, and closes the duplication as a side effect.
//
// `goId` is either a bare offer UUID (normalized_product_observations.id) or a storefront id
// already carrying the `ps_` prefix (product_stores.id) — /go/[offerId]/route.ts already
// branches on this shape, unchanged here. Minting the token unconditionally (even while
// ENABLE_GO_INTERACTION_PROVENANCE is off) is cheap and harmless — route.ts simply ignores
// the `gt` param until the flag is on, and there is no cutover step needed later.
import { issueGoToken } from './go-token';

export function buildGoUrl(goId: string, opts?: { source?: string }): string {
  const params = new URLSearchParams({ gt: issueGoToken(goId) });
  if (opts?.source) params.set('source', opts.source);
  return `/go/${goId}?${params.toString()}`;
}
