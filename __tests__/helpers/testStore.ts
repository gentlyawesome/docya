import { configureStore } from '@reduxjs/toolkit';
import authReducer, { loginUser } from '../../src/store/slices/authSlice';
import { Booking, TimeSlot, User } from '../../src/types';

export const makeStore = () =>
  configureStore({ reducer: { auth: authReducer } });

export const doctorUser: User = {
  id: 'doctor-1',
  email: 'doc@example.test',
  firstName: 'Dana',
  lastName: 'Doc',
  fullName: 'Dana Doc',
};

export const signedIn = (user: User = doctorUser) => {
  const store = makeStore();
  store.dispatch(
    loginUser.fulfilled(user, 'req', { email: user.email, password: 'x' }),
  );
  return store;
};

// 09:00-09:30 in Perth (UTC+8) on 2099-01-01 is 01:00-01:30 UTC
export const slot: TimeSlot = {
  id: 's',
  doctorId: 'doctor-1',
  doctorName: 'Dana Doc',
  date: '2099-01-01',
  startTime: '09:00',
  endTime: '09:30',
  dayOfWeek: 'Thursday',
  timezone: 'Australia/Perth',
  isBooked: false,
};

export const booking = (over: Partial<Booking> = {}): Booking => ({
  id: 'b1',
  doctorId: 'doctor-1',
  doctorName: 'Dana Doc',
  date: '2099-01-01',
  startTime: '09:00',
  endTime: '09:30',
  dayOfWeek: 'Thursday',
  timezone: 'Australia/Perth',
  bookedAt: '2026-01-01T00:00:00Z',
  status: 'confirmed',
  patientName: 'Pat Patient',
  ...over,
});
