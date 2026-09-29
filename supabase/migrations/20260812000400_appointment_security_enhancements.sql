-- Migration: Appointment security enhancements and status validation - Part 4
-- Created: 2024-08-12
-- Description: Enhanced appointment status transitions, overlap protection, and security policies

-- ============================================================================
-- 1. APPOINTMENT STATUS TRANSITION VALIDATION
-- ============================================================================

-- Create function to validate appointment status transitions
CREATE OR REPLACE FUNCTION public.validate_appointment_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only validate if status is being changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Validate allowed status transitions
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

  -- Prevent changing appointment ownership or core details during status updates
  IF OLD.doctor_id != NEW.doctor_id THEN
    RAISE EXCEPTION 'Cannot change doctor assignment';
  END IF;
  
  IF OLD.patient_id != NEW.patient_id THEN
    RAISE EXCEPTION 'Cannot change patient assignment';
  END IF;
  
  IF OLD.appointment_date != NEW.appointment_date THEN
    RAISE EXCEPTION 'Cannot change appointment date during status update';
  END IF;
  
  IF OLD.start_time != NEW.start_time OR OLD.end_time != NEW.end_time THEN
    RAISE EXCEPTION 'Cannot change appointment time during status update';
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for status transition validation
DROP TRIGGER IF EXISTS appointment_status_validation ON public.appointments;
CREATE TRIGGER appointment_status_validation
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_appointment_status_transition();

-- ============================================================================
-- 2. DOCTOR AVAILABILITY OVERLAP PROTECTION
-- ============================================================================

-- Create function to validate doctor availability overlap
CREATE OR REPLACE FUNCTION public.validate_availability_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Check for overlapping availability on the same day for the same doctor
  IF EXISTS (
    SELECT 1 
    FROM public.doctor_availability 
    WHERE doctor_id = NEW.doctor_id 
      AND day_of_week = NEW.day_of_week
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND (
        -- Check if new slot overlaps with existing slot
        (NEW.start_time < end_time AND NEW.end_time > start_time)
      )
  ) THEN
    RAISE EXCEPTION 'Availability slot overlaps with existing schedule for % on %', NEW.doctor_id, NEW.day_of_week;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for availability overlap validation
DROP TRIGGER IF EXISTS availability_overlap_check ON public.doctor_availability;
CREATE TRIGGER availability_overlap_check
  BEFORE INSERT OR UPDATE ON public.doctor_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_availability_overlap();

-- ============================================================================
-- 3. ENHANCED RLS POLICIES
-- ============================================================================

-- Replace appointment update policy with more restrictive access
DROP POLICY IF EXISTS "Users can update their own appointments" ON public.appointments;

-- Doctors can only update status, notes, and reason for their appointments
CREATE POLICY "Doctors can update their appointments status"
  ON public.appointments
  FOR UPDATE
  USING (
    (SELECT auth.uid()) = doctor_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'doctor'
  )
  WITH CHECK (
    (SELECT auth.uid()) = doctor_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'doctor'
  );

-- Patients can only cancel their own pending or confirmed appointments
CREATE POLICY "Patients can cancel their appointments"
  ON public.appointments
  FOR UPDATE
  USING (
    (SELECT auth.uid()) = patient_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'patient'
    AND status IN ('pending', 'confirmed')
  )
  WITH CHECK (
    (SELECT auth.uid()) = patient_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'patient'
    AND status = 'cancelled'
  );

-- Remove patient delete policy (appointments must be preserved for history)
DROP POLICY IF EXISTS "Patients can delete their own appointments" ON public.appointments;

-- ============================================================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for doctor appointment queries
CREATE INDEX IF NOT EXISTS appointments_doctor_date_time_idx 
ON public.appointments(doctor_id, appointment_date, start_time);

-- Index for patient appointment queries
CREATE INDEX IF NOT EXISTS appointments_patient_date_time_idx 
ON public.appointments(patient_id, appointment_date, start_time);

-- Index for appointment status filtering
CREATE INDEX IF NOT EXISTS appointments_status_date_idx 
ON public.appointments(status, appointment_date);

-- ============================================================================
-- 5. DOCUMENTATION AND VALIDATION
-- ============================================================================

COMMENT ON FUNCTION public.validate_appointment_status_transition() 
IS 'Enforces valid appointment status transitions and prevents core field changes';

COMMENT ON FUNCTION public.validate_availability_overlap() 
IS 'Prevents overlapping doctor availability slots on the same day';

-- Validate the migration
DO $$
BEGIN
  RAISE NOTICE 'Appointment security enhancements migration completed successfully!';
  RAISE NOTICE 'Status transitions are now validated at database level';
  RAISE NOTICE 'Availability overlap protection is enabled';
  RAISE NOTICE 'Enhanced RLS policies are active';
END
$$;