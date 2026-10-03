-- New doctors start with Monday-Friday 9:00-17:00 so they can book patients straight away; they can change
-- the hours in the Schedule tab. Doctors who signed up before this and have no hours at all get the same.

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
  INSERT INTO public.doctor_availability (doctor_id, day_of_week, start_time, end_time)
  SELECT new.id, d, time '09:00', time '17:00'
  FROM unnest(ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) AS d;
  RETURN new;
END;
$$;

INSERT INTO public.doctor_availability (doctor_id, day_of_week, start_time, end_time)
SELECT p.id, d, time '09:00', time '17:00'
FROM public.profiles p
CROSS JOIN unnest(ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) AS d
WHERE p.role = 'doctor'
  AND NOT EXISTS (SELECT 1 FROM public.doctor_availability a WHERE a.doctor_id = p.id);
