export const SLOT_DURATION_MINUTES = 30;

export const PRIVACY_POLICY_URL =
  'https://gentlyawesome.github.io/docya/privacy-policy.html';

export const USER_GUIDE_URL = 'https://gentlyawesome.github.io/docya/user-guide.html';

export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export const COLORS = {
  primary: '#2F5BEA',
  secondary: '#5856D6',
  success: '#22C55E',
  successDark: '#15803D',
  successSoft: '#E7F7EE',
  danger: '#DC2626',
  dangerSoft: '#FDECEC',
  warning: '#F59E0B',
  background: '#F4F5FA',
  card: '#FFFFFF',
  text: '#11142D',
  textSecondary: '#6B7280',
  border: '#E3E6EF',
  disabled: '#E5E7EB',
  primarySoft: '#EAF0FF',
  navy: '#0F1B4C',
  navySoft: '#1B2B6B',
} as const;

export const RADIUS = { card: 16, control: 12, pill: 999 } as const;

// A soft card shadow that works on iOS (and a light elevation elsewhere)
export const SHADOW = {
  shadowColor: '#11142D',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
} as const;
