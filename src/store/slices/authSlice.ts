import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { User } from '../../types';
import * as authService from '../../services/authService';
import { RegisterInput } from '../../services/authService';
import { updateUserProfile, UserProfileUpdate } from '../../services/userService';

interface AuthState {
  user: User | null;
  initialized: boolean;
  loading: boolean;
  error: string | null;
  notice: string | null;
}

const initialState: AuthState = {
  user: null,
  initialized: false,
  loading: false,
  error: null,
  notice: null,
};

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const initializeAuth = createAsyncThunk('auth/initialize', () =>
  authService.getSessionUser()
);

export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      return await authService.login(email, password);
    } catch (error) {
      return rejectWithValue(messageOf(error, 'Login failed'));
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/register',
  async (input: RegisterInput, { rejectWithValue }) => {
    try {
      return await authService.register(input);
    } catch (error) {
      return rejectWithValue(messageOf(error, 'Registration failed'));
    }
  }
);

export const logoutUser = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
  try {
    await authService.logout();
  } catch (error) {
    return rejectWithValue(messageOf(error, 'Logout failed'));
  }
});

export const deleteAccount = createAsyncThunk('auth/deleteAccount', async (_, { rejectWithValue }) => {
  try {
    await authService.deleteAccount();
  } catch (error) {
    return rejectWithValue(messageOf(error, 'Could not delete your account'));
  }
});

export const saveUserProfile = createAsyncThunk(
  'auth/saveProfile',
  async (
    { userId, update }: { userId: string; update: UserProfileUpdate },
    { rejectWithValue }
  ) => {
    try {
      return await updateUserProfile(userId, update);
    } catch (error) {
      return rejectWithValue(messageOf(error, 'Could not save your profile'));
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthMessages: state => {
      state.error = null;
      state.notice = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.user = action.payload;
        state.initialized = true;
      })
      .addCase(initializeAuth.rejected, state => {
        state.initialized = true;
      })
      .addCase(loginUser.pending, state => {
        state.loading = true;
        state.error = null;
        state.notice = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(registerUser.pending, state => {
        state.loading = true;
        state.error = null;
        state.notice = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.status === 'signed_in') {
          state.user = action.payload.user;
        } else {
          state.notice = 'Check your email for a confirmation link, then sign in.';
        }
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(logoutUser.fulfilled, state => {
        state.user = null;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      .addCase(deleteAccount.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteAccount.fulfilled, state => {
        state.loading = false;
        state.user = null;
      })
      .addCase(deleteAccount.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(saveUserProfile.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

export const { clearAuthMessages } = authSlice.actions;

type Root = { auth: AuthState };
export const selectUser = (state: Root) => state.auth.user;
export const selectAuthInitialized = (state: Root) => state.auth.initialized;
export const selectAuthLoading = (state: Root) => state.auth.loading;
export const selectAuthError = (state: Root) => state.auth.error;
export const selectAuthNotice = (state: Root) => state.auth.notice;

export default authSlice.reducer;
