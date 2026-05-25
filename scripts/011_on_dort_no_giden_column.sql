-- 14 No Hesap / Gelir Kalemleri icin kilitli "14 NO GIDEN" sutunu.
-- Idempotent calisir: mevcut sube ayarlarinda sutun yoksa araya ekler.

CREATE TEMP TABLE IF NOT EXISTS tmp_on_dort_no_giden_target_subeler (
  sube_id UUID
) ON COMMIT DROP;

TRUNCATE tmp_on_dort_no_giden_target_subeler;

INSERT INTO tmp_on_dort_no_giden_target_subeler (sube_id)
SELECT DISTINCT existing.sube_id
FROM public.kolon_ayarlari existing
WHERE existing.table_type = 'on_dort_no_hesap'
  AND NOT EXISTS (
    SELECT 1
    FROM public.kolon_ayarlari added
    WHERE added.table_type = 'on_dort_no_hesap'
      AND added.column_key = 'on_dort_no_giden'
      AND added.sube_id IS NOT DISTINCT FROM existing.sube_id
  );

UPDATE public.kolon_ayarlari column_settings
SET sort_order = sort_order + 1,
    updated_at = NOW()
FROM tmp_on_dort_no_giden_target_subeler target_subeler
WHERE column_settings.table_type = 'on_dort_no_hesap'
  AND column_settings.sube_id IS NOT DISTINCT FROM target_subeler.sube_id
  AND column_settings.sort_order >= 3;

INSERT INTO public.kolon_ayarlari (
  sube_id,
  table_type,
  column_key,
  label,
  color,
  sort_order,
  aktif,
  builtin,
  updated_at
)
SELECT
  target_subeler.sube_id,
  'on_dort_no_hesap',
  'on_dort_no_giden',
  '14 NO GİDEN',
  'bg-orange-500',
  3,
  true,
  true,
  NOW()
FROM tmp_on_dort_no_giden_target_subeler target_subeler
ON CONFLICT (sube_id, table_type, column_key)
DO UPDATE SET
  label = EXCLUDED.label,
  color = EXCLUDED.color,
  sort_order = 3,
  aktif = true,
  builtin = true,
  updated_at = NOW();
