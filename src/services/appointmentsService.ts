import { supabase } from '../config/supabase';
import { Booking, BookingStatus, TimeSlot } from '../types';
import { AppointmentRow, toBooking } from './mappers';
import { mapSupabaseError } from './supabaseErrors';

const SELECT =
  'id, doctor_id, patient_name, patient_phone, appointment_date, start_time, end_time, status, reason, notes, ' +
  'created_at, updated_at, ' +
  'doctor:profiles!doctor_id(full_name, doctor_profiles(timezone))';

const fail = (error: unknown): never => {
  throw new Error(mapSupabaseError(error));
};

// The patient is just a name (and optionally a phone number) the doctor types in
export interface PatientDetails {
  name: string;
  phone?: string;
}

export const createAppointment = async (
  slot: TimeSlot,
  patient: PatientDetails,
): Promise<Booking> => {
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      doctor_id: slot.doctorId,
      patient_name: patient.name.trim(),
      patient_phone: patient.phone?.trim() || null,
      appointment_date: slot.date,
      start_time: slot.startTime,
      end_time: slot.endTime,
    })
    .select(SELECT)
    .single();
  if (error) {
    return fail(error);
  }
  return toBooking(data as unknown as AppointmentRow);
};

// The signed-in doctor's appointments (row-level security limits the rows)
export const listMyAppointments = async (): Promise<Booking[]> => {
  const { data, error } = await supabase
    .from('appointments')
    .select(SELECT)
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) {
    return fail(error);
  }
  return (data as unknown as AppointmentRow[]).map(toBooking);
};

export const getAppointment = async (id: string): Promise<Booking> => {
  const { data, error } = await supabase
    .from('appointments')
    .select(SELECT)
    .eq('id', id)
    .single();
  if (error) {
    return fail(error);
  }
  return toBooking(data as unknown as AppointmentRow);
};

export const updateAppointmentStatus = async (
  id: string,
  status: BookingStatus,
  notes?: string,
): Promise<Booking> => {
  const { data, error } = await supabase
    .from('appointments')
    .update({ status, ...(notes !== undefined ? { notes } : {}) })
    .eq('id', id)
    .select(SELECT)
    .single();
  if (error) {
    return fail(error);
  }
  return toBooking(data as unknown as AppointmentRow);
};

export const saveAppointmentNotes = async (
  id: string,
  notes: string,
): Promise<Booking> => {
  const { data, error } = await supabase
    .from('appointments')
    .update({ notes: notes.trim() || null })
    .eq('id', id)
    .select(SELECT)
    .single();
  if (error) {
    return fail(error);
  }
  return toBooking(data as unknown as AppointmentRow);
};
