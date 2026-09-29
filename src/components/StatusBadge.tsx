import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Booking, BookingPhase } from '../types';
import { COLORS } from '../constants';

export const statusLabel = (booking: Booking, phase: BookingPhase): string => {
  if (phase === 'cancelled') return 'Cancelled';
  if (phase === 'completed') return 'Completed';
  return booking.status === 'pending' ? 'Awaiting confirmation' : 'Confirmed';
};

const colorFor = (booking: Booking, phase: BookingPhase) => {
  if (phase === 'cancelled') return COLORS.danger;
  if (phase === 'completed') return COLORS.textSecondary;
  return booking.status === 'pending' ? COLORS.secondary : COLORS.successDark;
};

export const StatusBadge: React.FC<{ booking: Booking; phase: BookingPhase }> = ({ booking, phase }) => (
  <View style={[styles.badge, { backgroundColor: colorFor(booking, phase) }]}>
    <Text style={styles.text}>{statusLabel(booking, phase)}</Text>
  </View>
);

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start' },
  text: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
});
