-- Sütun Ayarları
-- Supabase SQL Editor'de bir kere çalıştırın.

CREATE TABLE IF NOT EXISTS kolon_ayarlari (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sube_id UUID REFERENCES subeler(id) ON DELETE CASCADE,
  table_type TEXT NOT NULL CHECK (table_type IN ('gelir', 'gider')),
  column_key TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'bg-blue-600',
  sort_order INTEGER NOT NULL DEFAULT 0,
  aktif BOOLEAN NOT NULL DEFAULT true,
  builtin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sube_id, table_type, column_key)
);

ALTER TABLE kolon_ayarlari ADD COLUMN IF NOT EXISTS sube_id UUID REFERENCES subeler(id) ON DELETE CASCADE;
ALTER TABLE kolon_ayarlari DROP CONSTRAINT IF EXISTS kolon_ayarlari_table_type_column_key_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'kolon_ayarlari_sube_table_column_key'
  ) THEN
    ALTER TABLE kolon_ayarlari
      ADD CONSTRAINT kolon_ayarlari_sube_table_column_key
      UNIQUE (sube_id, table_type, column_key);
  END IF;
END $$;

ALTER TABLE gelir_kayitlari ADD COLUMN IF NOT EXISTS custom_values JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE gider_kayitlari ADD COLUMN IF NOT EXISTS custom_values JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE kolon_ayarlari ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kolon_ayarlari_select_auth" ON kolon_ayarlari;
CREATE POLICY "kolon_ayarlari_select_auth" ON kolon_ayarlari
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "kolon_ayarlari_admin_insert" ON kolon_ayarlari;
CREATE POLICY "kolon_ayarlari_admin_insert" ON kolon_ayarlari
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "kolon_ayarlari_admin_update" ON kolon_ayarlari;
CREATE POLICY "kolon_ayarlari_admin_update" ON kolon_ayarlari
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "kolon_ayarlari_admin_delete" ON kolon_ayarlari;
CREATE POLICY "kolon_ayarlari_admin_delete" ON kolon_ayarlari
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_kolon_ayarlari_sube_table_type ON kolon_ayarlari(sube_id, table_type, sort_order);
