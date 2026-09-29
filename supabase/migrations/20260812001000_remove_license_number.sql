-- Simplification: doctors are no longer asked for a license number.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_role text;
BEGIN
  user_role := new.raw_user_meta_data ->> 'role';

  IF user_role IS NULL OR user_role NOT IN ('patient', 'doctor') THEN
    RAISE EXCEPTION 'User signup must specify a valid role (patient or doctor) in metadata';
  END IF;

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

  IF user_role = 'doctor' THEN
    INSERT INTO public.doctor_profiles (user_id, specialization)
    VALUES (new.id, COALESCE(new.raw_user_meta_data ->> 'specialization', 'General Practice'));
  ELSIF user_role = 'patient' THEN
    INSERT INTO public.patient_profiles (user_id) VALUES (new.id);
  END IF;

  RETURN new;
END;
$$;

-- Dropping the column also drops its index, unique constraint and column privileges.
ALTER TABLE public.doctor_profiles DROP COLUMN IF EXISTS license_number;
