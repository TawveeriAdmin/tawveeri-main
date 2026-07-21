# Roadmap

**Governed by:** `TAWVEERI_CONSTITUTION.md`. **Detailed execution plan:** `docs/ENGINEERING-TRANSITION-PLAN.md`.

Two views: *where the product is on the capability ladder*, and *the engineering sequence to get up it*. Status is honest and evidence-based; a phase is "done" only when verified in production.

---

## 1. Capability Maturity Model

| Level | Capability | State |
|---|---|---|
| **L1** | **Discovery** — users find products | ✅ Live |
| **L2** | **Comparison** — stores, prices, availability, offers | ✅ Live (canonical comparison for covered categories) |
| **L3** | **Knowledge** — specs, differences, guides, FAQs, buying advice | 🟡 Partial — decision layer computed but not yet surfaced everywhere; TPS covers `mobile`/`ac` |
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
| **E6** | TPS pipeline automation + **canonical-quality audit** (resolves the identity-invariant debt) | Pending — highest-value knowledge work |
| **E7** | Canonical linkage on ingestion | Pending |
| **E8** | Surface the decision layer in web search | Pending — highest user-visible value, no dependency |
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
2. **E8 — surface the decision layer** (independent, high user value).
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
