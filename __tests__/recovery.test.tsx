import React from 'react';
import { Provider } from 'react-redux';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { supabase } from '../src/config/supabase';
import * as authService from '../src/services/authService';
import { selectUser } from '../src/store/slices/authSlice';
import { ConfirmEmailScreen } from '../src/screens/auth/ConfirmEmailScreen';
import { ForgotPasswordScreen } from '../src/screens/auth/ForgotPasswordScreen';
import { LoginScreen } from '../src/screens/auth/LoginScreen';
import { RegisterScreen } from '../src/screens/auth/RegisterScreen';
import { ResetPasswordScreen } from '../src/screens/auth/ResetPasswordScreen';
import { mapSupabaseError } from '../src/services/supabaseErrors';
import { isValidCode } from '../src/utils/validation';
import { makeStore } from './helpers/testStore';

jest.mock('../src/utils/logger');

const auth = supabase.auth as unknown as Record<string, jest.Mock>;
const from = supabase.from as unknown as jest.Mock;

const profileQuery = (row: unknown) => {
  const chain: Record<string, jest.Mock> = {};
  ['select', 'eq'].forEach(m => (chain[m] = jest.fn(() => chain)));
  chain.single = jest.fn(async () => ({ data: row, error: null }));
  return chain;
};
const profile = {
  id: 'u1',
  email: 'doc@example.test',
  first_name: 'Dana',
  last_name: 'Doc',
  full_name: 'Dana Doc',
  phone: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  from.mockReturnValue(profileQuery(profile));
});

describe('isValidCode', () => {
  it.each(['123456', ' 654321 ', '12345678'])('accepts %p', v =>
    expect(isValidCode(v)).toBe(true),
  );
  it.each(['', '12345', 'abcdef', '12 3456', '12345678901'])('rejects %p', v =>
    expect(isValidCode(v)).toBe(false),
  );
});

describe('error messages for codes', () => {
  it.each(['Token has expired or is invalid', 'Invalid OTP', 'otp_expired'])(
    'explains %p',
    message => {
      expect(mapSupabaseError({ message })).toBe(
        'That code is wrong or has expired. Request a new one.',
      );
    },
  );

  it('explains reusing the old password', () => {
    expect(
      mapSupabaseError({
        message: 'New password should be different from the old password.',
      }),
    ).toMatch(/different from your current one/);
  });
});

describe('recovery service', () => {
  it('asks for a code by email', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    await authService.requestPasswordReset(' doc@example.test ');
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('doc@example.test');
  });

  it('verifies the code, sets the new password, and returns the signed-in doctor', async () => {
    auth.verifyOtp.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    });
    auth.updateUser.mockResolvedValue({ data: {}, error: null });
    const user = await authService.resetPassword(
      'doc@example.test',
      ' 123456 ',
      'new-secret',
    );
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'doc@example.test',
      token: '123456',
      type: 'recovery',
    });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'new-secret' });
    expect(user.fullName).toBe('Dana Doc');
  });

  it('does not change the password when the code is wrong', async () => {
    auth.verifyOtp.mockResolvedValue({
      data: {},
      error: { message: 'Token has expired or is invalid' },
    });
    await expect(
      authService.resetPassword('a@b.co', '000000', 'new-secret'),
    ).rejects.toThrow(/wrong or has expired/);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('signs the half-finished recovery session out if the new password is refused', async () => {
    auth.verifyOtp.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    });
    auth.updateUser.mockResolvedValue({
      data: {},
      error: {
        message: 'New password should be different from the old password.',
      },
    });
    auth.signOut.mockResolvedValue({ error: null });
    await expect(
      authService.resetPassword('a@b.co', '123456', 'same'),
    ).rejects.toThrow(/different/);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('confirms a sign-up with the emailed code', async () => {
    auth.verifyOtp.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    });
    const user = await authService.confirmSignup('doc@example.test', '123456');
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'doc@example.test',
      token: '123456',
      type: 'signup',
    });
    expect(user.id).toBe('u1');
  });

  it('can send the sign-up code again', async () => {
    auth.resend.mockResolvedValue({ data: {}, error: null });
    await authService.resendSignupCode('doc@example.test');
    expect(auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'doc@example.test',
    });
  });
});

const nav = () => ({ navigate: jest.fn(), goBack: jest.fn() });

describe('Forgot password screen', () => {
  it('checks the email, sends the code, and moves on to entering it', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    const navigation = nav();
    render(
      <Provider store={makeStore()}>
        <ForgotPasswordScreen navigation={navigation as never} />
      </Provider>,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
    expect(screen.getByText('Enter a valid email address')).toBeTruthy();
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByLabelText('Email'), 'doc@example.test');
    fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
    await waitFor(() =>
      expect(navigation.navigate).toHaveBeenCalledWith('ResetPassword', {
        email: 'doc@example.test',
      }),
    );
  });

  it('stays on the screen and shows the problem if sending fails', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { message: 'email rate limit exceeded' },
    });
    const navigation = nav();
    render(
      <Provider store={makeStore()}>
        <ForgotPasswordScreen navigation={navigation as never} />
      </Provider>,
    );
    fireEvent.changeText(screen.getByLabelText('Email'), 'doc@example.test');
    fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText(/Too many attempts/)).toBeTruthy();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});

describe('Reset password screen', () => {
  const renderScreen = (store = makeStore()) => {
    render(
      <Provider store={store}>
        <ResetPasswordScreen
          route={{ params: { email: 'doc@example.test' } } as never}
        />
      </Provider>,
    );
    return store;
  };

  it('validates the code and both passwords before calling the server', () => {
    renderScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Reset password' }));
    expect(screen.getByText('Enter the code from the email')).toBeTruthy();
    expect(screen.getByText('Use at least 6 characters')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Code'), '123456');
    fireEvent.changeText(screen.getByLabelText('New password'), 'new-secret');
    fireEvent.changeText(
      screen.getByLabelText('Confirm new password'),
      'different',
    );
    fireEvent.press(screen.getByRole('button', { name: 'Reset password' }));
    expect(screen.getByText('Passwords do not match')).toBeTruthy();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('resets the password and signs the doctor in', async () => {
    auth.verifyOtp.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    });
    auth.updateUser.mockResolvedValue({ data: {}, error: null });
    const store = renderScreen();
    fireEvent.changeText(screen.getByLabelText('Code'), '123456');
    fireEvent.changeText(screen.getByLabelText('New password'), 'new-secret');
    fireEvent.changeText(
      screen.getByLabelText('Confirm new password'),
      'new-secret',
    );
    fireEvent.press(screen.getByRole('button', { name: 'Reset password' }));
    await waitFor(() => expect(selectUser(store.getState())?.id).toBe('u1'));
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'new-secret' });
  });

  it('shows a wrong or expired code and stays signed out', async () => {
    auth.verifyOtp.mockResolvedValue({
      data: {},
      error: { message: 'Token has expired or is invalid' },
    });
    const store = renderScreen();
    fireEvent.changeText(screen.getByLabelText('Code'), '000000');
    fireEvent.changeText(screen.getByLabelText('New password'), 'new-secret');
    fireEvent.changeText(
      screen.getByLabelText('Confirm new password'),
      'new-secret',
    );
    fireEvent.press(screen.getByRole('button', { name: 'Reset password' }));
    expect(
      await screen.findByText(
        'That code is wrong or has expired. Request a new one.',
      ),
    ).toBeTruthy();
    expect(selectUser(store.getState())).toBeNull();
  });

  it('can ask for a new code', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    renderScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Send a new code' }));
    expect(await screen.findByText('A new code is on its way.')).toBeTruthy();
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('doc@example.test');
  });
});

describe('Confirm email screen', () => {
  const renderScreen = () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <ConfirmEmailScreen
          route={{ params: { email: 'doc@example.test' } } as never}
        />
      </Provider>,
    );
    return store;
  };

  it('needs a code, then confirms the account and signs in', async () => {
    auth.verifyOtp.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    });
    const store = renderScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
    expect(screen.getByText('Enter the code from the email')).toBeTruthy();
    expect(auth.verifyOtp).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByLabelText('Code'), '123456');
    fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(selectUser(store.getState())?.id).toBe('u1'));
  });

  it('can send the code again', async () => {
    auth.resend.mockResolvedValue({ data: {}, error: null });
    renderScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Send a new code' }));
    expect(await screen.findByText('A new code is on its way.')).toBeTruthy();
  });
});

describe('links between the screens', () => {
  it('sign-in offers Forgot password', () => {
    const navigation = nav();
    render(
      <Provider store={makeStore()}>
        <LoginScreen navigation={navigation as never} />
      </Provider>,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(navigation.navigate).toHaveBeenCalledWith('ForgotPassword');
  });

  it('registering when the project wants confirmation goes to the code screen', async () => {
    auth.signUp.mockResolvedValue({
      data: { user: { id: 'u3' }, session: null },
      error: null,
    });
    const navigation = nav();
    render(
      <Provider store={makeStore()}>
        <RegisterScreen navigation={navigation as never} />
      </Provider>,
    );
    fireEvent.changeText(screen.getByLabelText('First name'), 'Eve');
    fireEvent.changeText(screen.getByLabelText('Last name'), 'Tester');
    fireEvent.changeText(screen.getByLabelText('Email'), 'eve@example.test');
    fireEvent.changeText(screen.getByLabelText('Specialization'), 'Cardiology');
    fireEvent.changeText(screen.getByLabelText('Password'), 'secret1');
    fireEvent.changeText(screen.getByLabelText('Confirm password'), 'secret1');
    fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'I agree to the Terms of Service and Privacy Policy',
      }),
    );
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    });
    await waitFor(() =>
      expect(navigation.navigate).toHaveBeenCalledWith('ConfirmEmail', {
        email: 'eve@example.test',
      }),
    );
  });
});
