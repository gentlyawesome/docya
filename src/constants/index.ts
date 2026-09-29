export const SLOT_DURATION_MINUTES = 30;

export const CURRENCY_SYMBOL = '₱';

export const PRIVACY_POLICY_URL = 'https://gentlyawesome.github.io/docya/privacy-policy.html';
export const SUPPORT_EMAIL = 'gentlyawesome@gmail.com';

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
  REMINDERS: '@doctora_reminders',
  DOCTORS_CACHE: '@doctora_doctors_cache',
  FAVORITES: '@doctora_favorites',
} as const;

export const COLORS = {
  primary: '#007AFF',
  secondary: '#5856D6',
  success: '#34C759',
  successDark: '#1E7E34',
  danger: '#FF3B30',
  warning: '#FF9500',
  background: '#F2F2F7',
  card: '#FFFFFF',
  text: '#000000',
  textSecondary: '#8E8E93',
  border: '#C6C6C8',
  disabled: '#D1D1D6',
} as const;

export const REMINDER_OPTIONS: ReadonlyArray<{ label: string; minutes: number | null }> = [
  { label: 'Off', minutes: null },
  { label: '1 hour before', minutes: 60 },
  { label: '1 day before', minutes: 1440 },
];

export const DEFAULT_REMINDER_MINUTES = 60;
