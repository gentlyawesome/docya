import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';
import { logError } from '../utils/logger';

// Device-only data. Appointments themselves live in Supabase.

export interface ReminderInfo {
  reminderId: string;
  leadMinutes: number;
}

// Which local notification belongs to which appointment (notifications never leave the device)
export const loadReminders = async (): Promise<Record<string, ReminderInfo>> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.REMINDERS);
    const parsed = json ? JSON.parse(json) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    logError('Error loading reminders:', error);
    return {};
  }
};

const writeReminders = async (reminders: Record<string, ReminderInfo>) => {
  await AsyncStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(reminders));
};

export const saveReminder = async (appointmentId: string, info: ReminderInfo): Promise<void> => {
  try {
    await writeReminders({ ...(await loadReminders()), [appointmentId]: info });
  } catch (error) {
    logError('Error saving reminder:', error);
  }
};

export const removeReminder = async (appointmentId: string): Promise<ReminderInfo | undefined> => {
  try {
    const { [appointmentId]: removed, ...rest } = await loadReminders();
    await writeReminders(rest);
    return removed;
  } catch (error) {
    logError('Error removing reminder:', error);
    return undefined;
  }
};

export const clearReminders = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.REMINDERS);
  } catch (error) {
    logError('Error clearing reminders:', error);
  }
};

// Favorite doctors are kept per signed-in user
const favoritesKey = (userId: string) => `${STORAGE_KEYS.FAVORITES}:${userId}`;

export const loadFavorites = async (userId: string): Promise<string[]> => {
  try {
    const json = await AsyncStorage.getItem(favoritesKey(userId));
    const parsed = json != null ? JSON.parse(json) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch (error) {
    logError('Error loading favorites:', error);
    return [];
  }
};

export const saveFavorites = async (userId: string, ids: string[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(favoritesKey(userId), JSON.stringify(ids));
  } catch (error) {
    logError('Error saving favorites:', error);
    throw new Error('Failed to save favorites');
  }
};
