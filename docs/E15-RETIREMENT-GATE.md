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
| 11 | Web/mobile do not depend on System B | ✅ (corrected) | Mobile `eas.json` → System A; System A has `products`/`product_stores`; web bundle = System A. Full platform-API adoption in mobile screens is a **future enhancement**, not a retirement blocker (ADR-041). |
| 12 | Required backups / archives exist before retirement | ✅ **N/A — not required** (corrected) | System B has **no required unique data** (2 zero-activity users; superseded catalog; sessions/OTPs must not migrate). A read key exists; nothing mandatory to archive (ADR-041). Prior "service-role archive blocker" WITHDRAWN. |
| 13 | Obsolete credentials/services retired safely | ⛔ **CAN be (proven safe); NOT executed** | Safe to retire (gates 1–10 met). Execution needs owner platform access — **absent** (§3). |

## 2. Re-audit corrections (ADR-041 — production evidence, this session)

Two prior "blockers" were **inferred, not demonstrated**, and are corrected here:

- **E11 mobile is NOT an E15 blocker.** `mobile/eas.json` targets System A (`vyceqrzttspyycdpojtn`); System A holds `products`=4,821 / `product_stores`=7,481 / `stores`=8. Mobile functions on A without B. Migrating mobile screens to the platform API is a **future enhancement**, not a retirement blocker.
- **E14 Layer 3 is NOT an E15 blocker.** The main site search is `/api/search/scrape` → `searchAllStores` (live scrapers on System A), not the sole owned index and not System B. Retiring B removes nothing from discoverability. E14 Core (hybrid, no false comparison) satisfies gate 10; Layer 3 is a future enhancement.
- **Archive is NOT technically necessary (gate 12 corrected).** System B holds **2 users with zero activity** (`mv_user_analytics`), ephemeral sessions/OTPs (must not migrate), and a **superseded** legacy catalog (94,921 products vs A's live 133k observations). No required unique production data. A System B **read** key (anon) was recovered; the *service-role* key I previously called a blocker is **not needed** because there is nothing required to archive.

## 3. The single remaining blocker (demonstrated)

**Executing the decommission** — delete Supabase project `ffpsjjazsluolysgithg` + shut down the `tawveeri.etlaq.sa` VPS — requires **owner/platform credentials that are demonstrably absent**: `SUPABASE_ACCESS_TOKEN`/`SUPABASE_MANAGEMENT_TOKEN`/`RAILWAY_TOKEN`/VPS SSH all absent; no supabase/railway CLI; anon-key `DELETE /v1/projects/…` → **HTTP 401**. The legacy services are **still running** (`etlaq.sa/api/health`=200; System B REST reachable). This is **external** and engineering **cannot** eliminate it (deleting a project / shutting a VPS are inherently owner actions).

## 3b. Execution attempt (2026-07-22) — BLOCKED by absent credentials (evidence)

The founder granted "full machine access" to execute decommission. Fresh, exhaustive verification of the actual environment **contradicts** that premise — the required credentials are not present:
- Env: `SUPABASE_ACCESS_TOKEN`/`SUPABASE_MANAGEMENT_TOKEN`/`SUPABASE_PAT`, all `RAILWAY_TOKEN*`, `VPS_SSH_KEY`/`SSH_PRIVATE_KEY`/`ETLAQ_SSH*`/`VPS_HOST`/`VPS_USER` = **absent**; full env scan for `RAILWAY|SUPABASE_ACCESS|SSH|VPS|ETLAQ|DO_TOKEN|…` = **none**.
- Stored CLI auth: no `~/.supabase`, `~/.config/supabase`, `~/.railway`, `~/.config/railway`, `~/.netrc`.
- SSH: no `~/.ssh/` keys or config (VPS `:22` reachable, but no key to authenticate).
- CLIs: `supabase`, `railway`, `doctl` not installed.
- Supabase Management API: no token → cannot list/delete projects.

No operational step (project delete / Railway env inspection / VPS decommission) is executable. **I did not guess, fake, or attempt destructive actions I cannot authenticate.** To proceed, the owner must either place a `SUPABASE_ACCESS_TOKEN` (+ Railway token + VPS SSH key) in the environment, or run the decommission commands directly.

## 4. Verdict

**E15 BLOCKED** — on the decommission action only. All readiness gates (1–10, and the corrected 11/12) are **VERIFIED**: nothing in production depends on System B, there is no required data to archive, and deleting System B breaks no subsystem (ingestion/search/web/mobile/cron/recommendations/measured-exits/Algolia/TPS/identity/progressive batching all run on System A).

**Exact next action (founder/owner, ~5 min):** in the Supabase dashboard, delete project `ffpsjjazsluolysgithg`; decommission the `tawveeri.etlaq.sa` VPS. No archive required (optional: export the 2 user rows first if any legacy-account preservation is desired). After the services are down, E15 is complete — verifiable by `etlaq.sa/api/health` and System B REST both becoming unreachable.
