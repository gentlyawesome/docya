import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchDoctorsWithCache, getCachedDoctors } from '../src/services/doctorsRepository';
import { fetchDoctors } from '../src/services/doctorsService';
import {
  hydrateDoctorsFromCache,
  loadDoctors,
  selectFilteredDoctors,
  setSearchQuery,
} from '../src/store/slices/doctorsSlice';
import { STORAGE_KEYS } from '../src/constants';
import { Doctor } from '../src/types';
import { makeStore } from './helpers/testStore';

jest.mock('../src/services/doctorsService');
jest.mock('../src/utils/logger');
const mockedFetch = fetchDoctors as jest.Mock;

const doctor = (name: string): Doctor => ({
  id: name.toLowerCase().replace(/\s+/g, '-'),
  name,
  timezone: 'Asia/Manila',
  availabilities: [],
});

beforeEach(async () => {
  await AsyncStorage.clear();
  mockedFetch.mockReset();
});

describe('fetchDoctorsWithCache', () => {
  it('returns fresh data and writes the cache', async () => {
    mockedFetch.mockResolvedValue([doctor('Ann Lee')]);
    const result = await fetchDoctorsWithCache();
    expect(result.fromCache).toBe(false);
    expect(result.doctors[0].name).toBe('Ann Lee');
    expect((await getCachedDoctors())?.doctors[0].name).toBe('Ann Lee');
  });

  it('falls back to the cache when the network fails', async () => {
    mockedFetch.mockResolvedValueOnce([doctor('Ann Lee')]);
    await fetchDoctorsWithCache();
    mockedFetch.mockRejectedValue(new Error('Network error'));
    const result = await fetchDoctorsWithCache();
    expect(result.fromCache).toBe(true);
    expect(result.doctors).toHaveLength(1);
  });

  it('throws when the network fails and there is no cache', async () => {
    mockedFetch.mockRejectedValue(new Error('Network error'));
    await expect(fetchDoctorsWithCache()).rejects.toThrow('Network error');
  });

  it('ignores a corrupted or invalid cache', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.DOCTORS_CACHE, '{not json');
    expect(await getCachedDoctors()).toBeNull();
    await AsyncStorage.setItem(
      STORAGE_KEYS.DOCTORS_CACHE,
      JSON.stringify({ doctors: [{ id: 5 }], savedAt: 1 })
    );
    expect(await getCachedDoctors()).toBeNull();
  });
});

describe('doctors slice', () => {
  it('hydrates from cache, then a fresh load replaces it', async () => {
    mockedFetch.mockResolvedValueOnce([doctor('Old Doc')]);
    await fetchDoctorsWithCache();

    const store = makeStore();
    await store.dispatch(hydrateDoctorsFromCache());
    expect(store.getState().doctors.doctors[0].name).toBe('Old Doc');
    expect(store.getState().doctors.fromCache).toBe(true);

    mockedFetch.mockResolvedValue([doctor('New Doc')]);
    await store.dispatch(loadDoctors());
    expect(store.getState().doctors.doctors[0].name).toBe('New Doc');
    expect(store.getState().doctors.fromCache).toBe(false);
  });

  it('does not let a late hydrate overwrite fresh data', async () => {
    mockedFetch.mockResolvedValueOnce([doctor('Old Doc')]);
    await fetchDoctorsWithCache();
    mockedFetch.mockResolvedValue([doctor('New Doc')]);

    const store = makeStore();
    await store.dispatch(loadDoctors());
    await store.dispatch(hydrateDoctorsFromCache());
    expect(store.getState().doctors.doctors[0].name).toBe('New Doc');
    expect(store.getState().doctors.fromCache).toBe(false);
  });

  it('surfaces a friendly error when there is neither network nor cache', async () => {
    mockedFetch.mockRejectedValue(new Error('Network error. Please check your internet connection.'));
    const store = makeStore();
    await store.dispatch(loadDoctors());
    expect(store.getState().doctors.error).toMatch(/internet connection/);
  });

  it('keeps the filtered list reference stable until something relevant changes', async () => {
    mockedFetch.mockResolvedValue([doctor('Ann Lee'), doctor('Bob Ray')]);
    const store = makeStore();
    await store.dispatch(loadDoctors());
    store.dispatch(setSearchQuery('ann'));
    const first = selectFilteredDoctors(store.getState());
    expect(first).toHaveLength(1);
    expect(selectFilteredDoctors(store.getState())).toBe(first);
  });
});
