import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
  AuthorizationStatus,
  TriggerType,
} from '@notifee/react-native';
import { fromZonedTime } from 'date-fns-tz';
import { Booking } from '../types';
import { getBookingPhase } from '../utils/bookingPhases';
import { formatDateWithDay, formatTimezone } from '../utils/dateHelpers';
import { formatTime } from '../utils/timeSlotGenerator';
import { logError } from '../utils/logger';

// Reminders are local notifications on the doctor's own phone; nothing about them is sent to a server.

const SETTINGS_KEY = '@docya_reminder_settings';
const SCHEDULED_KEY = '@docya_reminders';

export const REMINDER_LEADS = [15, 30, 60] as const;

// iOS keeps at most 64 pending local notifications per app; stay below that and top up on later syncs
export const MAX_SCHEDULED = 60;

export interface ReminderSettings {
  leadMinutes: number | null; // null = reminders off
  showPatientName: boolean; // lock screens show notifications, so patient names are opt-in
}

export const DEFAULT_SETTINGS: ReminderSettings = {
  leadMinutes: 30,
  showPatientName: false,
};

export const describeLead = (minutes: number): string =>
  minutes % 60 === 0
    ? minutes === 60
      ? '1 hour'
      : `${minutes / 60} hours`
    : `${minutes} minutes`;

export const loadSettings = async (): Promise<ReminderSettings> => {
  try {
    const parsed = JSON.parse(
      (await AsyncStorage.getItem(SETTINGS_KEY)) ?? 'null',
    );
    const leadOk =
      parsed &&
      (parsed.leadMinutes === null ||
        (REMINDER_LEADS as readonly number[]).includes(parsed.leadMinutes));
    if (leadOk && typeof parsed.showPatientName === 'boolean') {
      return {
        leadMinutes: parsed.leadMinutes,
        showPatientName: parsed.showPatientName,
      };
    }
  } catch (error) {
    logError('Ignoring unreadable reminder settings:', error);
  }
  return DEFAULT_SETTINGS;
};

export const saveSettings = async (
  settings: ReminderSettings,
): Promise<void> => {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

interface Scheduled {
  fireAt: number;
  leadMinutes: number;
  showPatientName: boolean;
}

const loadScheduled = async (): Promise<Record<string, Scheduled>> => {
  try {
    const parsed = JSON.parse(
      (await AsyncStorage.getItem(SCHEDULED_KEY)) ?? '{}',
    );
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
};

const notificationId = (appointmentId: string) => `appt-${appointmentId}`;

// When the reminder should fire (an absolute time, from the appointment's own time zone); null if that has passed
export const getReminderTime = (
  date: string,
  startTime: string,
  timezone: string,
  leadMinutes: number,
  now: number = Date.now(),
): number | null => {
  const fireAt =
    fromZonedTime(`${date}T${startTime}:00`, timezone).getTime() -
    leadMinutes * 60_000;
  return fireAt > now + 5_000 ? fireAt : null;
};

const isGranted = (status: AuthorizationStatus) =>
  status === AuthorizationStatus.AUTHORIZED ||
  status === AuthorizationStatus.PROVISIONAL;

export type PermissionState = 'granted' | 'denied' | 'undecided';

export const getPermission = async (): Promise<PermissionState> => {
  try {
    const { authorizationStatus } = await notifee.getNotificationSettings();
    if (isGranted(authorizationStatus)) return 'granted';
    return authorizationStatus === AuthorizationStatus.DENIED
      ? 'denied'
      : 'undecided';
  } catch (error) {
    logError('Could not read notification permission:', error);
    return 'undecided';
  }
};

// Asks the first time, never nags after a "Don't Allow"
export const ensurePermission = async (): Promise<boolean> => {
  const current = await getPermission();
  if (current !== 'undecided') return current === 'granted';
  try {
    const { authorizationStatus } = await notifee.requestPermission();
    return isGranted(authorizationStatus);
  } catch (error) {
    logError('Could not ask for notification permission:', error);
    return false;
  }
};

const contentFor = (
  booking: Booking,
  leadMinutes: number,
  showPatientName: boolean,
) => ({
  title:
    showPatientName && booking.patientName
      ? `Appointment with ${booking.patientName}`
      : 'Upcoming appointment',
  body: `In ${describeLead(leadMinutes)}: ${formatTime(
    booking.startTime,
  )}, ${formatDateWithDay(booking.date)} (${formatTimezone(
    booking.timezone,
  )} time)`,
});

export interface SyncResult {
  scheduled: number;
  cancelled: number;
  permission: PermissionState | 'not-needed';
}

// Serialise syncs: two screens can ask at once, and the stored list must not be overwritten half way
let queue: Promise<unknown> = Promise.resolve();
const enqueue = <T>(work: () => Promise<T>): Promise<T> => {
  const run = queue.then(work, work);
  queue = run.catch(() => undefined);
  return run;
};

// Makes the phone's pending reminders match the given appointments and the current settings:
// one for every upcoming confirmed appointment (soonest first, up to MAX_SCHEDULED), none for
// cancelled, completed or past ones. Safe to call as often as you like.
export const syncReminders = (
  bookings: Booking[],
  now: number = Date.now(),
): Promise<SyncResult> =>
  enqueue(async () => {
    const result: SyncResult = {
      scheduled: 0,
      cancelled: 0,
      permission: 'not-needed',
    };
    try {
      const settings = await loadSettings();
      if (settings.leadMinutes === null) {
        result.cancelled = Object.keys(await loadScheduled()).length;
        await cancelAllReminders();
        return result;
      }
      const lead = settings.leadMinutes;

      const wanted = bookings
        .filter(b => getBookingPhase(b, now) === 'upcoming')
        .map(booking => ({
          booking,
          fireAt: getReminderTime(
            booking.date,
            booking.startTime,
            booking.timezone,
            lead,
            now,
          ),
        }))
        .filter(
          (w): w is { booking: Booking; fireAt: number } => w.fireAt !== null,
        )
        .sort((a, b) => a.fireAt - b.fireAt)
        .slice(0, MAX_SCHEDULED);
      const wantedIds = new Set(wanted.map(w => w.booking.id));

      const scheduled = await loadScheduled();
      for (const [id, info] of Object.entries(scheduled)) {
        const stale =
          !wantedIds.has(id) ||
          info.leadMinutes !== lead ||
          info.showPatientName !== settings.showPatientName;
        if (stale) {
          await notifee.cancelTriggerNotification(notificationId(id));
          delete scheduled[id];
          result.cancelled++;
        }
      }

      const missing = wanted.filter(w => !scheduled[w.booking.id]);
      if (missing.length > 0) {
        if (await ensurePermission()) {
          result.permission = 'granted';
          for (const { booking, fireAt } of missing) {
            await notifee.createTriggerNotification(
              {
                id: notificationId(booking.id),
                ...contentFor(booking, lead, settings.showPatientName),
                ios: {
                  foregroundPresentationOptions: {
                    banner: true,
                    list: true,
                    sound: true,
                  },
                },
              },
              { type: TriggerType.TIMESTAMP, timestamp: fireAt },
            );
            scheduled[booking.id] = {
              fireAt,
              leadMinutes: lead,
              showPatientName: settings.showPatientName,
            };
            result.scheduled++;
          }
        } else {
          result.permission = 'denied';
        }
      }
      await AsyncStorage.setItem(SCHEDULED_KEY, JSON.stringify(scheduled));
    } catch (error) {
      logError('Could not sync reminders:', error);
    }
    return result;
  });

// A cancelled or completed appointment must not still ring
export const dropReminder = (appointmentId: string): Promise<void> =>
  enqueue(async () => {
    try {
      await notifee.cancelTriggerNotification(notificationId(appointmentId));
      const scheduled = await loadScheduled();
      if (scheduled[appointmentId]) {
        delete scheduled[appointmentId];
        await AsyncStorage.setItem(SCHEDULED_KEY, JSON.stringify(scheduled));
      }
    } catch (error) {
      logError('Could not drop a reminder:', error);
    }
  });

// On sign-out or account deletion nothing of this doctor may ring on a shared phone
export const cancelAllReminders = async (): Promise<void> => {
  try {
    await notifee.cancelTriggerNotifications();
    await AsyncStorage.removeItem(SCHEDULED_KEY);
  } catch (error) {
    logError('Could not cancel reminders:', error);
  }
};
