import { format, parseISO } from 'date-fns';
import { Booking, BookingStatus, DoctorAvailability } from '../types';

// Postgres `time` values arrive as "HH:mm:ss"; the app works with "HH:mm"
export const toHHmm = (time: string): string => time.slice(0, 5);

// "17:30:00" -> "5:30PM": the format the slot generator parses
export const to12Hour = (time: string): string => {
  const [h, m] = toHHmm(time).split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')}${suffix}`;
};

export interface AvailabilityRow {
  day_of_week: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

export const toAvailabilities = (
  name: string,
  timezone: string,
  rows: AvailabilityRow[],
): DoctorAvailability[] =>
  rows
    .filter(row => row.is_available)
    .map(row => ({
      name,
      timezone,
      day_of_week: row.day_of_week,
      available_at: to12Hour(row.start_time),
      available_until: to12Hour(row.end_time),
    }));

export interface AppointmentRow {
  id: string;
  doctor_id: string;
  patient_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: BookingStatus | 'pending';
  reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  doctor?: {
    full_name: string | null;
    doctor_profiles?: { timezone: string } | null;
  } | null;
  patient?: { full_name: string | null } | null;
}

export const toBooking = (row: AppointmentRow): Booking => ({
  id: row.id,
  doctorId: row.doctor_id,
  doctorName: row.doctor?.full_name ?? 'Doctor',
  date: row.appointment_date,
  startTime: toHHmm(row.start_time),
  endTime: toHHmm(row.end_time),
  dayOfWeek: format(parseISO(row.appointment_date), 'EEEE'),
  timezone: row.doctor?.doctor_profiles?.timezone ?? 'UTC',
  bookedAt: row.created_at,
  // Appointments are confirmed when a doctor creates them; older 'pending' rows count as confirmed
  status: row.status === 'pending' ? 'confirmed' : row.status,
  cancelledAt: row.status === 'cancelled' ? row.updated_at : undefined,
  patientId: row.patient_id,
  patientName: row.patient?.full_name ?? undefined,
  reason: row.reason ?? undefined,
  notes: row.notes ?? undefined,
});
