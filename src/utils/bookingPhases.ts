import { fromZonedTime } from 'date-fns-tz';
import { Booking, BookingPhase } from '../types';

// The appointment's end as an absolute instant, using the doctor's time zone
export const getBookingEnd = (booking: Booking): Date =>
  fromZonedTime(`${booking.date}T${booking.endTime}:00`, booking.timezone);

export const getBookingPhase = (booking: Booking, now: number = Date.now()): BookingPhase => {
  if (booking.status === 'cancelled') {
    return 'cancelled';
  }
  if (booking.status === 'completed') {
    return 'completed';
  }
  return getBookingEnd(booking).getTime() > now ? 'upcoming' : 'completed';
};
