import React from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import * as appointments from '../src/services/appointmentsService';
import { supabase } from '../src/config/supabase';
import {
  DEFAULT_SETTINGS,
  MAX_SCHEDULED,
  cancelAllReminders,
  dropReminder,
  getReminderTime,
  loadSettings,
  saveSettings,
  syncReminders,
} from '../src/services/reminders';
import { ReminderSettings } from '../src/components/ReminderSettings';
import { booking } from './helpers/testStore';

jest.mock('../src/utils/logger');

const n = notifee as unknown as Record<string, jest.Mock>;
const setPermission = (status: AuthorizationStatus) => {
  n.getNotificationSettings.mockResolvedValue({ authorizationStatus: status });
  n.requestPermission.mockResolvedValue({ authorizationStatus: status });
};

// 09:00-09:30 Perth (UTC+8) on 2099-01-01 starts at 01:00 UTC
const START = Date.UTC(2099, 0, 1, 1, 0);
const NOW = Date.UTC(2098, 11, 31, 0, 0);
const at = (id: string, over = {}) =>
  booking({ id, patientName: 'Pat Patient', ...over });
const scheduledIds = () =>
  n.createTriggerNotification.mock.calls.map(c => c[0].id);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  setPermission(AuthorizationStatus.AUTHORIZED);
});

describe('getReminderTime', () => {
  it('is the appointment start, in its own time zone, minus the lead time', () => {
    expect(
      getReminderTime('2099-01-01', '09:00', 'Australia/Perth', 30, NOW),
    ).toBe(START - 30 * 60_000);
  });

  it('is null once that moment has passed', () => {
    expect(
      getReminderTime(
        '2099-01-01',
        '09:00',
        'Australia/Perth',
        30,
        START - 10 * 60_000,
      ),
    ).toBeNull();
    expect(
      getReminderTime(
        '2099-01-01',
        '09:00',
        'Australia/Perth',
        15,
        START - 10 * 60_000,
      ),
    ).toBeNull();
    expect(
      getReminderTime(
        '2099-01-01',
        '09:00',
        'Australia/Perth',
        15,
        START - 20 * 60_000,
      ),
    ).not.toBeNull();
  });
});

describe('settings', () => {
  it('start at 30 minutes with patient names hidden', async () => {
    expect(await loadSettings()).toEqual({
      leadMinutes: 30,
      showPatientName: false,
    });
    expect(DEFAULT_SETTINGS.showPatientName).toBe(false);
  });

  it('are remembered, and garbage falls back to the defaults', async () => {
    await saveSettings({ leadMinutes: 60, showPatientName: true });
    expect(await loadSettings()).toEqual({
      leadMinutes: 60,
      showPatientName: true,
    });
    await AsyncStorage.setItem(
      '@docya_reminder_settings',
      JSON.stringify({ leadMinutes: 7, showPatientName: 'yes' }),
    );
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
    await AsyncStorage.setItem('@docya_reminder_settings', 'not json');
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('syncReminders', () => {
  it('schedules a reminder before each upcoming appointment, at the right time', async () => {
    const result = await syncReminders([at('a')], NOW);
    expect(result).toMatchObject({ scheduled: 1, cancelled: 0 });
    const [notification, trigger] = n.createTriggerNotification.mock.calls[0];
    expect(notification.id).toBe('appt-a');
    expect(trigger.timestamp).toBe(START - 30 * 60_000);
    expect(notification.body).toContain('9:00 AM');
    expect(notification.body).toContain('In 30 minutes');
    expect(notification.body).toContain('Perth');
  });

  it('keeps the patient name off the lock screen unless the doctor turns it on', async () => {
    await syncReminders([at('a')], NOW);
    expect(n.createTriggerNotification.mock.calls[0][0].title).toBe(
      'Upcoming appointment',
    );
    expect(
      JSON.stringify(n.createTriggerNotification.mock.calls[0][0]),
    ).not.toContain('Pat Patient');

    await saveSettings({ leadMinutes: 30, showPatientName: true });
    await syncReminders([at('a')], NOW);
    const last = n.createTriggerNotification.mock.calls.at(-1)![0];
    expect(last.title).toBe('Appointment with Pat Patient');
  });

  it('does not schedule the same reminder twice', async () => {
    await syncReminders([at('a')], NOW);
    await syncReminders([at('a')], NOW);
    expect(n.createTriggerNotification).toHaveBeenCalledTimes(1);
  });

  it('ignores cancelled, completed and past appointments', async () => {
    const result = await syncReminders(
      [
        at('c', { status: 'cancelled' }),
        at('d', { status: 'completed' }),
        at('p', { date: '2020-01-01' }),
      ],
      NOW,
    );
    expect(result.scheduled).toBe(0);
    expect(n.createTriggerNotification).not.toHaveBeenCalled();
    expect(n.requestPermission).not.toHaveBeenCalled(); // nothing to remind about, nothing to ask for
  });

  it('cancels the reminder of an appointment that was cancelled', async () => {
    await syncReminders(
      [at('a'), at('b', { startTime: '10:00', endTime: '10:30' })],
      NOW,
    );
    const result = await syncReminders(
      [
        at('a'),
        at('b', { startTime: '10:00', endTime: '10:30', status: 'cancelled' }),
      ],
      NOW,
    );
    expect(result.cancelled).toBe(1);
    expect(n.cancelTriggerNotification).toHaveBeenCalledWith('appt-b');
    expect(n.cancelTriggerNotification).not.toHaveBeenCalledWith('appt-a');
  });

  it('re-plans everything when the lead time changes', async () => {
    await syncReminders([at('a')], NOW);
    await saveSettings({ leadMinutes: 60, showPatientName: false });
    await syncReminders([at('a')], NOW);
    expect(n.cancelTriggerNotification).toHaveBeenCalledWith('appt-a');
    expect(n.createTriggerNotification).toHaveBeenCalledTimes(2);
    expect(n.createTriggerNotification.mock.calls[1][1].timestamp).toBe(
      START - 60 * 60_000,
    );
  });

  it('cancels everything when reminders are turned off', async () => {
    await syncReminders([at('a')], NOW);
    await saveSettings({ leadMinutes: null, showPatientName: false });
    const result = await syncReminders([at('a')], NOW);
    expect(result.cancelled).toBe(1);
    expect(n.cancelTriggerNotifications).toHaveBeenCalled();
    n.createTriggerNotification.mockClear();
    await syncReminders([at('a')], NOW);
    expect(n.createTriggerNotification).not.toHaveBeenCalled();
  });

  it('asks for permission the first time and schedules once it is granted', async () => {
    setPermission(AuthorizationStatus.NOT_DETERMINED);
    n.requestPermission.mockResolvedValue({
      authorizationStatus: AuthorizationStatus.AUTHORIZED,
    });
    const result = await syncReminders([at('a')], NOW);
    expect(n.requestPermission).toHaveBeenCalledTimes(1);
    expect(result.scheduled).toBe(1);
  });

  it('does not schedule or ask again after "Don\'t Allow"', async () => {
    setPermission(AuthorizationStatus.DENIED);
    const result = await syncReminders([at('a')], NOW);
    expect(result).toMatchObject({ scheduled: 0, permission: 'denied' });
    expect(n.requestPermission).not.toHaveBeenCalled();
    expect(n.createTriggerNotification).not.toHaveBeenCalled();
  });

  it('schedules the soonest appointments first and stays under the iOS limit', async () => {
    const many = Array.from({ length: MAX_SCHEDULED + 10 }, (_, i) =>
      at(`x${i}`, {
        date: `2099-02-${String((i % 27) + 1).padStart(2, '0')}`,
        startTime: `${String(9 + Math.floor(i / 27)).padStart(2, '0')}:00`,
        endTime: `${String(9 + Math.floor(i / 27)).padStart(2, '0')}:30`,
      }),
    );
    const result = await syncReminders(many, NOW);
    expect(result.scheduled).toBe(MAX_SCHEDULED);
    const fireTimes = n.createTriggerNotification.mock.calls.map(
      c => c[1].timestamp,
    );
    expect(fireTimes).toEqual([...fireTimes].sort((a, b) => a - b));
  });

  it('never throws: a native failure just leaves the appointments alone', async () => {
    n.createTriggerNotification.mockRejectedValueOnce(new Error('native boom'));
    await expect(syncReminders([at('a')], NOW)).resolves.toBeDefined();
  });

  it('handles two syncs started together without duplicating', async () => {
    await Promise.all([
      syncReminders([at('a')], NOW),
      syncReminders([at('a')], NOW),
    ]);
    expect(scheduledIds()).toEqual(['appt-a']);
  });
});

describe('dropping and clearing', () => {
  it('drops the reminder of one appointment', async () => {
    await syncReminders(
      [at('a'), at('b', { startTime: '10:00', endTime: '10:30' })],
      NOW,
    );
    await dropReminder('a');
    expect(n.cancelTriggerNotification).toHaveBeenCalledWith('appt-a');
    n.createTriggerNotification.mockClear();
    await syncReminders(
      [at('a'), at('b', { startTime: '10:00', endTime: '10:30' })],
      NOW,
    );
    expect(scheduledIds()).toEqual(['appt-a']); // it was forgotten, so a later sync would plan it again if still upcoming
  });

  it('clears every reminder and the record of them', async () => {
    await syncReminders([at('a')], NOW);
    await cancelAllReminders();
    expect(n.cancelTriggerNotifications).toHaveBeenCalled();
    expect(await AsyncStorage.getItem('@docya_reminders')).toBeNull();
  });
});

describe('appointment service keeps reminders in step', () => {
  const from = supabase.from as unknown as jest.Mock;
  const chain = (result: unknown) => {
    const c: Record<string, jest.Mock> = {};
    ['select', 'update', 'eq', 'order'].forEach(m => (c[m] = jest.fn(() => c)));
    c.single = jest.fn(async () => result);
    (c as unknown as { then: unknown }).then = (res: (v: unknown) => unknown) =>
      Promise.resolve(result).then(res);
    return c;
  };
  const row = {
    id: 'a1',
    doctor_id: 'doctor-1',
    patient_name: 'Pat Patient',
    patient_phone: null,
    appointment_date: '2099-01-01',
    start_time: '09:00:00',
    end_time: '09:30:00',
    status: 'confirmed',
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    doctor: {
      full_name: 'Dana Doc',
      doctor_profiles: { timezone: 'Australia/Perth' },
    },
  };

  it('plans reminders whenever the list is fetched', async () => {
    from.mockReturnValue(chain({ data: [row], error: null }));
    const list = await appointments.listMyAppointments();
    expect(list).toHaveLength(1);
    await waitFor(() =>
      expect(n.createTriggerNotification).toHaveBeenCalledTimes(1),
    );
  });

  it('drops the reminder when an appointment is cancelled', async () => {
    from.mockReturnValue(
      chain({ data: { ...row, status: 'cancelled' }, error: null }),
    );
    await appointments.updateAppointmentStatus('a1', 'cancelled');
    expect(n.cancelTriggerNotification).toHaveBeenCalledWith('appt-a1');
  });
});

describe('Reminders card on the profile', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(appointments, 'listMyAppointments').mockResolvedValue([]);
  });

  const open = async () => {
    const { NavigationContainer } = require('@react-navigation/native');
    render(
      <NavigationContainer>
        <ReminderSettings />
      </NavigationContainer>,
    );
    await screen.findByText('Remind me before each appointment');
  };

  it('starts at 30 minutes with names off, and remembers a new choice', async () => {
    await open();
    expect(
      screen.getByRole('button', { name: '30 min filter', selected: true }),
    ).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: '1 hour filter' }));
    await waitFor(async () =>
      expect((await loadSettings()).leadMinutes).toBe(60),
    );
    expect(
      screen.getByRole('button', { name: '1 hour filter', selected: true }),
    ).toBeTruthy();
  });

  it('turns reminders off, and the name switch then has nothing to do', async () => {
    await open();
    fireEvent.press(screen.getByRole('button', { name: 'Off filter' }));
    await waitFor(async () =>
      expect((await loadSettings()).leadMinutes).toBeNull(),
    );
    expect(
      screen.getByLabelText('Show patient name in reminders').props.disabled ??
        true,
    ).toBeTruthy();
  });

  it('lets the doctor show patient names', async () => {
    await open();
    fireEvent(
      screen.getByLabelText('Show patient name in reminders'),
      'valueChange',
      true,
    );
    await waitFor(async () =>
      expect((await loadSettings()).showPatientName).toBe(true),
    );
  });

  it('asks for notification permission when reminders are chosen', async () => {
    setPermission(AuthorizationStatus.NOT_DETERMINED);
    await open();
    fireEvent.press(screen.getByRole('button', { name: '15 min filter' }));
    await waitFor(() => expect(n.requestPermission).toHaveBeenCalledTimes(1));
  });

  it('explains how to fix it when notifications are blocked in iOS Settings', async () => {
    setPermission(AuthorizationStatus.DENIED);
    await open();
    expect(
      await screen.findByText(/Notifications are turned off for Docya/),
    ).toBeTruthy();
    expect(screen.getByText('Open Settings')).toBeTruthy();
  });

  it('re-plans the reminders after a change by fetching the list', async () => {
    await open();
    fireEvent.press(screen.getByRole('button', { name: '15 min filter' }));
    await waitFor(() =>
      expect(appointments.listMyAppointments).toHaveBeenCalled(),
    );
  });
});
