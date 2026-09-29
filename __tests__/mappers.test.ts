import {
  to12Hour,
  toAvailabilities,
  toBooking,
  toHHmm,
  AppointmentRow,
} from '../src/services/mappers';
import { mapSupabaseError } from '../src/services/supabaseErrors';
import {
  isValidEmail,
  isValidPassword,
  isValidPhone,
  isValidTimezone,
} from '../src/utils/validation';
import { generateDoctorTimeSlots } from '../src/utils/timeSlotGenerator';

describe('time conversion', () => {
  it('trims database times to HH:mm', () => {
    expect(toHHmm('09:30:00')).toBe('09:30');
  });

  it('converts to the 12-hour format the slot generator reads', () => {
    expect(to12Hour('09:00:00')).toBe('9:00AM');
    expect(to12Hour('12:00:00')).toBe('12:00PM');
    expect(to12Hour('12:30:00')).toBe('12:30PM');
    expect(to12Hour('00:15:00')).toBe('12:15AM');
    expect(to12Hour('17:30:00')).toBe('5:30PM');
  });
});

describe('working hours mapping', () => {
  const row = {
    doctor_availability: [
      {
        day_of_week: 'Monday',
        start_time: '09:00:00',
        end_time: '12:00:00',
        is_available: true,
      },
      {
        day_of_week: 'Tuesday',
        start_time: '09:00:00',
        end_time: '12:00:00',
        is_available: false,
      },
    ],
  };

  it('drops windows that are switched off and converts to the generator format', () => {
    expect(
      toAvailabilities('Maria Santos', 'Asia/Manila', row.doctor_availability),
    ).toEqual([
      {
        name: 'Maria Santos',
        timezone: 'Asia/Manila',
        day_of_week: 'Monday',
        available_at: '9:00AM',
        available_until: '12:00PM',
      },
    ]);
  });

  it('produces windows the slot generator turns into 30-minute slots', () => {
    const windows = toAvailabilities(
      'Maria',
      'Asia/Manila',
      row.doctor_availability,
    );
    // 2099-01-05 is a Monday
    const slots = generateDoctorTimeSlots(
      'd1',
      'Maria',
      windows,
      new Date(2099, 0, 5),
      1,
    );
    expect(slots.map(s => s.startTime)).toEqual([
      '09:00',
      '09:30',
      '10:00',
      '10:30',
      '11:00',
      '11:30',
    ]);
  });
});

describe('appointment mapping', () => {
  const base: AppointmentRow = {
    id: 'a1',
    doctor_id: 'd1',
    patient_name: 'Pat Patient',
    patient_phone: '+639175550001',
    appointment_date: '2099-01-01',
    start_time: '09:00:00',
    end_time: '09:30:00',
    status: 'confirmed',
    notes: 'bring results',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    doctor: {
      full_name: 'Maria Santos',
      doctor_profiles: { timezone: 'Asia/Manila' },
    },
  };

  it('maps to a Booking in the doctor time zone', () => {
    expect(toBooking(base)).toMatchObject({
      id: 'a1',
      doctorId: 'd1',
      doctorName: 'Maria Santos',
      patientName: 'Pat Patient',
      patientPhone: '+639175550001',
      date: '2099-01-01',
      startTime: '09:00',
      endTime: '09:30',
      dayOfWeek: 'Thursday',
      timezone: 'Asia/Manila',
      status: 'confirmed',
      notes: 'bring results',
    });
  });

  it('records when an appointment was cancelled and tolerates missing joins', () => {
    const cancelled = toBooking({ ...base, status: 'cancelled', doctor: null });
    expect(cancelled.cancelledAt).toBe('2026-01-02T00:00:00Z');
    expect(cancelled.doctorName).toBe('Doctor');
    expect(cancelled.timezone).toBe('UTC');
    expect(toBooking(base).cancelledAt).toBeUndefined();
  });
});

describe('mapSupabaseError', () => {
  it.each([
    ['Invalid login credentials', 'Invalid email or password.'],
    ['User already registered', 'An account with this email already exists.'],
    [
      'Password should be at least 6 characters',
      'Password must be at least 6 characters long.',
    ],
    ['Email not confirmed', 'Please confirm your email address, then sign in.'],
    [
      'TypeError: Network request failed',
      'Network error. Please check your internet connection.',
    ],
    ['JWT expired', 'Your session has expired. Please sign in again.'],
    [
      'new row violates row-level security policy',
      'You do not have permission to do that.',
    ],
    [
      'appointment_date must be today or in the future',
      'That time has already passed. Please choose a later slot.',
    ],
  ])('maps "%s"', (message, expected) => {
    expect(mapSupabaseError({ message })).toBe(expected);
  });

  it('maps a unique-violation code to a friendly double-booking message', () => {
    expect(mapSupabaseError({ message: 'whatever', code: '23505' })).toMatch(
      /just booked/,
    );
  });

  it('never leaks raw database text for unknown errors', () => {
    expect(
      mapSupabaseError({
        message: 'relation "x" does not exist at position 14',
      }),
    ).toBe('Something went wrong. Please try again.');
    expect(mapSupabaseError(undefined)).toBe(
      'Something went wrong. Please try again.',
    );
  });
});

describe('validation', () => {
  it('validates email, password and phone', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('nope')).toBe(false);
    expect(isValidEmail('a b@c.d')).toBe(false);
    expect(isValidPassword('12345')).toBe(false);
    expect(isValidPassword('123456')).toBe(true);
    expect(isValidPhone('')).toBe(true);
    expect(isValidPhone('+63 917 555 0001')).toBe(true);
    expect(isValidPhone('abc')).toBe(false);
  });


  it('validates IANA time zones', () => {
    expect(isValidTimezone('Asia/Manila')).toBe(true);
    expect(isValidTimezone('Mars/Olympus')).toBe(false);
  });
});
