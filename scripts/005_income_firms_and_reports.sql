-- Gelir firmalari ve sube ciro raporlari icin dinamik firma destegi.
-- Supabase SQL Editor'de bir kere calistirin.

CREATE TABLE IF NOT EXISTS gelir_firmalar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sube_id UUID NOT NULL REFERENCES subeler(id) ON DELETE CASCADE,
  ad TEXT NOT NULL,
  komisyon_orani NUMERIC(7,2),
  color TEXT NOT NULL DEFAULT 'bg-yellow-500',
  sira INTEGER NOT NULL DEFAULT 0,
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE gelir_firmalar ADD COLUMN IF NOT EXISTS komisyon_orani NUMERIC(7,2);
ALTER TABLE gelir_firmalar ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT 'bg-yellow-500';
ALTER TABLE gelir_firmalar ADD COLUMN IF NOT EXISTS sira INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gelir_firmalar ADD COLUMN IF NOT EXISTS aktif BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_gelir_firmalar_sube ON gelir_firmalar(sube_id, sira);

ALTER TABLE gelir_firmalar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gelir_firmalar_select_sube" ON gelir_firmalar;
CREATE POLICY "gelir_firmalar_select_sube" ON gelir_firmalar
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND (
        user_profiles.is_admin = true
        OR user_profiles.sube_id = gelir_firmalar.sube_id
      )
    )
  );

DROP POLICY IF EXISTS "gelir_firmalar_admin_insert" ON gelir_firmalar;
CREATE POLICY "gelir_firmalar_admin_insert" ON gelir_firmalar
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "gelir_firmalar_admin_update" ON gelir_firmalar;
CREATE POLICY "gelir_firmalar_admin_update" ON gelir_firmalar
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "gelir_firmalar_admin_delete" ON gelir_firmalar;
CREATE POLICY "gelir_firmalar_admin_delete" ON gelir_firmalar
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );
