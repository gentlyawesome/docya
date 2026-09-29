import { fromZonedTime } from 'date-fns-tz';
import { Booking, BookingPhase } from '../types';

// The appointment's start as an absolute instant, using the doctor's time zone
export const getSlotStart = (date: string, startTime: string, timezone: string): Date =>
  fromZonedTime(`${date}T${startTime}:00`, timezone);

// When a reminder should fire; null if that moment has already passed
export const getReminderTime = (
  date: string,
  startTime: string,
  timezone: string,
  leadMinutes: number,
  now: number = Date.now()
): number | null => {
  const fireAt = getSlotStart(date, startTime, timezone).getTime() - leadMinutes * 60_000;
  return fireAt > now + 5_000 ? fireAt : null;
};

// The appointment's end as an absolute instant, using the doctor's time zone
export const getBookingEnd = (booking: Booking): Date =>
  fromZonedTime(`${booking.date}T${booking.endTime}:00`, booking.timezone);

export const getBookingPhase = (booking: Booking, now: number = Date.now()): BookingPhase => {
  if (booking.status === 'cancelled') {
    return 'cancelled';
  }
  return getBookingEnd(booking).getTime() > now ? 'upcoming' : 'completed';
};

const sortKey = (b: Booking) => `${b.date} ${b.startTime}`;

export const partitionBookings = (bookings: Booking[], now: number = Date.now()) => {
  const upcoming: Booking[] = [];
  const past: Booking[] = [];

  bookings.forEach(booking => {
    (getBookingPhase(booking, now) === 'upcoming' ? upcoming : past).push(booking);
  });

  upcoming.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  past.sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  return { upcoming, past };
};
