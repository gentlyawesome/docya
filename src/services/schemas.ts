import { z } from 'zod';
import { DAYS_OF_WEEK } from '../constants';

const timeOfDay = z.string().regex(/^\s*\d{1,2}:\d{2}(AM|PM)\s*$/);

const availabilitySchema = z.object({
  name: z.string(),
  timezone: z.string(),
  day_of_week: z.enum(DAYS_OF_WEEK),
  available_at: timeOfDay,
  available_until: timeOfDay,
});

// Shape of a Doctor as stored in the offline cache. Cached data is untrusted on read.
export const doctorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  timezone: z.string().min(1),
  availabilities: z.array(availabilitySchema),
  specialty: z.string().optional(),
  fee: z.number().optional(),
  clinicName: z.string().optional(),
  bio: z.string().optional(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
});

export const doctorListSchema = z.array(doctorSchema);
