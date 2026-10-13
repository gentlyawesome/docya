// Sends the queued patient reminders through Semaphore (https://api.semaphore.co/docs).
// Called every 5 minutes by pg_cron (see supabase/tools/schedule-reminders.sql).
//
// Secrets (supabase secrets set ...):
//   CRON_SECRET             shared with the schedule; requests without it are refused
//   SEMAPHORE_API_KEY       needed when SMS_LIVE=true
//   SEMAPHORE_SENDER_NAME   optional, must be approved by Semaphore; leave unset to use the default sender
//   SEMAPHORE_API_URL      optional; only for tests against a fake gateway
//   SMS_LIVE                "true" to really send. ANYTHING ELSE is a dry run: reminders are claimed and logged
//                           but not sent, and recorded as skipped (dry_run). Safe by default.
// Supabase provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
import { buildReminderText, maskPhone, timingSafeEqual, toSemaphoreNumber } from '../_shared/reminderText.ts';

const BATCH = 20; // Semaphore allows 120 calls a minute; a run every 5 minutes stays far below that

interface Claimed {
  id: string;
  to_phone: string;
  doctor_last_name: string | null;
  doctor_phone: string | null;
  appointment_date: string;
  start_time: string;
  attempts: number;
}

const env = (name: string): string => Deno.env.get(name) ?? '';

const rpc = async (name: string, body: Record<string, unknown>) => {
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: env('SUPABASE_SERVICE_ROLE_KEY'),
      Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${name} failed: ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

const sendSms = async (toE164: string, message: string): Promise<string> => {
  const form = new URLSearchParams({
    apikey: env('SEMAPHORE_API_KEY'),
    number: toSemaphoreNumber(toE164),
    message,
  });
  if (env('SEMAPHORE_SENDER_NAME')) {
    form.set('sendername', env('SEMAPHORE_SENDER_NAME'));
  }
  const url = env('SEMAPHORE_API_URL') || 'https://api.semaphore.co/api/v4/messages';
  const res = await fetch(url, { method: 'POST', body: form });
  if (!res.ok) {
    throw new Error(`Semaphore answered ${res.status}`);
  }
  const json = await res.json();
  const first = Array.isArray(json) ? json[0] : null;
  if (!first?.message_id) {
    throw new Error('Semaphore returned no message id');
  }
  return String(first.message_id);
};

Deno.serve(async req => {
  const secret = env('CRON_SECRET');
  if (!secret || !timingSafeEqual(req.headers.get('x-cron-secret') ?? '', secret)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const live = env('SMS_LIVE') === 'true';
  if (live && !env('SEMAPHORE_API_KEY')) {
    return new Response('SEMAPHORE_API_KEY is not set', { status: 500 });
  }

  const claimed: Claimed[] = (await rpc('claim_due_reminders', { p_limit: BATCH })) ?? [];
  const result = { claimed: claimed.length, sent: 0, dry_run: 0, failed: 0 };

  for (const item of claimed) {
    const message = buildReminderText({
      doctorLastName: item.doctor_last_name,
      doctorPhone: item.doctor_phone,
      appointmentDate: item.appointment_date,
      startTime: item.start_time,
    });
    try {
      if (!live) {
        console.log(`dry run: reminder ${item.id} to ${maskPhone(item.to_phone)} (${message.length} chars)`);
        await rpc('complete_reminder', { p_id: item.id, p_outcome: 'dry_run' });
        result.dry_run++;
        continue;
      }
      const providerId = await sendSms(item.to_phone, message);
      await rpc('complete_reminder', { p_id: item.id, p_outcome: 'sent', p_provider_id: providerId });
      result.sent++;
    } catch (error) {
      console.error(`reminder ${item.id} to ${maskPhone(item.to_phone)} failed: ${(error as Error).message}`);
      await rpc('complete_reminder', { p_id: item.id, p_outcome: 'failed', p_error: (error as Error).message });
      result.failed++;
    }
  }

  return Response.json(result);
});
