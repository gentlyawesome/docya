import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { parseDoctorAvailability, INVALID_DATA_MESSAGE } from '../src/services/schemas';
import { ErrorMessage } from '../src/components/ErrorMessage';

jest.mock('../src/utils/logger');

const good = {
  name: 'Christy Schumm',
  timezone: 'Australia/Sydney',
  day_of_week: 'Monday',
  available_at: ' 9:00AM',
  available_until: '12:00PM',
};

describe('parseDoctorAvailability', () => {
  it('accepts well-formed records', () => {
    expect(parseDoctorAvailability([good])).toHaveLength(1);
  });

  it('accepts an empty array', () => {
    expect(parseDoctorAvailability([])).toEqual([]);
  });

  it('drops invalid records but keeps valid ones', () => {
    const result = parseDoctorAvailability([
      good,
      { ...good, timezone: 'Not/AZone' },
      { ...good, day_of_week: 'Funday' },
      { ...good, available_at: '9:00 AM' },
      { ...good, name: '   ' },
      null,
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Christy Schumm');
  });

  it('throws when nothing is valid', () => {
    expect(() => parseDoctorAvailability([{ nope: true }])).toThrow(INVALID_DATA_MESSAGE);
  });

  it('throws when the payload is not an array', () => {
    expect(() => parseDoctorAvailability({ doctors: [] })).toThrow(INVALID_DATA_MESSAGE);
    expect(() => parseDoctorAvailability('<html>')).toThrow(INVALID_DATA_MESSAGE);
  });
});

describe('ErrorMessage', () => {
  it('shows a title, the message, and a working retry button', () => {
    const onRetry = jest.fn();
    render(<ErrorMessage message="Boom" onRetry={onRetry} />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Boom')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
