import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import doctorsReducer from '../src/store/slices/doctorsSlice';
import favoritesReducer from '../src/store/slices/favoritesSlice';
import bookingsReducer, {
  cancelBooking,
  createBooking,
} from '../src/store/slices/bookingsSlice';
import { describeLead, scheduleReminder } from '../src/services/reminders';
import { getReminderTime } from '../src/utils/bookingPhases';
import { BookingConfirmationScreen } from '../src/screens/BookingConfirmationScreen';
import { Booking, Doctor, TimeSlot } from '../src/types';

jest.mock('../src/utils/logger');

const n = notifee as unknown as Record<string, jest.Mock>;
const setPermission = (status: AuthorizationStatus) => {
  n.getNotificationSettings.mockResolvedValue({ authorizationStatus: status });
  n.requestPermission.mockResolvedValue({ authorizationStatus: status });
};

const makeStore = () =>
  configureStore({
    reducer: {
      doctors: doctorsReducer,
      bookings: bookingsReducer,
      favorites: favoritesReducer,
    },
  });

// 09:00 Perth (UTC+8) on 2099-01-01 is 01:00 UTC
const slot: TimeSlot = {
  id: 's',
  doctorId: 'd1',
  doctorName: 'Ann Lee',
  date: '2099-01-01',
  startTime: '09:00',
  endTime: '09:30',
  dayOfWeek: 'Thursday',
  timezone: 'Australia/Perth',
  isBooked: false,
};
const startUtc = Date.UTC(2099, 0, 1, 1, 0);

const booking: Booking = {
  id: 'b1',
  doctorId: 'd1',
  doctorName: 'Ann Lee',
  date: '2099-01-01',
  startTime: '09:00',
  endTime: '09:30',
  dayOfWeek: 'Thursday',
  timezone: 'Australia/Perth',
  bookedAt: '2026-01-01T00:00:00Z',
};

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
    expect(notification.title).toBe('Appointment with Ann Lee');
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

describe('booking + reminder lifecycle', () => {
  it('stores the reminder on the booking and cancels it when the booking is cancelled', async () => {
    const store = makeStore();
    const { reminder } = await store
      .dispatch(createBooking({ timeSlot: slot, reminderLeadMinutes: 1440 }))
      .unwrap();
    expect(reminder?.status).toBe('scheduled');

    const [saved] = store.getState().bookings.bookings;
    expect(saved.reminderId).toBe(`reminder-${saved.id}`);
    expect(saved.reminderLeadMinutes).toBe(1440);

    await store.dispatch(cancelBooking(saved.id)).unwrap();
    expect(n.cancelTriggerNotification).toHaveBeenCalledWith(
      `reminder-${saved.id}`,
    );
    const [cancelled] = store.getState().bookings.bookings;
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.reminderId).toBeUndefined();
    expect(cancelled.reminderLeadMinutes).toBeUndefined();
  });

  it('still books when notifications are denied, and records no reminder', async () => {
    setPermission(AuthorizationStatus.DENIED);
    const store = makeStore();
    const { reminder } = await store
      .dispatch(createBooking({ timeSlot: slot, reminderLeadMinutes: 60 }))
      .unwrap();
    expect(reminder?.status).toBe('denied');
    const [saved] = store.getState().bookings.bookings;
    expect(saved.reminderId).toBeUndefined();
  });

  it('does not touch notifications when reminders are off', async () => {
    const store = makeStore();
    const { reminder } = await store
      .dispatch(createBooking({ timeSlot: slot }))
      .unwrap();
    expect(reminder).toBeNull();
    expect(n.getNotificationSettings).not.toHaveBeenCalled();
  });
});

describe('confirmation screen reminder choices', () => {
  const doctor: Doctor = {
    id: 'd1',
    name: 'Ann Lee',
    timezone: 'Australia/Perth',
    availabilities: [],
  };
  const renderScreen = (timeSlot: TimeSlot) =>
    render(
      <Provider store={makeStore()}>
        <BookingConfirmationScreen
          navigation={{ goBack: jest.fn(), reset: jest.fn() } as never}
          route={{ params: { doctor, timeSlot } } as never}
        />
      </Provider>,
    );

  it('offers every option for a far-off appointment, with 1 hour preselected', () => {
    renderScreen(slot);
    expect(screen.getByRole('button', { name: 'Off filter' })).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: '1 hour before filter',
        selected: true,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '1 day before filter' }),
    ).toBeTruthy();
  });

  it('hides options whose time has already passed', () => {
    const inThirtyMinutes = new Date(Date.now() + 30 * 60_000);
    const perth = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Australia/Perth',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(inThirtyMinutes);
    const part = (t: string) => perth.find(p => p.type === t)!.value;
    renderScreen({
      ...slot,
      date: `${part('year')}-${part('month')}-${part('day')}`,
      startTime: `${part('hour')}:${part('minute')}`,
    });
    expect(screen.getByRole('button', { name: 'Off filter' })).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: '1 hour before filter' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: '1 day before filter' }),
    ).toBeNull();
  });
});
