import { isValidPhone } from '../src/utils/validation';
import {
  deviceUses24HourClock,
  formatTime,
} from '../src/utils/timeSlotGenerator';
import { buildDataExport } from '../src/services/dataExport';
import * as appointments from '../src/services/appointmentsService';
import * as availability from '../src/services/availabilityService';
import * as users from '../src/services/userService';
import { booking, doctorUser } from './helpers/testStore';

jest.mock('../src/utils/logger');
jest.mock('../src/services/appointmentsService');
jest.mock('../src/services/availabilityService');
jest.mock('../src/services/userService');

describe('phone numbers from around the world', () => {
  it.each([
    '+63 917 123 4567',
    '+1 (555) 013-6000',
    '+44 7700 900123',
    '0917.123.4567',
    '+81-90-1234-5678',
    '',
  ])('accepts %s', value => expect(isValidPhone(value)).toBe(true));

  it.each(['abc', '12', 'call me', '+63 917 ext 4'])('rejects %s', value =>
    expect(isValidPhone(value)).toBe(false),
  );
});

describe('times follow the phone clock', () => {
  const original = Date.prototype.toLocaleTimeString;
  afterEach(() => {
    Date.prototype.toLocaleTimeString = original;
  });

  it('shows 12-hour times on a 12-hour phone', () => {
    expect(deviceUses24HourClock()).toBe(false);
    expect(formatTime('13:30')).toBe('1:30 PM');
  });

  it('shows 24-hour times on a 24-hour phone', () => {
    Date.prototype.toLocaleTimeString = () => '13';
    expect(deviceUses24HourClock()).toBe(true);
    expect(formatTime('13:30')).toBe('13:30');
    expect(formatTime('09:00')).toBe('09:00');
  });
});

describe('data export', () => {
  it('collects the profile, working hours and appointments as JSON', async () => {
    (users.getDoctorProfile as jest.Mock).mockResolvedValue({
      userId: doctorUser.id,
      specialization: 'Cardiology',
      timezone: 'Asia/Manila',
    });
    (availability.listMyAvailability as jest.Mock).mockResolvedValue([
      {
        id: 'w1',
        doctorId: doctorUser.id,
        dayOfWeek: 'Monday',
        startTime: '09:00',
        endTime: '17:00',
        isAvailable: true,
      },
    ]);
    (appointments.listMyAppointments as jest.Mock).mockResolvedValue([
      booking({
        patientName: 'Sam Rivera',
        patientPhone: '+1 555 0136',
        notes: 'Follow-up',
      }),
    ]);
    const data = JSON.parse(await buildDataExport(doctorUser));
    expect(data.app).toBe('Docya');
    expect(data.account).toMatchObject({
      email: doctorUser.email,
      specialization: 'Cardiology',
      timeZone: 'Asia/Manila',
    });
    expect(data.workingHours).toEqual([
      { day: 'Monday', from: '09:00', to: '17:00', available: true },
    ]);
    expect(data.appointments[0]).toMatchObject({
      patientName: 'Sam Rivera',
      patientPhone: '+1 555 0136',
      notes: 'Follow-up',
    });
    expect(data.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
