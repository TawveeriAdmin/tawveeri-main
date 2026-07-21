# E9 Kickoff — Create user/auth/commerce schema on System A (RLS-first)

**Ratified by** ADR-003 (consolidate onto System A). **Scope of E9 only:** create the MISSING auth/commerce tables on System A (`vyceqrzttspyycdpojtn`), RLS from the start. **NOT in E9:** E10 (migrate user data System B → A — irreversible, touches legacy), E11 (mobile convergence), E15 (legacy retirement). **Legacy `ffpsjjazsluolysgithg` stays closed** — do not read/write/migrate it here.

## Read-only assessment (System A, done 2026-07-21)
- System A has 26 public tables — all TPS/knowledge/scraping + `products`, `stores`, `product_stores`, `price_history` (TPS-oriented). Only `product_links` lacks RLS.
- **All 12 auth/commerce target tables are MISSING:** `users`, `user_wishlists`, `price_alerts`, `notifications`, `transactions`, `coupons`, `product_reviews`, `saved_searches`, `user_preferences`, `login_sessions`, `admin_logs`, `user_roles` (+ `search_history`, `store_reviews` per 02-rls).

## Critical reconciliation findings (E9 is NOT "apply the SQL files")
The ratified schema (`scripts/database/01-schema.sql`, `02-rls-policies.sql`, `04/07/09/11/12-*.sql`) targets the LEGACY lineage and DIVERGES from System A:
- **`stores.id`:** legacy = `UUID`; **A = `INTEGER`** (ADR-004 canonical identity). Commerce FKs to stores must use A's integer.
- **`product_category` enum:** legacy = 8 old values; A extended (migration 18: `air_conditioner`, `mobile`, `appliance`, `kitchen`, …). Do not recreate the enum.
- **`products`/`stores`/`product_stores`/`price_history` already exist on A** (TPS structure) — the new auth/commerce tables must FK to A's versions, not recreate them.
- **`users`** must integrate with A's Supabase `auth.users` (id UUID). Confirm whether public.users.id = auth.users(id) FK or the legacy standalone uuid model + trigger.
- RLS helper functions (`02-rls`: `get_user_role()`, admin checks) reference `public.users` — create users first.

## Plan (RLS-first, reversible, System A only)
1. Create enums missing on A (`user_role`, `auth_provider`, `transaction_status`, `notification_type` if absent — check first; product_category exists).
2. `public.users` (id → auth.users, role, verified flags) + RLS (own-row select/update; admin all) + the RLS helper functions.
3. Auth/commerce tables adapted to A: `user_roles`, `user_wishlists`, `price_alerts`, `notifications`, `transactions`, `product_reviews`, `saved_searches`, `user_preferences`, `login_sessions`, `admin_logs`, `coupons` — FKs to A's `products`/`stores` (integer store_id), each with **RLS enabled** and correct policies (own-data for users; admin all; **credential/session tables like `login_sessions`/`phone_otps` deny-all to `anon`**).
4. Apply as a numbered migration (next number in `scripts/database/knowledge-db/` or a new `2x-*.sql`), owner-applied over the direct connection (connect-retry). Reversible = drop the new tables/enums/functions.
5. Verify: every new table `relrowsecurity=true`; `anon` has no grants on credential/session tables; FKs resolve to A's tables; typecheck; a smoke insert/select under RLS (service-role) then rollback.

## Governance
- **Security-boundary milestone:** creating the platform's auth/credential schema. Build RLS-first; verify deny-all on credential/session tables (Constitution non-negotiable). Reversible (additive DDL).
- Legacy closed; E10 (data migration) separately gated (irreversible + touches legacy → founder approval).
- Env/connection: `SUPABASE_DB_URL` in `.env.local` (direct IPv6, intermittent — connect-retry). Never print/commit secrets; `.env.local` gitignored.
