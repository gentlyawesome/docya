import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Booking, TimeSlot } from '../../types';
import * as storage from '../../services/storage';

interface BookingsState {
  bookings: Booking[];
  loading: boolean;
  error: string | null;
}

const initialState: BookingsState = {
  bookings: [],
  loading: false,
  error: null,
};

// Async thunk to load bookings from storage
export const loadBookingsFromStorage = createAsyncThunk(
  'bookings/loadFromStorage',
  async (_, { rejectWithValue }) => {
    try {
      const bookings = await storage.loadBookings();
      return bookings;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to load bookings'
      );
    }
  }
);

// Async thunk to create a booking
export const createBooking = createAsyncThunk(
  'bookings/create',
  async (timeSlot: TimeSlot, { rejectWithValue }) => {
    try {
      // Check if slot is already booked
      const isBooked = await storage.isSlotBooked(
        timeSlot.doctorId,
        timeSlot.date,
        timeSlot.startTime
      );
      
      if (isBooked) {
        return rejectWithValue('This time slot is already booked');
      }
      
      // Create booking object
      const booking: Booking = {
        id: `${timeSlot.doctorId}-${timeSlot.date}-${timeSlot.startTime}-${Date.now()}`,
        doctorId: timeSlot.doctorId,
        doctorName: timeSlot.doctorName,
        date: timeSlot.date,
        startTime: timeSlot.startTime,
        endTime: timeSlot.endTime,
        dayOfWeek: timeSlot.dayOfWeek,
        timezone: timeSlot.timezone,
        bookedAt: new Date().toISOString(),
      };
      
      // Save to storage
      const updatedBookings = await storage.addBooking(booking);
      return updatedBookings;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to create booking'
      );
    }
  }
);

// Async thunk to cancel a booking
export const cancelBooking = createAsyncThunk(
  'bookings/cancel',
  async (bookingId: string, { rejectWithValue }) => {
    try {
      const updatedBookings = await storage.removeBooking(bookingId);
      return updatedBookings;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to cancel booking'
      );
    }
  }
);

const bookingsSlice = createSlice({
  name: 'bookings',
  initialState,
  reducers: {
    clearBookingsError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Load bookings
      .addCase(loadBookingsFromStorage.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadBookingsFromStorage.fulfilled, (state, action) => {
        state.loading = false;
        state.bookings = action.payload;
        state.error = null;
      })
      .addCase(loadBookingsFromStorage.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create booking
      .addCase(createBooking.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createBooking.fulfilled, (state, action) => {
        state.loading = false;
        state.bookings = action.payload;
        state.error = null;
      })
      .addCase(createBooking.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Cancel booking
      .addCase(cancelBooking.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(cancelBooking.fulfilled, (state, action) => {
        state.loading = false;
        state.bookings = action.payload;
        state.error = null;
      })
      .addCase(cancelBooking.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearBookingsError } = bookingsSlice.actions;

// Selectors
export const selectAllBookings = (state: { bookings: BookingsState }) => state.bookings.bookings;
export const selectBookingsLoading = (state: { bookings: BookingsState }) => state.bookings.loading;
export const selectBookingsError = (state: { bookings: BookingsState }) => state.bookings.error;

// Get bookings sorted by date and time (upcoming first)
export const selectUpcomingBookings = (state: { bookings: BookingsState }) => {
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];
  
  return [...state.bookings.bookings]
    .filter(booking => booking.date >= currentDate)
    .sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.startTime.localeCompare(b.startTime);
    });
};

// Get past bookings
export const selectPastBookings = (state: { bookings: BookingsState }) => {
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];
  
  return [...state.bookings.bookings]
    .filter(booking => booking.date < currentDate)
    .sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return b.startTime.localeCompare(a.startTime);
    });
};

export default bookingsSlice.reducer;
