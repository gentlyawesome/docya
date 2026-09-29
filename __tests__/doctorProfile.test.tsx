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

describe('doctor profile screen', () => {
  let saveSpy: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(users, 'getDoctorProfile').mockResolvedValue(saved);
    saveSpy = jest.spyOn(users, 'saveDoctorProfile').mockResolvedValue(saved);
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

  it('offers only what the app still uses', async () => {
    await open();
    expect(screen.getByLabelText('Specialization')).toBeTruthy();
    expect(screen.getByLabelText('Time zone')).toBeTruthy();
    expect(screen.queryByLabelText(/fee/i)).toBeNull();
    expect(screen.queryByLabelText('Clinic name')).toBeNull();
    expect(screen.queryByLabelText('About you')).toBeNull();
    expect(screen.queryByText('Contact support')).toBeNull();
    expect(screen.getByText('Privacy policy')).toBeTruthy();
  });

  it('saves an edited specialization', async () => {
    const field = await open();
    fireEvent.changeText(field, 'Neurology');
    fireEvent.press(screen.getByText('Save professional details'));
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    expect(saveSpy.mock.calls[0][1]).toEqual({
      specialization: 'Neurology',
      timezone: 'Asia/Manila',
    });
  });

  it('will not save a blank specialization or an unknown time zone', async () => {
    const field = await open();
    fireEvent.changeText(field, '   ');
    fireEvent.changeText(screen.getByLabelText('Time zone'), 'Mars/Olympus');
    fireEvent.press(screen.getByText('Save professional details'));
    expect(await screen.findByText('Enter your specialization')).toBeTruthy();
    expect(
      screen.getByText('Use a time zone name such as Asia/Manila'),
    ).toBeTruthy();
    expect(saveSpy).not.toHaveBeenCalled();
  });
});
