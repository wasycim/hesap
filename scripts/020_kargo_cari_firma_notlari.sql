CREATE TABLE IF NOT EXISTS public.kargo_cari_notlari (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sube_id UUID REFERENCES public.subeler(id) ON DELETE CASCADE,
  firma_id UUID NOT NULL REFERENCES public.kargo_cari_firmalar(id) ON DELETE CASCADE,
  tarih DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Europe/Istanbul')::date),
  not_metni TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kargo_cari_notlari_firma_tarih
  ON public.kargo_cari_notlari(firma_id, tarih DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kargo_cari_notlari_sube_tarih
  ON public.kargo_cari_notlari(sube_id, tarih DESC);

ALTER TABLE public.kargo_cari_notlari ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kargo_cari_notlari_select_sube" ON public.kargo_cari_notlari;
CREATE POLICY "kargo_cari_notlari_select_sube" ON public.kargo_cari_notlari
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND (
          user_profiles.is_admin = true
          OR user_profiles.is_developer = true
          OR user_profiles.sube_id = kargo_cari_notlari.sube_id
        )
    )
  );

DROP POLICY IF EXISTS "kargo_cari_notlari_admin_write" ON public.kargo_cari_notlari;
CREATE POLICY "kargo_cari_notlari_admin_write" ON public.kargo_cari_notlari
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
