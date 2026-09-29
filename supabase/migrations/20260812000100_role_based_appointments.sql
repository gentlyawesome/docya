-- Migration: Complete role-based authentication and appointment system
-- Created: 2024-08-12
-- Description: Creates complete appointment system with roles, profiles, availability, appointments and RLS
-- WARNING: This is a comprehensive migration that replaces all previous appointment-related migrations

-- ============================================================================
-- 1. EXTENSIONS AND FUNCTIONS
-- ============================================================================

-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create or update the updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. PROFILES TABLE ENHANCEMENTS
-- ============================================================================

-- Add new columns to existing profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role text,
ADD COLUMN IF NOT EXISTS full_name text,
ADD COLUMN IF NOT EXISTS phone text;

-- Backfill full_name from existing first_name and last_name
UPDATE public.profiles 
SET full_name = COALESCE(
  NULLIF(TRIM(first_name || ' ' || last_name), ''),
  NULLIF(TRIM(first_name), ''),
  NULLIF(TRIM(last_name), ''),
  'User'
)
WHERE full_name IS NULL;

-- Backfill roles from auth metadata where valid
UPDATE public.profiles AS profile
SET role = auth_user.raw_user_meta_data ->> 'role'
FROM auth.users AS auth_user
WHERE profile.id = auth_user.id
  AND profile.role IS NULL
  AND auth_user.raw_user_meta_data ->> 'role' IN ('patient', 'doctor');

-- Check for unresolved roles and provide guidance
DO $$
DECLARE
  unresolved_count integer;
  unresolved_users text;
BEGIN
  SELECT COUNT(*), string_agg(email, ', ') 
  INTO unresolved_count, unresolved_users
  FROM public.profiles 
  WHERE role IS NULL;
  
  IF unresolved_count > 0 THEN
    RAISE WARNING 'Found % users without valid roles: %. These accounts need manual role assignment before the migration can complete.', 
                  unresolved_count, unresolved_users;
    RAISE EXCEPTION 'Migration halted due to unresolved user roles. Please assign valid roles (patient/doctor) to all users.';
  END IF;
END
$$;

-- Now that all roles are resolved, add constraints
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check CHECK (role IN ('patient', 'doctor'));

-- Make role NOT NULL now that all rows have valid values
ALTER TABLE public.profiles 
ALTER COLUMN role SET NOT NULL;

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);
CREATE INDEX IF NOT EXISTS profiles_full_name_idx ON public.profiles(full_name);

-- ============================================================================
-- 3. DOCTOR PROFILES TABLE
-- ============================================================================

-- Create doctor_profiles table
CREATE TABLE IF NOT EXISTS public.doctor_profiles (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL PRIMARY KEY,
  specialization text NOT NULL,
  license_number text NOT NULL UNIQUE,
  clinic_name text,
  consultation_fee numeric(10,2) CHECK (consultation_fee >= 0),
  bio text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.doctor_profiles ENABLE ROW LEVEL SECURITY;

-- Add updated_at trigger
DROP TRIGGER IF EXISTS doctor_profiles_updated_at ON public.doctor_profiles;
CREATE TRIGGER doctor_profiles_updated_at
  BEFORE UPDATE ON public.doctor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes
CREATE INDEX IF NOT EXISTS doctor_profiles_specialization_idx ON public.doctor_profiles(specialization);
CREATE INDEX IF NOT EXISTS doctor_profiles_license_idx ON public.doctor_profiles(license_number);

-- ============================================================================
-- 4. PATIENT PROFILES TABLE
-- ============================================================================

-- Create patient_profiles table  
CREATE TABLE IF NOT EXISTS public.patient_profiles (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL PRIMARY KEY,
  date_of_birth date,
  gender text,
  address text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;

-- Add updated_at trigger
DROP TRIGGER IF EXISTS patient_profiles_updated_at ON public.patient_profiles;
CREATE TRIGGER patient_profiles_updated_at
  BEFORE UPDATE ON public.patient_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 5. DOCTOR AVAILABILITY TABLE
-- ============================================================================

-- Create doctor_availability table
CREATE TABLE IF NOT EXISTS public.doctor_availability (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  day_of_week text NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_available boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Constraint to ensure start_time < end_time
  CONSTRAINT doctor_availability_time_check CHECK (start_time < end_time),
  
  -- Prevent duplicate availability slots for same doctor/day/time
  CONSTRAINT doctor_availability_unique UNIQUE (doctor_id, day_of_week, start_time, end_time)
);

-- Enable RLS
ALTER TABLE public.doctor_availability ENABLE ROW LEVEL SECURITY;

-- Add updated_at trigger
DROP TRIGGER IF EXISTS doctor_availability_updated_at ON public.doctor_availability;
CREATE TRIGGER doctor_availability_updated_at
  BEFORE UPDATE ON public.doctor_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create role validation trigger function for doctor availability
CREATE OR REPLACE FUNCTION public.validate_doctor_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = NEW.doctor_id AND role = 'doctor'
  ) THEN
    RAISE EXCEPTION 'doctor_id must reference a user with role = doctor';
  END IF;
  RETURN NEW;
END;
$$;

-- Add doctor role validation trigger
DROP TRIGGER IF EXISTS doctor_availability_role_check ON public.doctor_availability;
CREATE TRIGGER doctor_availability_role_check
  BEFORE INSERT OR UPDATE ON public.doctor_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_doctor_role();

-- Create indexes
CREATE INDEX IF NOT EXISTS doctor_availability_doctor_day_idx ON public.doctor_availability(doctor_id, day_of_week);

-- ============================================================================
-- 6. APPOINTMENTS TABLE
-- ============================================================================

-- Create appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  patient_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  appointment_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  reason text,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Prevent doctor booking appointments with themselves
  CONSTRAINT appointments_different_users CHECK (doctor_id != patient_id),
  
  -- Ensure start_time < end_time
  CONSTRAINT appointments_time_check CHECK (start_time < end_time)
);

-- Create unique index to prevent double booking (only for active appointments)
CREATE UNIQUE INDEX IF NOT EXISTS appointments_no_double_booking 
ON public.appointments (doctor_id, appointment_date, start_time) 
WHERE status IN ('pending', 'confirmed');

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Add updated_at trigger
DROP TRIGGER IF EXISTS appointments_updated_at ON public.appointments;
CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create appointment role validation trigger function
CREATE OR REPLACE FUNCTION public.validate_appointment_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Check doctor role
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = NEW.doctor_id AND role = 'doctor'
  ) THEN
    RAISE EXCEPTION 'doctor_id must reference a user with role = doctor';
  END IF;
  
  -- Check patient role
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = NEW.patient_id AND role = 'patient'
  ) THEN
    RAISE EXCEPTION 'patient_id must reference a user with role = patient';
  END IF;
  
  -- Check appointment is in future (only for new appointments)
  IF TG_OP = 'INSERT' AND NEW.appointment_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'appointment_date must be today or in the future';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add appointment validation trigger
DROP TRIGGER IF EXISTS appointments_role_check ON public.appointments;
CREATE TRIGGER appointments_role_check
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_appointment_roles();

-- Create indexes
CREATE INDEX IF NOT EXISTS appointments_doctor_date_idx ON public.appointments(doctor_id, appointment_date);
CREATE INDEX IF NOT EXISTS appointments_patient_date_idx ON public.appointments(patient_id, appointment_date);
CREATE INDEX IF NOT EXISTS appointments_status_idx ON public.appointments(status);
CREATE INDEX IF NOT EXISTS appointments_date_status_idx ON public.appointments(appointment_date, status);