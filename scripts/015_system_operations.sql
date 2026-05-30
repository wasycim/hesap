-- Sistem operasyonlari: terminal cihaz eslestirme, bildirimler, tema tercihi,
-- yonetici ozet mail abonelikleri ve mobil cihaz tokenlari.

create or replace function public.is_dashboard_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_profiles
    where user_profiles.user_id = auth.uid()
      and user_profiles.is_admin = true
      and coalesce(user_profiles.dashboard_access, true) = true
  );
$$;

alter table public.user_profiles
  add column if not exists theme_preference text not null default 'system';

alter table public.user_profiles
  drop constraint if exists user_profiles_theme_preference_check;

alter table public.user_profiles
  add constraint user_profiles_theme_preference_check
  check (theme_preference in ('light', 'dark', 'system'));

create table if not exists public.terminal_devices (
  id uuid primary key default gen_random_uuid(),
  device_key text not null unique,
  label text not null default 'Terminal',
  approved boolean not null default false,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  last_seen_at timestamptz,
  last_ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text,
  platform text not null default 'web',
  push_token text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id, platform)
);

create unique index if not exists idx_user_devices_push_token
  on public.user_devices (push_token)
  where push_token is not null and push_token <> '';

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  href text not null default '/dashboard',
  level text not null default 'info',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.app_notifications
  drop constraint if exists app_notifications_level_check;

alter table public.app_notifications
  add constraint app_notifications_level_check
  check (level in ('info', 'success', 'warning', 'error'));

create table if not exists public.admin_digest_subscribers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  daily_enabled boolean not null default false,
  weekly_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.terminal_devices enable row level security;
alter table public.user_devices enable row level security;
alter table public.app_notifications enable row level security;
alter table public.admin_digest_subscribers enable row level security;

drop policy if exists "terminal_devices_admin_select" on public.terminal_devices;
create policy "terminal_devices_admin_select"
on public.terminal_devices
for select
to authenticated
using (public.is_dashboard_admin());

drop policy if exists "terminal_devices_admin_all" on public.terminal_devices;
create policy "terminal_devices_admin_all"
on public.terminal_devices
for all
to authenticated
using (public.is_dashboard_admin())
with check (public.is_dashboard_admin());

drop policy if exists "user_devices_own_select" on public.user_devices;
create policy "user_devices_own_select"
on public.user_devices
for select
to authenticated
using (auth.uid() = user_id or public.is_dashboard_admin());

drop policy if exists "user_devices_own_insert" on public.user_devices;
create policy "user_devices_own_insert"
on public.user_devices
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_devices_own_update" on public.user_devices;
create policy "user_devices_own_update"
on public.user_devices
for update
to authenticated
using (auth.uid() = user_id or public.is_dashboard_admin())
with check (auth.uid() = user_id or public.is_dashboard_admin());

drop policy if exists "app_notifications_own_select" on public.app_notifications;
create policy "app_notifications_own_select"
on public.app_notifications
for select
to authenticated
using (user_id = auth.uid() or user_id is null or public.is_dashboard_admin());

drop policy if exists "app_notifications_admin_all" on public.app_notifications;
create policy "app_notifications_admin_all"
on public.app_notifications
for all
to authenticated
using (public.is_dashboard_admin())
with check (public.is_dashboard_admin());

drop policy if exists "admin_digest_subscribers_admin_all" on public.admin_digest_subscribers;
create policy "admin_digest_subscribers_admin_all"
on public.admin_digest_subscribers
for all
to authenticated
using (public.is_dashboard_admin())
with check (public.is_dashboard_admin());

create index if not exists idx_terminal_devices_approved
  on public.terminal_devices (approved, last_seen_at desc);

create index if not exists idx_app_notifications_user_created
  on public.app_notifications (user_id, created_at desc);

create index if not exists idx_user_profiles_theme
  on public.user_profiles (theme_preference);
