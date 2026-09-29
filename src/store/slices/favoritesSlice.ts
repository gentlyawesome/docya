import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as storage from '../../services/storage';
import { deleteAccount, logoutUser } from './authSlice';

interface FavoritesState {
  ids: string[];
}

const initialState: FavoritesState = { ids: [] };

const currentUserId = (getState: () => unknown): string | null =>
  (getState() as { auth: { user: { id: string } | null } }).auth.user?.id ?? null;

export const loadFavorites = createAsyncThunk('favorites/load', (_, { getState }) => {
  const userId = currentUserId(getState);
  return userId ? storage.loadFavorites(userId) : [];
});

export const toggleFavorite = createAsyncThunk(
  'favorites/toggle',
  async (doctorId: string, { getState, rejectWithValue }) => {
    const userId = currentUserId(getState);
    if (!userId) {
      return rejectWithValue('Sign in to save favorites');
    }
    const current = (getState() as { favorites: FavoritesState }).favorites.ids;
    const next = current.includes(doctorId)
      ? current.filter(id => id !== doctorId)
      : [...current, doctorId];
    try {
      await storage.saveFavorites(userId, next);
      return next;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to save favorites');
    }
  }
);

const favoritesSlice = createSlice({
  name: 'favorites',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(loadFavorites.fulfilled, (state, action) => {
        state.ids = action.payload;
      })
      .addCase(toggleFavorite.fulfilled, (state, action) => {
        state.ids = action.payload;
      })
      .addCase(logoutUser.fulfilled, () => initialState)
      .addCase(deleteAccount.fulfilled, () => initialState);
  },
});

export const selectFavoriteIds = (state: { favorites: FavoritesState }) => state.favorites.ids;

export default favoritesSlice.reducer;
