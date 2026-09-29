import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  accessibilityLabel,
}) => {
  const inactive = disabled || loading;
  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], inactive && styles.inactive]}
      onPress={onPress}
      disabled={inactive}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#FFFFFF' : COLORS.primary} />
      ) : (
        <Text style={[styles.text, variant === 'secondary' && styles.textSecondary, variant === 'danger' && styles.textDanger]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 8,
  },
  primary: { backgroundColor: COLORS.primary },
  secondary: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.primary },
  danger: { backgroundColor: '#FFEBEE', borderWidth: 1, borderColor: '#FFCDD2' },
  inactive: { opacity: 0.55 },
  text: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  textSecondary: { color: COLORS.primary },
  textDanger: { color: COLORS.danger },
});
