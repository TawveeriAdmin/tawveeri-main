# Roadmap

**Governed by:** `TAWVEERI_CONSTITUTION.md`. **Detailed execution plan:** `docs/ENGINEERING-TRANSITION-PLAN.md`.

Two views: *where the product is on the capability ladder*, and *the engineering sequence to get up it*. Status is honest and evidence-based; a phase is "done" only when verified in production.

---

## 1. Capability Maturity Model

| Level | Capability | State |
|---|---|---|
| **L1** | **Discovery** — users find products | ✅ Live |
| **L2** | **Comparison** — stores, prices, availability, offers | ✅ Live (canonical comparison for covered categories) |
| **L3** | **Knowledge** — specs, differences, guides, FAQs, buying advice | 🟡 Partial — decision layer surfaced as Smart Pick in search; TPS **comparison** covers `mobile`/`ac`; `laptop` plugin built + precise but catalog yields 0 cross-store corroboration (ADR-032); TV is the next buildable category (ADR-033) |
| **L4** | **AI Shopping** — Waffar reasons, compares, explains, recommends | 🟡 Present on web; deterministic-engine-backed; not yet on all clients |
| **L5** | **Commerce Intelligence** — market understanding, prediction, merchant & consumer intelligence, APIs | ⚪ Foundational data exists; capabilities not yet built |

**Current position:** solidly L2, converging toward a complete L3 and a broader L4. The gating work is knowledge-construction automation and platform consolidation, not new surfaces.

---

## 2. Execution sequence (E-phases)

The path from the current two-system reality to the unified platform. Full detail — objectives, verification, rollback, risk — in `docs/ENGINEERING-TRANSITION-PLAN.md`.

| Phase | Scope | Status |
|---|---|---|
| **E0** | Environment authority & access | ✅ Complete |
| **E1** | Observability & run logging | ✅ **Complete — production-verified** (run 92) |
| **E2** | Canonical store identity (`stores.id`) | ✅ **Complete — production-verified** |
| **E3** | RLS at the definition layer + production exposure audit | ✅ **Complete — production-verified** (legacy remediation tracked separately) |
| **E4** | Scheduler consolidation, ingestion-trigger security, overlap protection, scheduler-as-code | ✅ **Complete — production-verified** (run 94); Must-Fix closed (two unauthenticated GET write paths eliminated) |
| **E5** | Algolia sync restoration (feed the owned TPS index) | ✅ **Complete — verified (ADR-027)**: `scripts/tps-algolia-sync.ts` builds owned index `tawveeri_tps_products` from the projection (48 recs, reproducible), stamps `algolia_synced_at`, schedulable via `/api/cron/tps-algolia-sync`; zero live-search impact until E14. |
| **E6** | TPS pipeline automation + **canonical-quality audit** (resolves the identity-invariant debt) | **COMPLETE — SHIPPED AND PRODUCTION-VERIFIED.** Mobile + AC bounded pipelines live; AC in live Smart Pick; category-isolated overlap-safe scheduler (`POST /api/cron/tps-batch`) production-verified (auth, ≤500 bound, 409 overlap, idempotent bounded write run, lock-release-after-failure); tests pass, 0 new failures; runbooks + test docs current (ADR-011..025). _History below._ **Mobile pipeline SHIPPED & PRODUCTION-VERIFIED, bounded & repeatable (ADR-011/013/014/015/016/017/018/019 + runbook).** 788 canonical taxonomy fixes; bounded matcher (≤500 obs, dry-run-first, atomic, idempotent, rollback); projection rebuilt (3→41, iPhone 15 live); `mobile`/`smartphone` resolved via the two-plane model (fixed an ADR-014 regression that hid 21 phones; TPS-visible 17→38); processing-status linked to committed batches (`done=123`). **Category readiness:** mobile READY, air_conditioner PARTIALLY_READY (no `write_ac_batch`), others NOT_READY — no category fabricated. **AC investigated (ADR-020):** gap report + `write_ac_batch` spec produced; batch NOT executed — evidence shows AC is structurally single-store (955 اكسترا vs 45 المنيع, 0 ≥2-store corroboration in the dry-run; only 3 corroborated ACs exist), so the Phase-6 precision gate is unmet. **AC pipeline SHIPPED & PRODUCTION-VERIFIED (ADR-022/023).** Four-store audit proved only Extra sells ACs at scale (Jarir/Amazon ~0 real units); the real blocker was **brand normalization** (Arabic `إل جي` vs English `LG`), not store coverage (corrects ADR-021) — fixed in `brand-map` + `ac/identity.ts`, unlocking corroboration. Built `write_ac_batch` (atomic, service-role-only, rollback-tested); write-capable balanced AC matcher (≤500, ≥2-store only). **First bounded AC batch: 7 corroborated LG/GREE/Westinghouse canonicals** (Extra↔Almanea comparisons), projection 41→48, no regression. AC unit tests 9/9. **AC now LIVE in search (ADR-024, build 5c43a50 verified):** category-aware TPS routing ("مكيف جري"/"LG split ac" → 2-store AC Smart Picks; mobile unchanged; accessory→none). **Remaining E6 (see `docs/HANDOFF-E6.md`):** category-isolated overlap-safe scheduler + one bounded scheduled run, broader integration tests. |
| **E7** | Canonical linkage on ingestion | Pending |
| **E8** | Surface the decision layer in web search ("Smart Pick") + accessory-relevance trust hardening | ✅ **Complete — production-verified** (build 6d4745a); trustworthy Smart Pick live for covered queries |
| **E9** | Create user/auth/commerce schema on System A (RLS from the start) | ✅ **Complete — production-verified (ADR-026)**: 13 auth/commerce tables on System A, RLS-first, credential table (`login_sessions`) deny-all to anon, FKs reconciled to A. E10 (data migration) gated. |
| **E10** | Migrate user data System B → A | ✅ **Resolved — no-substantial-data / near-superseded (ADR-031)**: System A has 0 users; System B is a pre-launch base (~2 active users, 12 sessions, evidence in LEGACY-DB-FINDINGS). No authoritative user base to migrate; sessions/OTPs must not migrate. Does not gate E14/E15. |
| **E11** | Mobile convergence — true platform client, measured exits | 🟡 **Core PRODUCTION-VERIFIED (ADR-029)** — Platform API Contract v1 (`/api/v1/tps/search` → offer_id + go_url), measured-exit loop verified (endpoint→/go 302→outbound_clicks source=mobile, affiliate tag). **Remaining:** mobile 45 catalog-read replacements, E10 auth prereq (🔒), app-store release. |
| **E12** | Adapter completion — all 8 stores on the adapter contract | ✅ **Complete — verified (ADR-028)**: all 8 registered on the `StoreAdapter` contract; 4 data-bearing enabled + live-verified (extra, almanea, jarir, amazon); 4 no-data stores registered `enabled:false` pending a validated ingestion run. |
| **E13** | Recommendations & embeddings re-keyed to canonical identity | ✅ **Complete — production-verified (ADR-030)**: deterministic canonical recommender `/api/v1/tps/recommendations` verified on mobile (best-value reasons, conf 93-95) + AC (same-family, conf 80); 0 accessory contamination; category-aware; no embeddings/Gemini. Semantic embeddings deferred (optional). |
| **E14** | Owned search index authority cutover | ⛔ **Gated on catalog coverage (not a secret):** owned TPS index = **48 of 4,821 catalog products (~1%)**. Coverage is gated by **cross-store corroboration, not plugin count** — the laptop plugin is built + precise yet the Saudi laptop catalog has **0 genuine ≥2-store matches** (store-exclusive SKUs, no shared model identifier — ADR-032). Evidence-based buildable categories by corroboration ceiling: **TV=32, Tablet=13, Audio=9, Camera=4, Appliance=0** (ADR-033). TV is next. The cutover needs corroboration-bearing categories scaled up; Smart-Pick overlay already live for mobile+ac. See **§6 TPS Category Coverage**. |
| **E15** | Legacy retirement (System B, VPS) | ⛔ **Gated on E14** (catalog coverage). Legacy DATA aspect resolved (E10 superseded — no data to migrate). Retirement of the owned-search-authority gate awaits catalog-scale TPS coverage. |
| **E16** | Contracts & documentation alignment (regenerate types) | Continuous |

**Critical path** is consolidation (E9 → E10 → E11 → E15), gated by the mobile release cycle, not by TPS. The data-correctness track (E4 → E6 → E7 → E14) runs in parallel. See the transition plan's dependency graph.

---

## 3. Near-term priorities

1. **E5 — Algolia sync restoration** (owned TPS index producer).
3. **E6 — automate knowledge construction and audit the canonical graph** — the platform's moat currently grows only when a human runs a script; this is the single highest-leverage architectural change.

---

## 4. Long-horizon capabilities (emerge from the foundation, not built ad hoc)

Price prediction · deal & offer-quality scoring · merchant intelligence & reputation · alerts engine · personalization (privacy-preserving) · knowledge graph expansion · consumer/merchant/enterprise APIs · AI-agent access. Each must arrive as a **reusable platform capability** unlocking multiple products, per Constitution Article II.11 and Article VIII.

---

## 6. TPS Category Coverage (evidence-based)

Comparison coverage grows **only where cross-store corroboration genuinely exists**. Raw product counts do not imply corroboration (laptop: 2,840 real units → 0 matches). Order set by measured corroboration ceiling (read-only audit, `scripts/tps-test/category-corroboration-audit.ts`), not inventory.

| Category | Status | Cross-store corroboration | Notes |
|---|---|---|---|
| **mobile** | ✅ Live (Smart Pick) | corroborated | first TPS category |
| **air_conditioner** | ✅ Live (Smart Pick) | 7 canonicals | unlocked by brand normalization (ADR-022/023) |
| **laptop** | 🟢 Plugin built + precise; ⛔ comparison-blocked | **0 genuine** | store-exclusive SKUs; all 5 spec-overlaps proven-different models (ADR-032) |
| **TV** | ⏭️ **Next build** | **32** (proxy floor) | Hisense/TCL/LG 65"/75" 4K — real commodity matches (ADR-033) |
| **tablet** | Queued | 13 | iPad Air / Huawei |
| **audio** | Queued | 9 | AirPods Pro/AirPods |
| **camera** | Queued | 4 | Canon EOS R-series |
| **appliance** | ⛔ Deferred | **0** | Extra-only; structurally single-store |

**Rule:** re-audit corroboration before building any category plugin; never write a merge that isn't ≥2-store corroborated (Constitution; precision over recall).

---

## 5. How the Roadmap stays honest

- A phase is complete only with production evidence (Constitution Article IX).
- Every phase records rollback and preserves historical evidence.
- Verification is read-only against the production database; the database is the source of truth (see the transition plan's verification methodology).
- Every material decision is logged in `docs/DECISIONS.md`.
