-- Web Komisyon Kayitlari Tablosu ve RLS Politikalari

CREATE TABLE IF NOT EXISTS public.web_komisyon_kayitlari (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sube_id UUID REFERENCES public.subeler(id) ON DELETE CASCADE,
  tarih DATE NOT NULL,
  ay_yil VARCHAR(50) NOT NULL,
  firma_degerleri JSONB NOT NULL DEFAULT '{}'::jsonb,
  toplam_komisyon NUMERIC NOT NULL DEFAULT 0,
  notlar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_web_komisyon_sube_ay_yil UNIQUE (sube_id, ay_yil)
);

CREATE INDEX IF NOT EXISTS idx_web_komisyon_sube_ay ON public.web_komisyon_kayitlari(sube_id, ay_yil);

ALTER TABLE public.web_komisyon_kayitlari ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "web_komisyon_select_sube" ON public.web_komisyon_kayitlari;
CREATE POLICY "web_komisyon_select_sube" ON public.web_komisyon_kayitlari
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND (user_profiles.is_admin = true OR user_profiles.is_developer = true OR user_profiles.sube_id = web_komisyon_kayitlari.sube_id)
    )
  );

DROP POLICY IF EXISTS "web_komisyon_write_sube" ON public.web_komisyon_kayitlari;
CREATE POLICY "web_komisyon_write_sube" ON public.web_komisyon_kayitlari
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND (user_profiles.is_admin = true OR user_profiles.is_developer = true)
    )
  );
