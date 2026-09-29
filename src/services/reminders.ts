import notifee, { AndroidImportance, AuthorizationStatus, TriggerType } from '@notifee/react-native';
import { Booking } from '../types';
import { getReminderTime } from '../utils/bookingPhases';
import { formatDateWithDay, formatTimezone } from '../utils/dateHelpers';
import { formatTime12Hour } from '../utils/timeSlotGenerator';
import { logError } from '../utils/logger';

const CHANNEL_ID = 'appointments';

export type ReminderResult =
  | { status: 'scheduled'; reminderId: string; leadMinutes: number }
  | { status: 'denied' }
  | { status: 'too_soon' }
  | { status: 'error' };

export const describeLead = (minutes: number): string => {
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? '1 day before' : `${days} days before`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? '1 hour before' : `${hours} hours before`;
  }
  return `${minutes} minutes before`;
};

const ensurePermission = async (): Promise<boolean> => {
  const settings = await notifee.getNotificationSettings();
  const granted = (status: AuthorizationStatus) =>
    status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;

  if (granted(settings.authorizationStatus)) {
    return true;
  }
  if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
    return false;
  }
  const requested = await notifee.requestPermission();
  return granted(requested.authorizationStatus);
};

export const scheduleReminder = async (
  booking: Booking,
  leadMinutes: number
): Promise<ReminderResult> => {
  try {
    const fireAt = getReminderTime(booking.date, booking.startTime, booking.timezone, leadMinutes);
    if (fireAt === null) {
      return { status: 'too_soon' };
    }
    if (!(await ensurePermission())) {
      return { status: 'denied' };
    }

    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Appointment reminders',
      importance: AndroidImportance.HIGH,
    });

    const reminderId = `reminder-${booking.id}`;
    await notifee.createTriggerNotification(
      {
        id: reminderId,
        title: `Appointment with ${booking.doctorName}`,
        body: `${formatDateWithDay(booking.date)} at ${formatTime12Hour(
          booking.startTime
        )} (${formatTimezone(booking.timezone)} time)`,
        android: { channelId: CHANNEL_ID, pressAction: { id: 'default' } },
        ios: { foregroundPresentationOptions: { banner: true, list: true, sound: true } },
      },
      { type: TriggerType.TIMESTAMP, timestamp: fireAt }
    );
    return { status: 'scheduled', reminderId, leadMinutes };
  } catch (error) {
    logError('Failed to schedule reminder:', error);
    return { status: 'error' };
  }
};

export const cancelReminder = async (reminderId: string): Promise<void> => {
  try {
    await notifee.cancelTriggerNotification(reminderId);
  } catch (error) {
    logError('Failed to cancel reminder:', error);
  }
};
