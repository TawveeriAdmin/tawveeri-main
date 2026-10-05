# Wave-1 Vacuum soak log (session cron; uncommitted)

| UTC | verdict | runner cycles | alerts | vacuum comparable | max signal age h |
|---|---|---:|---:|---:|---:|
| 2026-10-04 13:12 | HEALTHY | 1 | 0 | 63 | 2.94 |
| 2026-10-04 13:43 | HEALTHY | 1 | 0 | 63 | 2.94 |

**Post-rollback verification 2026-10-04 18:26Z (read-only):** identity_gate last success 18:18:40Z (after the 14:16Z rollback; note: skipped, no category in the runner scope has its read gate on); projection tv 206/1039 comparable, vacuum 67/441 (ungated, back from 63); TPS_IDENTITY_GATE=off on tawveeri-worker and tawveeri-main; health deep 200; newest tps_identity_wave_log row 14:08:56Z HEALTHY, 0 ROLLBACK_REQUIRED after 14:16Z (monitor skipped measuring). No variable changed, nothing pushed.

**Evidence shadow 2026-10-05 (TV, worker only):** deployed 3f364440 (commits 80f5e5d4, 9eb37557, 8e99398c; railway up, no push), TPS_IDENTITY_EVIDENCE=tv on tawveeri-worker only, gates OFF. First evidence cycle 04:06:58Z: TV signals 45 -> 101 (95 review + 6 reject) = dry prediction; projection unchanged (tv 205, vacuum 67); health 200. Report docs/report/PRODUCT-IDENTITY-TV-EVIDENCE-SHADOW-REPORT-2026-10-05.md. TV read gate stays HOLD.

**Evidence shadow cycles 2 and 3 (2026-10-05 04:51:53Z, 05:51:31Z):** TV signals stable at 95 review / 6 reject; vacuum 10/1. Catalog-wide dry verifier run (ungated prod exposure): 145/4,593 multi-store listings with material conflict. Main deploy denied by permission classifier (not attempted around). Readiness closure: PARTIAL_READY — docs/report/PRODUCT-IDENTITY-COMMERCIAL-READINESS-CLOSURE-2026-10-05.md.
