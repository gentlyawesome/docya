import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import RNHapticFeedback from 'react-native-haptic-feedback';
import { RatingBadge } from '../src/components/RatingBadge';
import { TimeSlotButton } from '../src/components/TimeSlotButton';
import { DoctorCard } from '../src/components/DoctorCard';
import { transformToDoctors } from '../src/services/api';
import { Doctor, TimeSlot } from '../src/types';

const slot: TimeSlot = {
  id: 's1',
  doctorId: 'd1',
  doctorName: 'Dr X',
  date: '2026-03-10',
  startTime: '09:00',
  endTime: '09:30',
  dayOfWeek: 'Tuesday',
  timezone: 'Australia/Sydney',
  isBooked: false,
};

describe('RatingBadge', () => {
  it('renders nothing without a rating', () => {
    render(<RatingBadge />);
    expect(screen.queryByText('★')).toBeNull();
  });

  it('shows rating and review count', () => {
    render(<RatingBadge rating={4.8} reviewCount={124} />);
    expect(screen.getByText('4.8')).toBeTruthy();
    expect(screen.getByText('(124)')).toBeTruthy();
  });
});

describe('TimeSlotButton haptics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('triggers haptics and onPress for an open slot', () => {
    const onPress = jest.fn();
    render(<TimeSlotButton slot={slot} onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(RNHapticFeedback.trigger).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a booked slot', () => {
    const onPress = jest.fn();
    render(<TimeSlotButton slot={{ ...slot, isBooked: true }} onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(RNHapticFeedback.trigger).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('DoctorCard profile', () => {
  const doctor: Doctor = {
    id: 'd1',
    name: 'Dr X',
    timezone: 'Australia/Sydney',
    availabilities: [],
    specialty: 'Cardiologist',
    rating: 4.5,
    reviewCount: 10,
    fee: 120,
  };

  it('shows specialty, rating and fee when present', () => {
    render(<DoctorCard doctor={doctor} onPress={jest.fn()} />);
    expect(screen.getByText('Cardiologist')).toBeTruthy();
    expect(screen.getByText('4.5')).toBeTruthy();
    expect(screen.getByText('$120 consult')).toBeTruthy();
  });
});

describe('sample profiles', () => {
  it('merges sample profile by doctor id and leaves unknown doctors untouched', () => {
    const base = { timezone: 'Australia/Sydney', day_of_week: 'Monday', available_at: ' 9:00AM', available_until: ' 5:00PM' };
    const doctors = transformToDoctors([
      { ...base, name: 'Christy Schumm' },
      { ...base, name: 'Someone Else' },
    ]);
    expect(doctors.find(d => d.id === 'christy-schumm')?.rating).toBeDefined();
    expect(doctors.find(d => d.id === 'someone-else')?.rating).toBeUndefined();
  });
});

describe('DoctorCalendar', () => {
  it('draws month arrows itself, because the library image assets do not resolve in Metro', () => {
    const { DoctorCalendar } = require('../src/components/DoctorCalendar');
    render(<DoctorCalendar selectedDate="2026-10-01" onDateSelect={jest.fn()} />);
    expect(screen.getByText('‹', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('›', { includeHiddenElements: true })).toBeTruthy();
  });
});
