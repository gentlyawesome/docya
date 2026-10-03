import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../constants';

export interface Step {
  key: string;
  label: string;
  done: boolean;
  onPress: () => void;
}

interface Props {
  steps: Step[];
  onHide: () => void;
}

// A short to-do list on the dashboard that ticks itself off as the doctor gets set up
export const GettingStarted: React.FC<Props> = ({ steps, onHide }) => {
  const doneCount = steps.filter(s => s.done).length;
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Getting started ({doneCount} of {steps.length})
        </Text>
        <TouchableOpacity
          onPress={onHide}
          style={styles.hide}
          accessibilityRole="button"
          accessibilityLabel="Hide getting started"
        >
          <Text style={styles.hideText}>Hide</Text>
        </TouchableOpacity>
      </View>
      {steps.map(step => (
        <TouchableOpacity
          key={step.key}
          style={styles.row}
          onPress={step.onPress}
          accessibilityRole="button"
          accessibilityLabel={`${step.label}, ${
            step.done ? 'done' : 'not done'
          }`}
        >
          <Text style={[styles.mark, step.done && styles.markDone]}>
            {step.done ? '✓' : '○'}
          </Text>
          <Text style={[styles.label, step.done && styles.labelDone]}>
            {step.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 18, fontWeight: '600', color: COLORS.text, flexShrink: 1 },
  hide: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  hideText: { fontSize: 15, color: COLORS.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  mark: { fontSize: 20, width: 28, color: COLORS.primary },
  markDone: { color: COLORS.successDark },
  label: { fontSize: 16, color: COLORS.text, flexShrink: 1 },
  labelDone: {
    color: COLORS.textSecondary,
    textDecorationLine: 'line-through',
  },
});
