import { z } from 'zod';
import { DAYS_OF_WEEK } from '../constants';
import { DoctorAvailability } from '../types';
import { logError } from '../utils/logger';

const isValidTimezone = (timezone: string) => {
  try {
    return !!new Intl.DateTimeFormat('en-US', { timeZone: timezone }).resolvedOptions().timeZone;
  } catch {
    return false;
  }
};

const timeOfDay = z.string().regex(/^\s*\d{1,2}:\d{2}(AM|PM)\s*$/);

export const doctorAvailabilitySchema = z.object({
  name: z.string().trim().min(1).max(100),
  timezone: z.string().refine(isValidTimezone),
  day_of_week: z.enum(DAYS_OF_WEEK),
  available_at: timeOfDay,
  available_until: timeOfDay,
});

export const INVALID_DATA_MESSAGE =
  'We received unexpected data from the server. Please try again later.';

export const parseDoctorAvailability = (data: unknown): DoctorAvailability[] => {
  if (!Array.isArray(data)) {
    throw new Error(INVALID_DATA_MESSAGE);
  }

  const valid: DoctorAvailability[] = [];
  data.forEach((record, index) => {
    const result = doctorAvailabilitySchema.safeParse(record);
    if (result.success) {
      valid.push(result.data);
    } else {
      logError(`Skipping invalid availability record at index ${index}`, result.error.issues);
    }
  });

  if (data.length > 0 && valid.length === 0) {
    throw new Error(INVALID_DATA_MESSAGE);
  }

  return valid;
};
