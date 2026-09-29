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

execFileSync('psql', [DB, '-X', '-q', '-c', 'delete from public.appointments']);

const patient1 = await signIn('patient1@doctora.test');
const patient2 = await signIn('patient2@doctora.test');
const maria = await signIn('maria.santos@doctora.test');
const juan = await signIn('juan.delacruz@doctora.test');
const date = nextWeekday();
const slot = { appointment_date: date, start_time: '09:00', end_time: '09:30' };

// --- Privacy
let r = await call('/rest/v1/profiles?select=email');
check('anonymous callers cannot read profiles', [401, 403].includes(r.status) || (r.status === 200 && r.json.length === 0), `${r.status}`);

r = await call('/rest/v1/profiles?select=email,role', { token: patient1.token });
const emails = r.json.map(p => p.email);
check('a patient sees themselves and the 3 doctors', r.json.length === 4 && emails.includes('patient1@doctora.test'), emails.join());
check("a patient cannot see another patient's profile", !emails.includes('patient2@doctora.test'));

r = await call('/rest/v1/doctor_profiles?select=user_id');
check('anonymous callers cannot read doctor profiles', [401, 403].includes(r.status) || (r.status === 200 && r.json.length === 0), `${r.status}`);

// --- Booking
r = await call('/rest/v1/appointments', { method: 'POST', token: patient1.token, body: { ...slot, doctor_id: maria.id, patient_id: patient1.id } });
check('a patient can book a slot (starts as pending)', r.status === 201 && r.json[0]?.status === 'pending', JSON.stringify(r.json).slice(0, 120));
const appointmentId = r.json?.[0]?.id;

r = await call('/rest/v1/appointments', { method: 'POST', token: patient2.token, body: { ...slot, doctor_id: maria.id, patient_id: patient2.id } });
check('a second patient cannot double-book the same slot', r.status === 409, `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);

r = await call('/rest/v1/appointments', { method: 'POST', token: patient2.token, body: { ...slot, start_time: '10:00', end_time: '10:30', doctor_id: maria.id, patient_id: patient1.id } });
check('a patient cannot book on behalf of another patient', r.status >= 400, `${r.status}`);

r = await call('/rest/v1/appointments', { method: 'POST', token: patient1.token, body: { ...slot, start_time: '11:00', end_time: '11:30', doctor_id: patient2.id, patient_id: patient1.id } });
check('an appointment must be with a doctor', r.status >= 400, `${r.status}`);

r = await call('/rest/v1/rpc/get_booked_slots', { method: 'POST', token: patient2.token, body: { p_doctor_id: maria.id, p_from: date, p_to: date } });
check('other patients can see the slot is taken (times only)', r.status === 200 && r.json.length === 1 && r.json[0].start_time.startsWith('09:00') && !('patient_id' in r.json[0]), JSON.stringify(r.json));

r = await call('/rest/v1/appointments?select=id', { token: patient2.token });
check("a patient cannot read another patient's appointments", r.status === 200 && r.json.length === 0);

r = await call('/rest/v1/rpc/get_booked_slots', { method: 'POST', body: { p_doctor_id: maria.id, p_from: date, p_to: date } });
check('anonymous callers cannot look up booked slots', r.status >= 400, `${r.status}`);

// --- Doctor side
r = await call('/rest/v1/appointments?select=id,patient:profiles!patient_id(full_name)', { token: maria.token });
check('the doctor sees the appointment with the patient name', r.status === 200 && r.json.length === 1 && r.json[0].patient?.full_name === 'Pat Patient', JSON.stringify(r.json).slice(0, 120));

r = await call('/rest/v1/profiles?select=email&role=eq.patient', { token: maria.token });
check("the doctor sees only their own patients' profiles", r.json.length === 1 && r.json[0].email === 'patient1@doctora.test', JSON.stringify(r.json));

r = await call('/rest/v1/appointments?select=id', { token: juan.token });
check("another doctor cannot see this doctor's appointments", r.status === 200 && r.json.length === 0);

r = await call(`/rest/v1/appointments?id=eq.${appointmentId}`, { method: 'PATCH', token: patient1.token, body: { status: 'confirmed' } });
check('a patient cannot confirm their own appointment', !(r.status === 200 && r.json?.[0]?.status === 'confirmed'), JSON.stringify(r.json).slice(0, 100));

r = await call(`/rest/v1/appointments?id=eq.${appointmentId}`, { method: 'PATCH', token: maria.token, body: { status: 'confirmed' } });
check('the doctor can confirm it', r.status === 200 && r.json[0]?.status === 'confirmed', JSON.stringify(r.json).slice(0, 100));

// --- Cancelling frees the slot
r = await call(`/rest/v1/appointments?id=eq.${appointmentId}`, { method: 'PATCH', token: patient1.token, body: { status: 'cancelled' } });
check('the patient can cancel', r.status === 200 && r.json[0]?.status === 'cancelled', JSON.stringify(r.json).slice(0, 100));

r = await call('/rest/v1/appointments', { method: 'POST', token: patient2.token, body: { ...slot, doctor_id: maria.id, patient_id: patient2.id } });
check('the cancelled slot can be booked by someone else', r.status === 201, `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);

// --- Account deletion
const email = `delete-me-${Date.now()}@doctora.test`;
r = await call('/auth/v1/signup', { method: 'POST', body: { email, password: PASSWORD, data: { first_name: 'Temp', last_name: 'User', role: 'patient' } } });
check('a new patient can register and gets a session', r.status === 200 && !!r.json.access_token, JSON.stringify(r.json).slice(0, 100));
const temp = r.json;
r = await call('/rest/v1/patient_profiles?select=user_id', { token: temp.access_token });
check('registration created the patient profile row', r.status === 200 && r.json.length === 1);
r = await call('/rest/v1/rpc/delete_my_account', { method: 'POST', token: temp.access_token, body: {} });
check('the user can delete their own account', r.status === 200 || r.status === 204, `${r.status} ${JSON.stringify(r.json)}`);
r = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password: PASSWORD } });
check('a deleted account can no longer sign in', r.status === 400, `${r.status}`);
r = await call('/rest/v1/rpc/delete_my_account', { method: 'POST', body: {} });
check('anonymous callers cannot call delete_my_account', r.status >= 400, `${r.status}`);

r = await call('/auth/v1/signup', { method: 'POST', body: { email: `nobody-${Date.now()}@doctora.test`, password: PASSWORD } });
check('signing up without a role is rejected', r.status >= 400, `${r.status}`);

execFileSync('psql', [DB, '-X', '-q', '-c', 'delete from public.appointments']);
console.log(failures === 0 ? '\nAll backend checks passed.' : `\n${failures} backend check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
