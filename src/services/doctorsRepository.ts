import AsyncStorage from '@react-native-async-storage/async-storage';
import { Doctor } from '../types';
import { STORAGE_KEYS } from '../constants';
import { logError } from '../utils/logger';
import { fetchDoctorAvailability, transformToDoctors } from './api';
import { parseDoctorAvailability } from './schemas';

export interface DoctorsResult {
  doctors: Doctor[];
  fromCache: boolean;
  updatedAt: number;
}

export const getCachedDoctors = async (): Promise<DoctorsResult | null> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.DOCTORS_CACHE);
    if (!json) {
      return null;
    }
    const { records, savedAt } = JSON.parse(json);
    if (typeof savedAt !== 'number') {
      return null;
    }
    const doctors = transformToDoctors(parseDoctorAvailability(records));
    return doctors.length > 0 ? { doctors, fromCache: true, updatedAt: savedAt } : null;
  } catch (error) {
    logError('Ignoring unreadable doctors cache:', error);
    return null;
  }
};

export const fetchDoctorsWithCache = async (): Promise<DoctorsResult> => {
  try {
    const records = await fetchDoctorAvailability();
    const updatedAt = Date.now();
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.DOCTORS_CACHE,
        JSON.stringify({ records, savedAt: updatedAt })
      );
    } catch (error) {
      logError('Failed to write doctors cache:', error);
    }
    return { doctors: transformToDoctors(records), fromCache: false, updatedAt };
  } catch (error) {
    const cached = await getCachedDoctors();
    if (cached) {
      return cached;
    }
    throw error;
  }
};
