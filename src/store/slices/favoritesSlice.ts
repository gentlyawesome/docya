import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as storage from '../../services/storage';

interface FavoritesState {
  ids: string[];
}

const initialState: FavoritesState = { ids: [] };

export const loadFavorites = createAsyncThunk('favorites/load', () => storage.loadFavorites());

export const toggleFavorite = createAsyncThunk(
  'favorites/toggle',
  async (doctorId: string, { getState, rejectWithValue }) => {
    const current = (getState() as { favorites: FavoritesState }).favorites.ids;
    const next = current.includes(doctorId)
      ? current.filter(id => id !== doctorId)
      : [...current, doctorId];
    try {
      await storage.saveFavorites(next);
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
      });
  },
});

export const selectFavoriteIds = (state: { favorites: FavoritesState }) => state.favorites.ids;

export default favoritesSlice.reducer;
