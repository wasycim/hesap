-- Push bildirim teslim loglari, gelismis log indeksleri ve vardiya cakismazlik guvencesi.

alter table public.app_notifications
  add column if not exists push_status text not null default 'pending';

alter table public.app_notifications
  add column if not exists push_sent_at timestamptz;

alter table public.app_notifications
  add column if not exists push_error text;

alter table public.app_notifications
  add column if not exists source_key text;

alter table public.app_notifications
  drop constraint if exists app_notifications_push_status_check;

alter table public.app_notifications
  add constraint app_notifications_push_status_check
  check (push_status in ('pending', 'sent', 'partial', 'failed', 'skipped'));

create table if not exists public.push_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.app_notifications(id) on delete set null,
  user_id uuid references auth.users(id) on delete cascade,
  device_id uuid references public.user_devices(id) on delete set null,
  provider text not null default 'fcm',
  status text not null,
  title text,
  href text,
  token_hash text,
  response jsonb,
  error text,
  created_at timestamptz not null default now()
);

alter table public.push_delivery_logs
  drop constraint if exists push_delivery_logs_status_check;

alter table public.push_delivery_logs
  add constraint push_delivery_logs_status_check
  check (status in ('sent', 'failed', 'skipped'));

alter table public.push_delivery_logs enable row level security;

drop policy if exists "push_delivery_logs_admin_select" on public.push_delivery_logs;
create policy "push_delivery_logs_admin_select"
on public.push_delivery_logs
for select
to authenticated
using (public.is_dashboard_admin());

drop policy if exists "push_delivery_logs_admin_all" on public.push_delivery_logs;
create policy "push_delivery_logs_admin_all"
on public.push_delivery_logs
for all
to authenticated
using (public.is_dashboard_admin())
with check (public.is_dashboard_admin());

create index if not exists idx_push_delivery_logs_created
  on public.push_delivery_logs (created_at desc);

create index if not exists idx_push_delivery_logs_user_created
  on public.push_delivery_logs (user_id, created_at desc);

create index if not exists idx_security_events_type_created
  on public.security_events (event_type, created_at desc);

create index if not exists idx_security_events_email_created
  on public.security_events (user_email, created_at desc);

create unique index if not exists idx_app_notifications_source_key
  on public.app_notifications (source_key)
  where source_key is not null and source_key <> '';

create unique index if not exists idx_vardiya_planlari_one_assignment_per_day
  on public.vardiya_planlari (sube_id, personel_id, tarih);
