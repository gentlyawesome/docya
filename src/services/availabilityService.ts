import { supabase } from '../config/supabase';
import { AvailabilityWindow, DayOfWeek } from '../types';
import { toHHmm } from './mappers';
import { mapSupabaseError } from './supabaseErrors';

interface Row {
  id: string;
  doctor_id: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

const toWindow = (row: Row): AvailabilityWindow => ({
  id: row.id,
  doctorId: row.doctor_id,
  dayOfWeek: row.day_of_week,
  startTime: toHHmm(row.start_time),
  endTime: toHHmm(row.end_time),
  isAvailable: row.is_available,
});

const OVERLAP_MESSAGE = 'That time overlaps another window on the same day.';

const fail = (error: { message?: string }): never => {
  if (error.message?.toLowerCase().includes('overlap')) {
    throw new Error(OVERLAP_MESSAGE);
  }
  throw new Error(mapSupabaseError(error));
};

export const listMyAvailability = async (doctorId: string): Promise<AvailabilityWindow[]> => {
  const { data, error } = await supabase
    .from('doctor_availability')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('start_time');
  if (error) {
    return fail(error);
  }
  return (data as Row[]).map(toWindow);
};

export const addAvailability = async (
  doctorId: string,
  dayOfWeek: DayOfWeek,
  startTime: string,
  endTime: string
): Promise<AvailabilityWindow> => {
  const { data, error } = await supabase
    .from('doctor_availability')
    .insert({ doctor_id: doctorId, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime })
    .select('*')
    .single();
  if (error) {
    return fail(error);
  }
  return toWindow(data as Row);
};

export const setAvailabilityEnabled = async (id: string, isAvailable: boolean): Promise<void> => {
  const { error } = await supabase.from('doctor_availability').update({ is_available: isAvailable }).eq('id', id);
  if (error) {
    fail(error);
  }
};

export const deleteAvailability = async (id: string): Promise<void> => {
  const { error } = await supabase.from('doctor_availability').delete().eq('id', id);
  if (error) {
    fail(error);
  }
};
