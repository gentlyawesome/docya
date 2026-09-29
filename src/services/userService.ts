import { supabase } from '../config/supabase';
import { DoctorProfile, PatientProfile, User } from '../types';
import { mapSupabaseError } from './supabaseErrors';

interface ProfileRow {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  role: 'patient' | 'doctor';
  phone: string | null;
}

export const toUser = (row: ProfileRow): User => ({
  id: row.id,
  email: row.email ?? '',
  firstName: row.first_name ?? '',
  lastName: row.last_name ?? '',
  fullName: row.full_name ?? `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
  role: row.role,
  phone: row.phone ?? undefined,
});

export const getUserProfile = async (userId: string): Promise<User> => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) {
    throw new Error(mapSupabaseError(error));
  }
  return toUser(data as ProfileRow);
};

export interface UserProfileUpdate {
  firstName: string;
  lastName: string;
  phone?: string;
}

export const updateUserProfile = async (userId: string, update: UserProfileUpdate): Promise<User> => {
  const firstName = update.firstName.trim();
  const lastName = update.lastName.trim();
  const { data, error } = await supabase
    .from('profiles')
    .update({
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`.trim(),
      phone: update.phone?.trim() || null,
    })
    .eq('id', userId)
    .select('*')
    .single();
  if (error) {
    throw new Error(mapSupabaseError(error));
  }
  return toUser(data as ProfileRow);
};

export const getPatientProfile = async (userId: string): Promise<PatientProfile | null> => {
  const { data, error } = await supabase
    .from('patient_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    throw new Error(mapSupabaseError(error));
  }
  return data
    ? {
        userId: data.user_id,
        dateOfBirth: data.date_of_birth ?? undefined,
        gender: data.gender ?? undefined,
        address: data.address ?? undefined,
      }
    : null;
};

export const savePatientProfile = async (
  userId: string,
  profile: Omit<PatientProfile, 'userId'>
): Promise<PatientProfile> => {
  const { data, error } = await supabase
    .from('patient_profiles')
    .upsert(
      {
        user_id: userId,
        date_of_birth: profile.dateOfBirth || null,
        gender: profile.gender?.trim() || null,
        address: profile.address?.trim() || null,
      },
      { onConflict: 'user_id' }
    )
    .select('*')
    .single();
  if (error) {
    throw new Error(mapSupabaseError(error));
  }
  return {
    userId: data.user_id,
    dateOfBirth: data.date_of_birth ?? undefined,
    gender: data.gender ?? undefined,
    address: data.address ?? undefined,
  };
};

const toDoctorProfile = (row: Record<string, any>): DoctorProfile => ({
  userId: row.user_id,
  specialization: row.specialization,
  clinicName: row.clinic_name ?? undefined,
  consultationFee: row.consultation_fee != null ? Number(row.consultation_fee) : undefined,
  bio: row.bio ?? undefined,
  timezone: row.timezone,
});

export const getDoctorProfile = async (userId: string): Promise<DoctorProfile | null> => {
  const { data, error } = await supabase
    .from('doctor_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    throw new Error(mapSupabaseError(error));
  }
  return data ? toDoctorProfile(data) : null;
};

export const saveDoctorProfile = async (
  userId: string,
  profile: Omit<DoctorProfile, 'userId'>
): Promise<DoctorProfile> => {
  const { data, error } = await supabase
    .from('doctor_profiles')
    .upsert(
      {
        user_id: userId,
        specialization: profile.specialization.trim(),
        clinic_name: profile.clinicName?.trim() || null,
        consultation_fee: profile.consultationFee ?? null,
        bio: profile.bio?.trim() || null,
        timezone: profile.timezone,
      },
      { onConflict: 'user_id' }
    )
    .select('*')
    .single();
  if (error) {
    throw new Error(mapSupabaseError(error));
  }
  return toDoctorProfile(data);
};
