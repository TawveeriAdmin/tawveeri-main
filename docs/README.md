# Tawveeri Documentation — Index & Precedence

This repository is governed by a constitutional document set. This index defines what each document is, and — critically — **which wins when two disagree.**

---

## Precedence (highest authority first)

1. **`/TAWVEERI_CONSTITUTION.md`** — the ratified vision and principles. Governs everything. Amendments require founder ratification.
2. **`/docs/ARCHITECTURE.md`** — the living, canonical architecture. Authoritative over any dated evidence doc.
3. **`/docs/TPS.md`** — the canonical product-identity standard.
4. **`/docs/ROADMAP.md`** — capability maturity and execution sequence/status.
5. **`/CLAUDE.md`** — the engineering operating manual (how we work in this repo).
6. **`/docs/DECISIONS.md`** — the Decision Register (why things are the way they are).
7. **Evidence & working documents** (below) — dated snapshots and detail. Subordinate to all of the above.
8. **Code** — must conform to the documents above; where it doesn't, that is debt to fix, recorded as a decision.

**Rule:** where any document, comment, or implementation conflicts with a higher authority, the higher authority prevails and the lower is corrected — never the reverse silently.

---

## The constitutional set

| Document | Purpose |
|---|---|
| `TAWVEERI_CONSTITUTION.md` | What Tawveeri is; the twelve principles; governance. **Single Source of Truth.** |
| `docs/ARCHITECTURE.md` | Layered platform model, invariants, current-vs-target, extension contracts. |
| `docs/TPS.md` | Tawveeri Product Standard — identity, category plugins, evidence, confidence. |
| `docs/ROADMAP.md` | Capability maturity; E-phase execution status. |
| `docs/GLOSSARY.md` | One agreed meaning per term. |
| `docs/DECISIONS.md` | Decision Register (ADRs). |
| `CLAUDE.md` | Operating manual for engineers and AI working in the repo. |

## Evidence & working documents (dated, subordinate)

| Document | Role |
|---|---|
| `docs/UNIFIED-PLATFORM-BLUEPRINT-V1.md` | Detailed target-architecture evidence (2026-07-20). Appendix to `ARCHITECTURE.md`. |
| `docs/ENGINEERING-TRANSITION-PLAN.md` | Full E-phase plan, verification, rollback, risk, and E1–E3 completion record. |
| `docs/ARCHITECTURE-RECONCILIATION.md` | The two-system reconciliation and consolidation recommendation. |
| `docs/PRODUCTION-EXECUTION-TOPOLOGY.md` | Verified trigger/ingestion topology. |
| `docs/ENVIRONMENT-AUTHORITY.md` | Project authority, deployment, credential inventory. |
| `docs/LEGACY-DB-FINDINGS.md` | Legacy-only findings (System B). Kept strictly separate from production. |

---

## Status legend used across docs

✅ Complete & production-verified · 🟡 Partial · ⏭ Next · ⚪ Foundational/not built · ❌ Failing.
A phase is "complete" only with production evidence (Constitution Article IX).

## How to use this set

- **Making an engineering decision?** Check the Constitution's twelve principles and the architecture invariants. If your change conflicts with one, stop.
- **Adding a store or category?** Registration against a contract, not core changes (`ARCHITECTURE.md` §4, `TPS.md` §3).
- **Made a significant decision?** Add an ADR to `DECISIONS.md`.
- **Reporting work?** Only verified production value counts.
