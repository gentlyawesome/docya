import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';
import { render, screen, fireEvent } from '@testing-library/react-native';
import doctorsReducer, {
  loadDoctors,
  selectFilteredDoctors,
  selectSpecialties,
  setSearchQuery,
  setSpecialty,
  setMinRating,
  setFavoritesOnly,
  clearFilters,
} from '../src/store/slices/doctorsSlice';
import bookingsReducer, {
  createBooking,
  cancelBooking,
  selectActiveBookings,
} from '../src/store/slices/bookingsSlice';
import favoritesReducer, {
  loadFavorites,
  toggleFavorite,
} from '../src/store/slices/favoritesSlice';
import { getBookingPhase, partitionBookings } from '../src/utils/bookingPhases';
import { filterFutureSlots } from '../src/utils/timeSlotGenerator';
import { MyBookingsScreen } from '../src/screens/MyBookingsScreen';
import { Booking, Doctor, TimeSlot } from '../src/types';
import { STORAGE_KEYS } from '../src/constants';

jest.mock('../src/utils/logger');

const makeStore = () =>
  configureStore({
    reducer: {
      doctors: doctorsReducer,
      bookings: bookingsReducer,
      favorites: favoritesReducer,
    },
  });

const booking = (over: Partial<Booking>): Booking => ({
  id: 'b1',
  doctorId: 'd1',
  doctorName: 'Ann Lee',
  date: '2026-10-01',
  startTime: '09:00',
  endTime: '09:30',
  dayOfWeek: 'Thursday',
  timezone: 'Australia/Perth',
  bookedAt: '2026-09-01T00:00:00Z',
  ...over,
});

const slot: TimeSlot = {
  id: 's',
  doctorId: 'd1',
  doctorName: 'Ann Lee',
  date: '2099-01-01',
  startTime: '09:00',
  endTime: '09:30',
  dayOfWeek: 'Thursday',
  timezone: 'Australia/Perth',
  isBooked: false,
};

beforeEach(() => AsyncStorage.clear());

describe('booking phases', () => {
  // 09:30 in Perth (UTC+8) on 2026-10-01 is 01:30 UTC
  const endUtc = Date.UTC(2026, 9, 1, 1, 30);

  it('uses the doctor time zone to decide when an appointment has ended', () => {
    expect(getBookingPhase(booking({}), endUtc - 60_000)).toBe('upcoming');
    expect(getBookingPhase(booking({}), endUtc + 60_000)).toBe('completed');
  });

  it('treats cancelled as cancelled regardless of time, and missing status as confirmed', () => {
    expect(
      getBookingPhase(booking({ status: 'cancelled' }), endUtc - 60_000),
    ).toBe('cancelled');
    expect(
      getBookingPhase(booking({ status: undefined }), endUtc - 60_000),
    ).toBe('upcoming');
  });

  it('sorts upcoming soonest-first and past newest-first', () => {
    const now = Date.UTC(2026, 9, 5);
    const { upcoming, past } = partitionBookings(
      [
        booking({ id: 'late', date: '2026-10-20' }),
        booking({ id: 'soon', date: '2026-10-10' }),
        booking({ id: 'old', date: '2026-10-01' }),
        booking({ id: 'older', date: '2026-09-01' }),
        booking({ id: 'cx', date: '2026-10-12', status: 'cancelled' }),
      ],
      now,
    );
    expect(upcoming.map(b => b.id)).toEqual(['soon', 'late']);
    expect(past.map(b => b.id)).toEqual(['cx', 'old', 'older']);
  });
});

describe('cancelling keeps history and frees the slot', () => {
  it('marks the booking cancelled, hides it from active, and allows rebooking', async () => {
    const store = makeStore();
    await store.dispatch(createBooking({ timeSlot: slot })).unwrap();
    const id = store.getState().bookings.bookings[0].id;

    await store.dispatch(cancelBooking(id)).unwrap();
    const [saved] = store.getState().bookings.bookings;
    expect(saved.status).toBe('cancelled');
    expect(saved.cancelledAt).toBeTruthy();
    expect(selectActiveBookings(store.getState())).toHaveLength(0);

    await store.dispatch(createBooking({ timeSlot: slot })).unwrap();
    expect(store.getState().bookings.bookings).toHaveLength(2);
    expect(selectActiveBookings(store.getState())).toHaveLength(1);
  });

  it('still rejects a double booking of an active slot', async () => {
    const store = makeStore();
    await store.dispatch(createBooking({ timeSlot: slot })).unwrap();
    await expect(store.dispatch(createBooking({ timeSlot: slot })).unwrap()).rejects.toBe(
      'This time slot is already booked',
    );
  });
});

describe('favorites', () => {
  it('toggles, persists, and reloads', async () => {
    const store = makeStore();
    await store.dispatch(toggleFavorite('d1'));
    await store.dispatch(toggleFavorite('d2'));
    await store.dispatch(toggleFavorite('d1'));
    expect(store.getState().favorites.ids).toEqual(['d2']);

    const fresh = makeStore();
    await fresh.dispatch(loadFavorites());
    expect(fresh.getState().favorites.ids).toEqual(['d2']);
  });

  it('ignores corrupted stored favorites', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.FAVORITES,
      JSON.stringify({ nope: 1 }),
    );
    const store = makeStore();
    await store.dispatch(loadFavorites());
    expect(store.getState().favorites.ids).toEqual([]);

    await AsyncStorage.setItem(
      STORAGE_KEYS.FAVORITES,
      JSON.stringify(['a', 3, null, 'b']),
    );
    await store.dispatch(loadFavorites());
    expect(store.getState().favorites.ids).toEqual(['a', 'b']);
  });
});

describe('doctor filters', () => {
  const doctor = (id: string, over: Partial<Doctor> = {}): Doctor => ({
    id,
    name: id.toUpperCase(),
    timezone: 'Australia/Sydney',
    availabilities: [],
    ...over,
  });
  const doctors = [
    doctor('a', { specialty: 'Cardiologist', rating: 4.9 }),
    doctor('b', { specialty: 'Cardiologist', rating: 4.1 }),
    doctor('c', { specialty: 'Dermatologist', rating: 4.5 }),
    doctor('d'),
  ];
  const storeWith = async () => {
    const store = makeStore();
    store.dispatch(
      loadDoctors.fulfilled(
        { doctors, fromCache: false, updatedAt: 1 },
        'req',
        undefined,
      ),
    );
    await store.dispatch(toggleFavorite('c'));
    return store;
  };
  const ids = (s: ReturnType<typeof makeStore>) =>
    selectFilteredDoctors(s.getState()).map(d => d.id);

  it('returns everyone with no filters and lists unique specialties', async () => {
    const store = await storeWith();
    expect(ids(store)).toEqual(['a', 'b', 'c', 'd']);
    expect(selectSpecialties(store.getState())).toEqual([
      'Cardiologist',
      'Dermatologist',
    ]);
  });

  it('filters by specialty, rating, and favorites, and combines them', async () => {
    const store = await storeWith();
    store.dispatch(setSpecialty('Cardiologist'));
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
    await AsyncStorage.setItem(
      STORAGE_KEYS.BOOKINGS,
      JSON.stringify([
        booking({ id: 'up', doctorName: 'Future Doc', date: '2099-01-01' }),
        booking({ id: 'done', doctorName: 'Done Doc', date: '2020-01-01' }),
        booking({
          id: 'cx',
          doctorName: 'Cancelled Doc',
          date: '2099-02-01',
          status: 'cancelled',
        }),
      ]),
    );
    render(
      <Provider store={makeStore()}>
        <NavigationContainer>
          <MyBookingsScreen />
        </NavigationContainer>
      </Provider>,
    );

    expect(await screen.findByText('Future Doc')).toBeTruthy();
    expect(screen.queryByText('Done Doc')).toBeNull();
    expect(screen.getByText('Cancel Appointment')).toBeTruthy();

    fireEvent.press(screen.getByRole('tab', { name: 'Past, 2' }));
    expect(screen.getByText('Done Doc')).toBeTruthy();
    expect(screen.getByText('Cancelled Doc')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.getByText('Cancelled')).toBeTruthy();
    expect(screen.queryByText('Cancel Appointment')).toBeNull();
    expect(screen.queryByText('Future Doc')).toBeNull();
  });
});

describe('filterFutureSlots', () => {
  const at = (startTime: string): TimeSlot => ({ ...slot, date: '2026-10-01', startTime });

  it('drops slots that already started, judged in the doctor time zone', () => {
    // 09:15 Perth (UTC+8) = 01:15 UTC
    const now = Date.UTC(2026, 9, 1, 1, 15);
    const kept = filterFutureSlots([at('08:30'), at('09:00'), at('09:30'), at('10:00')], now);
    expect(kept.map(s => s.startTime)).toEqual(['09:30', '10:00']);
  });
});
