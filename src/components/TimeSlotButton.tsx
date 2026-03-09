import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { TimeSlot } from '../types';
import { COLORS } from '../constants';
import { formatTime12Hour } from '../utils/timeSlotGenerator';

interface TimeSlotButtonProps {
  slot: TimeSlot;
  onPress: () => void;
}

export const TimeSlotButton: React.FC<TimeSlotButtonProps> = ({ slot, onPress }) => {
  const isBooked = slot.isBooked;
  
  return (
    <TouchableOpacity
      style={[
        styles.button,
        isBooked && styles.buttonBooked,
      ]}
      onPress={onPress}
      disabled={isBooked}
      activeOpacity={0.7}
    >
      <Text style={[styles.time, isBooked && styles.timeBooked]}>
        {formatTime12Hour(slot.startTime)}
      </Text>
      {isBooked && <Text style={styles.bookedLabel}>Booked</Text>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
    marginBottom: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  buttonBooked: {
    backgroundColor: COLORS.disabled,
    borderColor: COLORS.border,
  },
  time: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  timeBooked: {
    color: COLORS.textSecondary,
  },
  bookedLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
