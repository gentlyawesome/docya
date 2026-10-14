import { sql, target } from '../tools/target.mjs';

// End-to-end check of the DEPLOYED send-reminders function on the hosted DEVELOPMENT project (Docya Dev).
// Nothing is ever texted: the function must be in dry-run mode (SMS_LIVE unset), and this script fails if it is not.
// target.mjs refuses the production project, so this cannot be pointed at it.
//
// Needs: .env pointing at Docya Dev, `supabase link` to the same project, and the function's secret in the
// environment (it is never stored in the repo):
//   CRON_SECRET=<the value> node supabase/tests/hosted-reminders-check.mjs
// It takes about 6 minutes because one reminder is left for the 5-minute schedule to pick up on its own.
if (target.kind !== 'hosted') {
  console.log('This check is for the hosted development project. For the Docker copy use reminders:check.');
  process.exit(1);
}
const SECRET = process.env.CRON_SECRET;
if (!SECRET) {
  console.log('Set CRON_SECRET (the value given to `supabase secrets set`) in the environment.');
  process.exit(1);
}
console.log(`Checking reminders on the ${target.label}\n`);

const FN = `${target.url}/functions/v1/send-reminders`;
const PASSWORD = 'Password123!';
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  -> ${detail}`}`);
  if (!ok) failures++;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const first = q => sql(q)[0];

const login = await fetch(`${target.url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: target.key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'maria.santos@doctora.test', password: PASSWORD }),
}).then(r => r.json());
if (!login.access_token) throw new Error('Could not sign in as the seeded doctor. Run `npm run dev:reset` first.');
const doctorId = login.user.id;
const originalTz = first(`select timezone from public.doctor_profiles where user_id = '${doctorId}'`).timezone;

// A time zone where it is noon right now, so the quiet-hours rule cannot hold the reminder back
const tz = first("select name from pg_timezone_names where name like 'Etc/GMT%' and extract(hour from now() at time zone name) = 12 limit 1").name;
const reset = () =>
  sql(`delete from public.appointments;
       update public.profiles set sms_reminders_allowed = false, sms_daily_cap = 50, sms_monthly_cap = 20 where id = '${doctorId}';
       update public.doctor_profiles set timezone = '${originalTz}' where user_id = '${doctorId}'`);
const cleanUp = () => {
  try { reset(); } catch (e) { console.log(`Clean-up failed, run \`npm run dev:reset\`: ${e.message}`); }
};

try {
  reset();
  sql(`update public.profiles set sms_reminders_allowed = true where id = '${doctorId}';
       update public.doctor_profiles set timezone = '${tz}' where user_id = '${doctorId}'`);

  // The function must refuse anyone without the secret
  let res = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  check('a request with no secret is refused', res.status === 401, `${res.status}`);
  res = await fetch(FN, { method: 'POST', headers: { 'x-cron-secret': 'wrong' }, body: '{}' });
  check('a request with the wrong secret is refused', res.status === 401, `${res.status}`);

  const d = new Date();
  d.setDate(d.getDate() + 3);
  while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1);
  const date = d.toISOString().slice(0, 10);
  const book = async (start, end, phone) => {
    const r = await fetch(`${target.url}/rest/v1/appointments`, {
      method: 'POST',
      headers: { apikey: target.key, Authorization: `Bearer ${login.access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ doctor_id: doctorId, appointment_date: date, start_time: start, end_time: end, patient_name: 'Pat Patient', patient_phone: phone, patient_consented_sms: true }),
    });
    const body = await r.json();
    if (!Array.isArray(body)) throw new Error(`booking failed: ${JSON.stringify(body).slice(0, 120)}`);
    return body[0].id;
  };
  const makeDue = id => sql(`update public.reminder_messages set send_at = now() - interval '1 minute', next_attempt_at = null where appointment_id = '${id}'`);
  const state = id => first(`select status, coalesce(skip_reason, '') as reason from public.reminder_messages where appointment_id = '${id}'`);

  // 1. Call the deployed function ourselves
  const manual = await book('10:00', '10:30', '09175550001');
  check('a consented booking by an enabled doctor is queued on the hosted project', state(manual)?.status === 'pending', JSON.stringify(state(manual)));
  makeDue(manual);
  res = await fetch(FN, { method: 'POST', headers: { 'x-cron-secret': SECRET, 'Content-Type': 'application/json' }, body: '{}' });
  const out = await res.json().catch(() => ({}));
  check('the function answers 200 with the secret', res.status === 200, `${res.status}`);
  check('it is a dry run: nothing was sent', out.sent === 0 && out.failed === 0, JSON.stringify(out));
  let s = state(manual);
  check('the reminder is recorded as skipped (dry_run), never as sent', s?.status === 'skipped' && s?.reason === 'dry_run', JSON.stringify(s));

  // 2. Leave one for the 5-minute schedule alone
  const scheduled = await book('10:30', '11:00', '09175550002');
  makeDue(scheduled);
  console.log('Waiting for the 5-minute schedule to pick up a second reminder (up to 8 minutes)...');
  const deadline = Date.now() + 8 * 60 * 1000;
  while (Date.now() < deadline && state(scheduled)?.status === 'pending') await sleep(15000);
  s = state(scheduled);
  check('the schedule alone processed it as a dry run', s?.status === 'skipped' && s?.reason === 'dry_run', JSON.stringify(s));

  const runs = first("select count(*) filter (where status = 'succeeded') as ok, count(*) filter (where status = 'failed') as bad from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'send-reminders')");
  check('the schedule has succeeded runs and no failed ones', Number(runs.ok) > 0 && Number(runs.bad) === 0, JSON.stringify(runs));
  const live = first("select count(*) as n from public.reminder_messages where status = 'sent'");
  check('no reminder anywhere is marked sent', Number(live.n) === 0, JSON.stringify(live));
} finally {
  cleanUp();
}
console.log(failures === 0 ? '\nAll hosted reminder checks passed.' : `\n${failures} hosted reminder check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
