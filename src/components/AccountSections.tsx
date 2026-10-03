import React from 'react';
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  deleteAccount,
  logoutUser,
  selectAuthLoading,
} from '../store/slices/authSlice';
import { Button } from './Button';
import {
  COLORS,
  RADIUS,
  SHADOW,
  PRIVACY_POLICY_URL,
  USER_GUIDE_URL,
} from '../constants';

export const Section: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle} accessibilityRole="header">
      {title}
    </Text>
    {children}
  </View>
);

export const AboutSection: React.FC = () => (
  <Section title="About">
    <TouchableOpacity
      style={styles.linkRow}
      onPress={() => Linking.openURL(USER_GUIDE_URL)}
      accessibilityRole="link"
      accessibilityLabel="User guide"
    >
      <Text style={styles.linkText}>User guide</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={styles.linkRow}
      onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
      accessibilityRole="link"
      accessibilityLabel="Privacy policy"
    >
      <Text style={styles.linkText}>Privacy policy</Text>
    </TouchableOpacity>
  </Section>
);

export const AccountActionsSection: React.FC = () => {
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectAuthLoading);

  const confirmDelete = () => {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your account and all of your appointments. This cannot be undone.',
      [
        { text: 'Keep my account', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: async () => {
            const result = await dispatch(deleteAccount());
            if (deleteAccount.rejected.match(result)) {
              Alert.alert(
                'Could not delete your account',
                String(result.payload ?? 'Please try again.'),
              );
            }
          },
        },
      ],
    );
  };

  return (
    <Section title="Account">
      <Button
        title="Sign out"
        variant="secondary"
        onPress={() => dispatch(logoutUser())}
        disabled={loading}
      />
      <Button
        title="Delete account"
        variant="danger"
        onPress={confirmDelete}
        loading={loading}
      />
    </Section>
  );
};

const styles = StyleSheet.create({
  section: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    ...SHADOW,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  linkRow: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 16, color: COLORS.primary },
});
