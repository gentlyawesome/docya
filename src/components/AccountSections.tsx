import React, { useState } from 'react';
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { User } from '../types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  deleteAccount,
  logoutUser,
  saveUserProfile,
  selectAuthLoading,
} from '../store/slices/authSlice';
import { Button } from './Button';
import { FormField } from './FormField';
import { COLORS, PRIVACY_POLICY_URL } from '../constants';
import { isValidPhone } from '../utils/validation';

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

export const PersonalInfoSection: React.FC<{ user: User }> = ({ user }) => {
  const dispatch = useAppDispatch();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [errors, setErrors] = useState<{
    firstName?: string;
    lastName?: string;
    phone?: string;
  }>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const next: typeof errors = {};
    if (!firstName.trim()) next.firstName = 'Enter your first name';
    if (!lastName.trim()) next.lastName = 'Enter your last name';
    if (!isValidPhone(phone)) next.phone = 'Enter a valid phone number';
    setErrors(next);
    if (Object.keys(next).length > 0) {
      return;
    }
    setSaving(true);
    const result = await dispatch(
      saveUserProfile({
        userId: user.id,
        update: { firstName, lastName, phone },
      }),
    );
    setSaving(false);
    if (saveUserProfile.rejected.match(result)) {
      Alert.alert(
        'Could not save',
        String(result.payload ?? 'Please try again.'),
      );
    } else {
      Alert.alert('Saved', 'Your details were updated.');
    }
  };

  return (
    <Section title="Personal information">
      <View style={styles.readonlyRow}>
        <Text style={styles.readonlyLabel}>Email</Text>
        <Text style={styles.readonlyValue}>{user.email}</Text>
      </View>
      <FormField
        label="First name"
        value={firstName}
        onChangeText={setFirstName}
        error={errors.firstName}
      />
      <FormField
        label="Last name"
        value={lastName}
        onChangeText={setLastName}
        error={errors.lastName}
      />
      <FormField
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        error={errors.phone}
        keyboardType="phone-pad"
      />
      <Button
        title="Save personal information"
        onPress={save}
        loading={saving}
      />
    </Section>
  );
};

export const AboutSection: React.FC = () => (
  <Section title="About">
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
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  readonlyRow: { marginBottom: 12 },
  readonlyLabel: { fontSize: 13, color: COLORS.textSecondary },
  readonlyValue: { fontSize: 16, color: COLORS.text, marginTop: 2 },
  linkRow: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 16, color: COLORS.primary },
});
