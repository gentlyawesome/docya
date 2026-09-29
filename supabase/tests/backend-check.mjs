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

// --- Doctors schedule appointments for patients
r = await call('/rest/v1/appointments', { method: 'POST', token: patient1.token, body: { ...slot, doctor_id: maria.id, patient_id: patient1.id } });
check('a patient cannot book an appointment themselves', r.status >= 400, `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);

r = await call('/rest/v1/rpc/find_patient_by_email', { method: 'POST', token: patient1.token, body: { p_email: 'patient2@doctora.test' } });
check('a patient cannot look up other patients', r.status >= 400, `${r.status}`);
r = await call('/rest/v1/rpc/find_patient_by_email', { method: 'POST', body: { p_email: 'patient1@doctora.test' } });
check('anonymous callers cannot look up patients', r.status >= 400, `${r.status}`);

r = await call('/rest/v1/rpc/find_patient_by_email', { method: 'POST', token: maria.token, body: { p_email: ' Patient1@Doctora.test ' } });
check('a doctor finds a patient by exact email (any case), seeing only id and name', r.status === 200 && r.json.length === 1 && r.json[0].id === patient1.id && Object.keys(r.json[0]).sort().join() === 'full_name,id', JSON.stringify(r.json));
r = await call('/rest/v1/rpc/find_patient_by_email', { method: 'POST', token: maria.token, body: { p_email: 'patient' } });
check('a partial email finds nothing (no browsing)', r.status === 200 && r.json.length === 0, JSON.stringify(r.json));
r = await call('/rest/v1/rpc/find_patient_by_email', { method: 'POST', token: maria.token, body: { p_email: 'juan.delacruz@doctora.test' } });
check('a doctor cannot look up another doctor this way', r.status === 200 && r.json.length === 0, JSON.stringify(r.json));

r = await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: { ...slot, doctor_id: maria.id, patient_id: patient1.id } });
check('a doctor can schedule a patient and it is confirmed immediately', r.status === 201 && r.json[0]?.status === 'confirmed', JSON.stringify(r.json).slice(0, 120));
const appointmentId = r.json?.[0]?.id;

r = await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: { ...slot, start_time: '09:30', end_time: '10:00', status: 'cancelled', doctor_id: maria.id, patient_id: patient1.id } });
check('an appointment cannot be created in another status', r.status >= 400, `${r.status}`);

r = await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: { ...slot, doctor_id: maria.id, patient_id: patient2.id } });
check('the same slot cannot be booked twice', r.status === 409, `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);

r = await call('/rest/v1/appointments', { method: 'POST', token: juan.token, body: { ...slot, start_time: '10:00', end_time: '10:30', doctor_id: maria.id, patient_id: patient1.id } });
check("a doctor cannot schedule into another doctor's calendar", r.status >= 400, `${r.status}`);

r = await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: { ...slot, start_time: '11:00', end_time: '11:30', doctor_id: maria.id, patient_id: juan.id } });
check('an appointment must be with a patient', r.status >= 400, `${r.status}`);

r = await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: { appointment_date: '2020-01-06', start_time: '09:00', end_time: '09:30', doctor_id: maria.id, patient_id: patient1.id } });
check('an appointment in the past is rejected', r.status >= 400, `${r.status}`);

r = await call('/rest/v1/appointments?select=id,status', { token: patient1.token });
check('the patient sees the appointment their doctor made', r.status === 200 && r.json.length === 1 && r.json[0].status === 'confirmed', JSON.stringify(r.json));
r = await call('/rest/v1/appointments?select=id', { token: patient2.token });
check("a patient cannot read another patient's appointments", r.status === 200 && r.json.length === 0);
r = await call('/rest/v1/appointments?select=id', { token: juan.token });
check("another doctor cannot see this doctor's appointments", r.status === 200 && r.json.length === 0);

r = await call('/rest/v1/profiles?select=email&role=eq.patient', { token: maria.token });
check("the doctor sees only their own patients' profiles", r.json.length === 1 && r.json[0].email === 'patient1@doctora.test', JSON.stringify(r.json));

// --- Changing an appointment
r = await call(`/rest/v1/appointments?id=eq.${appointmentId}`, { method: 'PATCH', token: patient1.token, body: { appointment_date: '2099-01-01' } });
check('a patient cannot move an appointment', r.status >= 400 || r.json.length === 0, `${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
r = await call(`/rest/v1/appointments?id=eq.${appointmentId}`, { method: 'PATCH', token: patient2.token, body: { status: 'cancelled' } });
check("a patient cannot cancel someone else's appointment", r.status >= 400 || r.json.length === 0, `${r.status}`);
r = await call(`/rest/v1/appointments?id=eq.${appointmentId}`, { method: 'PATCH', token: patient1.token, body: { status: 'cancelled' } });
check('the patient can cancel', r.status === 200 && r.json[0]?.status === 'cancelled', JSON.stringify(r.json).slice(0, 100));
r = await call(`/rest/v1/appointments?id=eq.${appointmentId}`, { method: 'PATCH', token: maria.token, body: { status: 'confirmed' } });
check('a cancelled appointment cannot be revived', r.status >= 400 || r.json.length === 0, `${r.status}`);

r = await call('/rest/v1/appointments', { method: 'POST', token: maria.token, body: { ...slot, doctor_id: maria.id, patient_id: patient2.id } });
check('the cancelled slot can be given to someone else', r.status === 201, `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
const second = r.json?.[0]?.id;
r = await call(`/rest/v1/appointments?id=eq.${second}`, { method: 'PATCH', token: maria.token, body: { status: 'cancelled' } });
check('the doctor can cancel an appointment', r.status === 200 && r.json[0]?.status === 'cancelled', JSON.stringify(r.json).slice(0, 100));

// --- Doctor fee
r = await call(`/rest/v1/doctor_profiles?user_id=eq.${maria.id}`, { method: 'PATCH', token: maria.token, body: { consultation_fee: 1750.5 } });
check('a doctor can change their own fee', r.status === 200 && Number(r.json[0]?.consultation_fee) === 1750.5, JSON.stringify(r.json).slice(0, 100));

r = await call(`/rest/v1/doctor_profiles?user_id=eq.${maria.id}`, { method: 'PATCH', token: juan.token, body: { consultation_fee: 1 } });
check("another doctor cannot change this doctor's fee", r.status === 200 && r.json.length === 0, `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);

r = await call(`/rest/v1/doctor_profiles?user_id=eq.${maria.id}`, { method: 'PATCH', token: patient1.token, body: { consultation_fee: 1 } });
check("a patient cannot change a doctor's fee", r.status >= 400 || r.json.length === 0, `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);

r = await call(`/rest/v1/doctor_profiles?user_id=eq.${maria.id}`, { method: 'PATCH', token: maria.token, body: { consultation_fee: -5 } });
check('a negative fee is rejected', r.status >= 400, `${r.status}`);

r = await call('/rest/v1/doctor_profiles?select=consultation_fee&user_id=eq.' + maria.id, { token: patient1.token });
check('patients see the updated fee', Number(r.json[0]?.consultation_fee) === 1750.5, JSON.stringify(r.json));

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

execFileSync('psql', [DB, '-X', '-q', '-c', 'delete from public.appointments; update public.doctor_profiles set consultation_fee = 1500 where user_id = \'' + maria.id + '\'']);
console.log(failures === 0 ? '\nAll backend checks passed.' : `\n${failures} backend check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
