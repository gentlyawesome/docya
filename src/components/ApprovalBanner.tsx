import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { VerificationStatus } from '../types';
import { getDoctorProfile } from '../services/userService';
import { COLORS, SUPPORT_EMAIL } from '../constants';

export const approvalMessage = (
  status: VerificationStatus,
): { title: string; body: string } | null => {
  if (status === 'pending') {
    return {
      title: 'Awaiting approval',
      body: 'We are reviewing your details. Patients cannot see or book you until you are approved. You can finish your profile and schedule meanwhile.',
    };
  }
  if (status === 'rejected') {
    return {
      title: 'Not approved',
      body: `We could not approve your account. Please contact ${SUPPORT_EMAIL}.`,
    };
  }
  return null;
};

// Shown to doctors whose account is not yet approved; renders nothing once approved.
export const ApprovalBanner: React.FC<{ userId: string }> = ({ userId }) => {
  const [status, setStatus] = useState<VerificationStatus>('approved');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (userId) {
        getDoctorProfile(userId)
          .then(
            profile =>
              active && profile && setStatus(profile.verificationStatus),
          )
          .catch(() => {});
      }
      return () => {
        active = false;
      };
    }, [userId]),
  );

  const message = approvalMessage(status);
  if (!message) {
    return null;
  }
  const color = status === 'rejected' ? COLORS.danger : COLORS.warning;
  return (
    <View
      style={[styles.banner, { borderColor: color }]}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${message.title}. ${message.body}`}
    >
      <Text style={[styles.title, { color }]}>{message.title}</Text>
      <Text style={styles.body}>{message.body}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  body: { fontSize: 14, color: COLORS.text },
});
