-- Privacy hardening, table privileges and the booked-slots lookup.

-- Table privileges, granted explicitly (newer Supabase versions no longer auto-grant them).
-- Least privilege: nothing for anonymous callers, and only the columns users may edit.
-- Row Level Security (below and in earlier migrations) still decides which rows.
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (first_name, last_name, full_name, phone) ON public.profiles TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.patient_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.doctor_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_availability TO authenticated;

GRANT SELECT, INSERT ON public.appointments TO authenticated;
GRANT UPDATE (status, notes) ON public.appointments TO authenticated;


-- 1. `profiles` held emails and phone numbers and was readable by everyone, including
--    anonymous callers. Now: your own row, all doctors (patients must be able to find
--    them), and your patients if you are their doctor. Nothing for anonymous callers.
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Signed-in users can view doctors"
  ON public.profiles FOR SELECT TO authenticated
  USING (role = 'doctor');

-- SECURITY DEFINER so the lookup does not re-enter the row-level-security policies of
-- `appointments`, which themselves read `profiles` (that would recurse forever).
CREATE OR REPLACE FUNCTION public.is_my_patient(p_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.patient_id = p_patient_id AND a.doctor_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.is_my_patient(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_my_patient(uuid) TO authenticated;

CREATE POLICY "Doctors can view patients they have appointments with"
  ON public.profiles FOR SELECT TO authenticated
  USING (role = 'patient' AND public.is_my_patient(id));

-- 2. Doctor details and availability are for signed-in users only.
DROP POLICY IF EXISTS "Doctor profiles are viewable by everyone" ON public.doctor_profiles;
CREATE POLICY "Signed-in users can view doctor profiles"
  ON public.doctor_profiles FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Doctor availability is viewable by everyone" ON public.doctor_availability;
CREATE POLICY "Signed-in users can view doctor availability"
  ON public.doctor_availability FOR SELECT TO authenticated
  USING (true);

-- 3. Which slots are already taken? Patients cannot read other patients' appointments,
--    so this returns only dates and times (no identities).
CREATE OR REPLACE FUNCTION public.get_booked_slots(p_doctor_id uuid, p_from date, p_to date)
RETURNS TABLE (appointment_date date, start_time time)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT a.appointment_date, a.start_time
  FROM public.appointments a
  WHERE a.doctor_id = p_doctor_id
    AND a.status IN ('pending', 'confirmed')
    AND a.appointment_date BETWEEN p_from AND p_to;
$$;

REVOKE ALL ON FUNCTION public.get_booked_slots(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_booked_slots(uuid, date, date) TO authenticated;
