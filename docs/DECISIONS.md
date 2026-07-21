# Decision Register

**Mandated by:** `TAWVEERI_CONSTITUTION.md` Article VIII. Every significant decision records: context, decision, alternatives, consequences. History never disappears. Newest first.

Status legend: **Accepted** · **Superseded** · **Proposed**.

---

### ADR-011 — E6 canonical-quality audit: automation is gated on graph remediation; write-side pipeline BLOCKED pending founder approval · Proposed (2026-07-21)
**Context:** E6 ("TPS pipeline automation + canonical-quality audit") began, per ratified sequencing (TPS.md §8), with the read-only audit — the mandatory gate before automating writes into the canonical graph (the moat). Read-only production evidence (project `vyceqrzttspyycdpojtn`, service-role, no writes) found the graph is **not fit to automate on top of yet**:
- **Pipeline has never run in production:** `raw_observations` = 129,715 rows, **100% `pending`, 0 processed**. The 2,168 canonical products and 2,939 normalized rows were built by an out-of-band bulk path, not the live normalize→resolve→canonicalize pipeline. `tps_product_projection` = **3 rows** (effectively empty).
- **Graph is polluted:** **881 / 2,168 canonical products (41%) are `accessories`** — cases, chargers, covers — which pollute TPS comparisons and can carry the "Verified comparison" surface.
- **Corroboration invariant unmet:** in a 318-canonical `price_history` sample, **0 (0%)** have ≥2 distinct stores; **100% are single-store**. The ratified ≥2-store corroboration invariant ("Precision over Recall") is currently satisfied by ~none of the sampled canonicals.
- **Identity resolution barely exercised:** `product_matches` = 76 (all `tps_identity_key`, **0 verified**); `identity_resolution_events` = 37.
**Decision (proposed):** the E6 **audit is complete and ratified as evidence**. The E6 **write-side automation is BLOCKED pending founder approval** because it mutates the canonical graph, where over-merge is irreversible moat corruption — a "destructive / data" change reserved for founder approval by the safety boundaries — and the audit proves a **remediation decision must precede automation**, not follow it. Automating ingestion onto a 41%-accessory, 100%-single-store graph would industrialize the existing defects, violating Evidence-before-Confidence and Precision-over-Recall.
**Alternatives:** (a) proceed to full pipeline automation now — rejected: irreversible-corruption risk on an unvalidated graph, cannot be trustworthy-verified in one pass; (b) silently mutate/deactivate the 881 accessory canonicals — rejected: data deletion requires founder approval and must not be done unaudited.
**Consequences:** the moat's true state is now measured and on record. Required founder decisions before E6 Phase 2: (1) approve deactivating/quarantining accessory canonicals (or a category-scope for canonical membership); (2) approve the corroboration-gated ingestion policy (canonical becomes comparison-valid only at ≥2 corroborating stores); (3) approve the first bounded, reversible, dry-run-first automation batch with per-batch audit. No writes were performed; historical evidence untouched.

### ADR-010 — Surface the decision layer as a trust-gated "Smart Pick" · Accepted (2026-07-21)
**Context:** the search API computed a decision layer (best pick + evidence) that the client discarded. Surfacing it naively was unsafe: the accessory detector missed compatibility phrasing (magsafe / "compatible with" / "for phone"), so a phone case surfaced as the top result and "smart pick" for "iphone 15".
**Decision:** extend accessory/compatibility detection so accessories are demoted for product queries (improves the relevance order every user sees); gate the decision card server-side to null when the best match is an accessory for a main-product query; render a SmartPickCard that displays only the gated, evidence-bearing pick (reason, store count, TPS badge). The surface renders; it never re-judges (deterministic engine decides — ADR-002).
**Alternatives:** surface the card unconditionally (rejected — violates truth-before-convenience); tighten to a full query-relevance model (deferred — larger; coverage gaps for uncatalogued models are E6/E12).
**Consequences:** trustworthy Smart Pick live for covered Saudi-electronics queries; the specific accessory-as-pick trust failure is closed. Residual: for queries with no catalog coverage (e.g. a model not yet ingested) results remain weak — a coverage problem, not a decision defect. Verified on build 6d4745a.

### ADR-009 — pg_cron is the single authoritative scheduler; GET can never trigger a write · Accepted (2026-07-21)
**Context:** two uncoordinated trigger mechanisms (Supabase pg_cron for adapters, GitHub Actions for Jarir), a dormant DB-driven dispatch path, and two unauthenticated GET write paths (discover-firecrawl `?sync=1`; discover-products GET self-injecting CRON_SECRET). The pg_cron schedule lived only in the Supabase dashboard, outside version control.
**Decision:** Supabase pg_cron is the single authoritative scheduling mechanism; its schedule is captured in version control (`007_scheduler.sql`). Every scheduled call is an authenticated POST with the Bearer secret from Vault. GET on ingestion routes is read-only and can never write. Overlap protection (`hasActiveRun`) skips a store already running. The GitHub Actions Jarir trigger is retained with justification until `007` moves Jarir onto pg_cron and is verified live — retiring it earlier would stop Jarir ingestion.
**Alternatives:** make the DB-driven dispatch/`scraping_schedules` path authoritative (requires a schema migration + adapter-mechanism unification — that is E12/later, higher risk now).
**Consequences:** no unauthenticated write surface; no silent scheduler outside VCS; safe double-trigger handling. Full mechanism unification (one dispatch entry, all stores on adapters) deferred to E12. Verified on run 94.

### ADR-008 — Constitutional documentation set as Single Source of Truth · Accepted (2026-07-21)
**Context:** the founder ratified a 7-part Constitution; the repo had accurate but scattered analysis docs and a drifted `CLAUDE.md`.
**Decision:** consolidate into `TAWVEERI_CONSTITUTION.md` (root) governing `ARCHITECTURE.md`, `TPS.md`, `ROADMAP.md`, `GLOSSARY.md`, this register, and `CLAUDE.md`, with `docs/README.md` defining precedence. Deep analysis docs (Blueprint, transition plan, reconciliation) become the dated evidence layer.
**Alternatives:** keep the 7 raw parts (duplicative, contradictory); a single monolith (unmaintainable).
**Consequences:** one precedence chain; the Constitution wins conflicts; evidence docs are clearly subordinate and dated.

### ADR-007 — Verification is read-only; the production database is the only source of truth · Accepted (2026-07-21)
**Context:** two mis-targeted-project incidents (a probe and a SQL-editor session hit the wrong project).
**Decision:** all verification is strictly read-only unless the founder approves a write; every gate verdict is a fresh direct query against production; project identity is proven before acting (JWT `ref` / `to_regclass`); background watchers are optional instrumentation, never evidence.
**Consequences:** no verdict depends on a watcher; mis-targeting is caught before action. Governs all milestones.

### ADR-006 — Propagate `store_id` + `scraping_run_id` explicitly through the ingestion chain · Accepted (2026-07-21)
**Context:** the first post-deploy scheduled run left Jarir `raw_observations` without `scraping_run_id` and `price_history` without `store_id`.
**Decision:** pass the authoritative `store_id` (resolved once upstream) and the active run id explicitly down the discover-products chain; write both at insert; stop re-resolving identity downstream.
**Consequences:** single authoritative store id per offer; every observation links to its run. Verified on run 92. Historical rows preserved untouched.

### ADR-005 — RLS at the schema-definition layer; deny-all for credential/session tables · Accepted (2026-07-20)
**Context:** `phone_otps` and `login_sessions` were created without RLS; two tables of 21. E9 would have replicated the gap onto production.
**Decision:** fix the schema definitions (not just the live DB); enable+force RLS with deny-all on credential/session tables and revoke analytics views from `anon`/`authenticated`; add a static guard test.
**Consequences:** the defect cannot reach production or be replicated by E9. Legacy remediation tracked separately in `LEGACY-DB-FINDINGS.md`.

### ADR-004 — Canonical store identity is `stores.id` · Accepted (2026-07-20)
**Context:** three disagreeing store naming conventions (slug, display name, ingested label) silently broke joins and corroboration counts.
**Decision:** `stores.id` (integer FK) is the single store identity across all tables; `store_name` retained as provenance; expand-and-contract migration; alias shim removed.
**Alternatives:** the slug (drifts by language/spelling); a text key (no referential integrity).
**Consequences:** joins and corroboration are correct; identity is language-independent. Verified in production.

### ADR-003 — Consolidate onto System A (knowledge DB); migrate app schema into it · Accepted (2026-07-20)
**Context:** two live production systems — A (TPS/knowledge, live pipeline) and B (users/commerce, dormant catalog).
**Decision:** consolidate onto System A; migrate System B's user/auth/commerce schema in.
**Rationale:** customer identity is irreplaceable; the derived knowledge graph is rebuildable; the live pipeline already runs on A; the migration is additive on A. Reversed an earlier lean toward B after evidence showed B dormant (0 price updates in 30 days).
**Consequences:** defines the convergence target; mobile must be re-pointed and released.

### ADR-002 — Deterministic engines decide; LLMs phrase · Accepted (baseline, ratified)
**Context:** verdicts must be reproducible, auditable, and explainable to users, merchants, and partners.
**Decision:** all judgement (deal quality, price assessment, identity, ranking) is produced by deterministic engines and rules; LLMs handle intent, normalization, candidate selection, and language only, with supplied facts.
**Consequences:** no hallucinated prices/links/verdicts; model vendors are swappable without changing business truth. Enforced by post-generation validation.

### ADR-001 — Canonical Product / Commercial Variant / Offer with append-only evidence · Accepted (baseline, ratified)
**Context:** merchant listings are fragmented, inconsistent, and change constantly; identity must be stable while commerce is fluid.
**Decision:** the three-layer TPS model; identity requires ≥2-store corroboration; `raw_observations` immutable; `price_history` append-only; every identity decision logged.
**Consequences:** the platform's moat — a corroborated, provenance-complete, time-deep knowledge graph. Full spec in `docs/TPS.md`.
