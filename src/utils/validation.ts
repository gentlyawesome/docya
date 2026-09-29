export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export const MIN_PASSWORD_LENGTH = 6;

export const isValidPassword = (password: string): boolean => password.length >= MIN_PASSWORD_LENGTH;

// Accepts empty (optional field) or a phone-like value: digits, spaces, + ( ) -
export const isValidPhone = (phone: string): boolean =>
  phone.trim() === '' || /^\+?[0-9()\s-]{7,20}$/.test(phone.trim());

// YYYY-MM-DD that is a real calendar date in the past
export const isValidBirthDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    date.getTime() < Date.now()
  );
};

// An IANA time zone name such as "Asia/Manila"
export const isValidTimezone = (timezone: string): boolean => {
  try {
    return !!new Intl.DateTimeFormat('en-US', { timeZone: timezone }).resolvedOptions().timeZone;
  } catch {
    return false;
  }
};

// Matches the database column numeric(10,2): up to 8 whole digits and 2 decimals, no signs or exponents
export const isValidFee = (value: string): boolean => /^\d{1,8}(\.\d{1,2})?$/.test(value.trim());
