# E15 — Legacy Retirement Gate (assessment)

**Status:** assessed (2026-07-22). **Most gates MET**; retirement is **not yet executable** — see §2 blockers. Governed by the founder completion directive and the Constitution. Retirement of System B / VPS is **irreversible**; per the founder's own stop conditions it requires a verified archive and an ownership decision.

## 1. Gate checklist (evidence-based)

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | System A is authoritative | ✅ | All TPS pipeline, projection, index, `/api/v1`, schedulers run on `vyceqrzttspyycdpojtn`. |
| 2 | Milestone 7 / TPS authoritative for canonical identity | ✅ | 6 live categories + progressive batching; 94 corroborated + 812 resolved (ADR-039). |
| 3 | Legacy System B has no required authoritative data | ✅ | ADR-031: 0 authoritative users on B (~2 pre-launch dev rows); sessions/OTPs must not migrate. |
| 4 | No production runtime dependency on System B / VPS jobs | ✅ | `ffpsjjazsluolysgithg` appears only in tests, docs, a legacy remediation SQL, `.env.example` — **no runtime code/config**. Runtime uses System A. |
| 5 | Measured exits + affiliate attribution work | ✅ | `/go` 302 across all categories + Layer 2; absolute URLs (ADR-036); `outbound_clicks` + affiliate tags verified. |
| 6 | Owned search architecture live + rollback-tested | ✅ | E14 hybrid live (ADR-040); rollback = ignore `discovery[]` / one-line filter revert (read-side). |
| 7 | Recommendations canonical + deterministic | ✅ | E13 deterministic canonical recommender (ADR-030). |
| 8 | Schedulers + adapters on System A | ✅ | E4/E12; `/api/cron/*`, adapters registered on A. |
| 9 | Catalog coverage truth documented | ✅ | `docs/CATALOG-COMPLETENESS-GATE.md` (full-catalog measured). |
| 10 | Single-store / unmatched products discoverable without false comparison | ✅ | E14 Layer 2 resolved-single (ADR-040); 0 false-comparison verified. |
| 11 | **Web AND mobile use the Platform API contract** | 🟡 **Partial** | Web search consumes the canonical graph; **mobile still reads System A `products`/`product_stores` directly** (not `/api/v1/tps/search`) — E11 convergence incomplete. Not a System-B dependency (mobile uses A), but a stated E15 prerequisite. |
| 12 | Required backups / archives exist before retirement | ⛔ **Not done** | No verified archive of System B `public` schema. Retirement is irreversible → archive is mandatory (stop condition). |
| 13 | Obsolete credentials/services retired safely | ⛔ **Pending 12** | Depends on archive + ownership decision. |

## 2. Blockers to executing retirement (honest)

1. **E11 mobile convergence** (gate 11) — migrate mobile's direct `products`/`product_stores` reads (deals/index/search/product/store screens) to `platformApi` (`/api/v1/tps/search`), so in-app items carry `canonical_id`/`offer_id`/`go_url` + render decision objects. *Engineering — can be done autonomously; does not need System B.*
2. **E14 full sole-authority cutover** (Layer 3 raw long-tail + shadow/canary) — the founder set "E14 production-authoritative and stable" as the E15 precondition. Core hybrid is live; sole-authority promotion remains.
3. **Verified archive of System B** (gate 12) — requires **System B's service-role/DB credential**, which is **objectively absent** from every readable store (ADR-029/031). Without it, no read/export/archive of B is possible. **This is a genuine external-credential blocker** (founder stop condition).
4. **Ownership decision** — decommissioning System B + the VPS is an ownership/legal action (founder stop condition), even after archive.

## 3. Conclusion

**The engineering readiness for retirement is essentially complete** (gates 1–10 met; 11 is autonomous engineering). System B carries **no required data and no runtime dependency**, so its retirement is safe from a data-integrity standpoint. **E15 cannot be *declared complete*** because (a) executing retirement is irreversible and needs a verified archive, which needs System B credentials that are **absent** (external blocker), and (b) it is an ownership decision. The correct autonomous path is to **finish E11 mobile + E14 full cutover** (both credential-free engineering), then hand the archive+decommission decision to the founder with this gate as evidence.

**Next autonomous work (no external blocker):** E11 mobile convergence → E14 Layer 3 + shadow/canary. **Founder-gated:** System B archive (needs its credential) → decommission (ownership).
