import AsyncStorage from '@react-native-async-storage/async-storage';
import { Booking } from '../types';
import { STORAGE_KEYS } from '../constants';
import { logError } from '../utils/logger';

/**
 * Save bookings to AsyncStorage
 */
export const saveBookings = async (bookings: Booking[]): Promise<void> => {
  try {
    const jsonValue = JSON.stringify(bookings);
    await AsyncStorage.setItem(STORAGE_KEYS.BOOKINGS, jsonValue);
  } catch (error) {
    logError('Error saving bookings:', error);
    throw new Error('Failed to save bookings');
  }
};

/**
 * Load bookings from AsyncStorage
 */
export const loadBookings = async (): Promise<Booking[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.BOOKINGS);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (error) {
    logError('Error loading bookings:', error);
    return [];
  }
};

/**
 * Add a new booking
 */
export const addBooking = async (booking: Booking): Promise<Booking[]> => {
  try {
    const existingBookings = await loadBookings();
    const updatedBookings = [...existingBookings, booking];
    await saveBookings(updatedBookings);
    return updatedBookings;
  } catch (error) {
    logError('Error adding booking:', error);
    throw new Error('Failed to add booking');
  }
};

/**
 * Mark a booking as cancelled (kept for history; its slot becomes bookable again)
 */
export const cancelBookingById = async (bookingId: string): Promise<Booking[]> => {
  try {
    const existingBookings = await loadBookings();
    const updatedBookings = existingBookings.map(b =>
      b.id === bookingId && b.status !== 'cancelled'
        ? {
            ...b,
            status: 'cancelled' as const,
            cancelledAt: new Date().toISOString(),
            reminderId: undefined,
            reminderLeadMinutes: undefined,
          }
        : b
    );
    await saveBookings(updatedBookings);
    return updatedBookings;
  } catch (error) {
    logError('Error cancelling booking:', error);
    throw new Error('Failed to cancel booking');
  }
};

/**
 * Update fields on a booking
 */
export const updateBooking = async (
  bookingId: string,
  patch: Partial<Booking>
): Promise<Booking[]> => {
  try {
    const existingBookings = await loadBookings();
    const updatedBookings = existingBookings.map(b => (b.id === bookingId ? { ...b, ...patch } : b));
    await saveBookings(updatedBookings);
    return updatedBookings;
  } catch (error) {
    logError('Error updating booking:', error);
    throw new Error('Failed to update booking');
  }
};

/**
 * Clear all bookings
 */
export const clearAllBookings = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.BOOKINGS);
  } catch (error) {
    logError('Error clearing bookings:', error);
    throw new Error('Failed to clear bookings');
  }
};

/**
 * Check if a slot is already booked
 */
export const isSlotBooked = async (
  doctorId: string,
  date: string,
  startTime: string
): Promise<boolean> => {
  try {
    const bookings = await loadBookings();
    return bookings.some(
      b =>
        b.status !== 'cancelled' &&
        b.doctorId === doctorId &&
        b.date === date &&
        b.startTime === startTime
    );
  } catch (error) {
    logError('Error checking slot:', error);
    return false;
  }
};

/**
 * Favorite doctor ids
 */
export const loadFavorites = async (): Promise<string[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.FAVORITES);
    const parsed = jsonValue != null ? JSON.parse(jsonValue) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch (error) {
    logError('Error loading favorites:', error);
    return [];
  }
};

export const saveFavorites = async (ids: string[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(ids));
  } catch (error) {
    logError('Error saving favorites:', error);
    throw new Error('Failed to save favorites');
  }
};
