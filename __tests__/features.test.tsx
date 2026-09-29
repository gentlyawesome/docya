import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import {
  loadDoctors,
  selectFilteredDoctors,
  selectSpecialties,
  setSearchQuery,
  setSpecialty,
  setMinRating,
  setFavoritesOnly,
  clearFilters,
} from '../src/store/slices/doctorsSlice';
import {
  cancelBooking,
  createBooking,
  loadBookings,
  selectActiveBookings,
} from '../src/store/slices/bookingsSlice';
import { loadFavorites, toggleFavorite } from '../src/store/slices/favoritesSlice';
import { logoutUser } from '../src/store/slices/authSlice';
import { getBookingPhase, partitionBookings } from '../src/utils/bookingPhases';
import { filterFutureSlots } from '../src/utils/timeSlotGenerator';
import { MyBookingsScreen } from '../src/screens/MyBookingsScreen';
import * as appointments from '../src/services/appointmentsService';
import * as authService from '../src/services/authService';
import { Doctor } from '../src/types';
import { booking, doctorUser, makeStore, patient, signedIn, slot } from './helpers/testStore';

jest.mock('../src/services/appointmentsService');
jest.mock('../src/services/authService');
jest.mock('../src/utils/logger');

const svc = appointments as jest.Mocked<typeof appointments>;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  svc.listMyAppointments.mockResolvedValue([]);
});

describe('booking phases', () => {
  // 09:30 in Perth (UTC+8) on 2026-10-01 is 01:30 UTC
  const endUtc = Date.UTC(2026, 9, 1, 1, 30);
  const day = booking({ date: '2026-10-01' });

  it('uses the doctor time zone to decide when an appointment has ended', () => {
    expect(getBookingPhase(day, endUtc - 60_000)).toBe('upcoming');
    expect(getBookingPhase(day, endUtc + 60_000)).toBe('completed');
  });

  it('honours cancelled and completed statuses regardless of time', () => {
    expect(getBookingPhase({ ...day, status: 'cancelled' }, endUtc - 60_000)).toBe('cancelled');
    expect(getBookingPhase({ ...day, status: 'completed' }, endUtc - 60_000)).toBe('completed');
    expect(getBookingPhase({ ...day, status: undefined }, endUtc - 60_000)).toBe('upcoming');
  });

  it('sorts upcoming soonest-first and past newest-first', () => {
    const { upcoming, past } = partitionBookings(
      [
        booking({ id: 'late', date: '2026-10-20' }),
        booking({ id: 'soon', date: '2026-10-10' }),
        booking({ id: 'old', date: '2026-10-01' }),
        booking({ id: 'older', date: '2026-09-01' }),
        booking({ id: 'cx', date: '2026-10-12', status: 'cancelled' }),
      ],
      Date.UTC(2026, 9, 5)
    );
    expect(upcoming.map(b => b.id)).toEqual(['soon', 'late']);
    expect(past.map(b => b.id)).toEqual(['cx', 'old', 'older']);
  });
});

describe('bookings', () => {
  it('books as the signed-in patient and shows the server result', async () => {
    const created = booking({ id: 'new' });
    svc.createAppointment.mockResolvedValue(created);
    svc.listMyAppointments.mockResolvedValue([created]);
    const store = signedIn();

    await store.dispatch(createBooking({ timeSlot: slot })).unwrap();
    expect(svc.createAppointment).toHaveBeenCalledWith(slot, 'patient-1');
    expect(store.getState().bookings.bookings.map(b => b.id)).toEqual(['new']);
  });

  it('refuses to book when signed out', async () => {
    const store = makeStore();
    await expect(store.dispatch(createBooking({ timeSlot: slot })).unwrap()).rejects.toMatch(/sign in/i);
    expect(svc.createAppointment).not.toHaveBeenCalled();
  });

  it('surfaces the server message when someone else got the slot first', async () => {
    svc.createAppointment.mockRejectedValue(new Error('That time slot was just booked by someone else. Please choose another.'));
    const store = signedIn();
    await store.dispatch(createBooking({ timeSlot: slot }));
    expect(store.getState().bookings.error).toMatch(/just booked/);
    expect(store.getState().bookings.bookings).toEqual([]);
  });

  it('cancels on the server and reloads', async () => {
    svc.updateAppointmentStatus.mockResolvedValue(booking({ status: 'cancelled' }));
    svc.listMyAppointments.mockResolvedValue([booking({ id: 'b1', status: 'cancelled' })]);
    const store = signedIn();

    await store.dispatch(cancelBooking('b1')).unwrap();
    expect(svc.updateAppointmentStatus).toHaveBeenCalledWith('b1', 'cancelled');
    expect(store.getState().bookings.bookings[0].status).toBe('cancelled');
  });

  it('counts only pending and confirmed appointments as occupying a slot', async () => {
    svc.listMyAppointments.mockResolvedValue([
      booking({ id: 'p', status: 'pending' }),
      booking({ id: 'c', status: 'confirmed' }),
      booking({ id: 'x', status: 'cancelled' }),
      booking({ id: 'd', status: 'completed' }),
    ]);
    const store = signedIn();
    await store.dispatch(loadBookings());
    expect(selectActiveBookings(store.getState()).map(b => b.id)).toEqual(['p', 'c']);
  });
});

describe('signing out', () => {
  it("leaves nothing of the previous account's appointments or favorites behind", async () => {
    (authService.logout as jest.Mock).mockResolvedValue(undefined);
    svc.listMyAppointments.mockResolvedValue([booking()]);
    const store = signedIn();
    await store.dispatch(loadBookings());
    await store.dispatch(toggleFavorite('doctor-1'));
    expect(store.getState().bookings.bookings).toHaveLength(1);
    expect(store.getState().favorites.ids).toEqual(['doctor-1']);

    await store.dispatch(logoutUser());
    expect(store.getState().auth.user).toBeNull();
    expect(store.getState().bookings.bookings).toEqual([]);
    expect(store.getState().favorites.ids).toEqual([]);
  });
});

describe('favorites', () => {
  it('toggles, persists, and reloads for the same user', async () => {
    const store = signedIn();
    await store.dispatch(toggleFavorite('d1'));
    await store.dispatch(toggleFavorite('d2'));
    await store.dispatch(toggleFavorite('d1'));
    expect(store.getState().favorites.ids).toEqual(['d2']);

    const again = signedIn();
    await again.dispatch(loadFavorites());
    expect(again.getState().favorites.ids).toEqual(['d2']);
  });

  it('keeps each account favorites separate on a shared device', async () => {
    const first = signedIn(patient);
    await first.dispatch(toggleFavorite('d1'));

    const second = signedIn(doctorUser);
    await second.dispatch(loadFavorites());
    expect(second.getState().favorites.ids).toEqual([]);
  });

  it('needs an account to save favorites', async () => {
    const store = makeStore();
    await store.dispatch(toggleFavorite('d1'));
    expect(store.getState().favorites.ids).toEqual([]);
  });

  it('ignores corrupted stored favorites', async () => {
    await AsyncStorage.setItem('@doctora_favorites:patient-1', JSON.stringify(['a', 3, null, 'b']));
    const store = signedIn();
    await store.dispatch(loadFavorites());
    expect(store.getState().favorites.ids).toEqual(['a', 'b']);
  });
});

describe('doctor filters', () => {
  const doc = (id: string, over: Partial<Doctor> = {}): Doctor => ({
    id,
    name: id.toUpperCase(),
    timezone: 'Asia/Manila',
    availabilities: [],
    ...over,
  });
  const doctors = [
    doc('a', { specialty: 'Cardiology', rating: 4.9 }),
    doc('b', { specialty: 'Cardiology', rating: 4.1 }),
    doc('c', { specialty: 'Dermatology', rating: 4.5 }),
    doc('d'),
  ];
  const storeWith = async () => {
    const store = signedIn();
    store.dispatch(loadDoctors.fulfilled({ doctors, fromCache: false, updatedAt: 1 }, 'req', undefined));
    await store.dispatch(toggleFavorite('c'));
    return store;
  };
  const ids = (s: ReturnType<typeof makeStore>) => selectFilteredDoctors(s.getState()).map(d => d.id);

  it('returns everyone with no filters and lists unique specialties', async () => {
    const store = await storeWith();
    expect(ids(store)).toEqual(['a', 'b', 'c', 'd']);
    expect(selectSpecialties(store.getState())).toEqual(['Cardiology', 'Dermatology']);
  });

  it('filters by specialty, rating and favorites, and combines them', async () => {
    const store = await storeWith();
    store.dispatch(setSpecialty('Cardiology'));
    expect(ids(store)).toEqual(['a', 'b']);
    store.dispatch(setMinRating(4.5));
    expect(ids(store)).toEqual(['a']);
    store.dispatch(clearFilters());
    store.dispatch(setFavoritesOnly(true));
    expect(ids(store)).toEqual(['c']);
  });

  it('search also matches specialty; unrated doctors fail a rating filter', async () => {
    const store = await storeWith();
    store.dispatch(setSearchQuery('derm'));
    expect(ids(store)).toEqual(['c']);
    store.dispatch(setSearchQuery(''));
    store.dispatch(setMinRating(4));
    expect(ids(store)).not.toContain('d');
  });
});

describe('MyBookings tabs', () => {
  it('shows upcoming with a cancel button, and past with status badges', async () => {
    svc.listMyAppointments.mockResolvedValue([
      booking({ id: 'up', doctorName: 'Future Doc', date: '2099-01-01', status: 'confirmed' }),
      booking({ id: 'done', doctorName: 'Done Doc', date: '2020-01-01', status: 'confirmed' }),
      booking({ id: 'cx', doctorName: 'Cancelled Doc', date: '2099-02-01', status: 'cancelled' }),
    ]);
    const store = signedIn();
    render(
      <Provider store={store}>
        <NavigationContainer>
          <MyBookingsScreen />
        </NavigationContainer>
      </Provider>
    );

    expect(await screen.findByText('Future Doc')).toBeTruthy();
    expect(screen.queryByText('Done Doc')).toBeNull();
    expect(screen.getByText('Confirmed')).toBeTruthy();
    expect(screen.getByText('Cancel Appointment')).toBeTruthy();

    fireEvent.press(screen.getByRole('tab', { name: 'Past, 2' }));
    expect(screen.getByText('Done Doc')).toBeTruthy();
    expect(screen.getByText('Cancelled Doc')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.getByText('Cancelled')).toBeTruthy();
    expect(screen.queryByText('Cancel Appointment')).toBeNull();
    expect(screen.queryByText('Future Doc')).toBeNull();
  });

  it('marks a request the doctor has not accepted yet', async () => {
    svc.listMyAppointments.mockResolvedValue([booking({ doctorName: 'Wait Doc', status: 'pending' })]);
    render(
      <Provider store={signedIn()}>
        <NavigationContainer>
          <MyBookingsScreen />
        </NavigationContainer>
      </Provider>
    );
    expect(await screen.findByText('Awaiting confirmation')).toBeTruthy();
  });
});

describe('filterFutureSlots', () => {
  const at = (startTime: string) => ({ ...slot, date: '2026-10-01', startTime });

  it('drops slots that already started, judged in the doctor time zone', () => {
    // 09:15 Perth (UTC+8) = 01:15 UTC
    const now = Date.UTC(2026, 9, 1, 1, 15);
    const kept = filterFutureSlots([at('08:30'), at('09:00'), at('09:30'), at('10:00')], now);
    expect(kept.map(s => s.startTime)).toEqual(['09:30', '10:00']);
  });
});

