-- Notification rules, native device diagnostics and backup coverage helpers.

create table if not exists public.attendance_alert_rules (
  id uuid primary key default gen_random_uuid(),
  sube_id uuid not null unique references public.subeler(id) on delete cascade,
  active boolean not null default true,
  late_enabled boolean not null default true,
  late_threshold_minutes integer not null default 1,
  overtime_enabled boolean not null default true,
  overtime_threshold_minutes integer not null default 45,
  send_to_personnel boolean not null default true,
  send_to_admins boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.attendance_alert_rules
  drop constraint if exists attendance_alert_rules_threshold_check;

alter table public.attendance_alert_rules
  add constraint attendance_alert_rules_threshold_check
  check (
    late_threshold_minutes >= 0
    and overtime_threshold_minutes >= 0
  );

alter table public.attendance_alert_rules enable row level security;

drop policy if exists "attendance_alert_rules_admin_select" on public.attendance_alert_rules;
create policy "attendance_alert_rules_admin_select"
on public.attendance_alert_rules
for select
to authenticated
using (public.is_dashboard_admin());

drop policy if exists "attendance_alert_rules_admin_all" on public.attendance_alert_rules;
create policy "attendance_alert_rules_admin_all"
on public.attendance_alert_rules
for all
to authenticated
using (public.is_dashboard_admin())
with check (public.is_dashboard_admin());

create index if not exists idx_attendance_alert_rules_sube
  on public.attendance_alert_rules (sube_id, active);

create index if not exists idx_app_notifications_read_created
  on public.app_notifications (user_id, read_at, created_at desc);

create index if not exists idx_user_devices_platform_seen
  on public.user_devices (platform, last_seen_at desc);
