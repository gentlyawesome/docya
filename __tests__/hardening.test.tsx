import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { doctorListSchema } from '../src/services/schemas';
import { ErrorMessage } from '../src/components/ErrorMessage';

const validDoctor = {
  id: 'd1',
  name: 'Maria Santos',
  timezone: 'Asia/Manila',
  availabilities: [
    { name: 'Maria Santos', timezone: 'Asia/Manila', day_of_week: 'Monday', available_at: '9:00AM', available_until: '5:00PM' },
  ],
  specialty: 'Cardiology',
  fee: 1500,
};

describe('cached doctor validation', () => {
  it('accepts a well-formed doctor list', () => {
    expect(doctorListSchema.safeParse([validDoctor]).success).toBe(true);
  });

  it.each([
    ['a non-array', { doctors: [] }],
    ['a missing id', [{ ...validDoctor, id: undefined }]],
    ['an unknown weekday', [{ ...validDoctor, availabilities: [{ ...validDoctor.availabilities[0], day_of_week: 'Funday' }] }]],
    ['a malformed time', [{ ...validDoctor, availabilities: [{ ...validDoctor.availabilities[0], available_at: '9 o clock' }] }]],
    ['a non-numeric fee', [{ ...validDoctor, fee: 'lots' }]],
  ])('rejects %s', (_name, value) => {
    expect(doctorListSchema.safeParse(value).success).toBe(false);
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
