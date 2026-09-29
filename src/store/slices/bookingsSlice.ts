import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { Booking, TimeSlot } from '../../types';
import * as storage from '../../services/storage';
import { cancelReminder, scheduleReminder, ReminderResult } from '../../services/reminders';

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
  async (
    { timeSlot, reminderLeadMinutes = null }: { timeSlot: TimeSlot; reminderLeadMinutes?: number | null },
    { rejectWithValue }
  ) => {
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
      let updatedBookings = await storage.addBooking(booking);

      // A reminder problem must never undo or fail the booking itself
      let reminder: ReminderResult | null = null;
      if (reminderLeadMinutes !== null) {
        reminder = await scheduleReminder(booking, reminderLeadMinutes);
        if (reminder.status === 'scheduled') {
          updatedBookings = await storage.updateBooking(booking.id, {
            reminderId: reminder.reminderId,
            reminderLeadMinutes: reminder.leadMinutes,
          });
        }
      }
      return { bookings: updatedBookings, reminder };
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
      const existing = (await storage.loadBookings()).find(b => b.id === bookingId);
      if (existing?.reminderId) {
        await cancelReminder(existing.reminderId);
      }
      const updatedBookings = await storage.cancelBookingById(bookingId);
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
        state.bookings = action.payload.bookings;
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

// Bookings that still occupy a slot (cancelled ones free it up)
export const selectActiveBookings = createSelector([selectAllBookings], bookings =>
  bookings.filter(booking => booking.status !== 'cancelled')
);

export default bookingsSlice.reducer;
