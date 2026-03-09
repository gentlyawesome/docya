import { format, parseISO, startOfWeek, addDays } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

/**
 * Format date for display
 */
export const formatDate = (dateStr: string): string => {
  try {
    const date = parseISO(dateStr);
    return format(date, 'MMM dd, yyyy');
  } catch (error) {
    return dateStr;
  }
};

/**
 * Format date with day of week
 */
export const formatDateWithDay = (dateStr: string): string => {
  try {
    const date = parseISO(dateStr);
    return format(date, 'EEEE, MMM dd, yyyy');
  } catch (error) {
    return dateStr;
  }
};

/**
 * Get current date in ISO format
 */
export const getCurrentDate = (): string => {
  return format(new Date(), 'yyyy-MM-dd');
};

/**
 * Get start of current week
 */
export const getStartOfWeek = (): Date => {
  return startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
};

/**
 * Get array of dates for the next N days
 */
export const getNextDays = (numberOfDays: number = 7): Date[] => {
  const today = new Date();
  const days: Date[] = [];
  
  for (let i = 0; i < numberOfDays; i++) {
    days.push(addDays(today, i));
  }
  
  return days;
};

/**
 * Convert time to timezone
 */
export const convertToTimezone = (date: Date, timezone: string): Date => {
  return utcToZonedTime(date, timezone);
};

/**
 * Format timezone for display
 */
export const formatTimezone = (timezone: string): string => {
  // Extract city name from timezone (e.g., "Australia/Sydney" -> "Sydney")
  const parts = timezone.split('/');
  return parts[parts.length - 1].replace(/_/g, ' ');
};

/**
 * Get day name from date
 */
export const getDayName = (dateStr: string): string => {
  try {
    const date = parseISO(dateStr);
    return format(date, 'EEEE');
  } catch (error) {
    return '';
  }
};

/**
 * Check if date is today
 */
export const isToday = (dateStr: string): boolean => {
  const today = format(new Date(), 'yyyy-MM-dd');
  return dateStr === today;
};

/**
 * Check if date is in the past
 */
export const isPastDate = (dateStr: string): boolean => {
  const today = format(new Date(), 'yyyy-MM-dd');
  return dateStr < today;
};
