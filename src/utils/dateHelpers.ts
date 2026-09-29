import { format, parseISO } from 'date-fns';

/**
 * Format date with day of week
 */
export const formatDateWithDay = (dateStr: string): string => {
  try {
    const date = parseISO(dateStr);
    return format(date, 'EEEE, MMM dd, yyyy');
  } catch {
    return dateStr;
  }
};

/**
 * Format timezone for display
 */
export const formatTimezone = (timezone: string): string => {
  // Extract city name from timezone (e.g., "Australia/Sydney" -> "Sydney")
  const parts = timezone.split('/');
  return parts[parts.length - 1].replace(/_/g, ' ');
};
