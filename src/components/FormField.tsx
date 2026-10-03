import React, { forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { COLORS } from '../constants';

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export const FormField = forwardRef<TextInput, FormFieldProps>(
  ({ label, error, style, ...inputProps }, ref) => (
    <View style={styles.container}>
      {/* The input carries this text as its accessibility label; hide the visible copy so it is not read twice */}
      <Text
        style={styles.label}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {label}
      </Text>
      <TextInput
        ref={ref}
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor={COLORS.textSecondary}
        accessibilityLabel={label}
        {...inputProps}
      />
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  ),
);
FormField.displayName = 'FormField';

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    minHeight: 46,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  error: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.danger,
  },
});
