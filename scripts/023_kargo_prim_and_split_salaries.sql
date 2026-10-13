CREATE TABLE IF NOT EXISTS public.kargo_prim_kayitlari (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sube_id UUID REFERENCES public.subeler(id) ON DELETE CASCADE,
  tarih DATE NOT NULL,
  ay_yil VARCHAR(50) NOT NULL,
  toplam_ciro NUMERIC NOT NULL DEFAULT 0,
  personel_sayisi INT NOT NULL DEFAULT 0,
  isci_hakedis NUMERIC NOT NULL DEFAULT 0,
  personel_hakedis NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_kargo_prim_sube_ay_yil UNIQUE (sube_id, ay_yil)
);

CREATE INDEX IF NOT EXISTS idx_kargo_prim_sube_ay ON public.kargo_prim_kayitlari(sube_id, ay_yil);

ALTER TABLE public.kargo_prim_kayitlari ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kargo_prim_select_sube" ON public.kargo_prim_kayitlari;
CREATE POLICY "kargo_prim_select_sube" ON public.kargo_prim_kayitlari
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND (user_profiles.is_admin = true OR user_profiles.sube_id = kargo_prim_kayitlari.sube_id)
    )
  );

DROP POLICY IF EXISTS "kargo_prim_write_sube" ON public.kargo_prim_kayitlari;
CREATE POLICY "kargo_prim_write_sube" ON public.kargo_prim_kayitlari
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND (user_profiles.is_admin = true OR user_profiles.sube_id = kargo_prim_kayitlari.sube_id)
    )
  );

ALTER TABLE public.personeller ADD COLUMN IF NOT EXISTS banka_maas NUMERIC DEFAULT 0;
ALTER TABLE public.personeller ADD COLUMN IF NOT EXISTS nakit_maas NUMERIC DEFAULT 0;
