// Fills the LOCAL database with invented appointments for the seeded doctor Maria Santos, so the
// App Store screenshots look like a real working day. Run: node store/demo-data.mjs
// Refuses anything but the local database. Undo with: supabase db reset
import { execFileSync } from 'node:child_process';

const DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'; // the local Supabase, never a hosted one
const DOCTOR = 'b1a2c3d4-5e6f-4a8b-9c0d-1e2f3a4b5c6d'; // Maria Santos in supabase/seed.sql
const ZONE = 'America/New_York'; // pick a zone where it is mid-morning while you take the pictures

const parts = (date, tz) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(date)
      .map(p => [p.type, p.value]),
  );
const now = parts(new Date(), ZONE);
const nowMinutes = Number(now.hour) * 60 + Number(now.minute);

// Weekdays only, starting today (or the next weekday)
const days = [];
const cursor = new Date(Date.UTC(Number(now.year), Number(now.month) - 1, Number(now.day)));
while (days.length < 3) {
  if (![0, 6].includes(cursor.getUTCDay())) days.push(cursor.toISOString().slice(0, 10));
  cursor.setUTCDate(cursor.getUTCDate() + 1);
}
const today = `${now.year}-${now.month}-${now.day}`;

const plan = [
  [0, '10:30', 'Ana Cruz', '+1 555 0142', 'Follow-up: blood pressure check'],
  [0, '11:30', 'Ben Harper', '+1 555 0177', null],
  [0, '14:00', 'Carla Mendes', '+1 555 0113', 'Bring recent lab results'],
  [1, '09:00', 'Daniel Okafor', '+1 555 0165', null],
  [1, '10:00', 'Elena Petrova', '+1 555 0128', null],
  [1, '13:30', 'Farid Nasser', '+1 555 0190', null],
  [2, '09:30', 'Grace Lin', '+1 555 0151', null],
  [2, '11:00', 'Hugo Almeida', '+1 555 0104', null],
];
const q = v => (v === null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const addHalfHour = hm => {
  const [h, m] = hm.split(':').map(Number);
  const t = h * 60 + m + 30;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

const rows = plan.filter(([offset, hm]) => {
  if (days[offset] !== today) return true;
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m > nowMinutes + 45; // today's visits must still be ahead of us
});
const sql = [
  `update public.doctor_profiles set timezone = '${ZONE}', specialization = 'Cardiology' where user_id = '${DOCTOR}'`,
  'delete from public.appointments',
  ...rows.map(
    ([offset, hm, name, phone, note]) =>
      `insert into public.appointments (doctor_id, appointment_date, start_time, end_time, status, patient_name, patient_phone, notes) values ('${DOCTOR}', '${days[offset]}', '${hm}', '${addHalfHour(hm)}', 'confirmed', ${q(name)}, ${q(phone)}, ${q(note)})`,
  ),
];
execFileSync('psql', [DB, '-X', '-q', '-c', sql.join(';\n')], { stdio: 'inherit' });
console.log(`Doctor time zone ${ZONE}, now ${now.hour}:${now.minute}. Added ${rows.length} appointments.`);
