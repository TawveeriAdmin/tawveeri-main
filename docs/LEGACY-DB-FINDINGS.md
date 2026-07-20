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

Remediation `scripts/database/app-db/e3_rls_remediation.sql` exists but its application status on this project is unconfirmed. Re-verify read-only after the owner confirms where it was run.

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
