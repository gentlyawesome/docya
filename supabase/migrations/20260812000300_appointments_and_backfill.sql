-- Migration: Appointments policies, backfill, and final setup - Part 3
-- Created: 2024-08-12
-- Description: Appointment policies, role backfill, updated trigger, and validation

-- ============================================================================
-- 1. ROW LEVEL SECURITY POLICIES - AVAILABILITY & APPOINTMENTS
-- ============================================================================

-- Doctor availability policies
DROP POLICY IF EXISTS "Doctor availability is viewable by everyone" ON public.doctor_availability;
CREATE POLICY "Doctor availability is viewable by everyone"
  ON public.doctor_availability
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Doctors can manage their own availability" ON public.doctor_availability;
CREATE POLICY "Doctors can manage their own availability"
  ON public.doctor_availability
  FOR ALL
  USING (
    (SELECT auth.uid()) = doctor_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'doctor'
  )
  WITH CHECK (
    (SELECT auth.uid()) = doctor_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'doctor'
  );

-- Appointments policies
DROP POLICY IF EXISTS "Users can view their own appointments" ON public.appointments;
CREATE POLICY "Users can view their own appointments"
  ON public.appointments
  FOR SELECT
  USING (
    (SELECT auth.uid()) = doctor_id 
    OR (SELECT auth.uid()) = patient_id
  );

DROP POLICY IF EXISTS "Patients can create appointments" ON public.appointments;
CREATE POLICY "Patients can create appointments"
  ON public.appointments
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = patient_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'patient'
    AND (SELECT role FROM public.profiles WHERE id = doctor_id) = 'doctor'
  );

DROP POLICY IF EXISTS "Users can update their own appointments" ON public.appointments;
CREATE POLICY "Users can update their own appointments"
  ON public.appointments
  FOR UPDATE
  USING (
    (SELECT auth.uid()) = doctor_id 
    OR (SELECT auth.uid()) = patient_id
  )
  WITH CHECK (
    (SELECT auth.uid()) = doctor_id 
    OR (SELECT auth.uid()) = patient_id
  );

DROP POLICY IF EXISTS "Patients can delete their own appointments" ON public.appointments;
CREATE POLICY "Patients can delete their own appointments"
  ON public.appointments
  FOR DELETE
  USING (
    (SELECT auth.uid()) = patient_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'patient'
  );

-- ============================================================================
-- 2. BACKFILL ROLE-SPECIFIC PROFILES
-- ============================================================================

-- Create patient_profiles for existing patients
INSERT INTO public.patient_profiles (user_id)
SELECT id
FROM public.profiles
WHERE role = 'patient'
ON CONFLICT (user_id) DO NOTHING;

-- Create doctor_profiles for existing doctors
INSERT INTO public.doctor_profiles (
  user_id,
  specialization,
  license_number
)
SELECT
  profile.id,
  COALESCE(
    auth_user.raw_user_meta_data ->> 'specialization',
    'General Practice'
  ),
  COALESCE(
    auth_user.raw_user_meta_data ->> 'license_number',
    'PENDING-' || profile.id
  )
FROM public.profiles AS profile
JOIN auth.users AS auth_user ON auth_user.id = profile.id
WHERE profile.role = 'doctor'
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- 3. UPDATED SIGNUP TRIGGER
-- ============================================================================

-- Update the profile creation trigger to handle roles properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_role text;
BEGIN
  -- Get the role from metadata - REQUIRE it to be specified
  user_role := new.raw_user_meta_data ->> 'role';
  
  -- Validate role is explicitly provided and valid
  IF user_role IS NULL OR user_role NOT IN ('patient', 'doctor') THEN
    RAISE EXCEPTION 'User signup must specify a valid role (patient or doctor) in metadata';
  END IF;

  -- Insert into profiles with role and full_name
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
    user_role,
    new.raw_user_meta_data ->> 'phone'
  );

  -- Create role-specific profile
  IF user_role = 'doctor' THEN
    INSERT INTO public.doctor_profiles (user_id, specialization, license_number)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data ->> 'specialization', 'General Practice'),
      COALESCE(new.raw_user_meta_data ->> 'license_number', 'PENDING-' || new.id)
    );
  ELSIF user_role = 'patient' THEN
    INSERT INTO public.patient_profiles (user_id)
    VALUES (new.id);
  END IF;

  RETURN new;
END;
$$;

-- ============================================================================
-- 4. COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN public.profiles.role IS 'User role: patient or doctor - required for all accounts';
COMMENT ON COLUMN public.profiles.full_name IS 'Complete user name derived from first_name and last_name';
COMMENT ON COLUMN public.profiles.phone IS 'Optional user phone number';

COMMENT ON TABLE public.doctor_profiles IS 'Doctor-specific profile information';
COMMENT ON TABLE public.patient_profiles IS 'Patient-specific profile information';
COMMENT ON TABLE public.doctor_availability IS 'Doctor availability schedules';
COMMENT ON TABLE public.appointments IS 'Patient appointments with doctors';

COMMENT ON INDEX appointments_no_double_booking IS 'Prevents double booking of the same time slot';
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates role-based profiles when user signs up';
COMMENT ON FUNCTION public.validate_doctor_role() IS 'Ensures doctor_id references a doctor role';
COMMENT ON FUNCTION public.validate_appointment_roles() IS 'Validates appointment role requirements and business rules';

-- ============================================================================
-- 5. MIGRATION VALIDATION AND COMPLETION
-- ============================================================================

-- Validate the migration
DO $$
DECLARE
  profile_count integer;
  role_counts text;
  missing_patient_profiles integer;
  missing_doctor_profiles integer;
BEGIN
  -- Check profile counts by role
  SELECT COUNT(*) INTO profile_count FROM public.profiles;
  
  SELECT string_agg(role || ': ' || count::text, ', ')
  INTO role_counts
  FROM (
    SELECT role, COUNT(*) 
    FROM public.profiles 
    GROUP BY role
  ) AS role_summary;
  
  -- Check for missing role-specific profiles
  SELECT COUNT(*) INTO missing_patient_profiles
  FROM public.profiles AS p
  LEFT JOIN public.patient_profiles AS pp ON pp.user_id = p.id
  WHERE p.role = 'patient' AND pp.user_id IS NULL;
  
  SELECT COUNT(*) INTO missing_doctor_profiles
  FROM public.profiles AS p
  LEFT JOIN public.doctor_profiles AS dp ON dp.user_id = p.id
  WHERE p.role = 'doctor' AND dp.user_id IS NULL;
  
  RAISE NOTICE 'Migration validation complete:';
  RAISE NOTICE 'Total profiles: %', profile_count;
  RAISE NOTICE 'Role distribution: %', role_counts;
  RAISE NOTICE 'Missing patient profiles: %', missing_patient_profiles;
  RAISE NOTICE 'Missing doctor profiles: %', missing_doctor_profiles;
  
  IF missing_patient_profiles > 0 OR missing_doctor_profiles > 0 THEN
    RAISE WARNING 'Some users are missing role-specific profiles. This may indicate a migration issue.';
  END IF;
  
  RAISE NOTICE 'Role-based appointment system migration completed successfully!';
END
$$;