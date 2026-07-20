# Legacy Database Findings — `ffpsjjazsluolysgithg`

**Scope:** This file is separate from E1–E3 production verification by design. Everything here concerns the **legacy** project `ffpsjjazsluolysgithg` (System B, served by `tawveeri.etlaq.sa`), NOT production `vyceqrzttspyycdpojtn`. Do not conflate the two.

**Verification rule in force:** all checks read-only unless the product owner explicitly approves a write.

---

## L1 — Public anon exposure (unresolved, live)

Probed with the legacy public anon key (`ref=ffpsjjazsluolysgithg`, ships in the pre-M0 mobile build and web bundle). All readable by any anonymous client:

| Object | Rows |
|---|---|
| `phone_otps` | 92 — phone numbers and OTP codes |
| `login_sessions` | 12 — user ids, device fingerprints, user agents, IPs |
| `mv_user_analytics` | 2 |
| `mv_product_analytics` | 7 |
| `mv_store_analytics` | 5 |

**Legacy Gate 8 (read-only re-verification, 2026-07-20, after owner confirmed the remediation was run against this project):** still FAIL. All five objects remain anon-readable — `phone_otps` 92, `login_sessions` 12, `mv_user_analytics` 2, `mv_product_analytics` 7, `mv_store_analytics` 5. Project identity confirmed (anon-key JWT `ref = ffpsjjazsluolysgithg`).

**Diagnosis (read-only inference, no writes):** the remediation did not take effect at the Postgres level.
- `phone_otps` returns 92 rows to anon. A table with RLS *enabled* and no policy returns **0 rows** to anon (RLS denies silently), not an error and not rows. Getting rows back means **RLS is not enabled** on the table — the `ALTER TABLE … ENABLE ROW LEVEL SECURITY` did not persist.
- The three `mv_*` are materialized views, which cannot carry RLS; their only control is the `REVOKE`. They remain readable, so the **`REVOKE ALL … FROM anon` did not persist** either.
- Both failing together points to the whole script not having committed against this project: a transaction that errored and rolled back, a partial run, or execution in a session that did not commit. Not a PostgREST cache issue — RLS and grants are enforced in Postgres and take effect immediately.

**To resolve (owner):** re-run `scripts/database/app-db/e3_rls_remediation.sql` and share the output of its embedded verification query — `relrowsecurity` (must be true for the two tables) and `has_table_privilege('anon', …, 'SELECT')` (must be false for all five). That query is the definitive check; if Postgres reports RLS on and anon revoked while PostgREST still returns rows, escalate as a platform anomaly. Current evidence says Postgres itself still has them open.

## L2 — `phone_otps` was anon-WRITABLE (potential auth bypass)

An anon `INSERT` into `phone_otps` on this project returned HTTP 201. `verify-phone-otp` validates an OTP by matching `phone` + `is_used=false` + unexpired, with no binding to the requester. An attacker able to insert `{phone: victim, otp_code: known, is_used: false, expires_at: future}` could then verify it and trigger `supabase.auth.admin.createUser` / `updateUserById` for that phone — account creation or takeover.

Not tested end-to-end (would require authenticating as another identity). Assessed from the confirmed 201 plus the verification code path. Severity depends on whether this project still serves live auth traffic. `REVOKE ALL ON phone_otps FROM anon, authenticated` closes it.

## L3 — Data-modification incident (self-inflicted, disclosed)

During the mis-targeted Gate 8, a verification write inserted a test row into `phone_otps`, then a DELETE-by-phone-filter removed the test row plus **2 pre-existing rows** (count 94 → 95 → 92). The deleted rows were spent, expired OTP records (one captured: `otp_code 938927`, `is_used=true`, expired 2026-02-26). Assessed impact: nil (expired, used). Full field values of one deleted row are retained and can be restored on owner instruction. Root cause: acted before establishing project identity, and deleted by filter rather than by returned id. Directly motivated the standing read-only rule.

---

## Disposition

The legacy database is retired by transition-plan phases E10/E11/E12/E14/E15. These findings do not block E1–E3 production verification. They are owner-facing decisions:
1. Confirm where `e3_rls_remediation.sql` was applied; re-verify read-only.
2. Decide whether to apply the RLS remediation to this project now, given L2 is a live auth-bypass risk if the project still serves traffic.
3. Decide whether to restore the deleted OTP row (recommendation: no — expired and used).
