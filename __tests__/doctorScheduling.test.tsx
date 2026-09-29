import React from 'react';
import { Alert } from 'react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';
import * as appointments from '../src/services/appointmentsService';
import * as availability from '../src/services/availabilityService';
import * as users from '../src/services/userService';
import { supabase } from '../src/config/supabase';
import { DoctorNewAppointmentScreen } from '../src/screens/doctor/DoctorNewAppointmentScreen';
import { DoctorAppointmentsScreen } from '../src/screens/doctor/DoctorAppointmentsScreen';
import { booking, doctorUser, signedIn } from './helpers/testStore';
import { AvailabilityWindow } from '../src/types';

jest.mock('../src/utils/logger');
jest.mock('../src/services/appointmentsService');
jest.mock('../src/services/availabilityService');

const rpc = supabase.rpc as unknown as jest.Mock;
const svc = appointments as jest.Mocked<typeof appointments>;
const avail = availability as jest.Mocked<typeof availability>;

const everyDay: AvailabilityWindow[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
].map((dayOfWeek, i) => ({
  id: `w${i}`,
  doctorId: 'doctor-1',
  dayOfWeek: dayOfWeek as AvailabilityWindow['dayOfWeek'],
  startTime: '00:00',
  endTime: '23:30',
  isAvailable: true,
}));

const withNav = (ui: React.ReactElement) =>
  render(
    <Provider store={signedIn(doctorUser)}>
      <NavigationContainer>{ui}</NavigationContainer>
    </Provider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(users, 'getDoctorProfile').mockResolvedValue({
    userId: 'doctor-1',
    specialization: 'Cardiology',
    timezone: 'UTC',
  });
  avail.listMyAvailability.mockResolvedValue(everyDay);
  svc.listMyAppointments.mockResolvedValue([]);
});

describe('findPatientByEmail', () => {
  it('asks the server for an exact email and returns only the id and name', async () => {
    rpc.mockResolvedValue({
      data: [{ id: 'p1', full_name: 'Pat Patient' }],
      error: null,
    });
    expect(await users.findPatientByEmail(' Pat@Example.test ')).toEqual({
      id: 'p1',
      fullName: 'Pat Patient',
    });
    expect(rpc).toHaveBeenCalledWith('find_patient_by_email', {
      p_email: 'Pat@Example.test',
    });
  });

  it('returns null when there is no such patient', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await users.findPatientByEmail('nobody@example.test')).toBeNull();
  });

  it('turns a server failure into a readable error', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'TypeError: Network request failed' },
    });
    await expect(users.findPatientByEmail('a@b.co')).rejects.toThrow(
      'Network error',
    );
  });
});

// Render the screen and let its schedule finish loading, so no update lands after the test
const openNewAppointment = async () => {
  withNav(<DoctorNewAppointmentScreen />);
  await waitFor(() => expect(svc.listMyAppointments).toHaveBeenCalled());
  await act(async () => {});
};

describe('New appointment screen', () => {
  const findPatient = async (email = 'pat@example.test') => {
    fireEvent.changeText(screen.getByLabelText('Patient email'), email);
    fireEvent.press(screen.getByText('Find patient'));
  };

  it('checks the email before searching', async () => {
    await openNewAppointment();
    await findPatient('not-an-email');
    expect(
      await screen.findByText("Enter the patient's full email address"),
    ).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('explains when the patient has no account', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await openNewAppointment();
    await findPatient();
    expect(await screen.findByText(/No patient with that email/)).toBeTruthy();
    expect(screen.queryByText('Available Time Slots')).toBeNull();
  });

  it('schedules the chosen slot for the patient it found, after a confirmation', async () => {
    rpc.mockResolvedValue({
      data: [{ id: 'p1', full_name: 'Pat Patient' }],
      error: null,
    });
    svc.createAppointment.mockResolvedValue(booking({ id: 'made' }));
    await openNewAppointment();
    await findPatient();

    expect(await screen.findByText('Pat Patient')).toBeTruthy();
    const slotButtons = await screen.findAllByLabelText(/, available/);
    fireEvent.press(slotButtons[0]);

    const [title, message, buttons] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(title).toBe('Schedule appointment?');
    expect(message).toContain('Pat Patient');
    expect(svc.createAppointment).not.toHaveBeenCalled(); // nothing happens until the doctor agrees

    await act(async () => {
      await buttons
        .find((b: { text: string }) => b.text === 'Yes, schedule')
        .onPress();
    });
    expect(svc.createAppointment).toHaveBeenCalledTimes(1);
    const [slot, patientId] = svc.createAppointment.mock.calls[0];
    expect(patientId).toBe('p1');
    expect(slot.doctorId).toBe('doctor-1');
  });

  it('does not offer a slot the doctor has already given out', async () => {
    // Freeze only the clock: the first free day is then 2099-01-05, a Monday
    jest.useFakeTimers({
      now: new Date('2099-01-05T00:00:00Z'),
      doNotFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'setImmediate',
        'clearImmediate',
        'nextTick',
        'queueMicrotask',
        'performance',
      ],
    });
    try {
      svc.listMyAppointments.mockResolvedValue([
        booking({
          id: 'held',
          doctorId: 'doctor-1',
          date: '2099-01-05',
          startTime: '09:00',
          endTime: '09:30',
        }),
      ]);
      rpc.mockResolvedValue({
        data: [{ id: 'p1', full_name: 'Pat Patient' }],
        error: null,
      });
      await openNewAppointment();
      await findPatient();
      expect(await screen.findByLabelText('9:30 AM, available')).toBeTruthy();
      expect(screen.getByLabelText('9:00 AM, booked')).toBeTruthy();
      expect(screen.queryByLabelText('9:00 AM, available')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('points a doctor without working hours to the Schedule tab', async () => {
    avail.listMyAvailability.mockResolvedValue([]);
    rpc.mockResolvedValue({
      data: [{ id: 'p1', full_name: 'Pat Patient' }],
      error: null,
    });
    await openNewAppointment();
    await findPatient();
    expect(
      await screen.findByText(/Add your working hours in the Schedule tab/),
    ).toBeTruthy();
  });

  it('shows the server message if the slot was taken meanwhile', async () => {
    rpc.mockResolvedValue({
      data: [{ id: 'p1', full_name: 'Pat Patient' }],
      error: null,
    });
    svc.createAppointment.mockRejectedValue(
      new Error(
        'That time slot was just booked by someone else. Please choose another.',
      ),
    );
    await openNewAppointment();
    await findPatient();
    fireEvent.press((await screen.findAllByLabelText(/, available/))[0]);
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    await act(async () => {
      await buttons
        .find((b: { text: string }) => b.text === 'Yes, schedule')
        .onPress();
    });
    await waitFor(() =>
      expect(
        (Alert.alert as jest.Mock).mock.calls.some(
          c => c[0] === 'Could not schedule',
        ),
      ).toBe(true),
    );
  });
});

describe('Appointments list', () => {
  it('has no requests to approve: only Upcoming and Past, plus a way to add one', async () => {
    svc.listMyAppointments.mockResolvedValue([
      booking({ id: 'a', patientName: 'Pat Patient' }),
    ]);
    withNav(<DoctorAppointmentsScreen />);
    expect(await screen.findByText('Pat Patient')).toBeTruthy();
    expect(screen.getByText('New appointment')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Upcoming (1) filter' }),
    ).toBeTruthy();
    expect(screen.queryByText(/Pending/)).toBeNull();
    expect(screen.queryByText('Confirm')).toBeNull();
    expect(screen.queryByText('Decline')).toBeNull();
  });
});
