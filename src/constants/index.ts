export const SLOT_DURATION_MINUTES = 30;

export const PRIVACY_POLICY_URL =
  'https://gentlyawesome.github.io/docya/privacy-policy.html';

export const TERMS_URL = 'https://gentlyawesome.github.io/docya/terms.html';

export const USER_GUIDE_URL =
  'https://gentlyawesome.github.io/docya/user-guide.html';

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
  primary: '#1F4A43',
  secondary: '#5856D6',
  success: '#3E8E6B',
  successDark: '#2F6B4F',
  successSoft: '#E5F0E8',
  danger: '#B4372F',
  dangerSoft: '#FBEDEB',
  warning: '#C98A2B',
  background: '#F6F4EF',
  card: '#FFFFFF',
  text: '#1E2321',
  textSecondary: '#6B706C',
  border: '#E4E0D6',
  disabled: '#E7E4DB',
  primarySoft: '#E4EDE9',
  navy: '#1F4A43',
  navySoft: '#2E5D55',
} as const;

// Headings, big numbers and the appointment time use a serif; everything else the system font
export const FONTS = { serif: 'Georgia' } as const;

export const RADIUS = { card: 16, control: 12, pill: 999 } as const;

// A very soft shadow that works on iOS (and a light elevation elsewhere)
export const SHADOW = {
  shadowColor: '#1E2321',
  shadowOpacity: 0.04,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 1,
} as const;

// Cards: a thin border and the soft shadow
export const CARD = {
  ...SHADOW,
  borderWidth: 1,
  borderColor: COLORS.border,
} as const;
