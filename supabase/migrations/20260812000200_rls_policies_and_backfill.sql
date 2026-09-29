-- Migration: RLS policies, backfill, and trigger updates - Part 2
-- Created: 2024-08-12
-- Description: RLS policies, role-specific profile backfill, and updated signup trigger

-- ============================================================================
-- 1. ROW LEVEL SECURITY POLICIES - DOCTOR PROFILES
-- ============================================================================

-- Doctor profiles policies
DROP POLICY IF EXISTS "Doctor profiles are viewable by everyone" ON public.doctor_profiles;
CREATE POLICY "Doctor profiles are viewable by everyone"
  ON public.doctor_profiles
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Doctors can insert their own profile" ON public.doctor_profiles;
CREATE POLICY "Doctors can insert their own profile"
  ON public.doctor_profiles
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id 
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'doctor'
  );

DROP POLICY IF EXISTS "Doctors can update their own profile" ON public.doctor_profiles;
CREATE POLICY "Doctors can update their own profile"
  ON public.doctor_profiles
  FOR UPDATE
  USING (
    (SELECT auth.uid()) = user_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'doctor'
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'doctor'
  );

-- ============================================================================
-- 2. ROW LEVEL SECURITY POLICIES - PATIENT PROFILES  
-- ============================================================================

-- Patient profiles policies
DROP POLICY IF EXISTS "Patients can view own profile, doctors can view for appointments" ON public.patient_profiles;
CREATE POLICY "Patients can view own profile, doctors can view for appointments"
  ON public.patient_profiles
  FOR SELECT
  USING (
    (SELECT auth.uid()) = user_id -- Patient viewing own profile
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'doctor' 
      AND EXISTS (
        SELECT 1 FROM public.appointments 
        WHERE doctor_id = (SELECT auth.uid()) 
        AND patient_id = user_id
        AND status IN ('pending', 'confirmed', 'completed')
      )
    )
  );

DROP POLICY IF EXISTS "Patients can insert their own profile" ON public.patient_profiles;
CREATE POLICY "Patients can insert their own profile"
  ON public.patient_profiles
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id 
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'patient'
  );

DROP POLICY IF EXISTS "Patients can update their own profile" ON public.patient_profiles;
CREATE POLICY "Patients can update their own profile"
  ON public.patient_profiles
  FOR UPDATE
  USING (
    (SELECT auth.uid()) = user_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'patient'
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'patient'
  );