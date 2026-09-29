import { configureStore } from '@reduxjs/toolkit';
import doctorsReducer from './slices/doctorsSlice';
import bookingsReducer from './slices/bookingsSlice';
import favoritesReducer from './slices/favoritesSlice';
import authReducer from './slices/authSlice';

export const store = configureStore({
  reducer: {
    doctors: doctorsReducer,
    bookings: bookingsReducer,
    favorites: favoritesReducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['bookings/create/fulfilled', 'bookings/load/fulfilled'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
