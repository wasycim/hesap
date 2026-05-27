-- Dashboard erisimi olmayan, sadece mesai giris-cikis yapacak kullanicilar.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS dashboard_access BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.user_profiles
SET dashboard_access = TRUE
WHERE dashboard_access IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_dashboard_access
  ON public.user_profiles (dashboard_access);
