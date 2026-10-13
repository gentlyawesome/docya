import type { NavigatorScreenParams } from '@react-navigation/native';
// Weekly availability window in the format the slot generator reads (e.g. " 9:00AM")
export interface DoctorAvailability {
  name: string;
  timezone: string;
  day_of_week: string;
  available_at: string;
  available_until: string;
}

export interface TimeSlot {
  id: string;
  doctorId: string;
  doctorName: string;
  date: string; // ISO date string
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  dayOfWeek: string;
  timezone: string;
  isBooked: boolean;
}

export type BookingStatus = 'confirmed' | 'cancelled' | 'completed';

// Where a patient text reminder stands (from the reminder_messages queue)
export type SmsReminderStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'skipped';
export interface SmsReminder {
  status: SmsReminderStatus;
  skipReason?: string;
}
export type BookingPhase = 'upcoming' | 'completed' | 'cancelled';

// An appointment as the app uses it (mapped from the `appointments` table)
export interface Booking {
  id: string;
  doctorId: string;
  doctorName: string;
  date: string; // ISO date string
  startTime: string;
  endTime: string;
  dayOfWeek: string;
  timezone: string; // the doctor's time zone; date and times are wall-clock times in it
  bookedAt: string; // ISO timestamp
  status?: BookingStatus; // missing = 'confirmed'
  cancelledAt?: string; // ISO timestamp
  patientName?: string;
  patientPhone?: string;
  patientConsentedSms?: boolean; // the patient agreed to a text reminder when booked
  smsReminder?: SmsReminder; // the queued or finished text reminder, if any
  reason?: string;
  notes?: string;
  reminderId?: string; // scheduled local notification (device-only)
  reminderLeadMinutes?: number;
}

export type DayOfWeek =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

// Accounts
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string;
}

export interface DoctorProfile {
  userId: string;
  specialization: string;
  timezone: string;
}

// Weekly availability row managed by a doctor
export interface AvailabilityWindow {
  id: string;
  doctorId: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  isAvailable: boolean;
}

// Navigation
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { email: string };
  ConfirmEmail: { email: string };
};

export type DoctorStackParamList = {
  DoctorTabs: NavigatorScreenParams<DoctorTabParamList> | undefined;
  DoctorNewAppointment: undefined;
  DoctorAppointmentDetail: { appointmentId: string };
};

export type DoctorTabParamList = {
  DoctorDashboard: undefined;
  DoctorAppointments: undefined;
  DoctorSchedule: undefined;
  DoctorProfile: undefined;
};
