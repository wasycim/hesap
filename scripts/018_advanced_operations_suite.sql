-- Gelismis operasyon paketi: developer yetki seviyesi, cihaz lisanslama,
-- bildirim kural motoru, mesai onayi, PDF sablon/arsiv, duyuru, cay,
-- resmi gunler, bakim modu, hata raporlama ve offline cakismazlik.

alter table public.user_profiles
  add column if not exists is_developer boolean not null default false;

alter table public.user_profiles
  add column if not exists biometric_enabled boolean not null default false;

alter table public.user_profiles
  add column if not exists license_exempt boolean not null default false;

alter table public.terminal_devices
  add column if not exists allowed_ips text[] not null default '{}'::text[];

alter table public.terminal_devices
  add column if not exists camera_required boolean not null default true;

create or replace function public.is_dashboard_developer()
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
      and user_profiles.is_developer = true
      and coalesce(user_profiles.dashboard_access, true) = true
  );
$$;

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
      and (user_profiles.is_admin = true or user_profiles.is_developer = true)
      and coalesce(user_profiles.dashboard_access, true) = true
  );
$$;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.device_licenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  device_id text not null,
  platform text not null default 'web',
  label text,
  active boolean not null default true,
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  last_ip text,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id, platform)
);

create table if not exists public.notification_rule_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sube_id uuid references public.subeler(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  vardiya_code text,
  event_type text not null default 'attendance',
  starts_at time,
  ends_at time,
  level text not null default 'warning',
  message_template text not null default '',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_rule_definitions
  drop constraint if exists notification_rule_definitions_level_check;

alter table public.notification_rule_definitions
  add constraint notification_rule_definitions_level_check
  check (level in ('info', 'success', 'warning', 'error'));

create table if not exists public.dashboard_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null,
  role_key text,
  user_id uuid references auth.users(id) on delete cascade,
  permission_key text not null,
  allowed boolean not null default true,
  note text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dashboard_permission_overrides
  drop constraint if exists dashboard_permission_scope_check;

alter table public.dashboard_permission_overrides
  add constraint dashboard_permission_scope_check
  check (
    (scope_type = 'role' and role_key in ('developer', 'admin', 'user') and user_id is null)
    or
    (scope_type = 'user' and user_id is not null)
  );

create table if not exists public.overtime_approvals (
  id uuid primary key default gen_random_uuid(),
  attendance_log_id integer references public.attendance_logs(id) on delete cascade,
  personel_id uuid references public.personeller(id) on delete set null,
  source_key text,
  user_profile_id uuid references auth.users(id) on delete set null,
  personel_name text,
  branch_name text,
  work_date date,
  raw_minutes integer not null default 0,
  payable_minutes integer not null default 0,
  manual_minutes integer not null default 0,
  hourly_rate numeric(12,2),
  amount numeric(14,2),
  status text not null default 'pending',
  requested_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.overtime_approvals
  drop constraint if exists overtime_approvals_status_check;

alter table public.overtime_approvals
  add constraint overtime_approvals_status_check
  check (status in ('pending', 'approved', 'rejected'));

alter table public.overtime_approvals
  add column if not exists personel_id uuid references public.personeller(id) on delete set null;

alter table public.overtime_approvals
  add column if not exists source_key text;

alter table public.overtime_approvals
  add column if not exists manual_minutes integer not null default 0;

create table if not exists public.pdf_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  report_type text not null,
  orientation text not null default 'landscape',
  template_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pdf_templates
  drop constraint if exists pdf_templates_orientation_check;

alter table public.pdf_templates
  add constraint pdf_templates_orientation_check
  check (orientation in ('portrait', 'landscape'));

create table if not exists public.pdf_archives (
  id uuid primary key default gen_random_uuid(),
  report_type text not null,
  title text not null,
  period_label text,
  file_name text,
  html_snapshot text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  level text not null default 'info',
  target_type text not null default 'all',
  sube_id uuid references public.subeler(id) on delete set null,
  user_id uuid references auth.users(id) on delete cascade,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tea_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Cay hazir mi?',
  message text not null default 'Cay hazir mi?',
  status text not null default 'open',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.tea_request_recipients (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.tea_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  response text not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (request_id, user_id)
);

alter table public.tea_request_recipients
  drop constraint if exists tea_request_recipients_response_check;

alter table public.tea_request_recipients
  add constraint tea_request_recipients_response_check
  check (response in ('pending', 'ready', 'not_ready'));

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  name text not null,
  type text not null default 'official',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.system_health_alerts (
  id uuid primary key default gen_random_uuid(),
  component text not null,
  status text not null,
  message text,
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.error_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  path text,
  message text not null,
  stack text,
  component_stack text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.offline_conflicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  mutation_path text not null,
  client_payload jsonb not null default '{}'::jsonb,
  server_payload jsonb,
  status text not null default 'open',
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.app_store_metadata (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  title text not null,
  subtitle text,
  description text,
  keywords text,
  screenshot_url text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.backup_snapshots (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  tables jsonb not null default '{}'::jsonb,
  table_counts jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
alter table public.device_licenses enable row level security;
alter table public.notification_rule_definitions enable row level security;
alter table public.dashboard_permission_overrides enable row level security;
alter table public.overtime_approvals enable row level security;
alter table public.pdf_templates enable row level security;
alter table public.pdf_archives enable row level security;
alter table public.app_announcements enable row level security;
alter table public.tea_requests enable row level security;
alter table public.tea_request_recipients enable row level security;
alter table public.holidays enable row level security;
alter table public.system_health_alerts enable row level security;
alter table public.error_reports enable row level security;
alter table public.offline_conflicts enable row level security;
alter table public.app_store_metadata enable row level security;
alter table public.backup_snapshots enable row level security;

drop policy if exists "app_settings_developer_all" on public.app_settings;
create policy "app_settings_developer_all" on public.app_settings
for all to authenticated using (public.is_dashboard_developer()) with check (public.is_dashboard_developer());

drop policy if exists "app_settings_admin_select" on public.app_settings;
create policy "app_settings_admin_select" on public.app_settings
for select to authenticated using (public.is_dashboard_admin());

drop policy if exists "app_settings_public_maintenance_select" on public.app_settings;
create policy "app_settings_public_maintenance_select" on public.app_settings
for select to anon, authenticated using (key = 'maintenance_mode');

drop policy if exists "device_licenses_own_select" on public.device_licenses;
create policy "device_licenses_own_select" on public.device_licenses
for select to authenticated using (auth.uid() = user_id or public.is_dashboard_developer());

drop policy if exists "device_licenses_developer_all" on public.device_licenses;
create policy "device_licenses_developer_all" on public.device_licenses
for all to authenticated using (public.is_dashboard_developer()) with check (public.is_dashboard_developer());

drop policy if exists "notification_rules_admin_all" on public.notification_rule_definitions;
create policy "notification_rules_admin_all" on public.notification_rule_definitions
for all to authenticated using (public.is_dashboard_admin()) with check (public.is_dashboard_admin());

drop policy if exists "dashboard_permissions_developer_all" on public.dashboard_permission_overrides;
create policy "dashboard_permissions_developer_all" on public.dashboard_permission_overrides
for all to authenticated using (public.is_dashboard_developer()) with check (public.is_dashboard_developer());

drop policy if exists "dashboard_permissions_own_select" on public.dashboard_permission_overrides;
create policy "dashboard_permissions_own_select" on public.dashboard_permission_overrides
for select to authenticated using (
  public.is_dashboard_developer()
  or user_id = auth.uid()
  or scope_type = 'role'
);

drop policy if exists "overtime_approvals_admin_all" on public.overtime_approvals;
create policy "overtime_approvals_admin_all" on public.overtime_approvals
for all to authenticated using (public.is_dashboard_admin()) with check (public.is_dashboard_admin());

drop policy if exists "pdf_templates_admin_all" on public.pdf_templates;
create policy "pdf_templates_admin_all" on public.pdf_templates
for all to authenticated using (public.is_dashboard_admin()) with check (public.is_dashboard_admin());

drop policy if exists "pdf_archives_admin_all" on public.pdf_archives;
create policy "pdf_archives_admin_all" on public.pdf_archives
for all to authenticated using (public.is_dashboard_admin()) with check (public.is_dashboard_admin());

drop policy if exists "app_announcements_visible" on public.app_announcements;
create policy "app_announcements_visible" on public.app_announcements
for select to authenticated
using (
  active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
  and (
    target_type = 'all'
    or user_id = auth.uid()
    or public.is_dashboard_admin()
    or exists (
      select 1
      from public.user_profiles
      where user_profiles.user_id = auth.uid()
        and user_profiles.sube_id = app_announcements.sube_id
    )
  )
);

drop policy if exists "app_announcements_admin_all" on public.app_announcements;
create policy "app_announcements_admin_all" on public.app_announcements
for all to authenticated using (public.is_dashboard_admin()) with check (public.is_dashboard_admin());

drop policy if exists "tea_requests_admin_all" on public.tea_requests;
create policy "tea_requests_admin_all" on public.tea_requests
for all to authenticated using (public.is_dashboard_admin()) with check (public.is_dashboard_admin());

drop policy if exists "tea_request_recipients_own_select" on public.tea_request_recipients;
create policy "tea_request_recipients_own_select" on public.tea_request_recipients
for select to authenticated using (user_id = auth.uid() or public.is_dashboard_admin());

drop policy if exists "tea_request_recipients_own_update" on public.tea_request_recipients;
create policy "tea_request_recipients_own_update" on public.tea_request_recipients
for update to authenticated using (user_id = auth.uid() or public.is_dashboard_admin()) with check (user_id = auth.uid() or public.is_dashboard_admin());

drop policy if exists "tea_request_recipients_admin_insert" on public.tea_request_recipients;
create policy "tea_request_recipients_admin_insert" on public.tea_request_recipients
for insert to authenticated with check (public.is_dashboard_admin());

drop policy if exists "holidays_admin_all" on public.holidays;
create policy "holidays_admin_all" on public.holidays
for all to authenticated using (public.is_dashboard_admin()) with check (public.is_dashboard_admin());

drop policy if exists "system_health_alerts_developer_all" on public.system_health_alerts;
create policy "system_health_alerts_developer_all" on public.system_health_alerts
for all to authenticated using (public.is_dashboard_developer()) with check (public.is_dashboard_developer());

drop policy if exists "error_reports_developer_select" on public.error_reports;
create policy "error_reports_developer_select" on public.error_reports
for select to authenticated using (public.is_dashboard_developer());

drop policy if exists "error_reports_authenticated_insert" on public.error_reports;
create policy "error_reports_authenticated_insert" on public.error_reports
for insert to authenticated with check (auth.uid() = user_id or user_id is null);

drop policy if exists "offline_conflicts_admin_all" on public.offline_conflicts;
create policy "offline_conflicts_admin_all" on public.offline_conflicts
for all to authenticated using (public.is_dashboard_admin()) with check (public.is_dashboard_admin());

drop policy if exists "app_store_metadata_developer_all" on public.app_store_metadata;
create policy "app_store_metadata_developer_all" on public.app_store_metadata
for all to authenticated using (public.is_dashboard_developer()) with check (public.is_dashboard_developer());

drop policy if exists "backup_snapshots_developer_all" on public.backup_snapshots;
create policy "backup_snapshots_developer_all" on public.backup_snapshots
for all to authenticated using (public.is_dashboard_developer()) with check (public.is_dashboard_developer());

create index if not exists idx_user_profiles_developer on public.user_profiles (is_developer);
create index if not exists idx_device_licenses_user_platform on public.device_licenses (user_id, platform, active);
create index if not exists idx_notification_rule_definitions_scope on public.notification_rule_definitions (sube_id, user_id, event_type, active);
create unique index if not exists idx_dashboard_permission_overrides_unique_role
  on public.dashboard_permission_overrides (role_key, permission_key)
  where scope_type = 'role' and active = true;
create unique index if not exists idx_dashboard_permission_overrides_unique_user
  on public.dashboard_permission_overrides (user_id, permission_key)
  where scope_type = 'user' and active = true;
create index if not exists idx_overtime_approvals_status_date on public.overtime_approvals (status, work_date desc);
delete from public.overtime_approvals a
using public.overtime_approvals b
where a.attendance_log_id is not null
  and a.attendance_log_id = b.attendance_log_id
  and a.ctid < b.ctid;
drop index if exists public.idx_overtime_approvals_attendance_log;
create unique index idx_overtime_approvals_attendance_log
  on public.overtime_approvals (attendance_log_id);
create unique index if not exists idx_overtime_approvals_source_key
  on public.overtime_approvals (source_key)
  where source_key is not null and source_key <> '';
create index if not exists idx_overtime_approvals_personel_date
  on public.overtime_approvals (personel_id, work_date desc);
create index if not exists idx_pdf_archives_type_date on public.pdf_archives (report_type, created_at desc);
create index if not exists idx_app_announcements_active_date on public.app_announcements (active, starts_at, ends_at);
create index if not exists idx_tea_request_recipients_user_status on public.tea_request_recipients (user_id, response, created_at desc);
create index if not exists idx_holidays_date on public.holidays (holiday_date);
create index if not exists idx_error_reports_created on public.error_reports (created_at desc);
create index if not exists idx_backup_snapshots_created on public.backup_snapshots (created_at desc);

insert into public.app_settings (key, value)
values
  ('maintenance_mode', '{"enabled":false,"message":"Sistem bakim modunda.","allowDeveloper":true}'::jsonb),
  ('security_policy', '{"qrTtlSeconds":20,"tooFastScanSeconds":20,"strictTerminalIp":true,"strictCamera":true}'::jsonb),
  ('health_alerts', '{"smtp":true,"fcm":true,"vercel":true,"supabase":true}'::jsonb)
on conflict (key) do nothing;

insert into public.holidays (holiday_date, name, type)
values
  ('2026-01-01', 'Yilbasi', 'official'),
  ('2026-04-23', 'Ulusal Egemenlik ve Cocuk Bayrami', 'official'),
  ('2026-05-01', 'Emek ve Dayanisma Gunu', 'official'),
  ('2026-05-19', 'Ataturk''u Anma, Genclik ve Spor Bayrami', 'official'),
  ('2026-07-15', 'Demokrasi ve Milli Birlik Gunu', 'official'),
  ('2026-08-30', 'Zafer Bayrami', 'official'),
  ('2026-10-29', 'Cumhuriyet Bayrami', 'official')
on conflict (holiday_date) do nothing;

insert into public.app_store_metadata (platform, title, subtitle, description, keywords, screenshot_url)
values
  ('ios', 'Hesap', 'QR mesai ve rapor yonetimi', 'Hesap, sube bazli mesai, vardiya, bildirim ve PDF rapor sureclerini yonetmek icin gelistirilen is uygulamasidir.', 'mesai,vardiya,rapor,pdf,sube', '/store-screenshots'),
  ('android', 'Hesap', 'QR mesai ve rapor yonetimi', 'Hesap, sube bazli mesai, vardiya, bildirim ve PDF rapor sureclerini yonetmek icin gelistirilen is uygulamasidir.', 'mesai,vardiya,rapor,pdf,sube', '/store-screenshots')
on conflict do nothing;

with default_user_permissions(permission_key) as (
  values
    ('dashboard'),
    ('gelir'),
    ('gider'),
    ('corbalar'),
    ('kargo_cari'),
    ('vardiya'),
    ('mesai'),
    ('mesai_takip'),
    ('cay'),
    ('bildirimler'),
    ('hesap')
)
insert into public.dashboard_permission_overrides (
  scope_type,
  role_key,
  user_id,
  permission_key,
  allowed,
  active,
  note
)
select
  'role',
  'user',
  null,
  default_user_permissions.permission_key,
  true,
  true,
  'Normal kullanici operasyon menuleri varsayilan acik.'
from default_user_permissions
on conflict (role_key, permission_key)
where scope_type = 'role' and active = true
do update set
  allowed = true,
  updated_at = now(),
  note = excluded.note;

update public.user_profiles
set is_developer = true,
    is_admin = true,
    dashboard_access = true,
    license_exempt = true,
    updated_at = now()
where tc_kimlik = '25511195212'
   or lower(coalesce(email, '')) = 'ykacaran480@gmail.com';

with faruk_profile as (
  select user_id
  from public.user_profiles
  where tc_kimlik = '24802737766'
     or lower(coalesce(display_name, '')) = lower('Faruk KAHRIMAN')
     or lower(coalesce(display_name, '')) = lower('Faruk KAHRİMAN')
  limit 1
),
faruk_permissions(permission_key) as (
  values
    ('dashboard'),
    ('gelir'),
    ('gider'),
    ('corbalar'),
    ('vardiya'),
    ('mesai'),
    ('mesai_takip'),
    ('kargo_cari'),
    ('cay'),
    ('bildirimler'),
    ('hesap')
)
insert into public.dashboard_permission_overrides (
  scope_type,
  user_id,
  role_key,
  permission_key,
  allowed,
  active,
  note
)
select
  'user',
  faruk_profile.user_id,
  null,
  faruk_permissions.permission_key,
  true,
  true,
  'Faruk Kahriman eski menu yetkileri korunur.'
from faruk_profile
cross join faruk_permissions
on conflict (user_id, permission_key)
where scope_type = 'user' and active = true
do update set
  allowed = true,
  updated_at = now(),
  note = excluded.note;
