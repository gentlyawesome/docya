import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Share from 'react-native-share';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';
import doctorsReducer from '../src/store/slices/doctorsSlice';
import bookingsReducer from '../src/store/slices/bookingsSlice';
import favoritesReducer from '../src/store/slices/favoritesSlice';
import { MyBookingsScreen } from '../src/screens/MyBookingsScreen';
import { addToCalendar } from '../src/services/calendarExport';
import { toBase64 } from '../src/utils/base64';
import { buildIcs, icsFilename } from '../src/utils/ics';
import { Booking } from '../src/types';
import { STORAGE_KEYS } from '../src/constants';

declare const Buffer: any;
jest.mock('../src/utils/logger');

const share = (Share as unknown as { open: jest.Mock }).open;

// 09:00-09:30 Perth (UTC+8) on 2026-10-01 is 01:00-01:30 UTC
const booking: Booking = {
  id: 'b1',
  doctorId: 'd1',
  doctorName: 'Ann Lee',
  date: '2026-10-01',
  startTime: '09:00',
  endTime: '09:30',
  dayOfWeek: 'Thursday',
  timezone: 'Australia/Perth',
  bookedAt: '2026-09-01T00:00:00Z',
};
const now = new Date(Date.UTC(2026, 8, 29, 2, 3, 4));

beforeEach(() => {
  jest.clearAllMocks();
  return AsyncStorage.clear();
});

describe('toBase64', () => {
  it('matches known vectors, including padding and multi-byte characters', () => {
    expect(toBase64('')).toBe('');
    expect(toBase64('f')).toBe('Zg==');
    expect(toBase64('fo')).toBe('Zm8=');
    expect(toBase64('foo')).toBe('Zm9v');
    expect(toBase64('José ✓')).toBe(
      Buffer.from('José ✓', 'utf8').toString('base64'),
    );
  });
});

describe('buildIcs', () => {
  const ics = buildIcs(booking, now);

  it('is a well-formed calendar with CRLF line endings', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('stores start and end in UTC, converted from the doctor time zone', () => {
    expect(ics).toContain('DTSTART:20261001T010000Z');
    expect(ics).toContain('DTEND:20261001T013000Z');
    expect(ics).toContain('DTSTAMP:20260929T020304Z');
  });

  it('has a stable UID and a readable summary', () => {
    expect(ics).toContain('UID:b1@docya');
    expect(ics).toContain('SUMMARY:Appointment with Ann Lee');
    expect(ics).toContain('30-minute appointment with Ann Lee (Perth time).');
  });

  it('escapes special characters and folds long lines to 75 octets', () => {
    const tricky = buildIcs(
      {
        ...booking,
        doctorName: 'Dr. Lee, Ann; MD\\Ünïcode ' + 'x'.repeat(120),
      },
      now,
    );
    expect(tricky).toContain('Dr. Lee\\, Ann\\; MD\\\\Ünïcode');
    tricky.split('\r\n').forEach(line => {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
    });
    // unfolding restores the original text
    expect(tricky.replace(/\r\n /g, '')).toContain('x'.repeat(120));
  });

  it('builds a safe filename', () => {
    expect(icsFilename({ ...booking, doctorName: 'Dr. José O’Kon' })).toBe(
      'appointment-dr-jos-o-kon-2026-10-01.ics',
    );
  });
});

describe('addToCalendar', () => {
  it('shares the ICS as a base64 data URL with the calendar MIME type', async () => {
    share.mockResolvedValue({ success: true });
    expect(await addToCalendar(booking)).toBe('shared');
    const options = share.mock.calls[0][0];
    expect(options.type).toBe('text/calendar');
    expect(options.failOnCancel).toBe(false);
    const decoded = Buffer.from(options.url.split(',')[1], 'base64').toString(
      'utf8',
    );
    expect(decoded).toContain('UID:b1@docya');
    expect(decoded).toContain('DTSTART:20261001T010000Z');
  });

  it('reports a dismissed sheet and an error without throwing', async () => {
    share.mockResolvedValueOnce({ dismissedAction: true });
    expect(await addToCalendar(booking)).toBe('dismissed');
    share.mockRejectedValueOnce(new Error('native boom'));
    expect(await addToCalendar(booking)).toBe('error');
  });
});

describe('My Bookings calendar button', () => {
  it('appears on upcoming appointments and triggers the export', async () => {
    share.mockResolvedValue({ success: true });
    await AsyncStorage.setItem(
      STORAGE_KEYS.BOOKINGS,
      JSON.stringify([
        { ...booking, id: 'up', doctorName: 'Future Doc', date: '2099-01-01' },
        { ...booking, id: 'done', doctorName: 'Done Doc', date: '2020-01-01' },
      ]),
    );
    const store = configureStore({
      reducer: {
        doctors: doctorsReducer,
        bookings: bookingsReducer,
        favorites: favoritesReducer,
      },
    });
    render(
      <Provider store={store}>
        <NavigationContainer>
          <MyBookingsScreen />
        </NavigationContainer>
      </Provider>,
    );

    expect(await screen.findByText('Future Doc')).toBeTruthy();
    fireEvent.press(screen.getByText('Add to Calendar'));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));

    fireEvent.press(screen.getByRole('tab', { name: 'Past, 1' }));
    expect(screen.queryByText('Add to Calendar')).toBeNull();
  });
});
