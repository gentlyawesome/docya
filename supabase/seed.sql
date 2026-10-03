-- LOCAL DEVELOPMENT DATA ONLY. Runs on `supabase start` / `supabase db reset`, never on production.
-- All seeded accounts use the password "Password123!" and .test addresses (a reserved TLD).
-- Inserting into auth.users fires the sign-up trigger, which creates the profile rows.

CREATE OR REPLACE FUNCTION pg_temp.seed_user(
  p_id uuid, p_email text, p_first text, p_last text, p_role text,
  p_phone text DEFAULT NULL, p_specialization text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_strip_nulls(jsonb_build_object(
      'first_name', p_first, 'last_name', p_last, 'full_name', p_first || ' ' || p_last,
      'role', p_role, 'phone', p_phone, 'specialization', p_specialization
    )),
    now(), now(), '', '', '', ''
  );
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), p_id,
    jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
    'email', p_id::text, now(), now(), now()
  );
END;
$$;

-- Doctors
SELECT pg_temp.seed_user('b1a2c3d4-5e6f-4a8b-9c0d-1e2f3a4b5c6d', 'maria.santos@doctora.test',
  'Maria', 'Santos', 'doctor', '+639171234567', 'Cardiology');
SELECT pg_temp.seed_user('c2b3d4e5-6f7a-4b9c-8d1e-2f3a4b5c6d7e', 'juan.delacruz@doctora.test',
  'Juan', 'Dela Cruz', 'doctor', '+639172345678', 'Pediatrics');
SELECT pg_temp.seed_user('d3c4e5f6-7a8b-4c9d-9e2f-3a4b5c6d7e8f', 'angela.reyes@doctora.test',
  'Angela', 'Reyes', 'doctor', '+639173456789', 'Dermatology');

UPDATE public.doctor_profiles SET timezone = 'Asia/Manila'
WHERE user_id = 'b1a2c3d4-5e6f-4a8b-9c0d-1e2f3a4b5c6d';
UPDATE public.doctor_profiles SET timezone = 'Asia/Manila'
WHERE user_id = 'c2b3d4e5-6f7a-4b9c-8d1e-2f3a4b5c6d7e';
UPDATE public.doctor_profiles SET timezone = 'Asia/Manila'
WHERE user_id = 'd3c4e5f6-7a8b-4c9d-9e2f-3a4b5c6d7e8f';

-- Weekly availability (doctor's local time); replaces the default 9-17 hours new accounts get
DELETE FROM public.doctor_availability;
INSERT INTO public.doctor_availability (doctor_id, day_of_week, start_time, end_time)
SELECT d.id, day, d.start_time, d.end_time
FROM (VALUES
  ('b1a2c3d4-5e6f-4a8b-9c0d-1e2f3a4b5c6d'::uuid, '09:00'::time, '17:00'::time),
  ('c2b3d4e5-6f7a-4b9c-8d1e-2f3a4b5c6d7e'::uuid, '08:00'::time, '16:00'::time),
  ('d3c4e5f6-7a8b-4c9d-9e2f-3a4b5c6d7e8f'::uuid, '10:00'::time, '18:00'::time)
) AS d(id, start_time, end_time)
CROSS JOIN unnest(ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday']) AS day;
