create table if not exists public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  platform text not null default 'web',
  label text,
  verified_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id)
);

create table if not exists public.device_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  platform text not null default 'web',
  label text,
  code_hash text not null,
  attempt_count integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  requested_ip text,
  created_at timestamptz not null default now()
);

create index if not exists idx_device_challenges_active
  on public.device_verification_challenges (user_id, device_id, created_at desc)
  where consumed_at is null;

insert into public.trusted_devices (user_id, device_id, platform, label, verified_at, last_seen_at)
select user_id, device_id, platform, 'Kayıtlı mobil cihaz', created_at, last_seen_at
from public.user_devices
where device_id is not null and enabled = true
on conflict (user_id, device_id) do nothing;

insert into public.trusted_devices (user_id, device_id, platform, label, verified_at, last_seen_at)
select user_id, device_id, platform, label, created_at, last_seen_at
from public.device_licenses
where user_id is not null and active = true and revoked_at is null
on conflict (user_id, device_id) do nothing;

alter table public.trusted_devices enable row level security;
alter table public.device_verification_challenges enable row level security;

drop policy if exists "trusted_devices_developer_all" on public.trusted_devices;
create policy "trusted_devices_developer_all" on public.trusted_devices
for all to authenticated using (public.is_dashboard_developer()) with check (public.is_dashboard_developer());

drop policy if exists "trusted_devices_own_select" on public.trusted_devices;
create policy "trusted_devices_own_select" on public.trusted_devices
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "device_challenges_developer_all" on public.device_verification_challenges;
create policy "device_challenges_developer_all" on public.device_verification_challenges
for all to authenticated using (public.is_dashboard_developer()) with check (public.is_dashboard_developer());

alter table public.backup_snapshots add column if not exists interval text not null default 'daily';
alter table public.backup_snapshots add column if not exists object_path text;
alter table public.backup_snapshots add column if not exists size_bytes bigint;
alter table public.backup_snapshots add column if not exists checksum_sha256 text;
alter table public.backup_snapshots add column if not exists recipients jsonb not null default '[]'::jsonb;
alter table public.backup_snapshots add column if not exists encrypted boolean not null default false;
alter table public.backup_snapshots add column if not exists status text not null default 'completed';
alter table public.backup_snapshots add column if not exists error_message text;
alter table public.backup_snapshots add column if not exists completed_at timestamptz;

insert into public.app_settings (key, value, updated_at)
select
  'backup_delivery',
  jsonb_build_object(
    'dailyEnabled', true,
    'weeklyEnabled', true,
    'monthlyEnabled', true,
    'recipients', case when seed.email is null then '[]'::jsonb else jsonb_build_array(seed.email) end,
    'attachLimitMb', 12,
    'dailyRetention', 30,
    'weeklyRetention', 12,
    'monthlyRetention', 24
  ),
  now()
from (
  select email
  from public.user_profiles
  where is_developer = true and email is not null and email <> ''
  order by email
  limit 1
) seed
on conflict (key) do nothing;
