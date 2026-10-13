-- Patient text reminders (backend only; the app screens come later).
--
-- A doctor books a patient and ticks "patient agreed to a text reminder". A row in reminder_messages is queued
-- and the send-reminders Edge Function (supabase/functions/send-reminders) texts the patient through an SMS
-- gateway. Nothing is sent unless ALL of these hold: the doctor was switched on by an operator
-- (profiles.sms_reminders_allowed, which doctors cannot change), the booking records the patient's consent, the
-- phone is a valid Philippine mobile number, and the daily / monthly / per-patient limits below are not reached.

-- 1. Doctor settings. Only the lead time is editable by the doctor; the rest is set by an operator (service role).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sms_reminders_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_reminder_lead_minutes integer NOT NULL DEFAULT 1440,
  ADD COLUMN IF NOT EXISTS sms_daily_cap integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS sms_monthly_cap integer NOT NULL DEFAULT 20;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_sms_lead_check CHECK (sms_reminder_lead_minutes IN (120, 1440));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_sms_daily_cap_check CHECK (sms_daily_cap BETWEEN 0 AND 500);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_sms_monthly_cap_check CHECK (sms_monthly_cap BETWEEN 0 AND 5000);

GRANT UPDATE (sms_reminder_lead_minutes) ON public.profiles TO authenticated;

-- 2. Philippine mobile numbers, normalised to +639XXXXXXXXX (accepts 09.., 9.., 639.., +639.. with spaces or dashes)
CREATE OR REPLACE FUNCTION public.normalize_ph_mobile(p text)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT CASE
    WHEN d ~ '^639[0-9]{9}$' THEN '+' || d
    WHEN d ~ '^09[0-9]{9}$' THEN '+63' || substr(d, 2)
    WHEN d ~ '^9[0-9]{9}$' THEN '+63' || d
    ELSE NULL
  END
  FROM (SELECT regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') AS d) s
$$;

-- 3. The patient's consent is recorded per booking, set once when the doctor books (not editable afterwards:
--    the UPDATE grant on appointments only covers status and notes).
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS patient_consented_sms boolean NOT NULL DEFAULT false;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_sms_consent_needs_phone
  CHECK (NOT patient_consented_sms OR public.normalize_ph_mobile(patient_phone) IS NOT NULL);

-- 4. The queue and its history
CREATE TABLE IF NOT EXISTS public.reminder_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_phone text NOT NULL,
  send_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  skip_reason text,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  claimed_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reminder_messages_due ON public.reminder_messages (send_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS reminder_messages_doctor ON public.reminder_messages (doctor_id, claimed_at);
CREATE INDEX IF NOT EXISTS reminder_messages_phone ON public.reminder_messages (to_phone, claimed_at);

ALTER TABLE public.reminder_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors can view their own reminders"
  ON public.reminder_messages FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = doctor_id);

-- A doctor may see whether a reminder went out, never the number, provider id or error text.
-- Nobody but the service role can write.
GRANT SELECT (id, appointment_id, doctor_id, send_at, status, skip_reason, sent_at, attempts)
  ON public.reminder_messages TO authenticated;
GRANT ALL ON public.reminder_messages TO service_role;

-- 5. Queue a reminder when an eligible appointment is booked
CREATE OR REPLACE FUNCTION public.queue_patient_reminder()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_allowed boolean;
  v_lead integer;
  v_tz text;
  v_phone text;
  v_start timestamptz;
BEGIN
  IF NOT NEW.patient_consented_sms OR NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;
  v_phone := public.normalize_ph_mobile(NEW.patient_phone);
  IF v_phone IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.sms_reminders_allowed, p.sms_reminder_lead_minutes, COALESCE(dp.timezone, 'Asia/Manila')
  INTO v_allowed, v_lead, v_tz
  FROM public.profiles p
  LEFT JOIN public.doctor_profiles dp ON dp.user_id = p.id
  WHERE p.id = NEW.doctor_id;

  IF NOT FOUND OR NOT v_allowed THEN
    RETURN NEW;
  END IF;

  v_start := (NEW.appointment_date + NEW.start_time) AT TIME ZONE v_tz;

  IF v_start - now() < interval '30 minutes' THEN
    INSERT INTO public.reminder_messages (appointment_id, doctor_id, to_phone, send_at, status, skip_reason)
    VALUES (NEW.id, NEW.doctor_id, v_phone, now(), 'skipped', 'too_late');
  ELSE
    INSERT INTO public.reminder_messages (appointment_id, doctor_id, to_phone, send_at)
    VALUES (NEW.id, NEW.doctor_id, v_phone, GREATEST(v_start - make_interval(mins => v_lead), now()));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_queue_reminder ON public.appointments;
CREATE TRIGGER appointments_queue_reminder
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.queue_patient_reminder();

-- 6. Cancelling or completing an appointment withdraws a reminder that has not gone out yet
CREATE OR REPLACE FUNCTION public.withdraw_patient_reminder()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.reminder_messages
  SET status = 'skipped', skip_reason = 'appointment_' || NEW.status
  WHERE appointment_id = NEW.id AND status = 'pending';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_withdraw_reminder ON public.appointments;
CREATE TRIGGER appointments_withdraw_reminder
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW
  WHEN (NEW.status <> 'confirmed' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.withdraw_patient_reminder();

-- 7. Used by the Edge Function (service role only). Hands out due reminders one batch at a time and applies the
--    safety rules: expired visit, doctor no longer allowed, quiet hours (07:00 to 19:59 in the doctor's time
--    zone), daily and monthly doctor caps, and at most 3 texts to one phone number in 24 hours.
CREATE OR REPLACE FUNCTION public.claim_due_reminders(p_limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  to_phone text,
  doctor_last_name text,
  doctor_phone text,
  appointment_date date,
  start_time time,
  attempts integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  r record;
  v_local_now timestamp;
  v_day_start timestamptz;
  v_month_start timestamptz;
BEGIN
  UPDATE public.reminder_messages m
  SET status = 'pending'
  WHERE m.status = 'sending' AND m.claimed_at < now() - interval '10 minutes';

  FOR r IN
    SELECT m.id AS mid, m.doctor_id, m.to_phone AS mphone, m.attempts AS mattempts,
           a.appointment_date AS adate, a.start_time AS astart,
           p.sms_reminders_allowed, p.sms_daily_cap, p.sms_monthly_cap, p.last_name, p.phone AS dphone,
           COALESCE(dp.timezone, 'Asia/Manila') AS tz
    FROM public.reminder_messages m
    JOIN public.appointments a ON a.id = m.appointment_id
    JOIN public.profiles p ON p.id = m.doctor_id
    LEFT JOIN public.doctor_profiles dp ON dp.user_id = m.doctor_id
    WHERE m.status = 'pending'
      AND m.send_at <= now()
      AND (m.next_attempt_at IS NULL OR m.next_attempt_at <= now())
    ORDER BY m.send_at
    LIMIT GREATEST(p_limit, 0)
    FOR UPDATE OF m SKIP LOCKED
  LOOP
    v_local_now := now() AT TIME ZONE r.tz;

    IF (r.adate + r.astart) AT TIME ZONE r.tz <= now() THEN
      UPDATE public.reminder_messages SET status = 'skipped', skip_reason = 'expired' WHERE reminder_messages.id = r.mid;
      CONTINUE;
    END IF;
    IF NOT r.sms_reminders_allowed THEN
      UPDATE public.reminder_messages SET status = 'skipped', skip_reason = 'not_allowed' WHERE reminder_messages.id = r.mid;
      CONTINUE;
    END IF;
    IF extract(hour FROM v_local_now) < 7 OR extract(hour FROM v_local_now) >= 20 THEN
      CONTINUE; -- quiet hours: stays pending and goes out when they end
    END IF;

    v_day_start := date_trunc('day', v_local_now) AT TIME ZONE r.tz;
    v_month_start := date_trunc('month', v_local_now) AT TIME ZONE r.tz;

    IF (SELECT count(*) FROM public.reminder_messages x
        WHERE x.doctor_id = r.doctor_id AND x.status IN ('sent', 'sending') AND x.claimed_at >= v_day_start) >= r.sms_daily_cap THEN
      UPDATE public.reminder_messages SET status = 'skipped', skip_reason = 'doctor_daily_cap' WHERE reminder_messages.id = r.mid;
      CONTINUE;
    END IF;
    IF (SELECT count(*) FROM public.reminder_messages x
        WHERE x.doctor_id = r.doctor_id AND x.status IN ('sent', 'sending') AND x.claimed_at >= v_month_start) >= r.sms_monthly_cap THEN
      UPDATE public.reminder_messages SET status = 'skipped', skip_reason = 'doctor_monthly_cap' WHERE reminder_messages.id = r.mid;
      CONTINUE;
    END IF;
    IF (SELECT count(*) FROM public.reminder_messages x
        WHERE x.to_phone = r.mphone AND x.status IN ('sent', 'sending') AND x.claimed_at >= now() - interval '24 hours') >= 3 THEN
      UPDATE public.reminder_messages SET status = 'skipped', skip_reason = 'patient_daily_cap' WHERE reminder_messages.id = r.mid;
      CONTINUE;
    END IF;

    UPDATE public.reminder_messages
    SET status = 'sending', attempts = reminder_messages.attempts + 1, claimed_at = now()
    WHERE reminder_messages.id = r.mid;

    id := r.mid;
    to_phone := r.mphone;
    doctor_last_name := r.last_name;
    doctor_phone := r.dphone;
    appointment_date := r.adate;
    start_time := r.astart;
    attempts := r.mattempts + 1;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- 8. Records what happened to a claimed reminder: 'sent', 'dry_run' (nothing was sent) or 'failed'
--    (retried after 5, then 10 minutes; the third failure is final).
CREATE OR REPLACE FUNCTION public.complete_reminder(
  p_id uuid, p_outcome text, p_provider_id text DEFAULT NULL, p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_outcome = 'sent' THEN
    UPDATE public.reminder_messages
    SET status = 'sent', sent_at = now(), provider_message_id = left(p_provider_id, 100), error = NULL
    WHERE id = p_id AND status = 'sending';
  ELSIF p_outcome = 'dry_run' THEN
    UPDATE public.reminder_messages
    SET status = 'skipped', skip_reason = 'dry_run'
    WHERE id = p_id AND status = 'sending';
  ELSIF p_outcome = 'failed' THEN
    UPDATE public.reminder_messages
    SET status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'pending' END,
        next_attempt_at = now() + make_interval(mins => attempts * 5),
        error = left(p_error, 300)
    WHERE id = p_id AND status = 'sending';
  ELSE
    RAISE EXCEPTION 'Unknown outcome: %', p_outcome;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_reminders(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_reminder(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_reminders(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_reminder(uuid, text, text, text) TO service_role;
