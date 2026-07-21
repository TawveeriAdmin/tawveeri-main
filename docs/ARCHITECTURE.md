# Architecture

**Governed by:** `TAWVEERI_CONSTITUTION.md`. **Detailed evidence basis:** `docs/UNIFIED-PLATFORM-BLUEPRINT-V1.md` (2026-07-20 snapshot), `docs/ARCHITECTURE-RECONCILIATION.md`, `docs/PRODUCTION-EXECUTION-TOPOLOGY.md`.

This is the living, canonical architecture summary. Where it and the dated Blueprint differ, **this document is authoritative** and the Blueprint is the evidence appendix.

---

## 1. Current production reality (verified)

Tawveeri today runs as **two live systems**, mid-convergence onto one:

| | **System A — Knowledge** | **System B — Application** |
|---|---|---|
| Supabase project | `vyceqrzttspyycdpojtn` (**production authority**) | `ffpsjjazsluolysgithg` (**legacy**) |
| Deployment | Railway · `tawveeri.com` | self-hosted · `tawveeri.etlaq.sa` |
| Holds | TPS graph: raw observations, canonical products, price history, projection, outbound clicks | users, auth, wishlists, alerts, coupons, transactions, analytics |
| Lacks | user/auth/commerce schema | the entire TPS graph |

**Target:** consolidate onto **System A**, migrating System B's user/auth/commerce schema into it. Rationale: customer identity is irreplaceable while the derived knowledge graph is rebuildable; the live scraping pipeline already runs on A. See `docs/ARCHITECTURE-RECONCILIATION.md` §8 and the Roadmap.

---

## 2. The layered platform model

Tawveeri is built as layers, not features — a layer serves every surface that will ever exist. Each layer depends only on the one beneath it and declares what it must not touch.

| Layer | Owns | Must never |
|---|---|---|
| **L1 Data Acquisition** | Store adapters, scheduling, run logging, immutable `raw_observations` | resolve identity · compute verdicts |
| **L2 Knowledge Construction (TPS)** | Normalization, identity, canonical products, matches, append-only price history | serve requests · edit history · assert identity from one store |
| **L3 Knowledge Distribution** | Search, owned index, comparison APIs, product pages, SEO | originate identity · apply commercial ranking |
| **L4 Decision Intelligence** | Deal verdicts, price intelligence, recommendations — deterministic, explained | write state · fabricate · let a model form a verdict |
| **L5 Commerce & Attribution** | Measured merchant exit (`/go`), click logging, conversion | influence ranking · expose an unmeasured exit |
| **L6 Product Experience** | Web, Mobile, API, agents — render only | compute verdicts · read catalog tables directly |
| **L7 Growth & Market Visibility** | SEO entities, AI visibility, retention, merchant value | claims beyond evidence · buy ranking |
| **L8 Platform & External Services** | Same truth to agents/partners | expose a different truth than clients receive |
| **Ops & Governance** *(cross-cutting)* | Scheduling, secrets, roles, audit, provenance, rebuild-from-raw | — |

---

## 3. Architectural invariants

Permanent. Changing any of these is a Constitution-level amendment, not an engineering choice.

1. **One canonical product identity** (`tps_identity_key`) is the platform's address space.
2. **Canonical Product → Commercial Variant → Merchant Offer** (identity fields fork identity; commercial fields never do).
3. **Corroborated identity** — ≥2 distinct stores before a canonical product exists.
4. **History is append-only** — `raw_observations` immutable, `price_history` append-only.
5. **Provenance is permanent** — every derived fact traces to source, timestamp, and the version of the logic that produced it.
6. **One authority per business question** — no "both". Bridges may serve; they may never decide.
7. **One shared decision layer** — clients render verdicts, never compute them.
8. **Business judgement is deterministic**; models phrase, never decide.
9. **Commercial interest never enters ranking.**
10. **Every merchant exit is measured** through `/go`.
11. **Canonical store identity is `stores.id`** everywhere (integer FK); `store_name` is retained only as provenance.
12. **RLS at the definition layer** — every table enables row-level security in its schema definition; credential/session tables are never granted to `anon`.
13. **Rebuildable from raw evidence** — every derived layer reconstructable from `raw_observations`.
14. **Registration-based extension** — new stores and categories are added by registering against a contract, never by modifying the core.

---

## 4. Extension contracts

- **Store adapters** (`src/lib/scraping/adapters/`) — a store is a plugin: discover → normalize → observe → offer. Adding a store is one adapter file + one registry line.
- **Category plugins** (`scripts/tps-plugins/`) — a category is a plugin implementing the TPS contract. Adding a category is configuration before code. See `docs/TPS.md`.

---

## 5. Runtime & deployment

- **Web/API:** Next.js 14 (App Router, standalone) on **Railway** (`tawveeri.com`).
- **Database:** Supabase Postgres `vyceqrzttspyycdpojtn` (pgvector, pg_cron, pg_net, vault).
- **Search:** Algolia — target index `tawveeri_tps_products` fed from the TPS projection.
- **Scheduler:** Supabase **pg_cron** drives ingestion via `/api/cron/*` (see `docs/PRODUCTION-EXECUTION-TOPOLOGY.md`). Consolidation into one version-controlled scheduler is Roadmap E4.
- **Two ingestion paths today:** the adapter path (`discover-firecrawl`: Almanea, Extra) and the legacy scraper path (`discover-products`: Jarir). Both are run-logged and write canonical `store_id`.

---

## 6. The data lifecycle (one continuous system)

```
merchants → L1 acquisition → raw_observations → L2 TPS → canonical_products + price_history
        → L3 projection + owned index → search + product page + Waffar
        → L4 decision layer (verdict + reason + evidence)
        → L5 /go → outbound_clicks → transactions → L7 growth → back into the flywheel
```

Every product, price, verdict, SEO entity, and exit resolves through the same canonical identity — which is what makes many surfaces one platform.

---

## 7. What must converge (tracked in the Roadmap)

Recorded so the target is unambiguous: single production database; user/auth/commerce schema migrated onto System A; one owned search index serving all clients; the decision layer surfaced in search; recommendations re-keyed to canonical identity; mobile made a true platform client with measured exits; one version-controlled scheduler. Sequencing and status: `docs/ROADMAP.md` and `docs/ENGINEERING-TRANSITION-PLAN.md`.
