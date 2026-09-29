-- Doctors schedule appointments for patients. Patients no longer book themselves: they view,
-- cancel and get reminders. Appointments are confirmed as soon as the doctor creates them.

UPDATE public.appointments SET status = 'confirmed' WHERE status = 'pending';
ALTER TABLE public.appointments ALTER COLUMN status SET DEFAULT 'confirmed';

-- Who may create an appointment
DROP POLICY IF EXISTS "Patients can create appointments" ON public.appointments;
DROP POLICY IF EXISTS "Doctors can create appointments for patients" ON public.appointments;
CREATE POLICY "Doctors can create appointments for patients"
  ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = doctor_id
    AND status = 'confirmed'
    AND (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'doctor'
  );
-- (That patient_id belongs to a patient is enforced by the validate_appointment_roles trigger,
-- which can read profiles that the doctor cannot see before the first appointment exists.)

-- Patients no longer need to look up other people's taken slots.
DROP FUNCTION IF EXISTS public.get_booked_slots(uuid, date, date);

-- A doctor finds a patient by their exact email address. Only the id and name come back, and
-- there is no way to list or browse patients.
CREATE OR REPLACE FUNCTION public.find_patient_by_email(p_email text)
RETURNS TABLE (id uuid, full_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles me WHERE me.id = (SELECT auth.uid()) AND me.role = 'doctor'
  ) THEN
    RAISE EXCEPTION 'Only doctors can look up patients';
  END IF;

  RETURN QUERY
  SELECT p.id, p.full_name
  FROM public.profiles p
  WHERE p.role = 'patient' AND lower(p.email) = lower(trim(p_email));
END;
$$;

REVOKE ALL ON FUNCTION public.find_patient_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_patient_by_email(text) TO authenticated;
