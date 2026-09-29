import AsyncStorage from '@react-native-async-storage/async-storage';
import { Doctor } from '../types';
import { STORAGE_KEYS } from '../constants';
import { logError } from '../utils/logger';
import { fetchDoctors } from './doctorsService';
import { doctorListSchema } from './schemas';

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
    const { doctors, savedAt } = JSON.parse(json);
    if (typeof savedAt !== 'number') {
      return null;
    }
    const parsed = doctorListSchema.safeParse(doctors);
    return parsed.success && parsed.data.length > 0
      ? { doctors: parsed.data, fromCache: true, updatedAt: savedAt }
      : null;
  } catch (error) {
    logError('Ignoring unreadable doctors cache:', error);
    return null;
  }
};

export const fetchDoctorsWithCache = async (): Promise<DoctorsResult> => {
  try {
    const doctors = await fetchDoctors();
    const updatedAt = Date.now();
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DOCTORS_CACHE, JSON.stringify({ doctors, savedAt: updatedAt }));
    } catch (error) {
      logError('Failed to write doctors cache:', error);
    }
    return { doctors, fromCache: false, updatedAt };
  } catch (error) {
    const cached = await getCachedDoctors();
    if (cached) {
      return cached;
    }
    throw error;
  }
};
