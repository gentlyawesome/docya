import { format, parse, addMinutes, isBefore, isEqual } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';
import { DoctorAvailability, TimeSlot, Booking } from '../types';
import { SLOT_DURATION_MINUTES } from '../constants';

/**
 * Parse time string (e.g., " 9:00AM", "10:00AM") to 24-hour format
 */
export const parseTimeString = (timeStr: string): string => {
  const cleaned = timeStr.trim();
  try {
    const parsed = parse(cleaned, 'h:mma', new Date());
    return format(parsed, 'HH:mm');
  } catch (error) {
    console.error('Error parsing time:', timeStr, error);
    return '00:00';
  }
};

/**
 * Generate 30-minute time slots from a time range
 */
export const generateTimeSlotsFromRange = (
  startTime: string,
  endTime: string,
  doctorId: string,
  doctorName: string,
  dayOfWeek: string,
  timezone: string,
  date: string,
  bookedSlots: Booking[] = []
): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  
  // Parse start and end times
  const start24h = parseTimeString(startTime);
  const end24h = parseTimeString(endTime);
  
  // Create date objects for calculation
  const baseDate = new Date(date);
  let currentTime = parse(start24h, 'HH:mm', baseDate);
  const endTimeDate = parse(end24h, 'HH:mm', baseDate);
  
  // Generate slots
  while (isBefore(currentTime, endTimeDate)) {
    const slotStart = format(currentTime, 'HH:mm');
    const nextTime = addMinutes(currentTime, SLOT_DURATION_MINUTES);
    const slotEnd = format(nextTime, 'HH:mm');
    
    // Check if this slot is already booked
    const isBooked = bookedSlots.some(
      booking =>
        booking.doctorId === doctorId &&
        booking.date === date &&
        booking.startTime === slotStart
    );
    
    const slotId = `${doctorId}-${date}-${slotStart}`;
    
    slots.push({
      id: slotId,
      doctorId,
      doctorName,
      date,
      startTime: slotStart,
      endTime: slotEnd,
      dayOfWeek,
      timezone,
      isBooked,
    });
    
    currentTime = nextTime;
  }
  
  return slots;
};

/**
 * Generate all time slots for a doctor's availability
 */
export const generateDoctorTimeSlots = (
  doctorId: string,
  doctorName: string,
  availabilities: DoctorAvailability[],
  startDate: Date,
  numberOfDays: number = 7,
  bookedSlots: Booking[] = []
): TimeSlot[] => {
  const allSlots: TimeSlot[] = [];
  
  // Group availabilities by day of week
  const availabilityByDay = availabilities.reduce((acc, avail) => {
    if (!acc[avail.day_of_week]) {
      acc[avail.day_of_week] = [];
    }
    acc[avail.day_of_week].push(avail);
    return acc;
  }, {} as Record<string, DoctorAvailability[]>);
  
  // Generate slots for each day
  for (let i = 0; i < numberOfDays; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);
    
    const dayName = format(currentDate, 'EEEE');
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    
    const dayAvailabilities = availabilityByDay[dayName] || [];
    
    dayAvailabilities.forEach(avail => {
      const slots = generateTimeSlotsFromRange(
        avail.available_at,
        avail.available_until,
        doctorId,
        doctorName,
        dayName,
        avail.timezone,
        dateStr,
        bookedSlots
      );
      allSlots.push(...slots);
    });
  }
  
  return allSlots;
};

/**
 * Format time slot for display
 */
export const formatTimeSlot = (slot: TimeSlot): string => {
  return `${slot.startTime} - ${slot.endTime}`;
};

/**
 * Format time in 12-hour format
 */
export const formatTime12Hour = (time24: string): string => {
  try {
    const parsed = parse(time24, 'HH:mm', new Date());
    return format(parsed, 'h:mm a');
  } catch (error) {
    return time24;
  }
};
