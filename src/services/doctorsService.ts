import { supabase } from '../config/supabase';
import { Doctor } from '../types';
import { AvailabilityRow, toAvailabilities, toHHmm } from './mappers';
import { mapSupabaseError } from './supabaseErrors';

interface DoctorRow {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  doctor_profiles: {
    specialization: string;
    clinic_name: string | null;
    consultation_fee: number | null;
    bio: string | null;
    timezone: string;
  };
  doctor_availability: AvailabilityRow[];
}

export const toDoctor = (row: DoctorRow): Doctor => {
  const name = row.full_name || `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || 'Doctor';
  const profile = row.doctor_profiles;
  return {
    id: row.id,
    name,
    timezone: profile.timezone,
    specialty: profile.specialization,
    fee: profile.consultation_fee != null ? Number(profile.consultation_fee) : undefined,
    clinicName: profile.clinic_name ?? undefined,
    bio: profile.bio ?? undefined,
    availabilities: toAvailabilities(name, profile.timezone, row.doctor_availability ?? []),
  };
};

export const fetchDoctors = async (): Promise<Doctor[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, first_name, last_name, ' +
        'doctor_profiles!inner(specialization, clinic_name, consultation_fee, bio, timezone), ' +
        'doctor_availability(day_of_week, start_time, end_time, is_available)'
    )
    .eq('role', 'doctor')
    .order('full_name');
  if (error) {
    throw new Error(mapSupabaseError(error));
  }
  return (data as unknown as DoctorRow[]).map(toDoctor);
};

export interface BookedSlot {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
}

// Slots other patients already hold. Uses a SECURITY DEFINER function so no patient details leak.
export const fetchBookedSlots = async (
  doctorId: string,
  fromDate: string,
  toDate: string
): Promise<BookedSlot[]> => {
  const { data, error } = await supabase.rpc('get_booked_slots', {
    p_doctor_id: doctorId,
    p_from: fromDate,
    p_to: toDate,
  });
  if (error) {
    throw new Error(mapSupabaseError(error));
  }
  return (data as Array<{ appointment_date: string; start_time: string }>).map(row => ({
    date: row.appointment_date,
    startTime: toHHmm(row.start_time),
  }));
};
