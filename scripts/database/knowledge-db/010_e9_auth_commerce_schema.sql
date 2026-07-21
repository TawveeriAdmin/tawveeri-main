-- 010_e9_auth_commerce_schema.sql
-- E9: create the user/auth/commerce schema on System A (vyceqrzttspyycdpojtn),
-- RLS from the start. Adapted from the ratified app schema (scripts/database/
-- 01,04,07,09,11,12) and RECONCILED to System A:
--   * users.id references auth.users(id) (Supabase auth integration)
--   * stores.id is INTEGER on A (ADR-004) -> store_reviews.store_id, coupons.store_id are INTEGER
--   * products.id / product_stores.id are UUID on A (match)
--   * search_history.category is TEXT (avoid enum coupling)
--   * 'role' is a column on users (no separate user_roles table)
-- Additive & reversible (drop the objects below). Legacy stays closed.
-- Owner-applied over the direct connection.

-- ── Enums (guarded — CREATE TYPE has no IF NOT EXISTS) ──────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname='user_role') then
    create type user_role as enum ('admin','customer','store','guest'); end if;
  if not exists (select 1 from pg_type where typname='auth_provider') then
    create type auth_provider as enum ('email','phone','google','facebook','apple'); end if;
  if not exists (select 1 from pg_type where typname='transaction_status') then
    create type transaction_status as enum ('pending','completed','failed','refunded'); end if;
  if not exists (select 1 from pg_type where typname='notification_type') then
    create type notification_type as enum ('price_drop','back_in_stock','deal_alert','system'); end if;
  if not exists (select 1 from pg_type where typname='discount_type') then
    create type discount_type as enum ('percentage','fixed_amount','free_shipping'); end if;
end $$;

-- ── updated_at trigger helper ──────────────────────────────────────────────
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ── users (integrates with auth.users) ─────────────────────────────────────
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email varchar(255) unique,
  phone varchar(20) unique,
  full_name varchar(255),
  role user_role not null default 'customer',
  auth_provider auth_provider default 'email',
  auth_provider_id varchar(255),
  avatar_url text,
  email_verified boolean default false,
  phone_verified boolean default false,
  preferred_language varchar(2) default 'ar',
  is_active boolean default true,
  last_login_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_users_email on public.users(email);
create index if not exists idx_users_phone on public.users(phone);
create index if not exists idx_users_role on public.users(role);
create trigger trg_users_updated before update on public.users for each row execute function public.set_updated_at();

-- ── RLS helper functions (SECURITY DEFINER — bypass RLS to avoid recursion) ─
create or replace function public.is_admin() returns boolean language sql security definer stable set search_path=public as $$
  select exists(select 1 from public.users where id = auth.uid() and role = 'admin');
$$;
create or replace function public.current_user_role() returns user_role language sql security definer stable set search_path=public as $$
  select role from public.users where id = auth.uid();
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;
revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated, service_role;

-- ── commerce/user tables (FKs reconciled to A) ─────────────────────────────
create table if not exists public.user_wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  notes text, created_at timestamptz default now(),
  unique(user_id, product_id));
create index if not exists idx_wishlists_user on public.user_wishlists(user_id);

create table if not exists public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  target_price numeric(10,2) not null, is_active boolean default true,
  notified_at timestamptz, created_at timestamptz default now(),
  unique(user_id, product_id));
create index if not exists idx_price_alerts_user on public.price_alerts(user_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type notification_type not null,
  title_ar varchar(255) not null, title_en varchar(255) not null,
  message_ar text, message_en text,
  product_id uuid references public.products(id) on delete cascade,
  product_store_id uuid references public.product_stores(id) on delete cascade,
  data jsonb, is_read boolean default false, is_sent boolean default false,
  sent_at timestamptz, created_at timestamptz default now());
create index if not exists idx_notifications_user on public.notifications(user_id);
create index if not exists idx_notifications_unread on public.notifications(is_read) where is_read = false;

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name varchar(255) not null, search_query text, filters jsonb default '{}',
  created_at timestamptz default now(), updated_at timestamptz default now());
create index if not exists idx_saved_searches_user on public.saved_searches(user_id);
create trigger trg_saved_searches_updated before update on public.saved_searches for each row execute function public.set_updated_at();

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  notification_preferences jsonb, privacy_preferences jsonb, app_preferences jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id));
create trigger trg_user_prefs_updated before update on public.user_preferences for each row execute function public.set_updated_at();

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5), review_text text,
  is_verified_purchase boolean default false, helpful_count integer default 0,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique(product_id, user_id));
create index if not exists idx_product_reviews_product on public.product_reviews(product_id);
create trigger trg_product_reviews_updated before update on public.product_reviews for each row execute function public.set_updated_at();

create table if not exists public.store_reviews (
  id uuid primary key default gen_random_uuid(),
  store_id integer not null references public.stores(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5), review_text text,
  is_verified_purchase boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique(store_id, user_id));
create index if not exists idx_store_reviews_store on public.store_reviews(store_id);
create trigger trg_store_reviews_updated before update on public.store_reviews for each row execute function public.set_updated_at();

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  product_store_id uuid not null references public.product_stores(id),
  amount numeric(10,2) not null, commission_amount numeric(10,2), commission_rate numeric(5,2),
  status transaction_status default 'pending',
  click_id varchar(255) unique, clicked_at timestamptz, converted_at timestamptz,
  user_agent text, ip_address inet, referrer text,
  created_at timestamptz default now(), updated_at timestamptz default now());
create index if not exists idx_transactions_user on public.transactions(user_id);
create trigger trg_transactions_updated before update on public.transactions for each row execute function public.set_updated_at();

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  store_id integer not null references public.stores(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  code text not null, description_ar text, description_en text,
  discount_type discount_type not null default 'percentage',
  discount_value numeric(10,2), min_purchase numeric(10,2), max_discount numeric(10,2),
  starts_at timestamptz default now(), expires_at timestamptz,
  is_active boolean not null default true, usage_count integer not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists idx_coupons_store on public.coupons(store_id);
create index if not exists idx_coupons_active on public.coupons(is_active) where is_active = true;
create trigger trg_coupons_updated before update on public.coupons for each row execute function public.set_updated_at();

create table if not exists public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  search_query text not null, category text, filters jsonb, results_count integer,
  created_at timestamptz default now());
create index if not exists idx_search_history_user on public.search_history(user_id);

create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  action varchar(100) not null, entity_type varchar(50), entity_id uuid,
  details jsonb, ip_address inet, user_agent text, created_at timestamptz default now());
create index if not exists idx_admin_logs_action on public.admin_logs(action);

-- ── credential/session table — deny-all to anon (Constitution) ─────────────
create table if not exists public.login_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  device_fingerprint text not null, user_agent text, ip_address inet,
  is_known_device boolean default false,
  last_seen_at timestamptz default now(), created_at timestamptz default now());
create index if not exists idx_login_sessions_user on public.login_sessions(user_id);

-- ── ENABLE RLS on every new table ──────────────────────────────────────────
alter table public.users enable row level security;
alter table public.user_wishlists enable row level security;
alter table public.price_alerts enable row level security;
alter table public.notifications enable row level security;
alter table public.saved_searches enable row level security;
alter table public.user_preferences enable row level security;
alter table public.product_reviews enable row level security;
alter table public.store_reviews enable row level security;
alter table public.transactions enable row level security;
alter table public.coupons enable row level security;
alter table public.search_history enable row level security;
alter table public.admin_logs enable row level security;
alter table public.login_sessions enable row level security;

-- ── RLS policies ───────────────────────────────────────────────────────────
-- users: self + admin
create policy users_select_self on public.users for select using (id = auth.uid() or public.is_admin());
create policy users_insert_self on public.users for insert with check (id = auth.uid());
create policy users_update_self on public.users for update using (id = auth.uid() or public.is_admin());
create policy users_admin_delete on public.users for delete using (public.is_admin());

-- owned-by-user tables (self CRUD + admin all)
do $$ declare t text;
begin
  foreach t in array array['user_wishlists','price_alerts','notifications','saved_searches','user_preferences','transactions','search_history','login_sessions'] loop
    execute format('create policy %I on public.%I for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin())', t||'_own', t);
  end loop;
end $$;

-- reviews: public read, own write, admin all
create policy product_reviews_read on public.product_reviews for select using (true);
create policy product_reviews_own on public.product_reviews for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy store_reviews_read on public.store_reviews for select using (true);
create policy store_reviews_own on public.store_reviews for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

-- coupons: public read active, admin manage
create policy coupons_read on public.coupons for select using (is_active = true or public.is_admin());
create policy coupons_admin on public.coupons for all using (public.is_admin()) with check (public.is_admin());

-- admin_logs: admin only
create policy admin_logs_admin on public.admin_logs for all using (public.is_admin()) with check (public.is_admin());

-- credential/session: never accessible to anon
revoke all on public.login_sessions from anon;
