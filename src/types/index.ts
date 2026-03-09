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
}

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
