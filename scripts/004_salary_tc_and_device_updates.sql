-- TC giris, cihaz ayrimi ve maas/mesai alanlari

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tc_kimlik TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_tc_kimlik
  ON user_profiles(tc_kimlik)
  WHERE tc_kimlik IS NOT NULL AND tc_kimlik <> '';

ALTER TABLE personeller ADD COLUMN IF NOT EXISTS aylik_maas DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE personeller ADD COLUMN IF NOT EXISTS saatlik_mesai_ucreti DECIMAL(15,2) NOT NULL DEFAULT 0;

ALTER TABLE gider_kayitlari ADD COLUMN IF NOT EXISTS personel_mesai_detaylari JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_gider_kayitlari_sube_ay
  ON gider_kayitlari(sube_id, ay_yil, tarih);
