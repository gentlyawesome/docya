import React from 'react';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { render, screen, waitFor } from '@testing-library/react-native';
import * as users from '../src/services/userService';
import * as appointments from '../src/services/appointmentsService';
import { supabase } from '../src/config/supabase';
import {
  ApprovalBanner,
  approvalMessage,
} from '../src/components/ApprovalBanner';
import { DoctorDashboardScreen } from '../src/screens/doctor/DoctorDashboardScreen';
import { doctorUser, signedIn } from './helpers/testStore';
import { DoctorProfile } from '../src/types';

jest.mock('../src/utils/logger');
jest.mock('../src/services/appointmentsService');

const profile = (
  status: DoctorProfile['verificationStatus'],
): DoctorProfile => ({
  userId: 'doctor-1',
  specialization: 'Cardiology',
  timezone: 'Asia/Manila',
  verificationStatus: status,
});

const withNav = (ui: React.ReactElement) =>
  render(
    <Provider store={signedIn(doctorUser)}>
      <NavigationContainer>{ui}</NavigationContainer>
    </Provider>,
  );

beforeEach(() => jest.restoreAllMocks());

describe('approvalMessage', () => {
  it('explains pending and rejected, and says nothing when approved', () => {
    expect(approvalMessage('pending')?.title).toBe('Awaiting approval');
    expect(approvalMessage('pending')?.body).toMatch(/cannot see or book you/);
    expect(approvalMessage('rejected')?.title).toBe('Not approved');
    expect(approvalMessage('approved')).toBeNull();
  });
});

describe('ApprovalBanner', () => {
  it('warns a pending doctor', async () => {
    jest.spyOn(users, 'getDoctorProfile').mockResolvedValue(profile('pending'));
    withNav(<ApprovalBanner userId="doctor-1" />);
    expect(await screen.findByText('Awaiting approval')).toBeTruthy();
  });

  it('tells a rejected doctor', async () => {
    jest
      .spyOn(users, 'getDoctorProfile')
      .mockResolvedValue(profile('rejected'));
    withNav(<ApprovalBanner userId="doctor-1" />);
    expect(await screen.findByText('Not approved')).toBeTruthy();
  });

  it('stays hidden for an approved doctor', async () => {
    const spy = jest
      .spyOn(users, 'getDoctorProfile')
      .mockResolvedValue(profile('approved'));
    withNav(<ApprovalBanner userId="doctor-1" />);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(screen.queryByText('Awaiting approval')).toBeNull();
    expect(screen.queryByText('Not approved')).toBeNull();
  });

  it('does not break the screen when the status cannot be loaded', async () => {
    const spy = jest
      .spyOn(users, 'getDoctorProfile')
      .mockRejectedValue(new Error('offline'));
    withNav(<ApprovalBanner userId="doctor-1" />);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('doctor dashboard', () => {
  it('shows the approval banner to a pending doctor', async () => {
    jest.spyOn(users, 'getDoctorProfile').mockResolvedValue(profile('pending'));
    (appointments.listMyAppointments as jest.Mock).mockResolvedValue([]);
    withNav(<DoctorDashboardScreen />);
    expect(await screen.findByText('Awaiting approval')).toBeTruthy();
  });
});

describe('profile mapping', () => {
  it('reads the status from the row and never sends it when saving', async () => {
    const upsert = jest.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            user_id: 'doctor-1',
            specialization: 'X',
            timezone: 'Asia/Manila',
            verification_status: 'rejected',
          },
          error: null,
        }),
      }),
    });
    (supabase.from as jest.Mock).mockReturnValue({ upsert });
    const saved = await users.saveDoctorProfile('doctor-1', {
      specialization: 'X',
      timezone: 'Asia/Manila',
    });
    expect(saved.verificationStatus).toBe('rejected');
    expect(upsert.mock.calls[0][0]).not.toHaveProperty('verification_status');
  });
});
