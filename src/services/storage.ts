import AsyncStorage from '@react-native-async-storage/async-storage';
import { Booking } from '../types';
import { STORAGE_KEYS } from '../constants';

/**
 * Save bookings to AsyncStorage
 */
export const saveBookings = async (bookings: Booking[]): Promise<void> => {
  try {
    const jsonValue = JSON.stringify(bookings);
    await AsyncStorage.setItem(STORAGE_KEYS.BOOKINGS, jsonValue);
  } catch (error) {
    console.error('Error saving bookings:', error);
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
    console.error('Error loading bookings:', error);
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
    console.error('Error adding booking:', error);
    throw new Error('Failed to add booking');
  }
};

/**
 * Remove a booking by ID
 */
export const removeBooking = async (bookingId: string): Promise<Booking[]> => {
  try {
    const existingBookings = await loadBookings();
    const updatedBookings = existingBookings.filter(b => b.id !== bookingId);
    await saveBookings(updatedBookings);
    return updatedBookings;
  } catch (error) {
    console.error('Error removing booking:', error);
    throw new Error('Failed to remove booking');
  }
};

/**
 * Clear all bookings
 */
export const clearAllBookings = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.BOOKINGS);
  } catch (error) {
    console.error('Error clearing bookings:', error);
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
      b => b.doctorId === doctorId && b.date === date && b.startTime === startTime
    );
  } catch (error) {
    console.error('Error checking slot:', error);
    return false;
  }
};
