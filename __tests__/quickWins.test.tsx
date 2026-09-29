import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import RNHapticFeedback from 'react-native-haptic-feedback';
import { RatingBadge } from '../src/components/RatingBadge';
import { TimeSlotButton } from '../src/components/TimeSlotButton';
import { DoctorCard } from '../src/components/DoctorCard';
import { DoctorCalendar } from '../src/components/DoctorCalendar';
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

describe('DoctorCard', () => {
  const doctor: Doctor = {
    id: 'd1',
    name: 'Dr X',
    timezone: 'Asia/Manila',
    availabilities: [],
    specialty: 'Cardiology',
    fee: 1500,
  };

  it('shows the real specialty and fee from the database', () => {
    render(<DoctorCard doctor={doctor} onPress={jest.fn()} />);
    expect(screen.getByText('Cardiology')).toBeTruthy();
    expect(screen.getByText('₱1500 consult')).toBeTruthy();
  });

  it('shows no rating when there is none, instead of inventing one', () => {
    render(<DoctorCard doctor={doctor} onPress={jest.fn()} />);
    expect(screen.queryByText('★')).toBeNull();
  });

  it('exposes the favorite button separately from the card, so assistive tech can reach it', () => {
    const onToggleFavorite = jest.fn();
    const onPress = jest.fn();
    render(<DoctorCard doctor={doctor} onPress={onPress} onToggleFavorite={onToggleFavorite} />);
    fireEvent.press(screen.getByRole('button', { name: 'Add Dr X to favorites' }));
    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('DoctorCalendar', () => {
  it('draws month arrows itself, because the library image assets do not resolve in Metro', () => {
    render(<DoctorCalendar selectedDate="2026-10-01" onDateSelect={jest.fn()} />);
    expect(screen.getByText('‹', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('›', { includeHiddenElements: true })).toBeTruthy();
  });
});
