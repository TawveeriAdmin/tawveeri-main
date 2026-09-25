-- 61-founder-subscriptions.sql — «الالتزامات والاشتراكات الشهرية», separate from paid expenses.
-- A subscription never pays itself: a FIXED one materialises an EXPECTED (draft) expense row on
-- its renewal date, which becomes `paid` only when the founder confirms an invoice/charge; a
-- VARIABLE one (Railway, Supabase, SendGrid, Anthropic API) carries an estimated monthly budget
-- only and its real invoice is entered each month; NEEDS_CONFIRMATION (Store Leads, Browserless)
-- creates nothing until the founder confirms it is still active. Additive, idempotent, RLS on.
create table if not exists public.founder_subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  vendor             text not null,
  description        text,
  category           text not null check (category in ('hosting','data_extraction','ai','tools','advertising','design','contractor','fees','other')),
  kind               text not null check (kind in ('fixed','variable_budget')),
  status             text not null default 'active' check (status in ('active','paused','needs_confirmation','ended')),
  cadence            text not null default 'monthly' check (cadence in ('monthly','yearly')),
  amount_original    numeric(14,2),
  currency           text not null default 'SAR',
  amount_sar         numeric(14,2),            -- fixed: the expected charge; variable: the monthly budget estimate
  budget_source      text,                     -- how the estimate was derived (variable only)
  next_renewal_at    date,
  last_confirmed_at  date,
  notes              text,
  created_by         uuid,
  created_at         timestamptz not null default now(),
  updated_by         uuid,
  updated_at         timestamptz not null default now(),
  archived_at        timestamptz
);
alter table public.founder_subscriptions enable row level security;
revoke all on public.founder_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on public.founder_subscriptions to service_role;

-- Expected (draft) rows live in the same expense ledger, clearly separated by status.
alter table public.founder_expenses drop constraint if exists founder_expenses_payment_status_check;
alter table public.founder_expenses add constraint founder_expenses_payment_status_check
  check (payment_status in ('paid','due','expected'));
alter table public.founder_expenses add column if not exists subscription_id uuid references public.founder_subscriptions(id);
alter table public.founder_expenses add column if not exists expected_for date;
create unique index if not exists founder_expenses_subscription_period_idx
  on public.founder_expenses (subscription_id, expected_for) where subscription_id is not null and deleted_at is null;

-- ROLLBACK:
--   drop index if exists public.founder_expenses_subscription_period_idx;
--   alter table public.founder_expenses drop column if exists expected_for, drop column if exists subscription_id;
--   (restore the payment_status check to ('paid','due') only after no 'expected' rows remain)
--   drop table if exists public.founder_subscriptions;
