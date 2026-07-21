# TPS — The Tawveeri Product Standard

**Governed by:** `TAWVEERI_CONSTITUTION.md` (Article III). **Status:** canonical specification.
**Implementation:** `scripts/tps-core/`, `scripts/tps-plugins/`, and the canonical tables in the knowledge database.

TPS is the constitution of product identity: the category-aware standard that answers one question with evidence — **"is this the same product?"** — and turns fragmented merchant listings into a canonical knowledge graph.

---

## 1. The three-layer model

```
CANONICAL PRODUCT      the real-world product        key: tps_identity_key
      │                (store/price/promotion-independent; exactly one per real product)
      ├── COMMERCIAL VARIANT   region · warranty · bundle · installation · package
      │                        changes HOW it is sold, never identity
      └── MERCHANT OFFER        one store × one variant × a point in time
                               owns price, availability, stock, coupon, delivery, URL
```

**Invariant:** identity fields fork identity; commercial fields never do. Colour, warranty, and installation are commercial variants, not identity conflicts.

---

## 2. The four data domains

| Domain | Answers | Mutability |
|---|---|---|
| **Identity** | "Is this the same product?" | Governed, versioned |
| **Commercial** | What affects buying (price, stock, coupon, delivery) | Append-only observations |
| **Experience** | What improves understanding (reviews, guides, AI summaries) | Additive |
| **Derived** | Calculated knowledge (best/avg/low price, trend, confidence) | Recomputed, never hand-entered |

---

## 3. The category plugin contract

Every category — current and future — implements one contract. **Adding a category is configuration before code.** (Contract defined in `scripts/tps-core/types.ts`.)

A `CategoryPlugin` provides:
- `category` — the stored category name.
- `version` — stamped on every observation it produces, so we always know which version built which result.
- `detect(nameAr, nameEn)` — does this text belong to this category?
- `normalize(nameAr, nameEn, rawBrand)` — extract structured attributes from raw text; return `ambiguity_flags` and `ignored_terms`.
- `buildIdentityKey(brand, payload, meta)` — deterministic composite key; any null **critical** field yields `status: "invalid"` with a stated reason.
- `scoreConfidence(brand, payload, modelNumber, flags)` — confidence from completeness of critical fields; may flag `needs_llm`.

Each category owns its own contract defining critical / conditional / helpful / ignored attributes and its identity, conflict, validation, evidence, and confidence rules.

**Current coverage (honest state):** `ac` and `mobile` plugins are live; `tv` and `refrigerator` are registered stubs. TPS search and the deal engine currently operate on the `mobile` category. Expansion is additive via the plugin registry.

---

## 4. Evidence hierarchy

Identity emerges from evidence, never from a single source. Stronger evidence always wins; **AI never overrides stronger evidence.**

1. Manufacturer model number
2. GTIN / UPC / EAN
3. Brand
4. Series
5. Generation
6. Technical specifications
7. Normalized title
8. Store corroboration
9. Historical observations
10. AI reasoning

---

## 5. Confidence & corroboration

Every match carries a confidence state: `unknown` · `rejected` · `weak` · `medium` · `high` · `verified`. A `verified` identity must always explain **why**.

**Corroboration rule (precision over recall):** a canonical product is created only when **≥2 distinct stores** are resolved to the same identity at high confidence. Comparison is the point of the canonical layer; without two independent observations there is nothing to compare and the merge is deferred, not forced.

---

## 6. The pipeline (five layers)

```
merchant observation → normalization → identity resolution → canonicalization → offer/price history → projection → distribution
   raw_observations        normalized_       identity_          canonical_        price_history        tps_product_    search index
   (immutable)             product_obs        resolution_events  products +        (append-only)        projection
                                                                 product_matches
```

Each stage is idempotent, emits an event, and is rebuildable from `raw_observations` forward. Raw observations are never edited; price history is never overwritten.

---

## 7. The decision log

Every identity decision is traceable: every merge, split, rejection, override, AI decision, and human review is recorded in `identity_resolution_events` with `resolved_by ∈ {rules, llm, human}` and its evidence. History must never disappear. Human escalation is used only where rules and bounded AI cannot decide.

---

## 8. Known correctness debt (must resolve during pipeline automation)

Recorded honestly so it is never lost:
- A large share of historical canonical linkage was created by bulk name+brand matching, not by the corroborated TPS path. The canonical graph's historical quality is therefore **unvalidated** and must be audited when the pipeline is automated (Roadmap E6/E7), not merely built upon.
- The adapter-side `ensureCanonicalProduct` shortcut (exact `name_ar` match, default category `accessories`, no corroboration) is a live invariant violation slated for removal in the same phase.

---

## 9. The golden question

Before any schema, table, field, or relationship: *Will this make Tawveeri smarter? Reduce future engineering? Improve AI reasoning? Improve user trust?* If not, reconsider the design.
