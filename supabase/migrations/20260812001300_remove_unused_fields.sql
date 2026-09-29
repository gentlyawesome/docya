-- Fields that nothing in the doctor-only app shows or uses any more: with no patient-facing
-- side, a consultation fee, clinic name and bio are never displayed, and appointments no
-- longer carry a "reason".
ALTER TABLE public.doctor_profiles
  DROP COLUMN IF EXISTS consultation_fee,
  DROP COLUMN IF EXISTS clinic_name,
  DROP COLUMN IF EXISTS bio;

ALTER TABLE public.appointments DROP COLUMN IF EXISTS reason;
