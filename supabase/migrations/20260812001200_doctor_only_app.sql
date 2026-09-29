-- Doctor-only app. Patients are no longer users: a doctor records each appointment with the
-- patient's name and phone as plain details. Existing patient accounts are removed; their
-- appointments are kept under the patient's name.

-- 1. Keep who each appointment is for, as text
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS patient_name text,
  ADD COLUMN IF NOT EXISTS patient_phone text;

UPDATE public.appointments a
SET patient_name = COALESCE(NULLIF(p.full_name, ''), 'Patient'),
    patient_phone = p.phone
FROM public.profiles p
WHERE p.id = a.patient_id AND a.patient_name IS NULL;

UPDATE public.appointments SET patient_name = 'Patient' WHERE patient_name IS NULL;
ALTER TABLE public.appointments ALTER COLUMN patient_name SET NOT NULL;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_patient_name_check
  CHECK (length(btrim(patient_name)) > 0 AND length(patient_name) <= 120);
ALTER TABLE public.appointments ADD CONSTRAINT appointments_patient_phone_check
  CHECK (patient_phone IS NULL OR length(patient_phone) <= 40);

-- 2. Appointments belong to the doctor alone
DROP POLICY IF EXISTS "Users can view their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Patients can cancel their appointments" ON public.appointments;
DROP POLICY IF EXISTS "Doctors can create appointments for patients" ON public.appointments;
DROP POLICY IF EXISTS "Doctors can update their appointments status" ON public.appointments;

-- (its policy reads appointments.patient_id, so it must go before that column does)
DROP TABLE IF EXISTS public.patient_profiles;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_different_users;
ALTER TABLE public.appointments DROP COLUMN IF EXISTS patient_id;

CREATE OR REPLACE FUNCTION public.validate_appointment_roles()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.doctor_id AND role = 'doctor') THEN
    RAISE EXCEPTION 'doctor_id must reference a doctor';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.appointment_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'appointment_date must be today or in the future';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_appointment_status_transition()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF OLD.status <> NEW.status THEN
    CASE OLD.status
      WHEN 'pending' THEN
        IF NEW.status NOT IN ('confirmed', 'cancelled') THEN
          RAISE EXCEPTION 'Invalid status transition: pending can only become confirmed or cancelled';
        END IF;
      WHEN 'confirmed' THEN
        IF NEW.status NOT IN ('completed', 'cancelled') THEN
          RAISE EXCEPTION 'Invalid status transition: confirmed can only become completed or cancelled';
        END IF;
      WHEN 'completed' THEN
        RAISE EXCEPTION 'Cannot change status of completed appointment';
      WHEN 'cancelled' THEN
        RAISE EXCEPTION 'Cannot change status of cancelled appointment';
      ELSE
        RAISE EXCEPTION 'Unknown appointment status: %', OLD.status;
    END CASE;
  END IF;

  IF OLD.doctor_id <> NEW.doctor_id THEN
    RAISE EXCEPTION 'Cannot change the doctor of an appointment';
  END IF;
  IF OLD.appointment_date <> NEW.appointment_date THEN
    RAISE EXCEPTION 'Cannot change appointment date during status update';
  END IF;
  IF OLD.start_time <> NEW.start_time OR OLD.end_time <> NEW.end_time THEN
    RAISE EXCEPTION 'Cannot change appointment time during status update';
  END IF;
  RETURN NEW;
END;
$$;

UPDATE public.appointments SET status = 'confirmed' WHERE status = 'pending';

CREATE POLICY "Doctors can view their own appointments"
  ON public.appointments FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = doctor_id);

CREATE POLICY "Doctors can create their own appointments"
  ON public.appointments FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = doctor_id AND status = 'confirmed');

CREATE POLICY "Doctors can update their own appointments"
  ON public.appointments FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = doctor_id)
  WITH CHECK ((SELECT auth.uid()) = doctor_id);

-- 3. Remove patients
DROP POLICY IF EXISTS "Doctors can view patients they have appointments with" ON public.profiles;
DROP FUNCTION IF EXISTS public.find_patient_by_email(text);
DROP FUNCTION IF EXISTS public.is_my_patient(uuid);
DROP POLICY IF EXISTS "Signed-in users can view doctors" ON public.profiles;
DROP POLICY IF EXISTS "Signed-in users can view doctor profiles" ON public.doctor_profiles;
DROP POLICY IF EXISTS "Signed-in users can view doctor availability" ON public.doctor_availability;

DELETE FROM auth.users WHERE id IN (SELECT id FROM public.profiles WHERE role = 'patient');

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'doctor';
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role = 'doctor');

-- Doctors see their own data only
CREATE POLICY "Doctors can view their own doctor profile"
  ON public.doctor_profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Everyone who signs up is a doctor
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, full_name, email, role, phone)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    COALESCE(
      new.raw_user_meta_data ->> 'full_name',
      TRIM((new.raw_user_meta_data ->> 'first_name') || ' ' || (new.raw_user_meta_data ->> 'last_name')),
      new.raw_user_meta_data ->> 'first_name',
      new.raw_user_meta_data ->> 'last_name',
      'User'
    ),
    new.email,
    'doctor',
    new.raw_user_meta_data ->> 'phone'
  );
  INSERT INTO public.doctor_profiles (user_id, specialization)
  VALUES (new.id, COALESCE(NULLIF(btrim(new.raw_user_meta_data ->> 'specialization'), ''), 'General Practice'));
  RETURN new;
END;
$$;

REVOKE ALL ON public.appointments FROM authenticated;
GRANT SELECT, INSERT ON public.appointments TO authenticated;
GRANT UPDATE (status, notes) ON public.appointments TO authenticated;
