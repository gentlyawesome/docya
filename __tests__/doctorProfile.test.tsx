import React from 'react';
import { Alert } from 'react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';
import * as users from '../src/services/userService';
import { supabase } from '../src/config/supabase';
import { DoctorProfileScreen } from '../src/screens/profile/DoctorProfileScreen';
import { doctorUser, signedIn } from './helpers/testStore';

jest.mock('../src/utils/logger');

const saved = {
  userId: 'doctor-1',
  specialization: 'Cardiology',
  timezone: 'Asia/Manila',
};

describe('saveDoctorProfile', () => {
  it('sends only the professional details that exist', async () => {
    const upsert = jest.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            user_id: 'doctor-1',
            specialization: 'Cardiology',
            timezone: 'Asia/Manila',
          },
          error: null,
        }),
      }),
    });
    (supabase.from as jest.Mock).mockReturnValue({ upsert });

    const result = await users.saveDoctorProfile('doctor-1', {
      specialization: ' Cardiology ',
      timezone: 'Asia/Manila',
    });

    expect(upsert.mock.calls[0][0]).toEqual({
      user_id: 'doctor-1',
      specialization: 'Cardiology',
      timezone: 'Asia/Manila',
    });
    expect(result).toEqual(saved);
  });
});

describe('profile screen: one form, one Save button', () => {
  let saveDoctor: jest.SpyInstance;
  let saveAccount: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(users, 'getDoctorProfile').mockResolvedValue(saved);
    saveDoctor = jest
      .spyOn(users, 'saveDoctorProfile')
      .mockResolvedValue(saved);
    saveAccount = jest
      .spyOn(users, 'updateUserProfile')
      .mockImplementation(async (_id, update) => ({
        ...doctorUser,
        firstName: update.firstName,
        lastName: update.lastName,
        phone: update.phone,
      }));
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  const open = async () => {
    render(
      <Provider store={signedIn(doctorUser)}>
        <NavigationContainer>
          <DoctorProfileScreen />
        </NavigationContainer>
      </Provider>,
    );
    return screen.findByDisplayValue('Cardiology');
  };
  const press = () =>
    fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));

  it('shows name, phone, specialization and time zone together under one Save button', async () => {
    await open();
    ['First name', 'Last name', 'Phone', 'Specialization', 'Time zone'].forEach(
      label => expect(screen.getByLabelText(label)).toBeTruthy(),
    );
    expect(screen.getAllByRole('button', { name: /^Save/ })).toHaveLength(1);
    expect(screen.queryByText('Save professional details')).toBeNull();
    expect(screen.queryByText('Save personal information')).toBeNull();
    expect(screen.queryByLabelText(/fee/i)).toBeNull();
    expect(screen.queryByText('Contact support')).toBeNull();
    expect(screen.getByText('Privacy policy')).toBeTruthy();
    expect(screen.getByText(doctorUser.email)).toBeTruthy();
  });

  it('saves both parts with a single press and confirms once', async () => {
    const field = await open();
    fireEvent.changeText(screen.getByLabelText('First name'), 'Dina');
    fireEvent.changeText(screen.getByLabelText('Phone'), '+63 917 555 0001');
    fireEvent.changeText(field, 'Neurology');
    press();
    await waitFor(() => expect(saveDoctor).toHaveBeenCalledTimes(1));
    expect(saveAccount).toHaveBeenCalledWith('doctor-1', {
      firstName: 'Dina',
      lastName: 'Doc',
      phone: '+63 917 555 0001',
    });
    expect(saveDoctor.mock.calls[0][1]).toEqual({
      specialization: 'Neurology',
      timezone: 'Asia/Manila',
    });
    const calls = (Alert.alert as jest.Mock).mock.calls;
    expect(calls).toEqual([['Saved', 'Your details were updated.']]);
  });

  it('checks every field first and saves nothing if any is wrong', async () => {
    const field = await open();
    fireEvent.changeText(screen.getByLabelText('First name'), ' ');
    fireEvent.changeText(screen.getByLabelText('Phone'), 'call me');
    fireEvent.changeText(field, '   ');
    fireEvent.changeText(screen.getByLabelText('Time zone'), 'Mars/Olympus');
    press();
    expect(await screen.findByText('Enter your first name')).toBeTruthy();
    expect(screen.getByText('Enter a valid phone number')).toBeTruthy();
    expect(screen.getByText('Enter your specialization')).toBeTruthy();
    expect(
      screen.getByText('Use a time zone name such as Asia/Manila'),
    ).toBeTruthy();
    expect(saveAccount).not.toHaveBeenCalled();
    expect(saveDoctor).not.toHaveBeenCalled();
  });

  it('does not touch the professional part if saving the account part fails', async () => {
    saveAccount.mockRejectedValue(
      new Error('TypeError: Network request failed'),
    );
    await open();
    press();
    await waitFor(() =>
      expect((Alert.alert as jest.Mock).mock.calls.length).toBe(1),
    );
    expect((Alert.alert as jest.Mock).mock.calls[0][0]).toBe('Could not save');
    expect(saveDoctor).not.toHaveBeenCalled();
  });

  it('tells the doctor when the professional part fails', async () => {
    saveDoctor.mockRejectedValue(new Error('That time zone is not valid'));
    await open();
    press();
    await waitFor(() =>
      expect((Alert.alert as jest.Mock).mock.calls.length).toBe(1),
    );
    expect((Alert.alert as jest.Mock).mock.calls[0]).toEqual([
      'Could not save',
      'That time zone is not valid',
    ]);
  });
});
