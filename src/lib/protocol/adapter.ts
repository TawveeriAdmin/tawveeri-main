// src/lib/protocol/adapter.ts
// E15.5 / W4 — Protocol-neutral adapter layer. Tawveeri exposes its canonical graph
// to external agentic-commerce protocols (UCP / ACP / AP2) through this isolation
// boundary so it is UCP-compatible WITHOUT being UCP-dependent (Constitution:
// "UCP-compatible but not UCP-dependent"). Protocols evolve; only the adapters
// change. Merchant Independence holds: every offer names the retailer as
// merchant-of-record; Tawveeri never becomes the seller. Ranking-blind: a feed,
// not a ranking. Exit stays measured via /go.
//
// NOTE (REQUIRES VALIDATION): the exact UCP/ACP wire schemas are external standards
// (see docs/POST-E15-GLOBAL-RESEARCH-AUDIT.md). This is a v0 adapter SHAPE modelled
// on the public specs; conformance must be validated against the live spec before
// any production interop. The durable value is the isolation boundary, not v0 shape.

export interface TawveeriOffer {
  store: string;            // merchant-of-record (retailer)
  price: number | null;
  currency: "SAR";
  availability: string;     // in_stock | unknown
  measured_exit: string;    // /go/{offer_id} — the ONLY sanctioned exit
}

export interface TawveeriProduct {
  canonical_id: string;
  identity_key: string;
  title_ar: string | null;
  title_en: string | null;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  attributes: Record<string, unknown>;   // Product DNA
  comparison_available: boolean;          // ≥2-store corroborated
  confidence: number | null;
  offers: TawveeriOffer[];
}

// A protocol adapter maps Tawveeri's canonical products to a protocol's product shape.
export interface ProtocolAdapter<T> {
  readonly protocol: string;
  readonly version: string;
  toProduct(p: TawveeriProduct): T;
}

// ── UCP adapter (v0 shape). UCP is merchant-centric: retailer = merchant_of_record,
//    owns pricing. We expose read-only product + offers; checkout/payment are NOT
//    implemented here (Stage-2, SAMA-gated). ──
export interface UcpProduct {
  id: string;
  type: "product";
  title: { ar: string | null; en: string | null };
  brand: string | null;
  category: string | null;
  media: { image: string | null };
  attributes: Record<string, unknown>;
  comparison: { available: boolean; confidence: number | null };
  offers: Array<{
    merchant_of_record: string;
    price: { amount: number | null; currency: "SAR" };
    availability: string;
    exit_url: string;               // measured (/go)
  }>;
  source: "tawveeri";
  tps_version: "tps-v1";
}

export const ucpAdapter: ProtocolAdapter<UcpProduct> = {
  protocol: "ucp",
  version: "v0-shape",
  toProduct(p: TawveeriProduct): UcpProduct {
    return {
      id: p.canonical_id, type: "product",
      title: { ar: p.title_ar, en: p.title_en },
      brand: p.brand, category: p.category,
      media: { image: p.image_url },
      attributes: p.attributes,
      comparison: { available: p.comparison_available, confidence: p.confidence },
      offers: p.offers.map((o) => ({
        merchant_of_record: o.store,
        price: { amount: o.price, currency: "SAR" },
        availability: o.availability,
        exit_url: o.measured_exit,
      })),
      source: "tawveeri", tps_version: "tps-v1",
    };
  },
};

export const ADAPTERS: Record<string, ProtocolAdapter<unknown>> = { ucp: ucpAdapter };
