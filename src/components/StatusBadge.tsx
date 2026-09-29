import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BookingPhase } from '../types';
import { COLORS } from '../constants';

export const statusLabel = (phase: BookingPhase): string => {
  if (phase === 'cancelled') return 'Cancelled';
  if (phase === 'completed') return 'Completed';
  return 'Confirmed';
};

const colorFor = (phase: BookingPhase) => {
  if (phase === 'cancelled') return COLORS.danger;
  if (phase === 'completed') return COLORS.textSecondary;
  return COLORS.successDark;
};

export const StatusBadge: React.FC<{ phase: BookingPhase }> = ({ phase }) => (
  <View style={[styles.badge, { backgroundColor: colorFor(phase) }]}>
    <Text style={styles.text}>{statusLabel(phase)}</Text>
  </View>
);

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start' },
  text: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
});
