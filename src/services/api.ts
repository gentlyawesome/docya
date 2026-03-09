import axios from 'axios';
import { DoctorAvailability, Doctor } from '../types';
import { API_URL } from '../constants';

/**
 * Fetch doctor availability data from API
 */
export const fetchDoctorAvailability = async (): Promise<DoctorAvailability[]> => {
  try {
    const response = await axios.get<DoctorAvailability[]>(API_URL);
    return response.data;
  } catch (error) {
    console.error('Error fetching doctor availability:', error);
    throw new Error('Failed to fetch doctor availability. Please check your internet connection.');
  }
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
