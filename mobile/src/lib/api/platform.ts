// E11 — Mobile consumption of Platform API Contract v1. Canonical, platform-owned
// results with authoritative `go_url` per offer (measured exits). Mobile screens
// should migrate their direct catalog reads to these methods so items carry
// canonical_id / offer_id / go_url. See docs/API-CONTRACT-v1.md.
import { apiClient } from './client';

export interface PlatformOffer {
  offer_id: string;
  store_id: string;
  store_slug: string;
  price: number | null;
  availability: string;
  go_url: string; // /go/{offer_id} — the only sanctioned exit
}

export interface PlatformProduct {
  canonical_id: string;
  tps_identity_key: string;
  title_ar: string | null;
  title_en: string | null;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  lowest_price: number | null;
  highest_price: number | null;
  saving: number | null;
  price_spread_pct: number | null;
  store_count: number | null;
  has_comparison: boolean;
  comparison_available?: boolean;
  confidence: number | null;
  canonical_url: string | null;
  cheapest_store: string | null;
  decision: { is_smart_pick: boolean; reason_ar: string | null };
  tps_version: string;
  offers: PlatformOffer[];
}

// E14 hybrid: Layer 2 resolved-single items (known identity, one offer, no
// comparison). Same core shape as PlatformProduct with comparison_available:false.
export interface PlatformDiscoveryItem {
  canonical_id: string;
  tps_identity_key: string;
  title_ar: string | null;
  title_en: string | null;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  lowest_price: number | null;
  store_count: number | null;
  comparison_available: false;
  confidence: number | null;
  canonical_url: string | null;
  cheapest_store: string | null;
  decision: { is_smart_pick: false; reason_ar: string | null };
  kind: 'resolved_single';
  offers: PlatformOffer[];
}

export interface PlatformSearchResponse {
  version: string;
  query: string;
  count: number;
  results: PlatformProduct[];               // Layer 1 — comparison
  discovery?: PlatformDiscoveryItem[];       // Layer 2 — resolved-single (labelled)
  meta?: { authority: string; canonical_count: number; discovery_count: number };
}

export interface PlatformRecommendation {
  canonical_id: string;
  tps_identity_key: string;
  title_ar: string | null;
  title_en: string | null;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  lowest_price: number | null;
  store_count: number | null;
  canonical_url: string | null;
  reason: { kind: string; reason_ar: string };
  confidence: number;
}

export interface PlatformRecommendationsResponse { version: string; category: string; count: number; recommendations: PlatformRecommendation[]; }

export const platformApi = {
  /** Hybrid TPS search (E14) — results[] = comparison (Layer 1), discovery[] =
   *  resolved-single (Layer 2, labelled). Every item carries offers[].offer_id
   *  for measured exits via openMeasuredExit. */
  searchTps(q: string, limit = 20, discoveryLimit = 12): Promise<PlatformSearchResponse> {
    return apiClient.get<PlatformSearchResponse>(`/api/v1/tps/search?q=${encodeURIComponent(q)}&limit=${limit}&discovery_limit=${discoveryLimit}`);
  },
  /** Deterministic, explainable canonical recommendations (no embeddings). */
  recommendations(opts: { canonicalId?: string; category?: string; limit?: number }): Promise<PlatformRecommendationsResponse> {
    const p = new URLSearchParams();
    if (opts.canonicalId) p.set('canonical_id', opts.canonicalId);
    if (opts.category) p.set('category', opts.category);
    p.set('limit', String(opts.limit ?? 8));
    return apiClient.get<PlatformRecommendationsResponse>(`/api/v1/tps/recommendations?${p.toString()}`);
  },
  /** Convenience: the best measured-exit target for any platform item (cheapest
   *  offer's offer_id → openMeasuredExit routes it through /go?source=mobile). */
  bestExit(product: PlatformProduct | PlatformDiscoveryItem): { offerId?: string } {
    const o = product.offers?.[0];
    return o ? { offerId: o.offer_id } : {};
  },
};
