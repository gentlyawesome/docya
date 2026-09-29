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
import { DoctorNewAppointmentScreen } from '../src/screens/doctor/DoctorNewAppointmentScreen';
import { DoctorAppointmentsScreen } from '../src/screens/doctor/DoctorAppointmentsScreen';
import { DoctorScheduleScreen } from '../src/screens/doctor/DoctorScheduleScreen';
import { booking, doctorUser, signedIn } from './helpers/testStore';
import { AvailabilityWindow } from '../src/types';

jest.mock('../src/utils/logger');
jest.mock('../src/services/appointmentsService');
jest.mock('../src/services/availabilityService');

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

// Render the screen and let its schedule finish loading, so no update lands after the test
const openNewAppointment = async () => {
  withNav(<DoctorNewAppointmentScreen />);
  await waitFor(() => expect(svc.listMyAppointments).toHaveBeenCalled());
  await act(async () => {});
};

describe('New appointment screen', () => {
  const fill = (name: string, phone = '') => {
    fireEvent.changeText(screen.getByLabelText('Patient name'), name);
    if (phone)
      fireEvent.changeText(screen.getByLabelText('Phone (optional)'), phone);
  };
  const pressFirstSlot = async () =>
    fireEvent.press((await screen.findAllByLabelText(/, available/))[0]);
  const confirm = async () => {
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    await act(async () => {
      await buttons
        .find((b: { text: string }) => b.text === 'Yes, schedule')
        .onPress();
    });
  };

  it('needs a patient name before anything is booked', async () => {
    await openNewAppointment();
    await pressFirstSlot();
    expect(await screen.findByText("Enter the patient's name")).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(svc.createAppointment).not.toHaveBeenCalled();
  });

  it('rejects a phone number that is not a phone number', async () => {
    await openNewAppointment();
    fill('Pat Patient', 'call me maybe');
    await pressFirstSlot();
    expect(await screen.findByText('Enter a valid phone number')).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('schedules the chosen slot for the named patient, after a confirmation', async () => {
    svc.createAppointment.mockResolvedValue(booking({ id: 'made' }));
    await openNewAppointment();
    fill('  Pat Patient ', '+63 917 555 0001');
    await pressFirstSlot();

    const [title, message] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(title).toBe('Schedule appointment?');
    expect(message).toContain('Pat Patient');
    expect(svc.createAppointment).not.toHaveBeenCalled(); // nothing happens until the doctor agrees

    await confirm();
    expect(svc.createAppointment).toHaveBeenCalledTimes(1);
    const [slot, patient] = svc.createAppointment.mock.calls[0];
    expect(patient).toEqual({ name: 'Pat Patient', phone: '+63 917 555 0001' });
    expect(slot.doctorId).toBe('doctor-1');
  });

  it('works without a phone number', async () => {
    svc.createAppointment.mockResolvedValue(booking({ id: 'made' }));
    await openNewAppointment();
    fill('Sam Sample');
    await pressFirstSlot();
    await confirm();
    expect(svc.createAppointment.mock.calls[0][1]).toEqual({
      name: 'Sam Sample',
      phone: '',
    });
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
      await openNewAppointment();
      expect(await screen.findByLabelText('9:30 AM, available')).toBeTruthy();
      expect(screen.getByLabelText('9:00 AM, booked')).toBeTruthy();
      expect(screen.queryByLabelText('9:00 AM, available')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('points a doctor without working hours to the Schedule tab', async () => {
    avail.listMyAvailability.mockResolvedValue([]);
    await openNewAppointment();
    expect(
      await screen.findByText(/Add your working hours in the Schedule tab/),
    ).toBeTruthy();
  });

  it('shows the server message if the slot was taken meanwhile', async () => {
    svc.createAppointment.mockRejectedValue(
      new Error(
        'That time slot was just booked by someone else. Please choose another.',
      ),
    );
    await openNewAppointment();
    fill('Pat Patient');
    await pressFirstSlot();
    await confirm();
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

describe('Schedule screen wording', () => {
  it('speaks to the doctor booking patients, not to patients booking', async () => {
    withNav(<DoctorScheduleScreen />);
    expect(
      await screen.findByText(/You can book patients into 30-minute slots/),
    ).toBeTruthy();
    expect(screen.queryByText(/Patients can book/)).toBeNull();
  });
});
