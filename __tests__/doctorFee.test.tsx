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
import { isValidFee } from '../src/utils/validation';
import { DoctorProfileScreen } from '../src/screens/profile/DoctorProfileScreen';
import { doctorUser, signedIn } from './helpers/testStore';

jest.mock('../src/utils/logger');

const saved = {
  userId: 'doctor-1',
  specialization: 'Cardiology',
  clinicName: 'Heart Clinic',
  consultationFee: 1500,
  bio: '',
  timezone: 'Asia/Manila',
};

describe('isValidFee', () => {
  it.each(['0', '1200', '1200.5', '1200.50', ' 800 '])('accepts %p', v =>
    expect(isValidFee(v)).toBe(true),
  );
  it.each([
    '',
    'abc',
    '-5',
    '1e3',
    'Infinity',
    '1,200',
    '12.345',
    '123456789',
    '12.',
  ])('rejects %p', v => expect(isValidFee(v)).toBe(false));
});

describe('saveDoctorProfile fee', () => {
  const upsert = jest.fn();
  beforeEach(() => {
    upsert.mockReset();
    (supabase.from as jest.Mock).mockReturnValue({
      upsert: upsert.mockReturnValue({
        select: () => ({
          single: async () => ({
            data: {
              user_id: 'doctor-1',
              specialization: 'Cardiology',
              consultation_fee: '1250.50',
              timezone: 'Asia/Manila',
            },
            error: null,
          }),
        }),
      }),
    });
  });

  it('sends the fee to doctor_profiles and reads it back as a number', async () => {
    const result = await users.saveDoctorProfile('doctor-1', {
      ...saved,
      consultationFee: 1250.5,
    });
    expect(upsert.mock.calls[0][0]).toMatchObject({
      user_id: 'doctor-1',
      consultation_fee: 1250.5,
    });
    expect(result.consultationFee).toBe(1250.5);
  });

  it('clears the fee with null when it is left empty', async () => {
    await users.saveDoctorProfile('doctor-1', {
      ...saved,
      consultationFee: undefined,
    });
    expect(upsert.mock.calls[0][0].consultation_fee).toBeNull();
  });
});

describe('doctor profile fee field', () => {
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
    return screen.findByDisplayValue('1500');
  };

  it('shows the current fee and saves an edited one', async () => {
    const field = await open();
    fireEvent.changeText(field, '2000');
    fireEvent.press(screen.getByText('Save professional details'));
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    expect(saveSpy.mock.calls[0][1].consultationFee).toBe(2000);
  });

  it('saves an empty fee as no fee', async () => {
    const field = await open();
    fireEvent.changeText(field, '');
    fireEvent.press(screen.getByText('Save professional details'));
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    expect(saveSpy.mock.calls[0][1].consultationFee).toBeUndefined();
  });

  it.each(['abc', '-5', '1e9', 'Infinity', '12.345'])(
    'blocks %p with a message and does not save',
    async bad => {
      const field = await open();
      fireEvent.changeText(field, bad);
      fireEvent.press(screen.getByText('Save professional details'));
      expect(
        await screen.findByText('Enter an amount such as 1200 or 1200.50'),
      ).toBeTruthy();
      expect(saveSpy).not.toHaveBeenCalled();
    },
  );
});
