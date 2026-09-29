import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { configureStore } from '@reduxjs/toolkit';
import { fetchDoctorsWithCache, getCachedDoctors } from '../src/services/doctorsRepository';
import doctorsReducer, {
  hydrateDoctorsFromCache,
  loadDoctors,
  selectFilteredDoctors,
  setSearchQuery,
} from '../src/store/slices/doctorsSlice';
import favoritesReducer from '../src/store/slices/favoritesSlice';
import bookingsReducer, { selectActiveBookings } from '../src/store/slices/bookingsSlice';
import { STORAGE_KEYS } from '../src/constants';

jest.mock('axios');
jest.mock('../src/utils/logger');
const mockedGet = axios.get as jest.Mock;

const record = (name: string, tz = 'Australia/Sydney') => ({
  name,
  timezone: tz,
  day_of_week: 'Monday',
  available_at: ' 9:00AM',
  available_until: ' 5:00PM',
});

const makeStore = () =>
  configureStore({ reducer: { doctors: doctorsReducer, bookings: bookingsReducer, favorites: favoritesReducer } });

beforeEach(async () => {
  await AsyncStorage.clear();
  mockedGet.mockReset();
});

describe('fetchDoctorsWithCache', () => {
  it('returns fresh data and writes the cache', async () => {
    mockedGet.mockResolvedValue({ data: [record('Ann Lee')] });
    const result = await fetchDoctorsWithCache();
    expect(result.fromCache).toBe(false);
    expect(result.doctors[0].name).toBe('Ann Lee');
    const cached = await getCachedDoctors();
    expect(cached?.doctors[0].name).toBe('Ann Lee');
  });

  it('falls back to the cache when the network fails', async () => {
    mockedGet.mockResolvedValueOnce({ data: [record('Ann Lee')] });
    await fetchDoctorsWithCache();
    mockedGet.mockRejectedValue(new Error('offline'));
    const result = await fetchDoctorsWithCache();
    expect(result.fromCache).toBe(true);
    expect(result.doctors).toHaveLength(1);
  });

  it('throws when the network fails and there is no cache', async () => {
    mockedGet.mockRejectedValue(new Error('offline'));
    await expect(fetchDoctorsWithCache()).rejects.toThrow('Failed to fetch');
  });

  it('ignores a corrupted cache', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.DOCTORS_CACHE, '{not json');
    expect(await getCachedDoctors()).toBeNull();
    await AsyncStorage.setItem(
      STORAGE_KEYS.DOCTORS_CACHE,
      JSON.stringify({ records: [{ bad: true }], savedAt: 1 })
    );
    expect(await getCachedDoctors()).toBeNull();
  });
});

describe('doctors slice', () => {
  it('hydrates from cache, then a fresh load replaces it', async () => {
    mockedGet.mockResolvedValueOnce({ data: [record('Old Doc')] });
    await fetchDoctorsWithCache();

    const store = makeStore();
    await store.dispatch(hydrateDoctorsFromCache());
    expect(store.getState().doctors.doctors[0].name).toBe('Old Doc');
    expect(store.getState().doctors.fromCache).toBe(true);

    mockedGet.mockResolvedValue({ data: [record('New Doc')] });
    await store.dispatch(loadDoctors());
    expect(store.getState().doctors.doctors[0].name).toBe('New Doc');
    expect(store.getState().doctors.fromCache).toBe(false);
  });

  it('does not let a late hydrate overwrite fresh data', async () => {
    mockedGet.mockResolvedValueOnce({ data: [record('Old Doc')] });
    await fetchDoctorsWithCache();
    mockedGet.mockResolvedValue({ data: [record('New Doc')] });

    const store = makeStore();
    await store.dispatch(loadDoctors());
    await store.dispatch(hydrateDoctorsFromCache());
    expect(store.getState().doctors.doctors[0].name).toBe('New Doc');
    expect(store.getState().doctors.fromCache).toBe(false);
  });
});

describe('selector memoization', () => {
  it('selectFilteredDoctors keeps its reference across unrelated updates', async () => {
    mockedGet.mockResolvedValue({ data: [record('Ann Lee'), record('Bob Ray')] });
    const store = makeStore();
    await store.dispatch(loadDoctors());
    store.dispatch(setSearchQuery('ann'));
    const first = selectFilteredDoctors(store.getState());
    expect(first).toHaveLength(1);
    expect(selectFilteredDoctors(store.getState())).toBe(first);
  });

  it('selectActiveBookings keeps its reference until bookings change', () => {
    const store = makeStore();
    const first = selectActiveBookings(store.getState());
    expect(selectActiveBookings(store.getState())).toBe(first);
  });
});
