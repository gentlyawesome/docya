import React from 'react';
import { Alert } from 'react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { supabase } from '../src/config/supabase';
import * as appointments from '../src/services/appointmentsService';
import * as availability from '../src/services/availabilityService';
import * as users from '../src/services/userService';
import * as patientReminders from '../src/services/patientReminders';
import { AppointmentRow, toBooking } from '../src/services/mappers';
import { buildDataExport } from '../src/services/dataExport';
import { normalizePhMobile } from '../src/utils/validation';
import { DoctorNewAppointmentScreen } from '../src/screens/doctor/DoctorNewAppointmentScreen';
import { DoctorAppointmentDetailScreen } from '../src/screens/doctor/DoctorAppointmentDetailScreen';
import { PatientReminderSettings } from '../src/components/PatientReminderSettings';
import { booking, doctorUser, signedIn } from './helpers/testStore';
import { AvailabilityWindow } from '../src/types';

jest.mock('../src/utils/logger');

describe('normalizePhMobile', () => {
  it('turns every common way of writing a Philippine mobile number into +639...', () => {
    [
      '0917 555 0001',
      '9175550001',
      '639175550001',
      '+63 917-555-0001',
      '(0917) 555.0001',
    ].forEach(v => expect(normalizePhMobile(v)).toBe('+639175550001'));
  });

  it('refuses landlines, foreign numbers and fragments', () => {
    [
      '',
      '12345',
      '02 8123 4567',
      '+1 415 555 0100',
      '0817 555 0001',
      '091755500011',
    ].forEach(v => expect(normalizePhMobile(v)).toBeNull());
  });
});

describe('reading a reminder from an appointment row', () => {
  const row: AppointmentRow = {
    id: 'a1',
    doctor_id: 'd1',
    patient_name: 'Pat',
    patient_phone: '09175550001',
    patient_consented_sms: true,
    appointment_date: '2099-01-05',
    start_time: '09:00:00',
    end_time: '09:30:00',
    status: 'confirmed',
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  it('maps an embedded reminder object, or a one-item list', () => {
    const asObject = toBooking({
      ...row,
      reminder: { status: 'sent', skip_reason: null },
    });
    const asList = toBooking({
      ...row,
      reminder: [{ status: 'skipped', skip_reason: 'dry_run' }],
    });
    expect(asObject.smsReminder).toEqual({
      status: 'sent',
      skipReason: undefined,
    });
    expect(asList.smsReminder).toEqual({
      status: 'skipped',
      skipReason: 'dry_run',
    });
    expect(asObject.patientConsentedSms).toBe(true);
  });

  it('has no reminder when none was queued, and treats a missing consent column as no', () => {
    const b = toBooking({
      ...row,
      patient_consented_sms: undefined,
      reminder: null,
    });
    expect(b.smsReminder).toBeUndefined();
    expect(b.patientConsentedSms).toBe(false);
  });
});

describe('what the doctor is told about a reminder', () => {
  const note = (over: Parameters<typeof booking>[0]) =>
    patientReminders.describeReminder(booking(over));

  it('says nothing when the patient did not agree to a text', () => {
    expect(note({})).toBeNull();
  });

  it('explains each stage', () => {
    expect(note({ smsReminder: { status: 'pending' } })?.text).toMatch(
      /^Scheduled/,
    );
    expect(note({ smsReminder: { status: 'sent' } })).toEqual({
      text: 'Sent: the patient was texted.',
      tone: 'good',
    });
    expect(note({ smsReminder: { status: 'failed' } })?.tone).toBe('warn');
  });

  it('gives a plain reason when it was not sent', () => {
    expect(
      note({
        smsReminder: { status: 'skipped', skipReason: 'appointment_cancelled' },
      })?.text,
    ).toMatch(/cancelled/);
    expect(
      note({
        smsReminder: { status: 'skipped', skipReason: 'doctor_monthly_cap' },
      })?.tone,
    ).toBe('warn');
    expect(
      note({ smsReminder: { status: 'skipped', skipReason: 'something_new' } })
        ?.text,
    ).toBe('Not sent.');
  });

  it('tells a doctor whose reminders were off at booking time', () => {
    expect(note({ patientConsentedSms: true })?.text).toMatch(
      /were off for your account/,
    );
  });
});

describe('settings and saving', () => {
  const chain = (result: unknown) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => result }) }),
  });

  it('reads whether the doctor is switched on and the chosen lead time', async () => {
    (supabase.from as jest.Mock).mockReturnValue(
      chain({
        data: { sms_reminders_allowed: true, sms_reminder_lead_minutes: 120 },
        error: null,
      }),
    );
    expect(await patientReminders.getSmsSettings('d1')).toEqual({
      allowed: true,
      leadMinutes: 120,
    });
  });

  it('treats a missing column, an error or a throw as "not switched on"', async () => {
    (supabase.from as jest.Mock).mockReturnValue(
      chain({ data: null, error: { message: 'no column' } }),
    );
    expect(await patientReminders.getSmsSettings('d1')).toEqual(
      patientReminders.NO_SMS,
    );
    (supabase.from as jest.Mock).mockImplementation(() => {
      throw new Error('offline');
    });
    expect(await patientReminders.getSmsSettings('d1')).toEqual(
      patientReminders.NO_SMS,
    );
  });

  it('records consent only when the doctor ticked it', async () => {
    const single = async () => ({
      data: null,
      error: { message: 'stop here' },
    });
    const insert = jest.fn().mockReturnValue({ select: () => ({ single }) });
    (supabase.from as jest.Mock).mockReturnValue({ insert });
    const slot = {
      id: 's',
      doctorId: 'd1',
      doctorName: 'D',
      date: '2099-01-05',
      startTime: '09:00',
      endTime: '09:30',
      dayOfWeek: 'Monday',
      timezone: 'UTC',
      isBooked: false,
    };
    await appointments
      .createAppointment(slot, {
        name: 'Pat',
        phone: '0917 555 0001',
        smsConsent: true,
      })
      .catch(() => {});
    await appointments
      .createAppointment(slot, { name: 'Pat', phone: '0917 555 0001' })
      .catch(() => {});
    expect(insert.mock.calls[0][0].patient_consented_sms).toBe(true);
    expect('patient_consented_sms' in insert.mock.calls[1][0]).toBe(false);
  });

  it('puts the consent and the reminder status in the data export', async () => {
    jest
      .spyOn(users, 'getDoctorProfile')
      .mockResolvedValue({
        userId: 'doctor-1',
        specialization: 'X',
        timezone: 'UTC',
      });
    jest.spyOn(availability, 'listMyAvailability').mockResolvedValue([]);
    jest
      .spyOn(appointments, 'listMyAppointments')
      .mockResolvedValue([
        booking({
          patientConsentedSms: true,
          smsReminder: { status: 'skipped', skipReason: 'dry_run' },
        }),
      ]);
    const out = JSON.parse(await buildDataExport(doctorUser));
    expect(out.appointments[0].patientAgreedToTextReminder).toBe(true);
    expect(out.appointments[0].textReminder).toEqual({
      status: 'skipped',
      note: 'dry_run',
    });
  });
});

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

describe('New appointment screen: text reminder consent', () => {
  let createSpy: jest.SpyInstance;
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest
      .spyOn(users, 'getDoctorProfile')
      .mockResolvedValue({
        userId: 'doctor-1',
        specialization: 'X',
        timezone: 'UTC',
      });
    jest.spyOn(availability, 'listMyAvailability').mockResolvedValue(everyDay);
    jest.spyOn(appointments, 'listMyAppointments').mockResolvedValue([]);
    createSpy = jest
      .spyOn(appointments, 'createAppointment')
      .mockResolvedValue(booking({ id: 'made' }));
  });

  const open = async (allowed: boolean) => {
    jest
      .spyOn(patientReminders, 'getSmsSettings')
      .mockResolvedValue({ allowed, leadMinutes: 1440 });
    withNav(<DoctorNewAppointmentScreen />);
    await waitFor(() =>
      expect(appointments.listMyAppointments).toHaveBeenCalled(),
    );
    await act(async () => {});
  };
  const pressFirstSlot = async () =>
    fireEvent.press((await screen.findAllByLabelText(/, available/))[0]);

  it('offers no consent switch to a doctor who is not switched on', async () => {
    await open(false);
    expect(
      screen.queryByLabelText('Patient agreed to a text reminder'),
    ).toBeNull();
    expect(screen.getByLabelText('Phone (optional)')).toBeTruthy();
  });

  it('offers the switch to a doctor who is, off by default', async () => {
    await open(true);
    const toggle = screen.getByLabelText('Patient agreed to a text reminder');
    expect(toggle.props.value).toBe(false);
    expect(screen.getByText(/24 hours before/)).toBeTruthy();
  });

  it('needs a Philippine mobile number once consent is on', async () => {
    await open(true);
    fireEvent(
      screen.getByLabelText('Patient agreed to a text reminder'),
      'valueChange',
      true,
    );
    fireEvent.changeText(screen.getByLabelText('Patient name'), 'Pat Patient');
    fireEvent.changeText(
      screen.getByLabelText('Patient mobile number'),
      '+1 415 555 0100',
    );
    await pressFirstSlot();
    expect(await screen.findByText(/Philippine mobile number/)).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('shows where the text will go, and books with consent', async () => {
    await open(true);
    fireEvent(
      screen.getByLabelText('Patient agreed to a text reminder'),
      'valueChange',
      true,
    );
    fireEvent.changeText(screen.getByLabelText('Patient name'), 'Pat Patient');
    fireEvent.changeText(
      screen.getByLabelText('Patient mobile number'),
      '0917 555 0001',
    );
    await pressFirstSlot();

    const [, message, buttons] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(message).toContain(
      'A text reminder will be sent to +639175550001, 24 hours before.',
    );
    expect(createSpy).not.toHaveBeenCalled();
    await act(async () => {
      await buttons
        .find((b: { text: string }) => b.text === 'Yes, schedule')
        .onPress();
    });
    expect(createSpy.mock.calls[0][1]).toEqual({
      name: 'Pat Patient',
      phone: '0917 555 0001',
      smsConsent: true,
    });
  });

  it('books without consent exactly as before when the switch is left off', async () => {
    await open(true);
    fireEvent.changeText(screen.getByLabelText('Patient name'), 'Pat Patient');
    await pressFirstSlot();
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    expect((Alert.alert as jest.Mock).mock.calls[0][1]).not.toContain(
      'text reminder',
    );
    await act(async () => {
      await buttons
        .find((b: { text: string }) => b.text === 'Yes, schedule')
        .onPress();
    });
    expect(createSpy.mock.calls[0][1].smsConsent).toBeUndefined();
  });
});

describe('Appointment detail: text reminder line', () => {
  const renderDetail = async (b: ReturnType<typeof booking>) => {
    jest.spyOn(appointments, 'getAppointment').mockResolvedValue(b);
    render(
      <DoctorAppointmentDetailScreen
        route={{
          key: 'k',
          name: 'DoctorAppointmentDetail',
          params: { appointmentId: b.id },
        }}
      />,
    );
    await screen.findByText('Pat Patient');
  };

  it('shows the status of the reminder', async () => {
    await renderDetail(
      booking({ patientConsentedSms: true, smsReminder: { status: 'sent' } }),
    );
    expect(screen.getByText('Text reminder')).toBeTruthy();
    expect(screen.getByText('Sent: the patient was texted.')).toBeTruthy();
  });

  it('shows nothing about texts when the patient did not agree to one', async () => {
    await renderDetail(booking({}));
    expect(screen.queryByText('Text reminder')).toBeNull();
  });
});

describe('Profile: patient text reminders card', () => {
  beforeEach(() => jest.restoreAllMocks());

  it('tells a doctor who is not switched on why there is nothing to set', async () => {
    jest
      .spyOn(patientReminders, 'getSmsSettings')
      .mockResolvedValue({ allowed: false, leadMinutes: 1440 });
    render(<PatientReminderSettings userId="doctor-1" />);
    expect(
      await screen.findByText(/Not switched on for your account yet/),
    ).toBeTruthy();
    expect(screen.queryByText('2 hours before')).toBeNull();
  });

  it('lets a switched-on doctor choose 24 hours or 2 hours, and saves it', async () => {
    jest
      .spyOn(patientReminders, 'getSmsSettings')
      .mockResolvedValue({ allowed: true, leadMinutes: 1440 });
    const save = jest
      .spyOn(patientReminders, 'saveSmsLead')
      .mockResolvedValue();
    render(<PatientReminderSettings userId="doctor-1" />);
    fireEvent.press(await screen.findByText('2 hours before'));
    await waitFor(() => expect(save).toHaveBeenCalledWith('doctor-1', 120));
  });

  it('puts the old choice back when saving fails', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest
      .spyOn(patientReminders, 'getSmsSettings')
      .mockResolvedValue({ allowed: true, leadMinutes: 1440 });
    jest
      .spyOn(patientReminders, 'saveSmsLead')
      .mockRejectedValue(new Error('offline'));
    render(<PatientReminderSettings userId="doctor-1" />);
    fireEvent.press(await screen.findByText('2 hours before'));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Could not update', 'offline'),
    );
  });
});
