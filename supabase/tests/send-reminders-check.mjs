import { createServer } from 'node:http';
import { sql, target } from '../tools/target.mjs';

// End-to-end check of the send-reminders Edge Function against the LOCAL Docker copy.
// It never contacts Semaphore: the "live" mode talks to a fake gateway started by this script.
//
//   1. supabase start && supabase db reset
//   2. DRY RUN:  printf 'CRON_SECRET=test-secret-123\n' > /tmp/fn.env
//                supabase functions serve --env-file /tmp/fn.env --no-verify-jwt     (in another terminal)
//                node supabase/tests/send-reminders-check.mjs dry
//   3. LIVE:     printf 'CRON_SECRET=test-secret-123\nSMS_LIVE=true\nSEMAPHORE_API_KEY=test-key\nSEMAPHORE_API_URL=http://host.docker.internal:8799/send\n' > /tmp/fn.env
//                restart `supabase functions serve` with that file, then:
//                node supabase/tests/send-reminders-check.mjs live
const mode = process.argv[2];
if (!['dry', 'live'].includes(mode) || target.kind !== 'local') {
  console.log('Usage: node supabase/tests/send-reminders-check.mjs dry|live   (local Docker copy only)');
  process.exit(1);
}
const FN = `${target.url}/functions/v1/send-reminders`;
const SECRET = 'test-secret-123';
const PASSWORD = 'Password123!';
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  -> ${detail}`}`);
  if (!ok) failures++;
};
const rows = q => sql(q).split('\n').map(l => l.trim()).filter(Boolean).map(l => l.split('|'));
const one = q => rows(q)[0]?.[0];
const run = async (headers = { 'x-cron-secret': SECRET }) => {
  const res = await fetch(FN, { method: 'POST', headers, body: '{}' });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
};

let r = await run({});
check('a request without the secret is refused', r.status === 401, `${r.status}`);
r = await run({ 'x-cron-secret': 'wrong' });
check('a request with the wrong secret is refused', r.status === 401, `${r.status}`);

// A doctor who is switched on, in a time zone where it is noon, with one consented booking that is due
const login = await fetch(`${target.url}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: target.key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'maria.santos@doctora.test', password: PASSWORD }),
}).then(x => x.json());
const doctorId = login.user.id;
const originalTz = one(`select timezone from public.doctor_profiles where user_id = '${doctorId}'`);
const tz = one("select name from pg_timezone_names where name like 'Etc/GMT%' and extract(hour from now() at time zone name) = 12 limit 1");
sql(`delete from public.appointments; update public.profiles set sms_reminders_allowed = true, sms_daily_cap = 50, sms_monthly_cap = 20 where id = '${doctorId}'; update public.profiles set last_name = 'Santos', phone = '+639171234567' where id = '${doctorId}'; update public.doctor_profiles set timezone = '${tz}' where user_id = '${doctorId}'`);
const d = new Date(); d.setDate(d.getDate() + 3); while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1);
const date = d.toISOString().slice(0, 10);
const book = async (start, end, phone) => {
  const res = await fetch(`${target.url}/rest/v1/appointments`, {
    method: 'POST',
    headers: { apikey: target.key, Authorization: `Bearer ${login.access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ doctor_id: doctorId, appointment_date: date, start_time: start, end_time: end, patient_name: 'Pat Patient', patient_phone: phone, patient_consented_sms: true }),
  });
  return (await res.json())[0].id;
};
const makeDue = id => sql(`update public.reminder_messages set send_at = now() - interval '1 minute', next_attempt_at = null where appointment_id = '${id}'`);
const state = id => rows(`select status, coalesce(skip_reason,''), attempts, coalesce(provider_message_id,'') from public.reminder_messages where appointment_id = '${id}'`)[0];

if (mode === 'dry') {
  const id = await book('10:00', '10:30', '09175550001');
  makeDue(id);
  r = await run();
  check('a dry run claims the reminder and sends nothing', r.status === 200 && r.json.claimed === 1 && r.json.dry_run === 1 && r.json.sent === 0, JSON.stringify(r));
  const s = state(id);
  check('it is recorded as skipped (dry_run), never as sent', s?.[0] === 'skipped' && s?.[1] === 'dry_run', JSON.stringify(s));
  r = await run();
  check('the next run finds nothing to do', r.status === 200 && r.json.claimed === 0, JSON.stringify(r));
}

if (mode === 'live') {
  const received = [];
  let respondWith = 'ok';
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', () => {
      received.push(Object.fromEntries(new URLSearchParams(body)));
      if (respondWith === 'ok') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify([{ message_id: 987654, status: 'Pending' }]));
      } else {
        res.statusCode = 500; res.end('boom');
      }
    });
  }).listen(8799, '0.0.0.0');

  const a = await book('10:00', '10:30', '0917 555 0001');
  makeDue(a);
  r = await run();
  check('a live run sends the reminder', r.status === 200 && r.json.claimed === 1 && r.json.sent === 1, JSON.stringify(r));
  const s = state(a);
  check('it is recorded as sent with the gateway message id', s?.[0] === 'sent' && s?.[3] === '987654', JSON.stringify(s));
  const m = received[0] ?? {};
  check('the gateway got the API key, the number as 639..., and the text', m.apikey === 'test-key' && m.number === '639175550001' && /^Reminder: appointment with Dr\. Santos on /.test(m.message ?? ''), JSON.stringify(m));
  check('no sender name is sent unless configured', m.sendername === undefined, JSON.stringify(m));
  check('the text says nothing about the reason for the visit', !/check-up|consult|dental|therapy/i.test(m.message ?? ''), m.message);

  respondWith = 'fail';
  const b = await book('10:30', '11:00', '09175550002');
  makeDue(b);
  r = await run();
  check('a gateway error is counted as failed', r.status === 200 && r.json.failed === 1 && r.json.sent === 0, JSON.stringify(r));
  const f = state(b);
  check('the reminder goes back to pending for a retry', f?.[0] === 'pending' && f?.[2] === '1', JSON.stringify(f));
  server.close();
}

sql(`delete from public.appointments; update public.profiles set sms_reminders_allowed = false where id = '${doctorId}'; update public.doctor_profiles set timezone = '${originalTz}' where user_id = '${doctorId}'`);
console.log(failures === 0 ? `\nAll ${mode} checks passed.` : `\n${failures} ${mode} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
