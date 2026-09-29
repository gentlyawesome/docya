import React from 'react';
import { Provider } from 'react-redux';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';
import {
  clearAuthMessages,
  deleteAccount,
  initializeAuth,
  loginUser,
  registerUser,
  selectAuthError,
  selectAuthNotice,
  selectUser,
} from '../src/store/slices/authSlice';
import * as authService from '../src/services/authService';
import { supabase } from '../src/config/supabase';
import {
  login,
  register,
  deleteAccount as deleteAccountService,
  getSessionUser,
} from '../src/services/authService';
import { LoginScreen } from '../src/screens/auth/LoginScreen';
import { RegisterScreen } from '../src/screens/auth/RegisterScreen';
import { doctorUser, makeStore, patient } from './helpers/testStore';

jest.mock('../src/utils/logger');

const auth = supabase.auth as unknown as Record<string, jest.Mock>;
const rpc = supabase.rpc as unknown as jest.Mock;
const from = supabase.from as unknown as jest.Mock;

// A chainable stand-in for supabase.from('profiles').select().eq().single()
const profileQuery = (row: unknown, error: unknown = null) => {
  const chain: Record<string, jest.Mock> = {};
  ['select', 'eq'].forEach(m => (chain[m] = jest.fn(() => chain)));
  chain.single = jest.fn(async () => ({ data: row, error }));
  return chain;
};

const profileRow = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  email: 'pat@example.test',
  first_name: 'Pat',
  last_name: 'Patient',
  full_name: 'Pat Patient',
  role: 'patient',
  phone: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('authService', () => {
  it('signs in and loads the profile with its role', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    });
    from.mockReturnValue(profileQuery(profileRow({ role: 'doctor' })));
    const user = await login(' pat@example.test ', 'secret1');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'pat@example.test',
      password: 'secret1',
    });
    expect(user).toMatchObject({
      id: 'u1',
      role: 'doctor',
      fullName: 'Pat Patient',
    });
  });

  it('turns a server rejection into a friendly message', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    });
    await expect(login('a@b.co', 'bad')).rejects.toThrow(
      'Invalid email or password.',
    );
  });

  it('sends the role and doctor details as sign-up metadata', async () => {
    auth.signUp.mockResolvedValue({
      data: { user: { id: 'u2' }, session: { access_token: 't' } },
      error: null,
    });
    from.mockReturnValue(
      profileQuery(profileRow({ id: 'u2', role: 'doctor' })),
    );
    const result = await register({
      email: 'doc@example.test',
      password: 'secret1',
      firstName: ' Dana ',
      lastName: 'Doc',
      role: 'doctor',
      specialization: 'Cardiology',
      licenseNumber: 'LIC-1',
    });
    expect(result.status).toBe('signed_in');
    expect(auth.signUp.mock.calls[0][0].options.data).toMatchObject({
      first_name: 'Dana',
      last_name: 'Doc',
      full_name: 'Dana Doc',
      role: 'doctor',
      specialization: 'Cardiology',
      license_number: 'LIC-1',
    });
  });

  it('reports when the project requires email confirmation first', async () => {
    auth.signUp.mockResolvedValue({
      data: { user: { id: 'u3' }, session: null },
      error: null,
    });
    const result = await register({
      email: 'a@b.co',
      password: 'secret1',
      firstName: 'A',
      lastName: 'B',
      role: 'patient',
    });
    expect(result).toEqual({ status: 'confirm_email' });
  });

  it('restores the session user at startup, or null when there is no session', async () => {
    auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    expect(await getSessionUser()).toBeNull();
    auth.getSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'u1' } } },
      error: null,
    });
    from.mockReturnValue(profileQuery(profileRow()));
    expect(await getSessionUser()).toMatchObject({ id: 'u1' });
  });

  it('deletes the account through the server function and clears the local session', async () => {
    rpc.mockResolvedValue({ error: null });
    auth.signOut.mockResolvedValue({ error: null });
    await deleteAccountService();
    expect(rpc).toHaveBeenCalledWith('delete_my_account');
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('does not clear the session when the server refuses to delete the account', async () => {
    rpc.mockResolvedValue({ error: { message: 'Not authenticated' } });
    await expect(deleteAccountService()).rejects.toBeTruthy();
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});

describe('auth state', () => {
  it('starts uninitialised, then settles signed out when there is no session', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const store = makeStore();
    expect(store.getState().auth.initialized).toBe(false);
    await store.dispatch(initializeAuth());
    expect(store.getState().auth.initialized).toBe(true);
    expect(selectUser(store.getState())).toBeNull();
  });

  it('still becomes initialised when restoring the session throws', async () => {
    auth.getSession.mockRejectedValue(new Error('offline'));
    const store = makeStore();
    await store.dispatch(initializeAuth());
    expect(store.getState().auth.initialized).toBe(true);
  });

  it('keeps the error for a failed login and clears it on request', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    });
    const store = makeStore();
    await store.dispatch(loginUser({ email: 'a@b.co', password: 'bad' }));
    expect(selectAuthError(store.getState())).toBe(
      'Invalid email or password.',
    );
    store.dispatch(clearAuthMessages());
    expect(selectAuthError(store.getState())).toBeNull();
  });

  it('shows a notice instead of signing in when email confirmation is required', async () => {
    auth.signUp.mockResolvedValue({
      data: { user: { id: 'u3' }, session: null },
      error: null,
    });
    const store = makeStore();
    await store.dispatch(
      registerUser({
        email: 'a@b.co',
        password: 'secret1',
        firstName: 'A',
        lastName: 'B',
        role: 'patient',
      }),
    );
    expect(selectUser(store.getState())).toBeNull();
    expect(selectAuthNotice(store.getState())).toMatch(/confirmation link/);
  });

  it('signs out locally after deleting the account', async () => {
    jest.spyOn(authService, 'deleteAccount').mockResolvedValue(undefined);
    const store = makeStore();
    store.dispatch(
      loginUser.fulfilled(patient, 'req', {
        email: patient.email,
        password: 'x',
      }),
    );
    await store.dispatch(deleteAccount());
    expect(selectUser(store.getState())).toBeNull();
  });

  it('tells patients and doctors apart', () => {
    const store = makeStore();
    store.dispatch(
      loginUser.fulfilled(doctorUser, 'req', { email: 'd', password: 'x' }),
    );
    expect(selectUser(store.getState())?.role).toBe('doctor');
  });
});

describe('sign-in screen', () => {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() } as never;

  it('validates before sending anything to the server', () => {
    render(
      <Provider store={makeStore()}>
        <LoginScreen navigation={navigation} />
      </Provider>,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter a valid email address')).toBeTruthy();
    expect(screen.getByText('Enter your password')).toBeTruthy();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('shows the server error for a wrong password', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    });
    render(
      <Provider store={makeStore()}>
        <LoginScreen navigation={navigation} />
      </Provider>,
    );
    fireEvent.changeText(screen.getByLabelText('Email'), 'pat@example.test');
    fireEvent.changeText(screen.getByLabelText('Password'), 'wrong-password');
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Invalid email or password.')).toBeTruthy();
  });

  it('offers account creation', () => {
    render(
      <Provider store={makeStore()}>
        <LoginScreen navigation={navigation} />
      </Provider>,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Create an account' }));
    expect(
      (navigation as unknown as { navigate: jest.Mock }).navigate,
    ).toHaveBeenCalledWith('Register');
  });
});

describe('register screen', () => {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() } as never;
  const renderScreen = () =>
    render(
      <Provider store={makeStore()}>
        <RegisterScreen navigation={navigation} />
      </Provider>,
    );

  it('checks every field before registering', () => {
    renderScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Enter your first name')).toBeTruthy();
    expect(screen.getByText('Enter your last name')).toBeTruthy();
    expect(screen.getByText('Enter a valid email address')).toBeTruthy();
    expect(screen.getByText('Use at least 6 characters')).toBeTruthy();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('catches a password confirmation mismatch', () => {
    renderScreen();
    fireEvent.changeText(screen.getByLabelText('First name'), 'Eve');
    fireEvent.changeText(screen.getByLabelText('Last name'), 'Tester');
    fireEvent.changeText(screen.getByLabelText('Email'), 'eve@example.test');
    fireEvent.changeText(screen.getByLabelText('Password'), 'secret1');
    fireEvent.changeText(screen.getByLabelText('Confirm password'), 'secret2');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Passwords do not match')).toBeTruthy();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('asks doctors for a specialization and license, and patients for neither', () => {
    renderScreen();
    expect(screen.queryByLabelText('Specialization')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Doctor filter' }));
    expect(screen.getByLabelText('Specialization')).toBeTruthy();
    expect(screen.getByLabelText('License number')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Enter your specialization')).toBeTruthy();
    expect(screen.getByText('Enter your license number')).toBeTruthy();
  });

  it('registers with valid details', async () => {
    auth.signUp.mockResolvedValue({
      data: { user: { id: 'u9' }, session: { access_token: 't' } },
      error: null,
    });
    from.mockReturnValue(profileQuery(profileRow({ id: 'u9' })));
    renderScreen();
    fireEvent.changeText(screen.getByLabelText('First name'), 'Eve');
    fireEvent.changeText(screen.getByLabelText('Last name'), 'Tester');
    fireEvent.changeText(screen.getByLabelText('Email'), 'eve@example.test');
    fireEvent.changeText(screen.getByLabelText('Password'), 'secret1');
    fireEvent.changeText(screen.getByLabelText('Confirm password'), 'secret1');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(auth.signUp).toHaveBeenCalledTimes(1));
    expect(auth.signUp.mock.calls[0][0]).toMatchObject({
      email: 'eve@example.test',
      password: 'secret1',
    });
  });
});
