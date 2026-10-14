import { supabase } from '../config/supabase';
import { Booking } from '../types';
import { logError } from '../utils/logger';
import { mapSupabaseError } from './supabaseErrors';

// Patient text reminders: a doctor is switched on by the operator, then chooses how long before the visit the
// patient is texted. Everything else (the queue, the limits, the sending) happens on the server.

export const SMS_LEADS = [1440, 120] as const;
export type SmsLead = (typeof SMS_LEADS)[number];

export interface SmsSettings {
  allowed: boolean;
  leadMinutes: SmsLead;
}

export const NO_SMS: SmsSettings = { allowed: false, leadMinutes: 1440 };

// Never throws: if the settings cannot be read, reminders simply are not offered
export const getSmsSettings = async (userId: string): Promise<SmsSettings> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('sms_reminders_allowed, sms_reminder_lead_minutes')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) {
      return NO_SMS;
    }
    return {
      allowed: data.sms_reminders_allowed === true,
      leadMinutes: data.sms_reminder_lead_minutes === 120 ? 120 : 1440,
    };
  } catch (e) {
    logError('Could not read text reminder settings', e);
    return NO_SMS;
  }
};

export const saveSmsLead = async (
  userId: string,
  leadMinutes: SmsLead,
): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .update({ sms_reminder_lead_minutes: leadMinutes })
    .eq('id', userId);
  if (error) {
    throw new Error(mapSupabaseError(error));
  }
};

export const leadText = (leadMinutes: SmsLead): string =>
  leadMinutes === 120 ? '2 hours before' : '24 hours before';

export type ReminderTone = 'good' | 'warn' | 'muted';
export interface ReminderNote {
  text: string;
  tone: ReminderTone;
}

const SKIPPED: Record<string, ReminderNote> = {
  dry_run: {
    text: 'Not sent: text reminders are in test mode.',
    tone: 'muted',
  },
  too_late: { text: 'Not sent: booked too close to the visit.', tone: 'muted' },
  appointment_cancelled: {
    text: 'Withdrawn: the appointment was cancelled.',
    tone: 'muted',
  },
  appointment_completed: {
    text: 'Not sent: the appointment is completed.',
    tone: 'muted',
  },
  expired: { text: 'Not sent: the visit had already started.', tone: 'muted' },
  not_allowed: {
    text: 'Not sent: text reminders are off for your account.',
    tone: 'warn',
  },
  doctor_daily_cap: {
    text: 'Not sent: you reached your daily limit of texts.',
    tone: 'warn',
  },
  doctor_monthly_cap: {
    text: 'Not sent: you reached your monthly limit of texts.',
    tone: 'warn',
  },
  patient_daily_cap: {
    text: 'Not sent: this number already got the most texts allowed today.',
    tone: 'warn',
  },
};

// What to tell the doctor about the text reminder for one appointment, or nothing when none was asked for
export const describeReminder = (booking: Booking): ReminderNote | null => {
  const reminder = booking.smsReminder;
  if (!reminder) {
    return booking.patientConsentedSms
      ? {
          text: 'Not sent: text reminders were off for your account when this was booked.',
          tone: 'muted',
        }
      : null;
  }
  switch (reminder.status) {
    case 'pending':
      return {
        text: 'Scheduled: the patient will be texted before the visit.',
        tone: 'good',
      };
    case 'sending':
      return { text: 'Sending the text now.', tone: 'good' };
    case 'sent':
      return { text: 'Sent: the patient was texted.', tone: 'good' };
    case 'failed':
      return {
        text: 'The text could not be sent. Please remind the patient yourself.',
        tone: 'warn',
      };
    default:
      return (
        SKIPPED[reminder.skipReason ?? ''] ?? {
          text: 'Not sent.',
          tone: 'muted',
        }
      );
  }
};
