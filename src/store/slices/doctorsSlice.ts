import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Doctor } from '../../types';
import { fetchDoctors } from '../../services/api';

interface DoctorsState {
  doctors: Doctor[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
}

const initialState: DoctorsState = {
  doctors: [],
  loading: false,
  error: null,
  searchQuery: '',
};

// Async thunk to fetch doctors
export const loadDoctors = createAsyncThunk(
  'doctors/loadDoctors',
  async (_, { rejectWithValue }) => {
    try {
      const doctors = await fetchDoctors();
      return doctors;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to load doctors'
      );
    }
  }
);

const doctorsSlice = createSlice({
  name: 'doctors',
  initialState,
  reducers: {
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
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
        state.doctors = action.payload;
        state.error = null;
      })
      .addCase(loadDoctors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSearchQuery, clearError } = doctorsSlice.actions;

// Selectors
export const selectAllDoctors = (state: { doctors: DoctorsState }) => state.doctors.doctors;
export const selectDoctorsLoading = (state: { doctors: DoctorsState }) => state.doctors.loading;
export const selectDoctorsError = (state: { doctors: DoctorsState }) => state.doctors.error;
export const selectSearchQuery = (state: { doctors: DoctorsState }) => state.doctors.searchQuery;

export const selectFilteredDoctors = (state: { doctors: DoctorsState }) => {
  const { doctors, searchQuery } = state.doctors;
  if (!searchQuery.trim()) {
    return doctors;
  }
  
  const query = searchQuery.toLowerCase();
  return doctors.filter(doctor =>
    doctor.name.toLowerCase().includes(query) ||
    doctor.timezone.toLowerCase().includes(query)
  );
};

export default doctorsSlice.reducer;
