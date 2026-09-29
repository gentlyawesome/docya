import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import { cancelBooking, loadBookings } from '../src/store/slices/bookingsSlice';
import * as appointments from '../src/services/appointmentsService';
import { loadReminders } from '../src/services/storage';
import { booking as makeBooking, signedIn } from './helpers/testStore';
import { describeLead, scheduleReminder } from '../src/services/reminders';
import { getReminderTime } from '../src/utils/bookingPhases';
import { Booking } from '../src/types';

jest.mock('../src/utils/logger');
jest.mock('../src/services/appointmentsService');
const svc = appointments as jest.Mocked<typeof appointments>;

const n = notifee as unknown as Record<string, jest.Mock>;
const setPermission = (status: AuthorizationStatus) => {
  n.getNotificationSettings.mockResolvedValue({ authorizationStatus: status });
  n.requestPermission.mockResolvedValue({ authorizationStatus: status });
};

const startUtc = Date.UTC(2099, 0, 1, 1, 0);
const booking: Booking = makeBooking();

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  setPermission(AuthorizationStatus.AUTHORIZED);
});

describe('getReminderTime', () => {
  it('is the doctor-local start minus the lead time', () => {
    expect(
      getReminderTime('2099-01-01', '09:00', 'Australia/Perth', 60, 0),
    ).toBe(startUtc - 3_600_000);
  });

  it('is null once that moment has passed', () => {
    const now = startUtc - 30 * 60_000; // 30 minutes before the appointment
    expect(
      getReminderTime('2099-01-01', '09:00', 'Australia/Perth', 60, now),
    ).toBeNull();
    expect(
      getReminderTime('2099-01-01', '09:00', 'Australia/Perth', 15, now),
    ).not.toBeNull();
  });
});

describe('describeLead', () => {
  it('formats common lead times', () => {
    expect(describeLead(60)).toBe('1 hour before');
    expect(describeLead(120)).toBe('2 hours before');
    expect(describeLead(1440)).toBe('1 day before');
    expect(describeLead(45)).toBe('45 minutes before');
  });
});

describe('scheduleReminder', () => {
  it('schedules a timestamp trigger at the right time with the booking details', async () => {
    const result = await scheduleReminder(booking, 60);
    expect(result).toEqual({
      status: 'scheduled',
      reminderId: 'reminder-b1',
      leadMinutes: 60,
    });
    const [notification, trigger] = n.createTriggerNotification.mock.calls[0];
    expect(notification.id).toBe('reminder-b1');
    expect(notification.title).toBe('Appointment with Dana Doc');
    expect(notification.body).toContain('9:00 AM');
    expect(notification.body).toContain('Perth');
    expect(trigger.timestamp).toBe(startUtc - 3_600_000);
  });

  it('asks for permission when it has not been decided yet', async () => {
    n.getNotificationSettings.mockResolvedValue({
      authorizationStatus: AuthorizationStatus.NOT_DETERMINED,
    });
    n.requestPermission.mockResolvedValue({
      authorizationStatus: AuthorizationStatus.AUTHORIZED,
    });
    expect((await scheduleReminder(booking, 60)).status).toBe('scheduled');
    expect(n.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('does not schedule or re-prompt when permission was denied', async () => {
    setPermission(AuthorizationStatus.DENIED);
    expect((await scheduleReminder(booking, 60)).status).toBe('denied');
    expect(n.requestPermission).not.toHaveBeenCalled();
    expect(n.createTriggerNotification).not.toHaveBeenCalled();
  });

  it('reports too_soon without prompting when the reminder time has passed', async () => {
    const soon = { ...booking, date: '2020-01-01' };
    expect((await scheduleReminder(soon, 60)).status).toBe('too_soon');
    expect(n.getNotificationSettings).not.toHaveBeenCalled();
  });

  it('returns an error result instead of throwing when the library fails', async () => {
    n.createTriggerNotification.mockRejectedValueOnce(new Error('native boom'));
    expect((await scheduleReminder(booking, 60)).status).toBe('error');
  });
});

describe('reminders follow the appointments a doctor schedules', () => {
  const created = makeBooking({ id: 'new-1' });
  beforeEach(() => {
    svc.listMyAppointments.mockResolvedValue([created]);
  });

  it('schedules a reminder for a new upcoming appointment and remembers it on the device', async () => {
    const store = signedIn();
    await store.dispatch(loadBookings()).unwrap();

    expect(n.createTriggerNotification).toHaveBeenCalledTimes(1);
    expect(await loadReminders()).toEqual({
      'new-1': { reminderId: 'reminder-new-1', leadMinutes: 60 },
    });
    const [saved] = store.getState().bookings.bookings;
    expect(saved.reminderId).toBe('reminder-new-1');
    expect(saved.reminderLeadMinutes).toBe(60);
  });

  it('does not schedule the same reminder twice when the list is refreshed', async () => {
    const store = signedIn();
    await store.dispatch(loadBookings()).unwrap();
    await store.dispatch(loadBookings()).unwrap();
    expect(n.createTriggerNotification).toHaveBeenCalledTimes(1);
  });

  it('cancels the reminder when the doctor cancels the appointment', async () => {
    const store = signedIn();
    await store.dispatch(loadBookings()).unwrap();

    svc.listMyAppointments.mockResolvedValue([
      { ...created, status: 'cancelled' },
    ]);
    await store.dispatch(loadBookings()).unwrap();

    expect(n.cancelTriggerNotification).toHaveBeenCalledWith('reminder-new-1');
    expect(await loadReminders()).toEqual({});
    expect(store.getState().bookings.bookings[0].reminderId).toBeUndefined();
  });

  it('cancels the reminder when the patient cancels', async () => {
    const store = signedIn();
    await store.dispatch(loadBookings()).unwrap();

    svc.updateAppointmentStatus.mockResolvedValue({
      ...created,
      status: 'cancelled',
    });
    svc.listMyAppointments.mockResolvedValue([
      { ...created, status: 'cancelled' },
    ]);
    await store.dispatch(cancelBooking('new-1')).unwrap();

    expect(n.cancelTriggerNotification).toHaveBeenCalledWith('reminder-new-1');
    expect(await loadReminders()).toEqual({});
  });

  it('skips appointments that are already in the past', async () => {
    svc.listMyAppointments.mockResolvedValue([
      makeBooking({ id: 'old', date: '2020-01-01' }),
    ]);
    const store = signedIn();
    await store.dispatch(loadBookings()).unwrap();
    expect(n.createTriggerNotification).not.toHaveBeenCalled();
    expect(await loadReminders()).toEqual({});
  });

  it('still shows the appointments when notifications are denied', async () => {
    setPermission(AuthorizationStatus.DENIED);
    const store = signedIn();
    await store.dispatch(loadBookings()).unwrap();
    expect(store.getState().bookings.bookings).toHaveLength(1);
    expect(n.createTriggerNotification).not.toHaveBeenCalled();
    expect(await loadReminders()).toEqual({});
  });

  it('still shows the appointments when scheduling throws', async () => {
    n.createTriggerNotification.mockRejectedValueOnce(new Error('native boom'));
    const store = signedIn();
    await store.dispatch(loadBookings()).unwrap();
    expect(store.getState().bookings.bookings).toHaveLength(1);
    expect(await loadReminders()).toEqual({});
  });
});
