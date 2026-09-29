// Turns Supabase/PostgREST errors into messages that are safe to show to a person.
const RULES: Array<[RegExp, string]> = [
  [/user already registered|email already registered/, 'An account with this email already exists.'],
  [/invalid login credentials|invalid email or password/, 'Invalid email or password.'],
  [/email not confirmed/, 'Please confirm your email address, then sign in.'],
  [/signup.*disabled|signups not allowed/, 'New registrations are currently disabled.'],
  [/password should be at least|password is too weak/, 'Password must be at least 6 characters long.'],
  [/invalid email|unable to validate email/, 'Please enter a valid email address.'],
  [/otp.*(expired|invalid)|token.*(expired|invalid)|expired or is invalid|invalid.*(token|otp|code)/, 'That code is wrong or has expired. Request a new one.'],
  [/different from the old password|same as the old password/, 'Choose a new password that is different from your current one.'],
  [/rate limit|too many requests|security purposes/, 'Too many attempts. Please wait a moment and try again.'],
  [/network|fetch failed|failed to fetch/, 'Network error. Please check your internet connection.'],
  [/jwt|session.*(not found|expired)/, 'Your session has expired. Please sign in again.'],
  [/row-level security|row level security|permission denied/, 'You do not have permission to do that.'],
  [/appointments_no_double_booking|duplicate key/, 'That time slot was just booked by someone else. Please choose another.'],
  [/appointment_date must be today or in the future/, 'That time has already passed. Please choose a later slot.'],
];

export const mapSupabaseError = (error: unknown): string => {
  if (typeof error === 'string') {
    return error;
  }
  const { message = '', code } = (error ?? {}) as { message?: string; code?: string };
  const lower = message.toLowerCase();

  for (const [pattern, friendly] of RULES) {
    if (pattern.test(lower)) {
      return friendly;
    }
  }
  if (code === '23505') {
    return 'That time slot was just booked by someone else. Please choose another.';
  }
  if (code === 'PGRST116') {
    return 'The requested item was not found.';
  }
  return 'Something went wrong. Please try again.';
};
