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

**Canary soak check 2026-10-05 13:52Z (+7h15m):** identity_gate last success 13:24:49Z (age 27 min; first cycle after the 12:20Z worker redeploy, so it already used the new projection builder); wave log HEALTHY x8 + BASELINE, 0 triggers, 0 ROLLBACK_REQUIRED; tv comparable 165/1,040 canonicals (stable), vacuum 67/441; tv signals 95 review/6 reject, vacuum 10/2; GATE=tv only on worker+main (+EVIDENCE=tv, RUNNER_CATEGORIES=tv,vacuum); health deep 200 2.3s. S90H search card = samsung_ksa with observation time. No rollback trigger.

**Canary soak check 2026-10-05 15:43Z (+9h06m):** identity_gate last success 15:24:24Z (age 18 min; also 14:29Z); wave log HEALTHY at 14:29Z and 15:24Z, 0 triggers; tv comparable 163/1,040 (baseline 205, floor 100), vacuum 68/441 (was 67; ungated, drifts with data); tv signals 95 review/6 reject, vacuum 10 review/1 reject; GATE=tv only on worker+main; health 200 0.8s. No rollback trigger.

**Canary soak check 2026-10-05 15:47Z (+9h10m):** identity_gate last success 15:24:24Z (age 23 min); wave log: 0 non-HEALTHY rows since canary, no new row since 15:24Z; tv comparable 163/1,040, vacuum 68/441; tv signals 95 review/6 reject; GATE=tv only on worker+main; health 200 0.76s. No rollback trigger.

**Amazon executive closure 2026-10-05 (soak unaffected):** projection fix ebd36d39 deployed 16:04Z; gated cycle 17:12:35Z HEALTHY (0 triggers), tv comparable 163/1,040 (coverage unchanged), tv signals 95 review/6 reject, GATE=tv unchanged. Worker redeployed again at 17:14Z (56774849, e829cd09) — next identity_gate cycle ~18:15Z, stale limit 3h = 20:12Z. Out-of-stock-as-cheapest 80 -> 0 (14 non-TV categories rebuilt manually with --categories; tv+vacuum by the worker). Report AMAZON-EXECUTIVE-TECHNICAL-COMMERCIAL-CLOSURE-2026-10-05.md: AMAZON_READY_WITH_MONITORING.

**Canary soak check 2026-10-05 17:47Z (+11h10m):** identity_gate last success 17:12:35Z (age 35 min; the 17:14Z redeploy restarted timers, next cycle expected ~18:15Z); wave log 0 non-HEALTHY rows since canary (latest 17:12:34Z HEALTHY, 0 triggers); tv comparable 163/1,040, vacuum 68/441; tv signals 95 review/6 reject, vacuum 10/2; GATE=tv only on worker+main; health 200 0.7s; tv compare page 4.9s (pre-existing slow path). No rollback trigger.

**Canary soak check 2026-10-05 19:36Z (+12h59m):** identity_gate last success 19:03:40Z (age 32 min; first cycle after the 18:31Z redeploy, cadence 60m); wave log HEALTHY 17:12Z and 19:03Z, 0 triggers, 0 non-HEALTHY since canary; tv comparable 163/1,040, vacuum 67/441; GATE=tv only on worker+main; health 200 1.7s; origin/main == local main (a0b0de4a pushed 18:31Z). No rollback trigger.

**Canary soak check 2026-10-06 04:31Z (+21h54m):** identity_gate last success 03:35:27Z (age 55 min, hourly cadence at :35); wave log HEALTHY x8 since 20:35Z (every hour, 0 triggers), 0 non-HEALTHY since canary; tv comparable 159/1,040 (baseline 205, floor 100; 163 -> 159 data drift), vacuum 67/441; tv signals 95 review/6 reject, vacuum 10/2; GATE=tv only on worker+main; health 200 0.9s; tv compare 3.9s. No rollback trigger.

**Search-latency + AC-type deploys 2026-10-06 (soak unaffected):** 5 main+worker redeploys 05:04–05:44Z (2df775d1, 21ba8588, 7cb20eef, fd32fa95, c6c85d69). identity_gate ran 05:44:30Z after the last redeploy (HEALTHY, 0 triggers; gap since 04:35Z was 69 min, stale limit 3h); tv comparable 159/1,040, vacuum 67; GATE=tv unchanged. Broad searches 13–17 s -> ~1 s warm.

**Canary soak check 2026-10-06 05:58Z (+23h21m):** identity_gate last success 05:44:30Z (age 14 min); wave log HEALTHY at 03:35Z, 04:35Z, 05:44Z, 0 non-HEALTHY since canary; tv comparable 159/1,040, vacuum 67/441; tv signals 95 review/6 reject, vacuum 10/2; GATE=tv only on worker+main; health 200 1.7s; tv compare 3.1s. No rollback trigger.

**Search/exit/model-gate deploys 2026-10-06 (soak unaffected, gates unchanged):** ~14 main+worker redeploys 04:55–08:33Z. identity_gate cycles: 05:44Z, 07:07Z, 08:25:58Z (HEALTHY, 0 triggers; max gap 83 min vs 3 h limit). After the projection's hidden-store boundary the 08:25 cycle rebuilt tv/vacuum: tv comparable 150/1,040 (was 159; baseline 205; collapse trigger needs a 40% fall without signals), vacuum 67; tv signals 95 review/6 reject, vacuum 10/2; cheapest-store-is-a-hidden-retailer = 0 in all categories (was tv 18, vacuum 4, 26 elsewhere). GATE=tv unchanged.
