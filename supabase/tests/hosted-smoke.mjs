// Smoke test for a HOSTED Supabase project, using only the public (anon) key from .env.production.
// It registers one temporary doctor, exercises the main rules, then deletes that account again.
// Run: npm run hosted:smoke
//
// If the project requires an emailed code to confirm sign-up, the script stops after sign-up and
// tells you to finish that part by hand (it cannot read your inbox).
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../../.env.production', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
);
const URL_ = env.SUPABASE_URL;
const KEY = env.SUPABASE_ANON_KEY;
if (!URL_ || !KEY) throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY in .env.production');
if (/127\.0\.0\.1|localhost/.test(URL_)) throw new Error('.env.production points at a local stack, not a hosted project');

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  -> ${detail}`}`);
  if (!ok) failures++;
};
const call = async (path, { method = 'GET', token, body, headers = {} } = {}) => {
  const res = await fetch(`${URL_}${path}`, {
    method,
    headers: { apikey: KEY, Authorization: `Bearer ${token ?? KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
};

const email = `docya-smoke-${Date.now()}@example.com`;
const password = `Smoke-${Date.now()}!`;

let r = await call('/rest/v1/profiles?select=id');
check('anonymous callers cannot read profiles', [401, 403].includes(r.status) || (r.status === 200 && r.json.length === 0), `${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
r = await call('/rest/v1/appointments?select=id');
check('anonymous callers cannot read appointments', [401, 403].includes(r.status) || (r.status === 200 && r.json.length === 0), `${r.status}`);

r = await call('/auth/v1/signup', { method: 'POST', body: { email, password, data: { first_name: 'Smoke', last_name: 'Test', specialization: 'Testing' } } });
check('a doctor can register', r.status === 200, `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
if (r.status !== 200) process.exit(1);
if (!r.json.access_token) {
  console.log(`\nThis project asks for an emailed code to confirm sign-up, so the script cannot continue by itself.\nA temporary account ${email} was created; delete it in Authentication > Users.`);
  process.exit(failures === 0 ? 0 : 1);
}
const token = r.json.access_token;

r = await call('/rest/v1/profiles?select=role,email', { token });
check('their profile exists and is a doctor', r.json?.length === 1 && r.json[0].role === 'doctor', JSON.stringify(r.json));
r = await call('/rest/v1/doctor_profiles?select=specialization', { token });
check('their doctor profile exists', r.json?.[0]?.specialization === 'Testing', JSON.stringify(r.json));

const me = r.json && (await call('/auth/v1/user', { token })).json?.id;
r = await call('/rest/v1/doctor_availability?select=day_of_week,start_time,end_time', { token });
check('a new doctor starts with Monday-Friday 9 to 5 working hours', r.json?.length === 5 && r.json.every(h => h.start_time === '09:00:00' && h.end_time === '17:00:00'), JSON.stringify(r.json));
r = await call('/rest/v1/doctor_availability', { method: 'POST', token, body: { doctor_id: me, day_of_week: 'Monday', start_time: '09:00', end_time: '12:00' } });
check('a window overlapping the default hours is refused', r.status === 400, `${r.status}`);
r = await call('/rest/v1/doctor_availability', { method: 'POST', token, body: { doctor_id: me, day_of_week: 'Saturday', start_time: '09:00', end_time: '12:00' } });
check('they can set working hours', r.status === 201, `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);

const date = (() => { const d = new Date(); do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6); return d.toISOString().slice(0, 10); })();
const visit = { appointment_date: date, start_time: '09:00', end_time: '09:30', doctor_id: me, patient_name: 'Smoke Patient' };
r = await call('/rest/v1/appointments', { method: 'POST', token, body: visit });
check('they can schedule a patient (confirmed at once)', r.status === 201 && r.json[0]?.status === 'confirmed', `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
const id = r.json?.[0]?.id;
r = await call('/rest/v1/appointments', { method: 'POST', token, body: { ...visit, patient_name: 'Someone Else' } });
check('the same slot cannot be booked twice', r.status === 409, `${r.status}`);
r = await call('/rest/v1/appointments', { method: 'POST', token, body: { ...visit, start_time: '10:00', end_time: '10:30', status: 'cancelled' } });
check('an appointment cannot be created already cancelled', r.status >= 400, `${r.status}`);
r = await call(`/rest/v1/appointments?id=eq.${id}`, { method: 'PATCH', token, body: { status: 'cancelled' } });
check('they can cancel it', r.status === 200 && r.json[0]?.status === 'cancelled', `${r.status}`);
r = await call(`/rest/v1/appointments?id=eq.${id}`, { method: 'PATCH', token, body: { status: 'confirmed' } });
check('a cancelled appointment cannot be revived', r.status >= 400 || r.json.length === 0, `${r.status}`);

r = await call('/rest/v1/rpc/delete_my_account', { method: 'POST', token, body: {} });
check('they can delete their own account', r.status === 200 || r.status === 204, `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
r = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
check('the deleted account can no longer sign in', r.status === 400, `${r.status}`);

console.log(failures === 0 ? '\nHosted smoke test passed.' : `\n${failures} hosted check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
