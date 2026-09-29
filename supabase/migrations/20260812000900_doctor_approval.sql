-- Doctor approval: anyone can register as a doctor, but only approved doctors are visible to
-- patients and can receive appointment requests. Approval is done by an operator with the
-- service role (SQL editor / dashboard) via set_doctor_verification(); doctors cannot approve
-- themselves.

ALTER TABLE public.doctor_profiles
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Doctors that already exist when this migration is applied keep working.
UPDATE public.doctor_profiles
SET verification_status = 'approved', verified_at = now()
WHERE verification_status = 'pending';

-- Doctors may edit their professional details but never the verification columns.
REVOKE INSERT, UPDATE ON public.doctor_profiles FROM authenticated;
GRANT INSERT (user_id, specialization, license_number, clinic_name, consultation_fee, bio, timezone)
  ON public.doctor_profiles TO authenticated;
GRANT UPDATE (user_id, specialization, license_number, clinic_name, consultation_fee, bio, timezone)
  ON public.doctor_profiles TO authenticated;

-- Helpers. SECURITY DEFINER so policies on one table can consult another without recursing.
CREATE OR REPLACE FUNCTION public.is_approved_doctor(p_doctor_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.doctor_profiles d
    WHERE d.user_id = p_doctor_id AND d.verification_status = 'approved'
  );
$$;

-- A patient keeps seeing doctors they already have appointments with, even if approval is later withdrawn.
CREATE OR REPLACE FUNCTION public.has_appointment_with(p_doctor_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.doctor_id = p_doctor_id AND a.patient_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.is_approved_doctor(uuid), public.has_appointment_with(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_doctor(uuid), public.has_appointment_with(uuid) TO authenticated;

-- Visibility: doctors are listed only once approved (plus yourself, plus your own history).
DROP POLICY IF EXISTS "Signed-in users can view doctor profiles" ON public.doctor_profiles;
CREATE POLICY "View approved doctors, yourself, and doctors you booked"
  ON public.doctor_profiles FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR verification_status = 'approved'
    OR public.has_appointment_with(user_id)
  );

DROP POLICY IF EXISTS "Signed-in users can view doctors" ON public.profiles;
CREATE POLICY "Signed-in users can view approved doctors"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    role = 'doctor'
    AND (public.is_approved_doctor(id) OR public.has_appointment_with(id))
  );

DROP POLICY IF EXISTS "Signed-in users can view doctor availability" ON public.doctor_availability;
CREATE POLICY "View availability of approved doctors and your own"
  ON public.doctor_availability FOR SELECT TO authenticated
  USING (doctor_id = (SELECT auth.uid()) OR public.is_approved_doctor(doctor_id));

-- Only approved doctors can be booked.
DROP POLICY IF EXISTS "Patients can create appointments" ON public.appointments;
CREATE POLICY "Patients can create appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = patient_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'patient'
    AND public.is_approved_doctor(doctor_id)
  );

-- Operator function: approve, reject, or reset a doctor. Not callable by app users.
CREATE OR REPLACE FUNCTION public.set_doctor_verification(p_doctor_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status %', p_status;
  END IF;
  UPDATE public.doctor_profiles
  SET verification_status = p_status,
      verified_at = CASE WHEN p_status = 'approved' THEN now() ELSE NULL END
  WHERE user_id = p_doctor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No doctor profile for %', p_doctor_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_doctor_verification(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_doctor_verification(uuid, text) TO service_role;
