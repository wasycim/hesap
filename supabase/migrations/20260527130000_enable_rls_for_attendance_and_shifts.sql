alter table if exists public.shifts enable row level security;
alter table if exists public.users enable row level security;
alter table if exists public.attendance_logs enable row level security;
alter table if exists public.vardiya_tanimlari enable row level security;
alter table if exists public.vardiya_sabit_ayarlari enable row level security;

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
  );
$$;

drop policy if exists "dashboard_admin_select_shifts" on public.shifts;
create policy "dashboard_admin_select_shifts"
on public.shifts
for select
to authenticated
using (public.is_dashboard_admin());

drop policy if exists "dashboard_admin_select_users" on public.users;
create policy "dashboard_admin_select_users"
on public.users
for select
to authenticated
using (public.is_dashboard_admin());

drop policy if exists "dashboard_admin_select_attendance_logs" on public.attendance_logs;
create policy "dashboard_admin_select_attendance_logs"
on public.attendance_logs
for select
to authenticated
using (public.is_dashboard_admin());

drop policy if exists "dashboard_admin_select_vardiya_tanimlari" on public.vardiya_tanimlari;
create policy "dashboard_admin_select_vardiya_tanimlari"
on public.vardiya_tanimlari
for select
to authenticated
using (public.is_dashboard_admin());

drop policy if exists "dashboard_admin_insert_vardiya_tanimlari" on public.vardiya_tanimlari;
create policy "dashboard_admin_insert_vardiya_tanimlari"
on public.vardiya_tanimlari
for insert
to authenticated
with check (public.is_dashboard_admin());

drop policy if exists "dashboard_admin_update_vardiya_tanimlari" on public.vardiya_tanimlari;
create policy "dashboard_admin_update_vardiya_tanimlari"
on public.vardiya_tanimlari
for update
to authenticated
using (public.is_dashboard_admin())
with check (public.is_dashboard_admin());

drop policy if exists "dashboard_admin_delete_vardiya_tanimlari" on public.vardiya_tanimlari;
create policy "dashboard_admin_delete_vardiya_tanimlari"
on public.vardiya_tanimlari
for delete
to authenticated
using (public.is_dashboard_admin());

drop policy if exists "dashboard_admin_select_vardiya_sabit_ayarlari" on public.vardiya_sabit_ayarlari;
create policy "dashboard_admin_select_vardiya_sabit_ayarlari"
on public.vardiya_sabit_ayarlari
for select
to authenticated
using (public.is_dashboard_admin());

drop policy if exists "dashboard_admin_insert_vardiya_sabit_ayarlari" on public.vardiya_sabit_ayarlari;
create policy "dashboard_admin_insert_vardiya_sabit_ayarlari"
on public.vardiya_sabit_ayarlari
for insert
to authenticated
with check (public.is_dashboard_admin());

drop policy if exists "dashboard_admin_update_vardiya_sabit_ayarlari" on public.vardiya_sabit_ayarlari;
create policy "dashboard_admin_update_vardiya_sabit_ayarlari"
on public.vardiya_sabit_ayarlari
for update
to authenticated
using (public.is_dashboard_admin())
with check (public.is_dashboard_admin());

drop policy if exists "dashboard_admin_delete_vardiya_sabit_ayarlari" on public.vardiya_sabit_ayarlari;
create policy "dashboard_admin_delete_vardiya_sabit_ayarlari"
on public.vardiya_sabit_ayarlari
for delete
to authenticated
using (public.is_dashboard_admin());

