-- Performance indexes and summary helpers.
-- Run this once in Supabase SQL Editor before heavy production usage.

create index if not exists idx_gelir_kayitlari_sube_ay_tarih_vardiya
  on public.gelir_kayitlari (sube_id, ay_yil, tarih, vardiya);

create index if not exists idx_gelir_kayitlari_sube_tarih
  on public.gelir_kayitlari (sube_id, tarih);

create index if not exists idx_gider_kayitlari_sube_ay_tarih_vardiya
  on public.gider_kayitlari (sube_id, ay_yil, tarih, vardiya);

create index if not exists idx_gider_kayitlari_sube_tarih
  on public.gider_kayitlari (sube_id, tarih);

create index if not exists idx_corbalar_sube_ay_tarih
  on public.corbalar (sube_id, ay_yil, tarih);

create index if not exists idx_kargo_cari_kayitlar_firma_ay_tarih
  on public.kargo_cari_kayitlar (firma_id, ay_yil, tarih);

create index if not exists idx_security_events_created_at
  on public.security_events (created_at desc);

create index if not exists idx_security_events_user_created_at
  on public.security_events (user_id, created_at desc);

create index if not exists idx_security_events_ip_created_at
  on public.security_events (ip_address, created_at desc);

create index if not exists idx_user_profiles_sube_admin
  on public.user_profiles (sube_id, is_admin);

create index if not exists idx_personeller_sube_aktif_sira
  on public.personeller (sube_id, aktif, sira);

create index if not exists idx_ortaklar_sube_aktif_sira
  on public.ortaklar (sube_id, aktif, sira);

create index if not exists idx_gelir_firmalar_sube_aktif_sira
  on public.gelir_firmalar (sube_id, aktif, sira);

create or replace view public.v_dashboard_monthly_totals as
select
  coalesce(g.sube_id, d.sube_id) as sube_id,
  coalesce(g.ay_yil, d.ay_yil) as ay_yil,
  coalesce(g.toplam_gelir, 0)::numeric as toplam_gelir,
  coalesce(d.toplam_gider, 0)::numeric as toplam_gider,
  (coalesce(g.toplam_gelir, 0) - coalesce(d.toplam_gider, 0))::numeric as kalan
from (
  select sube_id, ay_yil, sum(coalesce(toplam, 0)) as toplam_gelir
  from public.gelir_kayitlari
  group by sube_id, ay_yil
) g
full outer join (
  select sube_id, ay_yil, sum(coalesce(genel_toplam, 0)) as toplam_gider
  from public.gider_kayitlari
  group by sube_id, ay_yil
) d on d.sube_id = g.sube_id and d.ay_yil = g.ay_yil;

create or replace view public.v_gider_daily_shift_totals as
select
  sube_id,
  ay_yil,
  tarih,
  vardiya,
  sum(coalesce(genel_toplam, 0))::numeric as toplam_gider
from public.gider_kayitlari
group by sube_id, ay_yil, tarih, vardiya;
