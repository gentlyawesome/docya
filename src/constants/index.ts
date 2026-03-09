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
