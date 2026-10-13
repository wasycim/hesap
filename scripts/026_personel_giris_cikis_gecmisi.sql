ALTER TABLE public.personeller ADD COLUMN IF NOT EXISTS giris_cikis_gecmisi JSONB DEFAULT '[]'::jsonb;
