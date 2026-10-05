# Wave-1 Vacuum soak log (session cron; uncommitted)

| UTC | verdict | runner cycles | alerts | vacuum comparable | max signal age h |
|---|---|---:|---:|---:|---:|
| 2026-10-04 13:12 | HEALTHY | 1 | 0 | 63 | 2.94 |
| 2026-10-04 13:43 | HEALTHY | 1 | 0 | 63 | 2.94 |

**Post-rollback verification 2026-10-04 18:26Z (read-only):** identity_gate last success 18:18:40Z (after the 14:16Z rollback; note: skipped, no category in the runner scope has its read gate on); projection tv 206/1039 comparable, vacuum 67/441 (ungated, back from 63); TPS_IDENTITY_GATE=off on tawveeri-worker and tawveeri-main; health deep 200; newest tps_identity_wave_log row 14:08:56Z HEALTHY, 0 ROLLBACK_REQUIRED after 14:16Z (monitor skipped measuring). No variable changed, nothing pushed.

**Evidence shadow 2026-10-05 (TV, worker only):** deployed 3f364440 (commits 80f5e5d4, 9eb37557, 8e99398c; railway up, no push), TPS_IDENTITY_EVIDENCE=tv on tawveeri-worker only, gates OFF. First evidence cycle 04:06:58Z: TV signals 45 -> 101 (95 review + 6 reject) = dry prediction; projection unchanged (tv 205, vacuum 67); health 200. Report docs/report/PRODUCT-IDENTITY-TV-EVIDENCE-SHADOW-REPORT-2026-10-05.md. TV read gate stays HOLD.

**Evidence shadow cycles 2 and 3 (2026-10-05 04:51:53Z, 05:51:31Z):** TV signals stable at 95 review / 6 reject; vacuum 10/1. Catalog-wide dry verifier run (ungated prod exposure): 145/4,593 multi-store listings with material conflict. Main deploy denied by permission classifier (not attempted around). Readiness closure: PARTIAL_READY — docs/report/PRODUCT-IDENTITY-COMMERCIAL-READINESS-CLOSURE-2026-10-05.md.

**Canary soak check 2026-10-05 07:47Z:** identity_gate last success 07:37:04Z (age 0.17h); wave log HEALTHY x2 since canary (no triggers/warnings); tv comparable 165 (baseline 205), vacuum 67; signals tv 95 review/6 reject; GATE=tv only on worker+main (+EVIDENCE=tv); health 200 0.7s; tv compare 7.6s (pre-existing). No rollback trigger.

**Canary soak check 2026-10-05 10:26Z (+3h50m):** identity_gate last success 09:40:39Z; wave log HEALTHY x4 (07:37, 07:49, 08:40, 09:40), no triggers; tv comparable 165 (stable), vacuum 67; tv signals 95 review/6 reject; GATE=tv only on worker+main; health 200 0.7s. No rollback trigger.

**Canary soak check 2026-10-05 11:47Z (+5h10m):** identity_gate last success 11:40:29Z (age 0.12h); wave log HEALTHY x8 since canary, 0 ROLLBACK_REQUIRED; tv comparable 165, vacuum 67; tv signals 95 review/6 reject; GATE=tv only on worker+main; health 200 0.95s; tv compare 7.3s (pre-existing). No rollback trigger.

**Amazon closure deploys 2026-10-05 (soak untouched, gates unchanged):** a12a6ec0 (claim-eligibility, store filter, device-vs-accessory) at ~15:07+03 and e6806b82 (legacy Algolia hits exit via /go/ps_<id>) at 15:20+03 — both main+worker SUCCESS (worker restart; identity_gate resumes on its interval). Gate=tv unchanged. Final report docs/report/AMAZON-COMMERCIAL-INTEGRATION-FINAL-CLOSURE-2026-10-05.md (AMAZON_PARTIAL_READY; 13 non-TV projection rows await a scoped rebuild that the permission classifier denied).
