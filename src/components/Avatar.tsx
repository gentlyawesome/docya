import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../constants';

export const initialsOf = (name?: string | null): string => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
};

// A round badge with a person's initials (decorative; the name is always shown next to it)
export const Avatar: React.FC<{
  name?: string | null;
  size?: number;
  dark?: boolean;
}> = ({ name, size = 44, dark = false }) => (
  <View
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    style={[
      styles.circle,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: dark ? 'rgba(255,255,255,0.18)' : COLORS.primarySoft,
      },
    ]}
  >
    <Text
      style={[
        styles.text,
        { fontSize: size * 0.36, color: dark ? '#FFFFFF' : COLORS.primary },
      ]}
    >
      {initialsOf(name)}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '700' },
});
