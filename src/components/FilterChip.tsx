import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants';
import { haptics } from '../utils/haptics';

interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export const FilterChip: React.FC<FilterChipProps> = ({ label, selected, onPress }) => (
  <TouchableOpacity
    style={[styles.chip, selected && styles.chipSelected]}
    onPress={() => {
      haptics.selection();
      onPress();
    }}
    accessibilityRole="button"
    accessibilityLabel={`${label} filter`}
    accessibilityState={{ selected }}
  >
    <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    marginRight: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  label: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  labelSelected: {
    color: '#FFFFFF',
  },
});
