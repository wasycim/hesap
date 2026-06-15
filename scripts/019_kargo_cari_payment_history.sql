CREATE TABLE IF NOT EXISTS public.kargo_cari_odeme_hareketleri (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sube_id UUID REFERENCES public.subeler(id) ON DELETE CASCADE,
  firma_id UUID NOT NULL REFERENCES public.kargo_cari_firmalar(id) ON DELETE CASCADE,
  ay_yil TEXT NOT NULL,
  tarih DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Europe/Istanbul')::date),
  toplam_borc NUMERIC(15, 2) NOT NULL DEFAULT 0,
  odenen NUMERIC(15, 2) NOT NULL DEFAULT 0,
  kalan_borc NUMERIC(15, 2) NOT NULL DEFAULT 0,
  notlar TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kargo_cari_odeme_hareketleri
  ADD COLUMN IF NOT EXISTS notlar TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_kargo_cari_odeme_hareketleri_sube_ay
  ON public.kargo_cari_odeme_hareketleri(sube_id, ay_yil, tarih DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kargo_cari_odeme_hareketleri_firma
  ON public.kargo_cari_odeme_hareketleri(firma_id, tarih DESC);

WITH toplamlar AS (
  SELECT
    sube_id,
    firma_id,
    ay_yil,
    SUM(COALESCE(alinan_tutar, 0)) AS toplam_borc
  FROM public.kargo_cari_kayitlar
  GROUP BY sube_id, firma_id, ay_yil
)
INSERT INTO public.kargo_cari_odeme_hareketleri (
  user_id,
  sube_id,
  firma_id,
  ay_yil,
  tarih,
  toplam_borc,
  odenen,
  kalan_borc,
  notlar,
  created_at
)
SELECT
  odeme.user_id,
  odeme.sube_id,
  odeme.firma_id,
  odeme.ay_yil,
  COALESCE((odeme.updated_at AT TIME ZONE 'Europe/Istanbul')::date, (now() AT TIME ZONE 'Europe/Istanbul')::date),
  COALESCE(toplamlar.toplam_borc, 0),
  COALESCE(odeme.odenen, 0),
  COALESCE(toplamlar.toplam_borc, 0) - COALESCE(odeme.odenen, 0),
  COALESCE(odeme.notlar, ''),
  COALESCE(odeme.updated_at, now())
FROM public.kargo_cari_odemeler odeme
LEFT JOIN toplamlar
  ON toplamlar.sube_id IS NOT DISTINCT FROM odeme.sube_id
  AND toplamlar.firma_id = odeme.firma_id
  AND toplamlar.ay_yil = odeme.ay_yil
WHERE COALESCE(odeme.odenen, 0) <> 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.kargo_cari_odeme_hareketleri hareket
    WHERE hareket.sube_id IS NOT DISTINCT FROM odeme.sube_id
      AND hareket.firma_id = odeme.firma_id
      AND hareket.ay_yil = odeme.ay_yil
  );

ALTER TABLE public.kargo_cari_odeme_hareketleri ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kargo_cari_odeme_hareketleri_select_sube" ON public.kargo_cari_odeme_hareketleri;
CREATE POLICY "kargo_cari_odeme_hareketleri_select_sube" ON public.kargo_cari_odeme_hareketleri
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND (
          user_profiles.is_admin = true
          OR user_profiles.is_developer = true
          OR user_profiles.sube_id = kargo_cari_odeme_hareketleri.sube_id
        )
    )
  );

DROP POLICY IF EXISTS "kargo_cari_odeme_hareketleri_admin_write" ON public.kargo_cari_odeme_hareketleri;
CREATE POLICY "kargo_cari_odeme_hareketleri_admin_write" ON public.kargo_cari_odeme_hareketleri
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND (user_profiles.is_admin = true OR user_profiles.is_developer = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND (user_profiles.is_admin = true OR user_profiles.is_developer = true)
    )
  );
