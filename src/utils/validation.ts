export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export const MIN_PASSWORD_LENGTH = 6;

export const isValidPassword = (password: string): boolean => password.length >= MIN_PASSWORD_LENGTH;

// Accepts empty (optional field) or a phone-like value: digits, spaces, + ( ) -
export const isValidPhone = (phone: string): boolean =>
  phone.trim() === '' || /^\+?[0-9()\s-]{7,20}$/.test(phone.trim());

// An IANA time zone name such as "Asia/Manila"
export const isValidTimezone = (timezone: string): boolean => {
  try {
    return !!new Intl.DateTimeFormat('en-US', { timeZone: timezone }).resolvedOptions().timeZone;
  } catch {
    return false;
  }
};

