// Weekly availability window in the format the slot generator reads (e.g. " 9:00AM")
export interface DoctorAvailability {
  name: string;
  timezone: string;
  day_of_week: string;
  available_at: string;
  available_until: string;
}

export interface Doctor {
  id: string;
  name: string;
  timezone: string;
  availabilities: DoctorAvailability[];
  specialty?: string;
  fee?: number;
  clinicName?: string;
  bio?: string;
  rating?: number;
  reviewCount?: number;
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

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
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
  patientId?: string;
  patientName?: string;
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
export type UserRole = 'patient' | 'doctor';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: UserRole;
  phone?: string;
}

export interface PatientProfile {
  userId: string;
  dateOfBirth?: string; // YYYY-MM-DD
  gender?: string;
  address?: string;
}

export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export interface DoctorProfile {
  userId: string;
  specialization: string;
  clinicName?: string;
  consultationFee?: number;
  bio?: string;
  timezone: string;
  verificationStatus: VerificationStatus;
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
};

// Patient navigator (root stack over the patient tabs)
export type RootStackParamList = {
  MainTabs: undefined;
  DoctorDetail: { doctor: Doctor };
  BookingConfirmation: {
    doctor: Doctor;
    timeSlot: TimeSlot;
  };
};

export type MainTabParamList = {
  DoctorsList: undefined;
  MyBookings: undefined;
  Profile: undefined;
};

export type DoctorStackParamList = {
  DoctorTabs: undefined;
  DoctorAppointmentDetail: { appointmentId: string };
};

export type DoctorTabParamList = {
  DoctorDashboard: undefined;
  DoctorAppointments: undefined;
  DoctorSchedule: undefined;
  DoctorProfile: undefined;
};
