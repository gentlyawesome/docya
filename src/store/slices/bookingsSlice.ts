import {
  createSlice,
  createAsyncThunk,
  createSelector,
} from '@reduxjs/toolkit';
import { Booking } from '../../types';
import { DEFAULT_REMINDER_MINUTES } from '../../constants';
import { getBookingPhase } from '../../utils/bookingPhases';
import { logError } from '../../utils/logger';
import * as storage from '../../services/storage';
import { cancelReminder, scheduleReminder } from '../../services/reminders';
import {
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
      ? {
          ...b,
          reminderId: reminders[b.id].reminderId,
          reminderLeadMinutes: reminders[b.id].leadMinutes,
        }
      : b,
  );
};

// Doctors create appointments, so the patient's phone learns about them here. Keep the local
// reminders in step: schedule one for every upcoming appointment and drop those of cancelled
// ones. A reminder problem never blocks or fails loading the appointments.
const syncReminders = async (bookings: Booking[]): Promise<void> => {
  try {
    const stored = await storage.loadReminders();
    const upcoming = bookings.filter(
      b => b.status !== 'cancelled' && getBookingPhase(b) === 'upcoming',
    );
    const liveIds = new Set(upcoming.map(b => b.id));

    for (const [appointmentId, info] of Object.entries(stored)) {
      if (!liveIds.has(appointmentId)) {
        await cancelReminder(info.reminderId);
        await storage.removeReminder(appointmentId);
      }
    }
    for (const booking of upcoming) {
      if (!stored[booking.id]) {
        const result = await scheduleReminder(
          booking,
          DEFAULT_REMINDER_MINUTES,
        );
        if (result.status === 'scheduled') {
          await storage.saveReminder(booking.id, {
            reminderId: result.reminderId,
            leadMinutes: result.leadMinutes,
          });
        }
      }
    }
  } catch (error) {
    logError('Could not sync reminders:', error);
  }
};

const loadAll = async () => {
  const bookings = await listMyAppointments();
  await syncReminders(bookings);
  return withReminders(bookings);
};

export const loadBookings = createAsyncThunk(
  'bookings/load',
  async (_, { rejectWithValue }) => {
    try {
      return await loadAll();
    } catch (error) {
      return rejectWithValue(messageOf(error, 'Failed to load appointments'));
    }
  },
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
  },
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

export const selectAllBookings = (state: { bookings: BookingsState }) =>
  state.bookings.bookings;
export const selectBookingsLoading = (state: { bookings: BookingsState }) =>
  state.bookings.loading;
export const selectBookingsError = (state: { bookings: BookingsState }) =>
  state.bookings.error;

// Bookings that still occupy a slot (cancelled and completed ones do not)
export const selectActiveBookings = createSelector(
  [selectAllBookings],
  bookings =>
    bookings.filter(b => b.status === undefined || b.status === 'confirmed'),
);

export default bookingsSlice.reducer;
