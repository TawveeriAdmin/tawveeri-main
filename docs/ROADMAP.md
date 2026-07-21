# Roadmap

**Governed by:** `TAWVEERI_CONSTITUTION.md`. **Detailed execution plan:** `docs/ENGINEERING-TRANSITION-PLAN.md`.

Two views: *where the product is on the capability ladder*, and *the engineering sequence to get up it*. Status is honest and evidence-based; a phase is "done" only when verified in production.

---

## 1. Capability Maturity Model

| Level | Capability | State |
|---|---|---|
| **L1** | **Discovery** — users find products | ✅ Live |
| **L2** | **Comparison** — stores, prices, availability, offers | ✅ Live (canonical comparison for covered categories) |
| **L3** | **Knowledge** — specs, differences, guides, FAQs, buying advice | 🟡 Partial — decision layer now surfaced as Smart Pick in search; TPS covers `mobile`/`ac` |
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
| **E5** | Algolia sync restoration (feed the owned TPS index) | Pending |
| **E6** | TPS pipeline automation + **canonical-quality audit** (resolves the identity-invariant debt) | **COMPLETE — SHIPPED AND PRODUCTION-VERIFIED.** Mobile + AC bounded pipelines live; AC in live Smart Pick; category-isolated overlap-safe scheduler (`POST /api/cron/tps-batch`) production-verified (auth, ≤500 bound, 409 overlap, idempotent bounded write run, lock-release-after-failure); tests pass, 0 new failures; runbooks + test docs current (ADR-011..025). _History below._ **Mobile pipeline SHIPPED & PRODUCTION-VERIFIED, bounded & repeatable (ADR-011/013/014/015/016/017/018/019 + runbook).** 788 canonical taxonomy fixes; bounded matcher (≤500 obs, dry-run-first, atomic, idempotent, rollback); projection rebuilt (3→41, iPhone 15 live); `mobile`/`smartphone` resolved via the two-plane model (fixed an ADR-014 regression that hid 21 phones; TPS-visible 17→38); processing-status linked to committed batches (`done=123`). **Category readiness:** mobile READY, air_conditioner PARTIALLY_READY (no `write_ac_batch`), others NOT_READY — no category fabricated. **AC investigated (ADR-020):** gap report + `write_ac_batch` spec produced; batch NOT executed — evidence shows AC is structurally single-store (955 اكسترا vs 45 المنيع, 0 ≥2-store corroboration in the dry-run; only 3 corroborated ACs exist), so the Phase-6 precision gate is unmet. **AC pipeline SHIPPED & PRODUCTION-VERIFIED (ADR-022/023).** Four-store audit proved only Extra sells ACs at scale (Jarir/Amazon ~0 real units); the real blocker was **brand normalization** (Arabic `إل جي` vs English `LG`), not store coverage (corrects ADR-021) — fixed in `brand-map` + `ac/identity.ts`, unlocking corroboration. Built `write_ac_batch` (atomic, service-role-only, rollback-tested); write-capable balanced AC matcher (≤500, ≥2-store only). **First bounded AC batch: 7 corroborated LG/GREE/Westinghouse canonicals** (Extra↔Almanea comparisons), projection 41→48, no regression. AC unit tests 9/9. **AC now LIVE in search (ADR-024, build 5c43a50 verified):** category-aware TPS routing ("مكيف جري"/"LG split ac" → 2-store AC Smart Picks; mobile unchanged; accessory→none). **Remaining E6 (see `docs/HANDOFF-E6.md`):** category-isolated overlap-safe scheduler + one bounded scheduled run, broader integration tests. |
| **E7** | Canonical linkage on ingestion | Pending |
| **E8** | Surface the decision layer in web search ("Smart Pick") + accessory-relevance trust hardening | ✅ **Complete — production-verified** (build 6d4745a); trustworthy Smart Pick live for covered queries |
| **E9** | Create user/auth/commerce schema on System A (RLS from the start) | Pending |
| **E10** | Migrate user data System B → A | Pending |
| **E11** | Mobile convergence — true platform client, measured exits | Pending |
| **E12** | Adapter completion — all 8 stores on the adapter contract | Pending |
| **E13** | Recommendations & embeddings re-keyed to canonical identity | Pending |
| **E14** | Owned search index authority cutover | Pending |
| **E15** | Legacy retirement (System B, VPS) | Pending — after observation |
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

## 5. How the Roadmap stays honest

- A phase is complete only with production evidence (Constitution Article IX).
- Every phase records rollback and preserves historical evidence.
- Verification is read-only against the production database; the database is the source of truth (see the transition plan's verification methodology).
- Every material decision is logged in `docs/DECISIONS.md`.
