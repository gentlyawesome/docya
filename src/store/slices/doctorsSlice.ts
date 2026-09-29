import { createSlice, createAsyncThunk, createSelector, PayloadAction } from '@reduxjs/toolkit';
import { Doctor } from '../../types';
import { selectFavoriteIds } from './favoritesSlice';
import { fetchDoctorsWithCache, getCachedDoctors } from '../../services/doctorsRepository';

interface DoctorsState {
  doctors: Doctor[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  fromCache: boolean;
  lastUpdated: number | null;
  specialty: string | null;
  minRating: number | null;
  favoritesOnly: boolean;
}

const initialState: DoctorsState = {
  doctors: [],
  loading: false,
  error: null,
  searchQuery: '',
  fromCache: false,
  lastUpdated: null,
  specialty: null,
  minRating: null,
  favoritesOnly: false,
};

// Async thunk to fetch doctors
export const loadDoctors = createAsyncThunk(
  'doctors/loadDoctors',
  async (_, { rejectWithValue }) => {
    try {
      return await fetchDoctorsWithCache();
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to load doctors'
      );
    }
  }
);

// Shows saved doctors immediately on launch, before the network refresh finishes
export const hydrateDoctorsFromCache = createAsyncThunk('doctors/hydrateFromCache', () =>
  getCachedDoctors()
);

const doctorsSlice = createSlice({
  name: 'doctors',
  initialState,
  reducers: {
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setSpecialty: (state, action: PayloadAction<string | null>) => {
      state.specialty = action.payload;
    },
    setMinRating: (state, action: PayloadAction<number | null>) => {
      state.minRating = action.payload;
    },
    setFavoritesOnly: (state, action: PayloadAction<boolean>) => {
      state.favoritesOnly = action.payload;
    },
    clearFilters: (state) => {
      state.specialty = null;
      state.minRating = null;
      state.favoritesOnly = false;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadDoctors.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadDoctors.fulfilled, (state, action) => {
        state.loading = false;
        state.doctors = action.payload.doctors;
        state.fromCache = action.payload.fromCache;
        state.lastUpdated = action.payload.updatedAt;
        state.error = null;
      })
      .addCase(hydrateDoctorsFromCache.fulfilled, (state, action) => {
        if (action.payload && state.doctors.length === 0) {
          state.doctors = action.payload.doctors;
          state.fromCache = true;
          state.lastUpdated = action.payload.updatedAt;
        }
      })
      .addCase(loadDoctors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  setSearchQuery,
  setSpecialty,
  setMinRating,
  setFavoritesOnly,
  clearFilters,
  clearError,
} = doctorsSlice.actions;

// Selectors
export const selectAllDoctors = (state: { doctors: DoctorsState }) => state.doctors.doctors;
export const selectDoctorsLoading = (state: { doctors: DoctorsState }) => state.doctors.loading;
export const selectDoctorsError = (state: { doctors: DoctorsState }) => state.doctors.error;
export const selectSearchQuery = (state: { doctors: DoctorsState }) => state.doctors.searchQuery;

export const selectDoctorsFromCache = (state: { doctors: DoctorsState }) => state.doctors.fromCache;
export const selectDoctorsLastUpdated = (state: { doctors: DoctorsState }) =>
  state.doctors.lastUpdated;

export const selectSpecialty = (state: { doctors: DoctorsState }) => state.doctors.specialty;
export const selectMinRating = (state: { doctors: DoctorsState }) => state.doctors.minRating;
export const selectFavoritesOnly = (state: { doctors: DoctorsState }) => state.doctors.favoritesOnly;

export const selectSpecialties = createSelector([selectAllDoctors], doctors =>
  [...new Set(doctors.map(d => d.specialty).filter((s): s is string => !!s))].sort()
);

export const selectHasRatings = createSelector([selectAllDoctors], doctors =>
  doctors.some(d => d.rating !== undefined)
);

export const selectHasActiveFilters = (state: { doctors: DoctorsState }) =>
  state.doctors.specialty !== null ||
  state.doctors.minRating !== null ||
  state.doctors.favoritesOnly;

export const selectFilteredDoctors = createSelector(
  [
    selectAllDoctors,
    selectSearchQuery,
    selectSpecialty,
    selectMinRating,
    selectFavoritesOnly,
    selectFavoriteIds,
  ],
  (doctors, searchQuery, specialty, minRating, favoritesOnly, favoriteIds) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query && specialty === null && minRating === null && !favoritesOnly) {
      return doctors;
    }
    return doctors.filter(
      doctor =>
        (!query ||
          doctor.name.toLowerCase().includes(query) ||
          doctor.timezone.toLowerCase().includes(query) ||
          !!doctor.specialty?.toLowerCase().includes(query)) &&
        (specialty === null || doctor.specialty === specialty) &&
        (minRating === null || (doctor.rating ?? 0) >= minRating) &&
        (!favoritesOnly || favoriteIds.includes(doctor.id))
    );
  }
);

export default doctorsSlice.reducer;
