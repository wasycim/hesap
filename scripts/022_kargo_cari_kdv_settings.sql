ALTER TABLE public.kargo_cari_firmalar
  ADD COLUMN IF NOT EXISTS kdv_dahil BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.kargo_cari_firmalar.kdv_dahil
  IS 'Kargo cari firma borçlarında %20 KDV otomatik ve kalıcı uygulansın mı?';

UPDATE public.kargo_cari_firmalar
SET kdv_dahil = false
WHERE kdv_dahil IS NULL;
