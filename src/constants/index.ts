export const API_URL = 'https://raw.githubusercontent.com/suyogshiftcare/jsontest/main/available.json';

export const SLOT_DURATION_MINUTES = 30;

export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export const STORAGE_KEYS = {
  BOOKINGS: '@doctora_bookings',
  DOCTORS_CACHE: '@doctora_doctors_cache',
  FAVORITES: '@doctora_favorites',
} as const;

export const COLORS = {
  primary: '#007AFF',
  secondary: '#5856D6',
  success: '#34C759',
  danger: '#FF3B30',
  warning: '#FF9500',
  background: '#F2F2F7',
  card: '#FFFFFF',
  text: '#000000',
  textSecondary: '#8E8E93',
  border: '#C6C6C8',
  disabled: '#D1D1D6',
} as const;

// SAMPLE DATA: the availability API has no ratings/specialty/fee fields, so these
// placeholder profiles (keyed by doctor id) are invented. They are shown in every build;
// set this to false (or replace them with real data) before any store submission.
export const SHOW_SAMPLE_DOCTOR_PROFILES = true;

export const SAMPLE_DOCTOR_PROFILES: Record<string, import('../types').DoctorProfile> = {
  'christy-schumm': { specialty: 'General Practitioner', rating: 4.8, reviewCount: 124, fee: 90 },
  'natalia-stanton-jr': { specialty: 'Paediatrician', rating: 4.6, reviewCount: 87, fee: 110 },
  'nola-murazik-v': { specialty: 'Dermatologist', rating: 4.4, reviewCount: 52, fee: 130 },
  'elyssa-okon': { specialty: 'Cardiologist', rating: 4.9, reviewCount: 203, fee: 160 },
  'dr-geovany-keebler': { specialty: 'Orthopaedic Surgeon', rating: 4.5, reviewCount: 71, fee: 150 },
  'ramy-malik': { specialty: 'General Practitioner', rating: 4.3, reviewCount: 40, fee: 85 },
};

export const REMINDER_OPTIONS: ReadonlyArray<{ label: string; minutes: number | null }> = [
  { label: 'Off', minutes: null },
  { label: '1 hour before', minutes: 60 },
  { label: '1 day before', minutes: 1440 },
];

export const DEFAULT_REMINDER_MINUTES = 60;
