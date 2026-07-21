# Glossary

**Governed by:** `TAWVEERI_CONSTITUTION.md`. One agreed meaning per term — an AI-native knowledge platform cannot tolerate overloaded vocabulary.

| Term | Meaning |
|---|---|
| **Canonical Product** | The real-world product, independent of any store, price, or promotion. Exactly one per real product. Keyed by `tps_identity_key`. |
| **Commercial Variant** | A commercial difference in how a product is sold (region, warranty, bundle, installation, package). Never changes identity. |
| **Offer** | One store selling one commercial variant at a point in time. Owns price, availability, stock, coupon, delivery, URL. Never defines identity. |
| **Observation** | A single record of what a merchant published. |
| **Raw observation** | An observation stored exactly as received, before interpretation. **Immutable.** (`raw_observations`) |
| **Normalized observation** | Structured attributes extracted from a raw observation, carrying a proposed identity, confidence, and ambiguity flags. (`normalized_product_observations`) |
| **Canonical identity** | The platform's assertion that N observations across ≥2 stores are one real product. (`canonical_products`, `product_matches`) |
| **`tps_identity_key`** | The deterministic composite key of a canonical product; also the platform's public address space (URL slug derives from it). |
| **TPS** | Tawveeri Product Standard — the category-aware standard for product identity. See `docs/TPS.md`. |
| **Category plugin** | A module implementing the TPS contract for one category (`detect`, `normalize`, `buildIdentityKey`, `scoreConfidence`). |
| **Store adapter** | A plugin that ingests one store: discover → normalize → observe → offer. |
| **Confidence** | The strength of an identity match: `unknown` · `rejected` · `weak` · `medium` · `high` · `verified`. A `verified` match must explain why. |
| **Evidence hierarchy** | The ordered strength of identity evidence (model number → GTIN → brand → … → AI). AI never overrides stronger evidence. |
| **Corroboration** | The requirement that ≥2 distinct stores resolve to an identity before a canonical product is created. |
| **Decision log** | The permanent, traceable record of every identity decision. (`identity_resolution_events`, `resolved_by ∈ {rules, llm, human}`) |
| **Derived knowledge** | Calculated facts (best/average/lowest price, trend, savings, confidence). Never hand-entered; recomputed from evidence. |
| **Price history** | Append-only record of observed prices; every row answers when/where/what changed. Never overwritten. |
| **Decision layer** | The deterministic engine that produces judgement (deal verdict, price intelligence, ranking) with reasons and evidence. Clients render it; they never compute it. |
| **Waffar** | Tawveeri's Commerce Intelligence Assistant. Phrases engine-produced verdicts in Saudi dialect; never invents prices, links, or verdicts. |
| **Knowledge Graph** | The connected model in which products relate to categories, brands, series, variants, offers, stores, price history, media, reviews, and AI knowledge. Nothing exists in isolation. |
| **Provenance** | The source, timestamp, method, and logic-version attached to every derived fact. Permanent. |
| **Canonical store identity** | `stores.id` (integer FK) — the single store key across all tables. `store_name` is retained only as provenance. |
| **System A** | The knowledge/TPS production database `vyceqrzttspyycdpojtn` (Railway, `tawveeri.com`). The production authority and consolidation target. |
| **System B** | The legacy application database `ffpsjjazsluolysgithg` (`tawveeri.etlaq.sa`). Being retired. |
| **Adapter path** | Ingestion via `discover-firecrawl` + store adapters (Almanea, Extra). |
| **discover-products path** | Ingestion via the legacy scraper + orchestrator (Jarir). |
| **`/go`** | The measured merchant-exit endpoint. Every outbound click is normalized, attributed, and logged. |
