import { supabase } from '../config/supabase';
import { Doctor } from '../types';
import { AvailabilityRow, toAvailabilities } from './mappers';
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
  const name =
    row.full_name ||
    `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() ||
    'Doctor';
  const profile = row.doctor_profiles;
  return {
    id: row.id,
    name,
    timezone: profile.timezone,
    specialty: profile.specialization,
    fee:
      profile.consultation_fee != null
        ? Number(profile.consultation_fee)
        : undefined,
    clinicName: profile.clinic_name ?? undefined,
    bio: profile.bio ?? undefined,
    availabilities: toAvailabilities(
      name,
      profile.timezone,
      row.doctor_availability ?? [],
    ),
  };
};

export const fetchDoctors = async (): Promise<Doctor[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, first_name, last_name, ' +
        'doctor_profiles!inner(specialization, clinic_name, consultation_fee, bio, timezone), ' +
        'doctor_availability(day_of_week, start_time, end_time, is_available)',
    )
    .eq('role', 'doctor')
    .order('full_name');
  if (error) {
    throw new Error(mapSupabaseError(error));
  }
  return (data as unknown as DoctorRow[]).map(toDoctor);
};
