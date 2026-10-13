ALTER TABLE kargo_cari_odemeler
ADD COLUMN IF NOT EXISTS ay_yil TEXT;

UPDATE kargo_cari_odemeler
SET ay_yil = COALESCE(NULLIF(ay_yil, ''), 'Eski Kayit')
WHERE ay_yil IS NULL OR ay_yil = '';

ALTER TABLE kargo_cari_odemeler
ALTER COLUMN ay_yil SET NOT NULL;

ALTER TABLE kargo_cari_odemeler
DROP CONSTRAINT IF EXISTS kargo_cari_odemeler_user_id_firma_id_key;

DROP INDEX IF EXISTS kargo_cari_odemeler_user_id_firma_id_key;

ALTER TABLE kargo_cari_odemeler
DROP CONSTRAINT IF EXISTS kargo_cari_odemeler_sube_firma_key;

ALTER TABLE kargo_cari_odemeler
DROP CONSTRAINT IF EXISTS kargo_cari_odemeler_sube_firma_unique;

ALTER TABLE kargo_cari_odemeler
DROP CONSTRAINT IF EXISTS kargo_cari_odemeler_sube_firma_ay_key;

WITH ranked AS (
  SELECT
    ctid,
    SUM(COALESCE(odenen, 0)) OVER (PARTITION BY sube_id, firma_id, ay_yil) AS toplam_odenen,
    ROW_NUMBER() OVER (
      PARTITION BY sube_id, firma_id, ay_yil
      ORDER BY updated_at DESC NULLS LAST, ctid
    ) AS rn
  FROM kargo_cari_odemeler
  WHERE sube_id IS NOT NULL
    AND firma_id IS NOT NULL
    AND ay_yil IS NOT NULL
)
UPDATE kargo_cari_odemeler target
SET odenen = ranked.toplam_odenen
FROM ranked
WHERE target.ctid = ranked.ctid
  AND ranked.rn = 1;

WITH ranked AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY sube_id, firma_id, ay_yil
      ORDER BY updated_at DESC NULLS LAST, ctid
    ) AS rn
  FROM kargo_cari_odemeler
  WHERE sube_id IS NOT NULL
    AND firma_id IS NOT NULL
    AND ay_yil IS NOT NULL
)
DELETE FROM kargo_cari_odemeler target
USING ranked
WHERE target.ctid = ranked.ctid
  AND ranked.rn > 1;

ALTER TABLE kargo_cari_odemeler
ADD CONSTRAINT kargo_cari_odemeler_sube_firma_ay_key
UNIQUE (sube_id, firma_id, ay_yil);

DROP INDEX IF EXISTS idx_kargo_cari_odemeler_sube_firma;
CREATE INDEX IF NOT EXISTS idx_kargo_cari_odemeler_sube_firma_ay
ON kargo_cari_odemeler(sube_id, firma_id, ay_yil);
