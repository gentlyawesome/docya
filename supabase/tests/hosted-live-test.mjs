import { sql, target } from '../tools/target.mjs';

// Sends ONE REAL TEXT through the deployed send-reminders function on the hosted DEVELOPMENT project.
// target.mjs refuses the production project, so this cannot be pointed at it.
//
// Before running: put SEMAPHORE_API_KEY in supabase/functions/.env, upload it with
// `supabase secrets set --env-file supabase/functions/.env --project-ref <dev ref>`, and set SMS_LIVE=true on Docya Dev
// (see legal/SEMAPHORE.md). Afterwards unset SMS_LIVE again.
//
//   CRON_SECRET=<dev secret> TEST_PHONE=09XXXXXXXXX node supabase/tests/hosted-live-test.mjs --yes-send-one-real-text
//
// TEST_PHONE must be YOUR OWN number. It costs one Semaphore credit.
if (target.kind !== 'hosted') {
  console.log('This is for the hosted development project only.');
  process.exit(1);
}
const { CRON_SECRET, TEST_PHONE } = process.env;
if (!process.argv.includes('--yes-send-one-real-text')) {
  console.log('This sends one real text. Re-run with --yes-send-one-real-text if you mean it.');
  process.exit(1);
}
if (!CRON_SECRET || !TEST_PHONE) {
  console.log('Set CRON_SECRET and TEST_PHONE (your own Philippine mobile number) in the environment.');
  process.exit(1);
}
const phone = sql(`select public.normalize_ph_mobile('${TEST_PHONE.replace(/[^0-9+ ()-]/g, '')}') as p`)[0].p;
if (!phone) {
  console.log('TEST_PHONE is not a valid Philippine mobile number (09XXXXXXXXX or +639XXXXXXXXX).');
  process.exit(1);
}
console.log(`Docya Dev: one real text to ${phone.slice(0, 3)}******${phone.slice(-3)}`);

const FN = `${target.url}/functions/v1/send-reminders`;
const login = await fetch(`${target.url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: target.key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'maria.santos@doctora.test', password: 'Password123!' }),
}).then(r => r.json());
if (!login.access_token) throw new Error('Could not sign in as the seeded doctor. Run `npm run dev:reset` first.');
const doctorId = login.user.id;
const originalTz = sql(`select timezone from public.doctor_profiles where user_id = '${doctorId}'`)[0].timezone;
const tz = sql("select name from pg_timezone_names where name like 'Etc/GMT%' and extract(hour from now() at time zone name) = 12 limit 1")[0].name;

const clean = () => {
  try {
    sql(`delete from public.appointments;
         update public.profiles set sms_reminders_allowed = false where id = '${doctorId}';
         update public.doctor_profiles set timezone = '${originalTz}' where user_id = '${doctorId}'`);
  } catch (e) {
    console.log(`Clean-up failed, run \`npm run dev:reset\`: ${e.message}`);
  }
};

let code = 0;
try {
  clean();
  // Nothing else may be queued: the function sends everything that is due
  sql(`update public.profiles set sms_reminders_allowed = true where id = '${doctorId}';
       update public.doctor_profiles set timezone = '${tz}' where user_id = '${doctorId}'`);
  const d = new Date();
  d.setDate(d.getDate() + 3);
  while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1);
  const r = await fetch(`${target.url}/rest/v1/appointments`, {
    method: 'POST',
    headers: { apikey: target.key, Authorization: `Bearer ${login.access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ doctor_id: doctorId, appointment_date: d.toISOString().slice(0, 10), start_time: '10:00', end_time: '10:30', patient_name: 'Test Patient', patient_phone: phone, patient_consented_sms: true }),
  });
  const body = await r.json();
  if (!Array.isArray(body)) throw new Error(`booking failed: ${JSON.stringify(body).slice(0, 120)}`);
  const id = body[0].id;
  const queued = sql('select count(*) as n from public.reminder_messages')[0].n;
  if (Number(queued) !== 1) throw new Error(`expected exactly 1 queued reminder, found ${queued}; refusing to send`);
  sql(`update public.reminder_messages set send_at = now() - interval '1 minute' where appointment_id = '${id}'`);

  const res = await fetch(FN, { method: 'POST', headers: { 'x-cron-secret': CRON_SECRET, 'Content-Type': 'application/json' }, body: '{}' });
  const out = await res.json().catch(() => ({}));
  console.log(`function answered ${res.status}: ${JSON.stringify(out)}`);
  const row = sql(`select status, coalesce(skip_reason, '') as reason, coalesce(provider_message_id, '') as provider_id, coalesce(error, '') as error from public.reminder_messages where appointment_id = '${id}'`)[0];
  console.log(`reminder row: ${JSON.stringify(row)}`);
  if (row.status === 'sent') {
    console.log('\nSent. Check your phone. Then run: supabase secrets unset SMS_LIVE --project-ref <dev ref>');
  } else if (row.reason === 'dry_run') {
    console.log('\nStill a dry run: SMS_LIVE is not "true" on Docya Dev, so nothing was sent.');
    code = 1;
  } else {
    console.log('\nNot sent. See the row above (status, reason, error).');
    code = 1;
  }
} catch (e) {
  console.log(`Failed: ${e.message}`);
  code = 1;
} finally {
  clean();
}
process.exit(code);
