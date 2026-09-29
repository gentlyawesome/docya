import { createAsyncThunk, createSlice, isAnyOf } from '@reduxjs/toolkit';
import { User } from '../../types';
import * as authService from '../../services/authService';
import { RegisterInput } from '../../services/authService';
import {
  updateUserProfile,
  UserProfileUpdate,
} from '../../services/userService';

interface AuthState {
  user: User | null;
  initialized: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  initialized: false,
  loading: false,
  error: null,
};

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const initializeAuth = createAsyncThunk('auth/initialize', () =>
  authService.getSessionUser(),
);

export const loginUser = createAsyncThunk(
  'auth/login',
  async (
    { email, password }: { email: string; password: string },
    { rejectWithValue },
  ) => {
    try {
      return await authService.login(email, password);
    } catch (error) {
      return rejectWithValue(messageOf(error, 'Login failed'));
    }
  },
);

export const registerUser = createAsyncThunk(
  'auth/register',
  async (input: RegisterInput, { rejectWithValue }) => {
    try {
      return await authService.register(input);
    } catch (error) {
      return rejectWithValue(messageOf(error, 'Registration failed'));
    }
  },
);

export const requestReset = createAsyncThunk(
  'auth/requestReset',
  async (email: string, { rejectWithValue }) => {
    try {
      await authService.requestPasswordReset(email);
    } catch (error) {
      return rejectWithValue(messageOf(error, 'Could not send the code'));
    }
  },
);

export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async (
    {
      email,
      code,
      newPassword,
    }: { email: string; code: string; newPassword: string },
    { rejectWithValue },
  ) => {
    try {
      return await authService.resetPassword(email, code, newPassword);
    } catch (error) {
      return rejectWithValue(messageOf(error, 'Could not reset your password'));
    }
  },
);

export const confirmSignup = createAsyncThunk(
  'auth/confirmSignup',
  async (
    { email, code }: { email: string; code: string },
    { rejectWithValue },
  ) => {
    try {
      return await authService.confirmSignup(email, code);
    } catch (error) {
      return rejectWithValue(
        messageOf(error, 'Could not confirm your account'),
      );
    }
  },
);

export const resendCode = createAsyncThunk(
  'auth/resendCode',
  async (email: string, { rejectWithValue }) => {
    try {
      await authService.resendSignupCode(email);
    } catch (error) {
      return rejectWithValue(messageOf(error, 'Could not send a new code'));
    }
  },
);

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout();
    } catch (error) {
      return rejectWithValue(messageOf(error, 'Logout failed'));
    }
  },
);

export const deleteAccount = createAsyncThunk(
  'auth/deleteAccount',
  async (_, { rejectWithValue }) => {
    try {
      await authService.deleteAccount();
    } catch (error) {
      return rejectWithValue(messageOf(error, 'Could not delete your account'));
    }
  },
);

export const saveUserProfile = createAsyncThunk(
  'auth/saveProfile',
  async (
    { userId, update }: { userId: string; update: UserProfileUpdate },
    { rejectWithValue },
  ) => {
    try {
      return await updateUserProfile(userId, update);
    } catch (error) {
      return rejectWithValue(messageOf(error, 'Could not save your profile'));
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthMessages: state => {
      state.error = null;
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
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.status === 'signed_in') {
          state.user = action.payload.user;
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
      })
      .addMatcher(
        isAnyOf(
          requestReset.pending,
          resetPassword.pending,
          confirmSignup.pending,
          resendCode.pending,
        ),
        state => {
          state.loading = true;
          state.error = null;
        },
      )
      .addMatcher(
        isAnyOf(resetPassword.fulfilled, confirmSignup.fulfilled),
        (state, action) => {
          state.loading = false;
          state.user = action.payload;
        },
      )
      .addMatcher(
        isAnyOf(requestReset.fulfilled, resendCode.fulfilled),
        state => {
          state.loading = false;
        },
      )
      .addMatcher(
        isAnyOf(
          requestReset.rejected,
          resetPassword.rejected,
          confirmSignup.rejected,
          resendCode.rejected,
        ),
        (state, action) => {
          state.loading = false;
          state.error = action.payload as string;
        },
      );
  },
});

export const { clearAuthMessages } = authSlice.actions;

type Root = { auth: AuthState };
export const selectUser = (state: Root) => state.auth.user;
export const selectAuthInitialized = (state: Root) => state.auth.initialized;
export const selectAuthLoading = (state: Root) => state.auth.loading;
export const selectAuthError = (state: Root) => state.auth.error;

export default authSlice.reducer;
