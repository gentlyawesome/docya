import axios from 'axios';
import { DoctorAvailability, Doctor } from '../types';
import { logError } from '../utils/logger';
import { parseDoctorAvailability } from './schemas';
import { API_URL, SAMPLE_DOCTOR_PROFILES, SHOW_SAMPLE_DOCTOR_PROFILES } from '../constants';

/**
 * Fetch doctor availability data from API
 */
export const fetchDoctorAvailability = async (): Promise<DoctorAvailability[]> => {
  let data: unknown;
  try {
    const response = await axios.get<unknown>(API_URL);
    data = response.data;
  } catch (error) {
    logError('Error fetching doctor availability:', error);
    throw new Error('Failed to fetch doctor availability. Please check your internet connection.');
  }
  return parseDoctorAvailability(data);
};

/**
 * Transform API data into Doctor objects
 */
export const transformToDoctors = (availabilities: DoctorAvailability[]): Doctor[] => {
  // Group availabilities by doctor name
  const doctorMap = new Map<string, DoctorAvailability[]>();
  
  availabilities.forEach(avail => {
    const existing = doctorMap.get(avail.name) || [];
    doctorMap.set(avail.name, [...existing, avail]);
  });
  
  // Convert to Doctor objects
  const doctors: Doctor[] = [];
  doctorMap.forEach((availabilities, name) => {
    // Use first availability's timezone as doctor's primary timezone
    const timezone = availabilities[0]?.timezone || 'UTC';
    
    // Generate a simple ID from the name
    const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    doctors.push({
      id,
      name,
      timezone,
      availabilities,
      ...(SHOW_SAMPLE_DOCTOR_PROFILES ? SAMPLE_DOCTOR_PROFILES[id] : undefined),
    });
  });
  
  // Sort doctors by name
  return doctors.sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Fetch and transform doctors data
 */
export const fetchDoctors = async (): Promise<Doctor[]> => {
  const availabilities = await fetchDoctorAvailability();
  return transformToDoctors(availabilities);
};
