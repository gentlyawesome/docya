import { sql, target } from '../tools/target.mjs';

// Checks the patient-reminder queue (migration 20260812001500): who may queue a text, what the limits do, and who
// can read or write the queue. It talks to the database through its real API as two seeded doctors and uses SQL
// for the service-side functions (claim_due_reminders / complete_reminder), which only the service role may call.
// Needs the LOCAL Docker copy (`supabase start`): quiet-hours checks change the doctor's time zone.
// Run: npm run reminders:check
if (target.kind !== 'local') {
  console.log('reminders:check runs on the local Docker copy only (supabase start). Skipping.');
  process.exit(0);
}
console.log(`Checking reminders on the ${target.label}\n`);

const PASSWORD = 'Password123!';
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  -> ${detail}`}`);
  if (!ok) failures++;
};

const call = async (path, { method = 'GET', token, body } = {}) => {
  const res = await fetch(`${target.url}${path}`, {
    method,
    headers: {
      apikey: target.key,
      Authorization: `Bearer ${token ?? target.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
};
const signIn = async email => {
  const { status, json } = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password: PASSWORD } });
  if (status !== 200) throw new Error(`sign-in failed for ${email}: ${status}`);
  return { token: json.access_token, id: json.user.id };
};

// psql prints rows as `a|b|c`, one per line
const rows = q => sql(q).split('\n').map(l => l.trim()).filter(Boolean).map(l => l.split('|'));
const one = q => rows(q)[0]?.[0];

// A weekday at least `plus` days ahead, so the 24-hour reminder is still in the future
const weekday = plus => {
  const d = new Date();
  d.setDate(d.getDate() + plus);
  while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};
const DATE = weekday(3);
const book = (doctor, over = {}) => ({
  doctor_id: doctor.id, appointment_date: DATE, start_time: '09:00', end_time: '09:30',
  patient_name: 'Pat Patient', patient_phone: '0917 555 0001', patient_consented_sms: true, ...over,
});
const reminderFor = id => rows(`select status, coalesce(skip_reason,''), attempts, to_phone from public.reminder_messages where appointment_id = '${id}'`)[0];

const maria = await signIn('maria.santos@doctora.test');
const juan = await signIn('juan.delacruz@doctora.test');
const originalTz = one(`select timezone from public.doctor_profiles where user_id = '${maria.id}'`);
// A time zone where it is currently `hour` o'clock, so the quiet-hours rule is predictable
const setLocalHour = hour => {
  const tz = one(`select name from pg_timezone_names where name like 'Etc/GMT%' and extract(hour from now() at time zone name) = ${hour} limit 1`);
  sql(`update public.doctor_profiles set timezone = '${tz}' where user_id = '${maria.id}'`);
};
const reset = () => sql(`
  delete from public.appointments;
  update public.profiles set sms_reminders_allowed = false, sms_daily_cap = 50, sms_monthly_cap = 20, sms_reminder_lead_minutes = 1440;
  update public.profiles set sms_reminders_allowed = true where id = '${maria.id}';
`);
reset();
setLocalHour(12);

// --- Phone numbers
const norm = v => one(`select public.normalize_ph_mobile(${v === null ? 'null' : `'${v}'`})`);
check('09.. numbers become +639..', norm('0917 555 0001') === '+639175550001', norm('0917 555 0001'));
check('+63 numbers with dashes are accepted', norm('+63-917-555-0001') === '+639175550001');
check('9.. (no leading zero) numbers are accepted', norm('9175550001') === '+639175550001');
check('landlines and foreign numbers are refused', !norm('02 8123 4567') && !norm('+14155550100') && !norm('12345') && !norm(null));

// --- Queueing
let r = await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: book(maria) });
check('a consented booking by an allowed doctor is accepted', r.status === 201, `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
const first = r.json?.[0]?.id;
let q = reminderFor(first);
check('it queues a pending reminder to the normalised number', q?.[0] === 'pending' && q?.[3] === '+639175550001', JSON.stringify(q));
check('the reminder is due before the visit, not after', one(`select send_at < (appointment_date + start_time) at time zone '${one(`select timezone from public.doctor_profiles where user_id = '${maria.id}'`)}' from public.reminder_messages m join public.appointments a on a.id = m.appointment_id where m.appointment_id = '${first}'`) === 't');

r = await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: book(maria, { start_time: '09:30', end_time: '10:00', patient_consented_sms: false }) });
check('no consent: the booking works and nothing is queued', r.status === 201 && !reminderFor(r.json[0].id), JSON.stringify(r.json).slice(0, 80));

r = await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: book(maria, { start_time: '10:00', end_time: '10:30', patient_phone: undefined }) });
check('consent without a phone number is refused', r.status >= 400, `${r.status}`);
r = await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: book(maria, { start_time: '10:00', end_time: '10:30', patient_phone: '+14155550100' }) });
check('consent with a non-Philippine number is refused', r.status >= 400, `${r.status}`);

r = await call('/rest/v1/appointments', { method: 'POST', token: juan.token, body: book(juan) });
check('a doctor who is not switched on can book, but nothing is queued', r.status === 201 && !reminderFor(r.json[0].id), JSON.stringify(r.json).slice(0, 80));

// --- Who can see and change what
r = await call('/rest/v1/reminder_messages?select=status,skip_reason', { token: maria.token });
check('a doctor sees the status of their own reminders', r.status === 200 && r.json.length === 1 && r.json[0].status === 'pending', JSON.stringify(r.json));
r = await call('/rest/v1/reminder_messages?select=to_phone', { token: maria.token });
check("a doctor cannot read the patient's number from the queue", r.status >= 400, `${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
r = await call('/rest/v1/reminder_messages?select=status', { token: juan.token });
check("another doctor cannot see this doctor's reminders", r.status === 200 && r.json.length === 0, JSON.stringify(r.json));
r = await call('/rest/v1/reminder_messages?select=status');
check('anonymous callers cannot read the queue', r.status >= 400 || (r.status === 200 && r.json.length === 0), `${r.status}`);
r = await call('/rest/v1/reminder_messages', { method: 'POST', token: maria.token, body: { appointment_id: first, doctor_id: maria.id, to_phone: '+639175550009', send_at: new Date().toISOString() } });
check('a doctor cannot add to the queue', r.status >= 400, `${r.status}`);
r = await call(`/rest/v1/reminder_messages?appointment_id=eq.${first}`, { method: 'PATCH', token: maria.token, body: { status: 'sent' } });
check('a doctor cannot edit the queue', r.status >= 400 || r.json?.length === 0, `${r.status}`);
r = await call(`/rest/v1/reminder_messages?appointment_id=eq.${first}`, { method: 'DELETE', token: maria.token });
check('a doctor cannot delete from the queue', r.status >= 400 || r.json?.length === 0, `${r.status}`);

r = await call(`/rest/v1/profiles?id=eq.${juan.id}`, { method: 'PATCH', token: juan.token, body: { sms_reminders_allowed: true } });
check('a doctor cannot switch reminders on for themselves', r.status >= 400, `${r.status}`);
r = await call(`/rest/v1/profiles?id=eq.${maria.id}`, { method: 'PATCH', token: maria.token, body: { sms_monthly_cap: 5000 } });
check('a doctor cannot raise their own sending cap', r.status >= 400, `${r.status}`);
r = await call(`/rest/v1/profiles?id=eq.${maria.id}`, { method: 'PATCH', token: maria.token, body: { sms_reminder_lead_minutes: 120 } });
check('a doctor can choose the 2-hour lead time', r.status === 200 && r.json[0]?.sms_reminder_lead_minutes === 120, `${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
r = await call(`/rest/v1/profiles?id=eq.${maria.id}`, { method: 'PATCH', token: maria.token, body: { sms_reminder_lead_minutes: 60 } });
check('any other lead time is refused', r.status >= 400, `${r.status}`);
sql(`update public.profiles set sms_reminder_lead_minutes = 1440 where id = '${maria.id}'`);

r = await call('/rest/v1/rpc/claim_due_reminders', { method: 'POST', token: maria.token, body: { p_limit: 5 } });
check('a doctor cannot call claim_due_reminders', r.status >= 400, `${r.status}`);
r = await call('/rest/v1/rpc/complete_reminder', { method: 'POST', token: maria.token, body: { p_id: first, p_outcome: 'sent' } });
check('a doctor cannot call complete_reminder', r.status >= 400, `${r.status}`);
r = await call('/rest/v1/rpc/claim_due_reminders', { method: 'POST', body: { p_limit: 5 } });
check('anonymous callers cannot call claim_due_reminders', r.status >= 400, `${r.status}`);

// --- Sending rules (the service-side functions)
const claim = (limit = 20) => rows(`select id, attempts from public.claim_due_reminders(${limit})`);
const due = id => sql(`update public.reminder_messages set send_at = now() - interval '1 minute', next_attempt_at = null where appointment_id = '${id}'`);

check('nothing is claimed before it is due', claim().length === 0);
due(first);
let got = claim();
check('a due reminder is claimed once, with its first attempt', got.length === 1 && got[0][1] === '1', JSON.stringify(got));
check('a second run does not claim it again', claim().length === 0);
const rid = got[0]?.[0];

sql(`select public.complete_reminder('${rid}', 'failed', null, 'gateway down')`);
q = reminderFor(first);
check('a failed send goes back to pending for a retry', q?.[0] === 'pending' && q?.[2] === '1', JSON.stringify(q));
check('the retry waits a few minutes', claim().length === 0);
due(first);
got = claim();
check('after the wait it is claimed again (attempt 2)', got.length === 1 && got[0][1] === '2', JSON.stringify(got));
sql(`select public.complete_reminder('${rid}', 'failed', null, 'gateway down')`);
due(first);
got = claim();
check('attempt 3 is the last', got.length === 1 && got[0][1] === '3', JSON.stringify(got));
sql(`select public.complete_reminder('${rid}', 'failed', null, 'gateway down')`);
check('the third failure is final', reminderFor(first)?.[0] === 'failed');

r = await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: book(maria, { start_time: '11:00', end_time: '11:30' }) });
const second = r.json?.[0]?.id;
due(second);
got = claim();
sql(`select public.complete_reminder('${got[0]?.[0]}', 'sent', 'msg-123', null)`);
q = reminderFor(second);
check('a successful send is recorded as sent', q?.[0] === 'sent', JSON.stringify(q));
sql(`select public.complete_reminder('${got[0]?.[0]}', 'failed', null, 'late')`);
check('a finished reminder cannot be changed again', reminderFor(second)?.[0] === 'sent');

r = await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: book(maria, { start_time: '11:30', end_time: '12:00', patient_phone: '09175550002' }) });
const dry = r.json?.[0]?.id;
due(dry);
got = claim();
sql(`select public.complete_reminder('${got[0]?.[0]}', 'dry_run', null, null)`);
q = reminderFor(dry);
check('a dry run sends nothing and is recorded as skipped (dry_run)', q?.[0] === 'skipped' && q?.[1] === 'dry_run', JSON.stringify(q));

// Quiet hours
r = await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: book(maria, { start_time: '12:00', end_time: '12:30', patient_phone: '09175550003' }) });
const quiet = r.json?.[0]?.id;
due(quiet);
setLocalHour(3);
check('at 3 am the doctor\'s time, nothing goes out', claim().length === 0 && reminderFor(quiet)?.[0] === 'pending');
setLocalHour(21);
check('at 9 pm the doctor\'s time, nothing goes out', claim().length === 0 && reminderFor(quiet)?.[0] === 'pending');
setLocalHour(12);
check('at noon it goes out', claim().length === 1);

// Cancelling withdraws a reminder that has not gone out
r = await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: book(maria, { start_time: '12:30', end_time: '13:00', patient_phone: '09175550004' }) });
const cancelled = r.json?.[0]?.id;
await call(`/rest/v1/appointments?id=eq.${cancelled}`, { method: 'PATCH', token: maria.token, body: { status: 'cancelled' } });
q = reminderFor(cancelled);
check('cancelling the appointment withdraws its reminder', q?.[0] === 'skipped' && q?.[1] === 'appointment_cancelled', JSON.stringify(q));

// A doctor switched off after booking
r = await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: book(maria, { start_time: '13:00', end_time: '13:30', patient_phone: '09175550005' }) });
const revoked = r.json?.[0]?.id;
due(revoked);
sql(`update public.profiles set sms_reminders_allowed = false where id = '${maria.id}'`);
claim();
q = reminderFor(revoked);
check('switching a doctor off stops reminders already queued', q?.[0] === 'skipped' && q?.[1] === 'not_allowed', JSON.stringify(q));
sql(`update public.profiles set sms_reminders_allowed = true where id = '${maria.id}'`);

// Limits
sql(`delete from public.appointments; update public.profiles set sms_monthly_cap = 1 where id = '${maria.id}'`);
const capA = (await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: book(maria, { start_time: '09:00', end_time: '09:30', patient_phone: '09175550011' }) })).json?.[0]?.id;
const capB = (await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: book(maria, { start_time: '09:30', end_time: '10:00', patient_phone: '09175550012' }) })).json?.[0]?.id;
due(capA); due(capB);
got = claim();
check('with a monthly cap of 1 only one reminder is claimed', got.length === 1, JSON.stringify(got));
check('the other is skipped with the reason doctor_monthly_cap', [reminderFor(capA), reminderFor(capB)].some(x => x?.[1] === 'doctor_monthly_cap'));

sql(`delete from public.appointments; update public.profiles set sms_monthly_cap = 20, sms_daily_cap = 2 where id = '${maria.id}'`);
const dayIds = [];
for (const [i, [st, en]] of [['09:00', '09:30'], ['09:30', '10:00'], ['10:00', '10:30']].entries()) {
  const id = (await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: book(maria, { start_time: st, end_time: en, patient_phone: `091755500${20 + i}` }) })).json?.[0]?.id;
  dayIds.push(id);
}
dayIds.filter(Boolean).forEach(due);
got = claim();
check('with a daily cap of 2 only two reminders are claimed', got.length === 2, JSON.stringify(got));
check('the third is skipped with the reason doctor_daily_cap', dayIds.some(id => reminderFor(id)?.[1] === 'doctor_daily_cap'));

sql(`delete from public.appointments; update public.profiles set sms_daily_cap = 50 where id = '${maria.id}'`);
const times = [['09:00', '09:30'], ['09:30', '10:00'], ['10:00', '10:30'], ['10:30', '11:00']];
const sameNumber = [];
for (const [s, e] of times) {
  const id = (await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: book(maria, { start_time: s, end_time: e, patient_phone: '09175550099', patient_name: `Same ${s}` }) })).json?.[0]?.id;
  sameNumber.push(id);
}
sameNumber.filter(Boolean).forEach(due);
got = claim();
check('one phone number gets at most 3 texts in 24 hours', got.length === 3, JSON.stringify(got));
check('the fourth is skipped with the reason patient_daily_cap', sameNumber.some(id => reminderFor(id)?.[1] === 'patient_daily_cap'));

// Deleting an appointment removes its queued reminder (and with the account, all of them)
const goner = sameNumber[0];
sql(`delete from public.appointments where id = '${goner}'`);
check('deleting an appointment deletes its reminder row', !reminderFor(goner));

sql(`update public.doctor_profiles set timezone = '${originalTz}' where user_id = '${maria.id}'`);
reset();
console.log(failures === 0 ? '\nAll reminder checks passed.' : `\n${failures} reminder check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
