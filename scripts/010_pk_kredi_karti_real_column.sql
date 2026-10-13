-- PK KREDI KARTI icin gercek gider kolonu.
-- Eski bir kolonun etiketi PK KREDI KARTI yapildiysa, veriyi yeni kolona tasir
-- ve eski kolonun adini kendi varsayilan basligina geri alir.

ALTER TABLE public.gider_kayitlari
  ADD COLUMN IF NOT EXISTS pk_kredi_karti NUMERIC DEFAULT 0;

DO $$
DECLARE
  sube14_id UUID;
  old_key TEXT;
BEGIN
  SELECT id INTO sube14_id
  FROM public.subeler
  WHERE regexp_replace(lower(coalesce(kod, '')), '\s+', '', 'g') = '14'
     OR regexp_replace(lower(coalesce(ad, '')), '\s+', '', 'g') = '14'
     OR regexp_replace(lower(coalesce(ad, '')), '\s+', '', 'g') LIKE '%14no%'
     OR regexp_replace(lower(coalesce(ad, '')), '\s+', '', 'g') LIKE '%14numara%'
  LIMIT 1;

  IF sube14_id IS NOT NULL THEN
    SELECT column_key INTO old_key
    FROM public.kolon_ayarlari
    WHERE sube_id = sube14_id
      AND table_type = 'gider'
      AND column_key <> 'pk_kredi_karti'
      AND lower(label) LIKE '%pk%'
      AND lower(label) LIKE '%kredi%'
      AND lower(label) LIKE '%kart%'
    ORDER BY sort_order
    LIMIT 1;

    IF old_key IS NOT NULL THEN
      IF old_key = 'inegol_donus' THEN
        UPDATE public.gider_kayitlari
        SET pk_kredi_karti = COALESCE(pk_kredi_karti, 0) + COALESCE(inegol_donus, 0)
        WHERE sube_id = sube14_id;

        UPDATE public.gider_kayitlari
        SET inegol_donus = 0
        WHERE sube_id = sube14_id;

        UPDATE public.kolon_ayarlari
        SET label = 'İNEGÖL DÖNÜŞ',
            color = 'bg-orange-500',
            updated_at = NOW()
        WHERE sube_id = sube14_id
          AND table_type = 'gider'
          AND column_key = 'inegol_donus';
      END IF;
    END IF;

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
    VALUES (
      sube14_id,
      'gider',
      'pk_kredi_karti',
      'PK KREDİ KARTI',
      'bg-blue-500',
      8,
      true,
      true,
      NOW()
    )
    ON CONFLICT (sube_id, table_type, column_key)
    DO UPDATE SET
      label = EXCLUDED.label,
      color = EXCLUDED.color,
      aktif = true,
      builtin = true,
      updated_at = NOW();
  END IF;
END $$;
