import React from 'react';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as appointments from '../src/services/appointmentsService';
import * as reminders from '../src/services/reminders';
import { DoctorDashboardScreen } from '../src/screens/doctor/DoctorDashboardScreen';
import { loadOnboarding } from '../src/services/onboarding';
import { booking, doctorUser, signedIn } from './helpers/testStore';

jest.mock('../src/utils/logger');
jest.mock('../src/services/appointmentsService');

const svc = appointments as jest.Mocked<typeof appointments>;

const renderDashboard = () =>
  render(
    <Provider store={signedIn(doctorUser)}>
      <NavigationContainer>
        <DoctorDashboardScreen />
      </NavigationContainer>
    </Provider>,
  );

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  svc.listMyAppointments.mockResolvedValue([]);
  jest.spyOn(reminders, 'getPermission').mockResolvedValue('undecided');
});

describe('first-time onboarding', () => {
  it('shows the welcome cards once, and Skip remembers it', async () => {
    renderDashboard();
    expect(await screen.findByText('Welcome to Docya')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Next'));
    expect(await screen.findByText('Set your working hours')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Skip'));
    await waitFor(() =>
      expect(screen.queryByText('Set your working hours')).toBeNull(),
    );
    await waitFor(async () =>
      expect((await loadOnboarding(doctorUser.id)).welcomeSeen).toBe(true),
    );
  });

  it('does not show the welcome cards again', async () => {
    await AsyncStorage.setItem(
      `@docya_onboarding_${doctorUser.id}`,
      JSON.stringify({ welcomeSeen: true }),
    );
    renderDashboard();
    expect(await screen.findByText(/Getting started/)).toBeTruthy();
    expect(screen.queryByText('Welcome to Docya')).toBeNull();
  });

  it('shows the checklist with what is still to do, and Hide removes it', async () => {
    await AsyncStorage.setItem(
      `@docya_onboarding_${doctorUser.id}`,
      JSON.stringify({ welcomeSeen: true }),
    );
    renderDashboard();
    expect(await screen.findByText('Getting started (0 of 3)')).toBeTruthy();
    expect(
      screen.getByLabelText('Review your working hours, not done'),
    ).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Hide getting started'));
    await waitFor(() =>
      expect(screen.queryByText(/Getting started/)).toBeNull(),
    );
  });

  it('ticks off booking a first patient and hides when everything is done', async () => {
    await AsyncStorage.setItem(
      `@docya_onboarding_${doctorUser.id}`,
      JSON.stringify({ welcomeSeen: true, hoursReviewed: true }),
    );
    svc.listMyAppointments.mockResolvedValue([booking()]);
    renderDashboard();
    expect(await screen.findByText('Getting started (2 of 3)')).toBeTruthy();
    expect(screen.getByLabelText('Book your first patient, done')).toBeTruthy();
  });

  it('hides the checklist once all steps are done', async () => {
    await AsyncStorage.setItem(
      `@docya_onboarding_${doctorUser.id}`,
      JSON.stringify({ welcomeSeen: true, hoursReviewed: true }),
    );
    svc.listMyAppointments.mockResolvedValue([booking()]);
    jest.spyOn(reminders, 'getPermission').mockResolvedValue('granted');
    renderDashboard();
    expect(await screen.findByText('Today')).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByText(/Getting started/)).toBeNull(),
    );
  });
});
