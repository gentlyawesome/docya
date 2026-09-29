-- Doctor time zone (appointment times are wall-clock times in the doctor's zone)
-- and in-app account deletion (required by the App Store once accounts can be created).

ALTER TABLE public.doctor_profiles
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Australia/Sydney';

CREATE OR REPLACE FUNCTION public.validate_doctor_timezone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = NEW.timezone) THEN
    RAISE EXCEPTION 'Unknown time zone: %', NEW.timezone;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS doctor_profiles_timezone_check ON public.doctor_profiles;
CREATE TRIGGER doctor_profiles_timezone_check
  BEFORE INSERT OR UPDATE OF timezone ON public.doctor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_doctor_timezone();

-- Deletes the signed-in user's account. Profile rows, availability and appointments
-- are removed by the ON DELETE CASCADE foreign keys.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
