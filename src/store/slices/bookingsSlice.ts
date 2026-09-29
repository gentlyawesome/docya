import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { Booking, TimeSlot } from '../../types';
import * as storage from '../../services/storage';
import { cancelReminder, scheduleReminder, ReminderResult } from '../../services/reminders';
import {
  createAppointment,
  listMyAppointments,
  updateAppointmentStatus,
} from '../../services/appointmentsService';
import { deleteAccount, logoutUser } from './authSlice';

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

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

// Appointments come from the server; the reminder for each one is a device-only detail
const withReminders = async (bookings: Booking[]): Promise<Booking[]> => {
  const reminders = await storage.loadReminders();
  return bookings.map(b =>
    reminders[b.id]
      ? { ...b, reminderId: reminders[b.id].reminderId, reminderLeadMinutes: reminders[b.id].leadMinutes }
      : b
  );
};

const loadAll = async () => withReminders(await listMyAppointments());

export const loadBookings = createAsyncThunk('bookings/load', async (_, { rejectWithValue }) => {
  try {
    return await loadAll();
  } catch (error) {
    return rejectWithValue(messageOf(error, 'Failed to load appointments'));
  }
});

export const createBooking = createAsyncThunk(
  'bookings/create',
  async (
    { timeSlot, reminderLeadMinutes = null }: { timeSlot: TimeSlot; reminderLeadMinutes?: number | null },
    { getState, rejectWithValue }
  ) => {
    const state = getState() as { auth: { user: { id: string } | null }; bookings: BookingsState };
    const userId = state.auth.user?.id;
    if (!userId) {
      return rejectWithValue('Please sign in to book an appointment');
    }

    let booking: Booking;
    try {
      booking = await createAppointment(timeSlot, userId);
    } catch (error) {
      return rejectWithValue(messageOf(error, 'Failed to create booking'));
    }

    // A reminder problem must never undo or fail the booking itself
    let reminder: ReminderResult | null = null;
    if (reminderLeadMinutes !== null) {
      reminder = await scheduleReminder(booking, reminderLeadMinutes);
      if (reminder.status === 'scheduled') {
        await storage.saveReminder(booking.id, {
          reminderId: reminder.reminderId,
          leadMinutes: reminder.leadMinutes,
        });
      }
    }

    let bookings: Booking[];
    try {
      bookings = await loadAll();
    } catch {
      bookings = await withReminders([...state.bookings.bookings, booking]);
    }
    return { bookings, reminder };
  }
);

export const cancelBooking = createAsyncThunk(
  'bookings/cancel',
  async (bookingId: string, { rejectWithValue }) => {
    try {
      await updateAppointmentStatus(bookingId, 'cancelled');
      const reminder = await storage.removeReminder(bookingId);
      if (reminder) {
        await cancelReminder(reminder.reminderId);
      }
      return await loadAll();
    } catch (error) {
      return rejectWithValue(messageOf(error, 'Failed to cancel appointment'));
    }
  }
);

const bookingsSlice = createSlice({
  name: 'bookings',
  initialState,
  reducers: {
    clearBookingsError: state => {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(loadBookings.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadBookings.fulfilled, (state, action) => {
        state.loading = false;
        state.bookings = action.payload;
      })
      .addCase(loadBookings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createBooking.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createBooking.fulfilled, (state, action) => {
        state.loading = false;
        state.bookings = action.payload.bookings;
      })
      .addCase(createBooking.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(cancelBooking.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(cancelBooking.fulfilled, (state, action) => {
        state.loading = false;
        state.bookings = action.payload;
      })
      .addCase(cancelBooking.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Nothing from one account may be visible to the next one
      .addCase(logoutUser.fulfilled, () => initialState)
      .addCase(deleteAccount.fulfilled, () => initialState);
  },
});

export const { clearBookingsError } = bookingsSlice.actions;

export const selectAllBookings = (state: { bookings: BookingsState }) => state.bookings.bookings;
export const selectBookingsLoading = (state: { bookings: BookingsState }) => state.bookings.loading;
export const selectBookingsError = (state: { bookings: BookingsState }) => state.bookings.error;

// Bookings that still occupy a slot (cancelled and completed ones do not)
export const selectActiveBookings = createSelector([selectAllBookings], bookings =>
  bookings.filter(b => b.status === undefined || b.status === 'pending' || b.status === 'confirmed')
);

export default bookingsSlice.reducer;
