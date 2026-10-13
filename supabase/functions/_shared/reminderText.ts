// Pure helpers for the send-reminders Edge Function. No Deno or network code here so Jest can test them.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// One SMS part is 160 characters only if every character is in the plain GSM alphabet; anything else (curly
// quotes, accents, emoji) switches to 70-character parts and the message costs more. Keep it plain ASCII.
export const MAX_REMINDER_LENGTH = 160;

export interface ReminderInput {
  doctorLastName: string | null;
  doctorPhone: string | null;
  appointmentDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM or HH:MM:SS
}

export const formatReminderDate = (isoDate: string): string => {
  const [y, m, d] = isoDate.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday}, ${MONTHS[m - 1]} ${d}`;
};

export const formatReminderTime = (time: string): string => {
  const [h, min] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(min).padStart(2, '0')} ${suffix}`;
};

const plain = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// The text names only the doctor, the day and the time. It never says what the visit is for.
export const buildReminderText = (input: ReminderInput): string => {
  const when = `${formatReminderDate(input.appointmentDate)} at ${formatReminderTime(input.startTime)}`;
  const phone = input.doctorPhone ? plain(input.doctorPhone) : '';
  const contact = phone ? `To change it, call ${phone}.` : 'To change it, contact the clinic.';
  const build = (who: string) => `Reminder: appointment with ${who} on ${when}. ${contact}`;

  const last = input.doctorLastName ? plain(input.doctorLastName) : '';
  let who = last ? `Dr. ${last}` : 'your doctor';
  let text = build(who);
  if (text.length > MAX_REMINDER_LENGTH) {
    who = 'your doctor';
    text = build(who);
  }
  return text.length > MAX_REMINDER_LENGTH ? text.slice(0, MAX_REMINDER_LENGTH) : text;
};

// Logs must not hold patient phone numbers: keep the country code and the last 3 digits.
export const maskPhone = (phone: string): string =>
  phone.length <= 7 ? '***' : `${phone.slice(0, 3)}${'*'.repeat(phone.length - 6)}${phone.slice(-3)}`;

// Semaphore takes 639XXXXXXXXX
export const toSemaphoreNumber = (e164: string): string => e164.replace(/^\+/, '');

export const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  /* eslint-disable no-bitwise -- constant-time comparison */
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  /* eslint-enable no-bitwise */
  return diff === 0;
};
