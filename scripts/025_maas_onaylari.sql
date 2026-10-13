CREATE TABLE IF NOT EXISTS public.maas_onaylari (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sube_id UUID REFERENCES public.subeler(id) ON DELETE CASCADE,
  ay_yil VARCHAR(50) NOT NULL,
  personel_id VARCHAR(100) NOT NULL,
  bankaya_gonderilen NUMERIC NOT NULL DEFAULT 0,
  kalan_nakit NUMERIC NOT NULL DEFAULT 0,
  nakit_odeme_tarihi DATE,
  approved_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_maas_onay_sube_ay_personel UNIQUE (sube_id, ay_yil, personel_id)
);

CREATE INDEX IF NOT EXISTS idx_maas_onaylari_sube_ay ON public.maas_onaylari(sube_id, ay_yil);

ALTER TABLE public.maas_onaylari ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "maas_onaylari_select" ON public.maas_onaylari;
CREATE POLICY "maas_onaylari_select" ON public.maas_onaylari
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "maas_onaylari_write" ON public.maas_onaylari;
CREATE POLICY "maas_onaylari_write" ON public.maas_onaylari
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND (user_profiles.is_admin = true OR user_profiles.is_developer = true OR user_profiles.sube_id = maas_onaylari.sube_id)
    )
  );
