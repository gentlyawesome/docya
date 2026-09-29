// Exercises the local Supabase backend through its real HTTP API as different users.
// Prereqs: `supabase start` (applies migrations + seed.sql) and a .env with the local URL/anon key.
// Run: npm run backend:check   (wipes appointments in the LOCAL database first)
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const env = Object.fromEntries(
  readFileSync(new URL('../../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);
const URL_ = env.SUPABASE_URL;
const KEY = env.SUPABASE_ANON_KEY;
if (!URL_?.includes('127.0.0.1') && !URL_?.includes('localhost')) {
  throw new Error('Refusing to run: this check wipes data and only runs against a local Supabase.');
}
const DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const PASSWORD = 'Password123!';

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  -> ${detail}`}`);
  if (!ok) failures++;
};

const call = async (path, { method = 'GET', token, body, headers = {} } = {}) => {
  const res = await fetch(`${URL_}${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${token ?? KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
};

const signIn = async email => {
  const { status, json } = await call('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email, password: PASSWORD },
  });
  if (status !== 200) throw new Error(`sign-in failed for ${email}: ${status} ${JSON.stringify(json)}`);
  return { token: json.access_token, id: json.user.id };
};

const nextWeekday = () => {
  const d = new Date();
  do { d.setDate(d.getDate() + 1); } while ([0, 6].includes(d.getDay()));
  return d.toISOString().slice(0, 10);
};

const psql = sql => execFileSync('psql', [DB, '-X', '-q', '-c', sql]);
psql('delete from public.appointments');

const maria = await signIn('maria.santos@doctora.test');
const juan = await signIn('juan.delacruz@doctora.test');
const date = nextWeekday();
const slot = { appointment_date: date, start_time: '09:00', end_time: '09:30' };
const visit = (doctor, over = {}) => ({ ...slot, doctor_id: doctor.id, patient_name: 'Pat Patient', patient_phone: '+639175550001', ...over });

// --- Privacy
let r = await call('/rest/v1/profiles?select=email');
check('anonymous callers cannot read profiles', [401, 403].includes(r.status) || (r.status === 200 && r.json.length === 0), `${r.status}`);
r = await call('/rest/v1/appointments?select=id');
check('anonymous callers cannot read appointments', [401, 403].includes(r.status) || (r.status === 200 && r.json.length === 0), `${r.status}`);
r = await call('/rest/v1/doctor_profiles?select=user_id');
check('anonymous callers cannot read doctor profiles', [401, 403].includes(r.status) || (r.status === 200 && r.json.length === 0), `${r.status}`);

r = await call('/rest/v1/profiles?select=email,role', { token: maria.token });
check('a doctor sees only their own profile', r.json.length === 1 && r.json[0].email === 'maria.santos@doctora.test', JSON.stringify(r.json));
r = await call('/rest/v1/doctor_profiles?select=user_id', { token: maria.token });
check("a doctor cannot see other doctors' professional details", r.json.length === 1 && r.json[0].user_id === maria.id, JSON.stringify(r.json));
r = await call('/rest/v1/doctor_availability?select=id', { token: maria.token });
check('a doctor sees only their own working hours', r.json.length === 5, `${r.json.length}`);

// --- Scheduling
r = await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: visit(maria) });
check('a doctor can schedule a patient by name and it is confirmed immediately', r.status === 201 && r.json[0]?.status === 'confirmed' && r.json[0]?.patient_name === 'Pat Patient', JSON.stringify(r.json).slice(0, 140));
const appointmentId = r.json?.[0]?.id;

r = await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: visit(maria, { start_time: '09:30', end_time: '10:00', status: 'cancelled' }) });
check('an appointment cannot be created in another status', r.status >= 400, `${r.status}`);
r = await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: visit(maria, { patient_name: '   ' }) });
check('a patient name is required', r.status >= 400, `${r.status}`);
r = await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: visit(maria, { start_time: '10:00', end_time: '10:30', patient_phone: undefined }) });
check('the phone number is optional', r.status === 201, `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
r = await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: visit(maria, { patient_name: 'Someone Else' }) });
check('the same slot cannot be booked twice', r.status === 409, `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
r = await call('/rest/v1/appointments', { method: 'POST', token: juan.token, body: visit(maria, { start_time: '11:00', end_time: '11:30' }) });
check("a doctor cannot schedule into another doctor's calendar", r.status >= 400, `${r.status}`);
r = await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: { ...visit(maria, { start_time: '12:00', end_time: '12:30' }), patient_id: juan.id } });
check('there is no patient account to point at', r.status >= 400, `${r.status}`);
r = await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: visit(maria, { appointment_date: '2020-01-06' }) });
check('an appointment in the past is rejected', r.status >= 400, `${r.status}`);
r = await call('/rest/v1/appointments', { method: 'POST', body: visit(maria, { start_time: '13:00', end_time: '13:30' }) });
check('anonymous callers cannot schedule', r.status >= 400, `${r.status}`);

r = await call('/rest/v1/appointments?select=id,patient_name', { token: maria.token });
check('the doctor sees their appointments', r.status === 200 && r.json.length === 2, `${r.json.length}`);
r = await call('/rest/v1/appointments?select=id', { token: juan.token });
check("another doctor cannot see this doctor's appointments", r.status === 200 && r.json.length === 0);

// --- Changing an appointment
r = await call(`/rest/v1/appointments?id=eq.${appointmentId}`, { method: 'PATCH', token: juan.token, body: { status: 'cancelled' } });
check("a doctor cannot cancel another doctor's appointment", r.status >= 400 || r.json.length === 0, `${r.status}`);
r = await call(`/rest/v1/appointments?id=eq.${appointmentId}`, { method: 'PATCH', token: maria.token, body: { appointment_date: '2099-01-01' } });
check('an appointment cannot be moved', r.status >= 400 || r.json.length === 0, `${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
r = await call(`/rest/v1/appointments?id=eq.${appointmentId}`, { method: 'PATCH', token: maria.token, body: { notes: 'Bring test results' } });
check('the doctor can add private notes', r.status === 200 && r.json[0]?.notes === 'Bring test results', JSON.stringify(r.json).slice(0, 100));
r = await call(`/rest/v1/appointments?id=eq.${appointmentId}`, { method: 'PATCH', token: maria.token, body: { patient_name: 'Renamed' } });
check('the patient name cannot be rewritten afterwards', r.status >= 400 || r.json.length === 0, `${r.status}`);
r = await call(`/rest/v1/appointments?id=eq.${appointmentId}`, { method: 'PATCH', token: maria.token, body: { status: 'cancelled' } });
check('the doctor can cancel', r.status === 200 && r.json[0]?.status === 'cancelled', JSON.stringify(r.json).slice(0, 100));
r = await call(`/rest/v1/appointments?id=eq.${appointmentId}`, { method: 'PATCH', token: maria.token, body: { status: 'confirmed' } });
check('a cancelled appointment cannot be revived', r.status >= 400 || r.json.length === 0, `${r.status}`);
r = await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: visit(maria, { patient_name: 'Sam Sample' }) });
check('the cancelled slot can be given to someone else', r.status === 201, `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);

// --- Doctor fee
r = await call(`/rest/v1/doctor_profiles?user_id=eq.${maria.id}`, { method: 'PATCH', token: maria.token, body: { consultation_fee: 1750.5 } });
check('a doctor can change their own fee', r.status === 200 && Number(r.json[0]?.consultation_fee) === 1750.5, JSON.stringify(r.json).slice(0, 100));
r = await call(`/rest/v1/doctor_profiles?user_id=eq.${maria.id}`, { method: 'PATCH', token: juan.token, body: { consultation_fee: 1 } });
check("another doctor cannot change this doctor's fee", r.status === 200 && r.json.length === 0, `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
r = await call(`/rest/v1/doctor_profiles?user_id=eq.${maria.id}`, { method: 'PATCH', token: maria.token, body: { consultation_fee: -5 } });
check('a negative fee is rejected', r.status >= 400, `${r.status}`);

// --- Accounts: everyone who registers is a doctor
const email = `delete-me-${Date.now()}@doctora.test`;
r = await call('/auth/v1/signup', { method: 'POST', body: { email, password: PASSWORD, data: { first_name: 'Temp', last_name: 'Doc', specialization: 'Neurology' } } });
check('a new doctor can register and gets a session', r.status === 200 && !!r.json.access_token, JSON.stringify(r.json).slice(0, 100));
const temp = r.json;
r = await call('/rest/v1/doctor_profiles?select=specialization', { token: temp.access_token });
check('registration created the doctor profile row', r.status === 200 && r.json.length === 1 && r.json[0].specialization === 'Neurology', JSON.stringify(r.json));
r = await call('/rest/v1/profiles?select=role', { token: temp.access_token });
check('the account role is doctor', r.json?.[0]?.role === 'doctor', JSON.stringify(r.json));

const patientTry = `patient-try-${Date.now()}@doctora.test`;
r = await call('/auth/v1/signup', { method: 'POST', body: { email: patientTry, password: PASSWORD, data: { first_name: 'Pat', last_name: 'Try', role: 'patient' } } });
r = await call('/rest/v1/profiles?select=role', { token: r.json.access_token });
check('claiming to be a patient at sign-up does nothing (no patient role exists)', r.json?.[0]?.role === 'doctor', JSON.stringify(r.json));
psql(`delete from auth.users where email = '${patientTry}'`);

r = await call('/rest/v1/rpc/delete_my_account', { method: 'POST', token: temp.access_token, body: {} });
check('the doctor can delete their own account', r.status === 200 || r.status === 204, `${r.status} ${JSON.stringify(r.json)}`);
r = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password: PASSWORD } });
check('a deleted account can no longer sign in', r.status === 400, `${r.status}`);
r = await call('/rest/v1/rpc/delete_my_account', { method: 'POST', body: {} });
check('anonymous callers cannot call delete_my_account', r.status >= 400, `${r.status}`);

psql('delete from public.appointments; update public.doctor_profiles set consultation_fee = 1500 where user_id = \'' + maria.id + '\'');
console.log(failures === 0 ? '\nAll backend checks passed.' : `\n${failures} backend check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
