-- 60-founder-expense-date-precision.sql — historical expenses whose date is not on the supplied
-- evidence must never get a guessed date. `date_precision='needs_review'` allows the service-period
-- and paid dates to be NULL; such rows still count in all-time totals (F04) and are listed as
-- «تاريخ تاريخي يحتاج مراجعة», but stay OUT of any dated window until the founder fixes the date.
-- Additive, idempotent; rollback at the end.
alter table public.founder_expenses add column if not exists date_precision text not null default 'exact'
  check (date_precision in ('exact','month','year','needs_review'));
alter table public.founder_expenses alter column service_period_start drop not null;
alter table public.founder_expenses alter column service_period_end drop not null;
alter table public.founder_expenses drop constraint if exists founder_expenses_dates_required;
alter table public.founder_expenses add constraint founder_expenses_dates_required
  check (date_precision = 'needs_review' or (service_period_start is not null and service_period_end is not null));

-- ROLLBACK:
--   alter table public.founder_expenses drop constraint if exists founder_expenses_dates_required;
--   alter table public.founder_expenses drop column if exists date_precision;
--   (NOT NULL can be restored only after every needs_review row has dates.)
