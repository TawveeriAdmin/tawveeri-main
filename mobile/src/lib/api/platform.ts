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
  confidence: number | null;
  canonical_url: string | null;
  cheapest_store: string | null;
  decision: { is_smart_pick: boolean; reason_ar: string | null };
  tps_version: string;
  offers: PlatformOffer[];
}

export interface PlatformSearchResponse { version: string; query: string; count: number; results: PlatformProduct[]; }

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
  /** Canonical TPS search — items carry offers[].go_url (measured exits). */
  searchTps(q: string, limit = 20): Promise<PlatformSearchResponse> {
    return apiClient.get<PlatformSearchResponse>(`/api/v1/tps/search?q=${encodeURIComponent(q)}&limit=${limit}`);
  },
  /** Deterministic, explainable canonical recommendations (no embeddings). */
  recommendations(opts: { canonicalId?: string; category?: string; limit?: number }): Promise<PlatformRecommendationsResponse> {
    const p = new URLSearchParams();
    if (opts.canonicalId) p.set('canonical_id', opts.canonicalId);
    if (opts.category) p.set('category', opts.category);
    p.set('limit', String(opts.limit ?? 8));
    return apiClient.get<PlatformRecommendationsResponse>(`/api/v1/tps/recommendations?${p.toString()}`);
  },
  /** Convenience: the best measured-exit URL for a platform product (cheapest offer). */
  bestExit(product: PlatformProduct): { offerId?: string; url?: string } {
    const o = product.offers?.[0];
    return o ? { offerId: o.offer_id } : {};
  },
};
