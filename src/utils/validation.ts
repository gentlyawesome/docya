export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export const MIN_PASSWORD_LENGTH = 6;

export const isValidPassword = (password: string): boolean =>
  password.length >= MIN_PASSWORD_LENGTH;

// Accepts empty (optional field) or a phone-like value: digits, spaces, + ( ) - .
export const isValidPhone = (phone: string): boolean =>
  phone.trim() === '' || /^\+?[0-9().\s-]{7,20}$/.test(phone.trim());

// An IANA time zone name such as "Asia/Manila"
export const isValidTimezone = (timezone: string): boolean => {
  try {
    return !!new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
    }).resolvedOptions().timeZone;
  } catch {
    return false;
  }
};

// The emailed one-time code (6 digits locally; a hosted project may use up to 10)
export const isValidCode = (code: string): boolean =>
  /^\d{6,10}$/.test(code.trim());

// A Philippine mobile number as +639XXXXXXXXX, or null. Same rules as the database function
// normalize_ph_mobile (09.., 9.., 639.., +639.. with spaces or dashes). Patient text reminders need one.
export const normalizePhMobile = (phone: string): string | null => {
  const digits = phone.replace(/[^0-9]/g, '');
  if (/^639[0-9]{9}$/.test(digits)) {
    return `+${digits}`;
  }
  if (/^09[0-9]{9}$/.test(digits)) {
    return `+63${digits.slice(1)}`;
  }
  if (/^9[0-9]{9}$/.test(digits)) {
    return `+63${digits}`;
  }
  return null;
};
