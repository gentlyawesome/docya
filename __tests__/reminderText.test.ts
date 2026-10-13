import {
  buildReminderText,
  formatReminderDate,
  formatReminderTime,
  maskPhone,
  MAX_REMINDER_LENGTH,
  timingSafeEqual,
  toSemaphoreNumber,
} from '../supabase/functions/_shared/reminderText';

describe('reminder text', () => {
  const base = { doctorLastName: 'Santos', doctorPhone: '+639171234567', appointmentDate: '2026-10-14', startTime: '10:30:00' };

  it('names the doctor, the day and the time, and how to change it', () => {
    expect(buildReminderText(base)).toBe(
      'Reminder: appointment with Dr. Santos on Wed, Oct 14 at 10:30 AM. To change it, call +639171234567.',
    );
  });

  it('falls back to the clinic when the doctor has no phone', () => {
    expect(buildReminderText({ ...base, doctorPhone: null })).toContain('To change it, contact the clinic.');
  });

  it('never says what the visit is for', () => {
    const text = buildReminderText(base).toLowerCase();
    ['check-up', 'dental', 'therapy', 'consultation', 'follow-up', 'cardio'].forEach(word => expect(text).not.toContain(word));
  });

  it('stays within one SMS and plain ASCII', () => {
    const text = buildReminderText({ ...base, doctorLastName: "Dela Cruz-Ñúñez “the Great”" });
    expect(text.length).toBeLessThanOrEqual(MAX_REMINDER_LENGTH);
    expect(/^[\x20-\x7E]*$/.test(text)).toBe(true);
  });

  it('drops the doctor name rather than overflow a message', () => {
    const text = buildReminderText({ ...base, doctorLastName: 'A'.repeat(120), doctorPhone: '+63 917 123 4567' });
    expect(text.length).toBeLessThanOrEqual(MAX_REMINDER_LENGTH);
    expect(text).toContain('your doctor');
  });

  it('formats dates and times', () => {
    expect(formatReminderDate('2026-01-01')).toBe('Thu, Jan 1');
    expect(formatReminderTime('00:05')).toBe('12:05 AM');
    expect(formatReminderTime('12:00:00')).toBe('12:00 PM');
    expect(formatReminderTime('17:45:00')).toBe('5:45 PM');
  });
});

describe('helpers', () => {
  it('masks phone numbers for logs', () => {
    expect(maskPhone('+639171234567')).toBe('+63*******567');
    expect(maskPhone('123')).toBe('***');
  });

  it('turns +63 numbers into the form Semaphore takes', () => {
    expect(toSemaphoreNumber('+639171234567')).toBe('639171234567');
  });

  it('compares secrets without short-circuiting on content', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('', '')).toBe(true);
  });
});
