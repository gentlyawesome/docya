import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BookingPhase } from '../types';
import { COLORS } from '../constants';

export const statusLabel = (phase: BookingPhase): string => {
  if (phase === 'cancelled') return 'Cancelled';
  if (phase === 'completed') return 'Completed';
  return 'Confirmed';
};

const colorsFor = (phase: BookingPhase) => {
  if (phase === 'cancelled') {
    return { bg: COLORS.dangerSoft, fg: COLORS.danger };
  }
  if (phase === 'completed') {
    return { bg: COLORS.disabled, fg: COLORS.textSecondary };
  }
  return { bg: COLORS.successSoft, fg: COLORS.successDark };
};

export const StatusBadge: React.FC<{ phase: BookingPhase }> = ({ phase }) => {
  const { bg, fg } = colorsFor(phase);
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{statusLabel(phase)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 12, fontWeight: '700' },
});
