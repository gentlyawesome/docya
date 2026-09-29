// API Response Types
export interface DoctorAvailability {
  name: string;
  timezone: string;
  day_of_week: string;
  available_at: string;
  available_until: string;
}

// Internal App Types
export interface Doctor {
  id: string;
  name: string;
  timezone: string;
  availabilities: DoctorAvailability[];
  specialty?: string;
  rating?: number;
  reviewCount?: number;
  fee?: number;
}

export type DoctorProfile = Pick<Doctor, 'specialty' | 'rating' | 'reviewCount' | 'fee'>;

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

export interface Booking {
  id: string;
  doctorId: string;
  doctorName: string;
  date: string; // ISO date string
  startTime: string;
  endTime: string;
  dayOfWeek: string;
  timezone: string;
  bookedAt: string; // ISO timestamp
  status?: BookingStatus; // missing on bookings saved before status existed = 'confirmed'
  cancelledAt?: string; // ISO timestamp
  reminderId?: string; // id of the scheduled local notification
  reminderLeadMinutes?: number;
}

export type BookingStatus = 'confirmed' | 'cancelled';
export type BookingPhase = 'upcoming' | 'completed' | 'cancelled';

export type DayOfWeek = 
  | 'Monday' 
  | 'Tuesday' 
  | 'Wednesday' 
  | 'Thursday' 
  | 'Friday' 
  | 'Saturday' 
  | 'Sunday';

// Navigation Types
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
};
