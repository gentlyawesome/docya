import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { User } from '../types';
import { useAppDispatch } from '../store/hooks';
import { saveUserProfile } from '../store/slices/authSlice';
import { getDoctorProfile, saveDoctorProfile } from '../services/userService';
import { isValidPhone, isValidTimezone } from '../utils/validation';
import { COLORS } from '../constants';
import { Button } from './Button';
import { FormField } from './FormField';
import { Section } from './AccountSections';

type Errors = Partial<
  Record<
    'firstName' | 'lastName' | 'phone' | 'specialization' | 'timezone',
    string
  >
>;

// Name, phone, specialization and time zone in one form with a single Save button.
export const ProfileForm: React.FC<{ user: User }> = ({ user }) => {
  const dispatch = useAppDispatch();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [specialization, setSpecialization] = useState('');
  const [timezone, setTimezone] = useState('Australia/Sydney');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getDoctorProfile(user.id)
        .then(profile => {
          if (active && profile) {
            setSpecialization(profile.specialization);
            setTimezone(profile.timezone);
          }
        })
        .catch(
          e =>
            active &&
            setLoadError(
              e instanceof Error ? e.message : 'Could not load your details',
            ),
        );
      return () => {
        active = false;
      };
    }, [user.id]),
  );

  const save = async () => {
    const next: Errors = {};
    if (!firstName.trim()) next.firstName = 'Enter your first name';
    if (!lastName.trim()) next.lastName = 'Enter your last name';
    if (!isValidPhone(phone)) next.phone = 'Enter a valid phone number';
    if (!specialization.trim())
      next.specialization = 'Enter your specialization';
    if (!isValidTimezone(timezone))
      next.timezone = 'Use a time zone name such as Asia/Manila';
    setErrors(next);
    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    try {
      // Both parts are checked above, so nothing is written unless everything is valid
      const account = await dispatch(
        saveUserProfile({
          userId: user.id,
          update: { firstName, lastName, phone },
        }),
      );
      if (saveUserProfile.rejected.match(account)) {
        throw new Error(String(account.payload ?? 'Please try again.'));
      }
      await saveDoctorProfile(user.id, { specialization, timezone });
      Alert.alert('Saved', 'Your details were updated.');
    } catch (e) {
      Alert.alert(
        'Could not save',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Your details">
      {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
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
      <FormField
        label="Specialization"
        value={specialization}
        onChangeText={setSpecialization}
        error={errors.specialization}
      />
      <FormField
        label="Time zone"
        value={timezone}
        onChangeText={setTimezone}
        error={errors.timezone}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Button title="Save changes" onPress={save} loading={saving} />
    </Section>
  );
};

const styles = StyleSheet.create({
  error: { color: COLORS.danger, marginBottom: 8 },
  readonlyRow: { marginBottom: 12 },
  readonlyLabel: { fontSize: 13, color: COLORS.textSecondary },
  readonlyValue: { fontSize: 16, color: COLORS.text, marginTop: 2 },
});
