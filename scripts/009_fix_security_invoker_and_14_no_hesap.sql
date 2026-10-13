-- Supabase SQL Editor'de tek parca calistirin.
-- 1) 14 No Hesap tablosunu ve kolon ayari tipini ekler.
-- 2) Security Definer View uyarilarini giderir.

ALTER TABLE public.kolon_ayarlari
  DROP CONSTRAINT IF EXISTS kolon_ayarlari_table_type_check;

ALTER TABLE public.kolon_ayarlari
  ADD CONSTRAINT kolon_ayarlari_table_type_check
  CHECK (table_type IN ('gelir', 'gider', 'on_dort_no_hesap'));

CREATE TABLE IF NOT EXISTS public.on_dort_no_hesap_kayitlari (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sube_id UUID NOT NULL REFERENCES public.subeler(id) ON DELETE CASCADE,
  ay_yil TEXT NOT NULL,
  tarih DATE NOT NULL DEFAULT CURRENT_DATE,
  tutarlar JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.on_dort_no_hesap_kayitlari
  ADD COLUMN IF NOT EXISTS tarih DATE;

UPDATE public.on_dort_no_hesap_kayitlari
SET tarih = CURRENT_DATE
WHERE tarih IS NULL;

ALTER TABLE public.on_dort_no_hesap_kayitlari
  ALTER COLUMN tarih SET DEFAULT CURRENT_DATE,
  ALTER COLUMN tarih SET NOT NULL;

ALTER TABLE public.on_dort_no_hesap_kayitlari
  DROP CONSTRAINT IF EXISTS on_dort_no_hesap_kayitlari_sube_id_ay_yil_key;

ALTER TABLE public.on_dort_no_hesap_kayitlari
  DROP CONSTRAINT IF EXISTS on_dort_no_hesap_kayitlari_sube_id_ay_yil_tarih_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'on_dort_no_hesap_kayitlari_sube_ay_tarih_key'
  ) THEN
    ALTER TABLE public.on_dort_no_hesap_kayitlari
      ADD CONSTRAINT on_dort_no_hesap_kayitlari_sube_ay_tarih_key
      UNIQUE (sube_id, ay_yil, tarih);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_on_dort_no_hesap_sube_ay
  ON public.on_dort_no_hesap_kayitlari(sube_id, ay_yil, tarih);

ALTER TABLE public.on_dort_no_hesap_kayitlari ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "on_dort_no_hesap_select_admin" ON public.on_dort_no_hesap_kayitlari;
CREATE POLICY "on_dort_no_hesap_select_admin" ON public.on_dort_no_hesap_kayitlari
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "on_dort_no_hesap_write_admin" ON public.on_dort_no_hesap_kayitlari;
CREATE POLICY "on_dort_no_hesap_write_admin" ON public.on_dort_no_hesap_kayitlari
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.is_admin = true
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE OR REPLACE VIEW public.v_dashboard_monthly_totals
WITH (security_invoker = true) AS
SELECT
  COALESCE(g.sube_id, d.sube_id) AS sube_id,
  COALESCE(g.ay_yil, d.ay_yil) AS ay_yil,
  COALESCE(g.toplam_gelir, 0)::numeric AS toplam_gelir,
  COALESCE(d.toplam_gider, 0)::numeric AS toplam_gider,
  (COALESCE(g.toplam_gelir, 0) - COALESCE(d.toplam_gider, 0))::numeric AS kalan
FROM (
  SELECT sube_id, ay_yil, SUM(COALESCE(toplam, 0)) AS toplam_gelir
  FROM public.gelir_kayitlari
  GROUP BY sube_id, ay_yil
) g
FULL OUTER JOIN (
  SELECT sube_id, ay_yil, SUM(COALESCE(genel_toplam, 0)) AS toplam_gider
  FROM public.gider_kayitlari
  GROUP BY sube_id, ay_yil
) d ON d.sube_id = g.sube_id AND d.ay_yil = g.ay_yil;

CREATE OR REPLACE VIEW public.v_gider_daily_shift_totals
WITH (security_invoker = true) AS
SELECT
  sube_id,
  ay_yil,
  tarih,
  vardiya,
  SUM(COALESCE(genel_toplam, 0))::numeric AS toplam_gider
FROM public.gider_kayitlari
GROUP BY sube_id, ay_yil, tarih, vardiya;

GRANT SELECT ON public.v_dashboard_monthly_totals TO authenticated;
GRANT SELECT ON public.v_gider_daily_shift_totals TO authenticated;
