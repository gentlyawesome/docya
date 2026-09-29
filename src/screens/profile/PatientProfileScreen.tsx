import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAppSelector } from '../../store/hooks';
import { useTabBarInset } from '../../hooks/useTabBarInset';
import { selectUser } from '../../store/slices/authSlice';
import { getPatientProfile, savePatientProfile } from '../../services/userService';
import { AboutSection, AccountActionsSection, PersonalInfoSection, Section } from '../../components/AccountSections';
import { Button } from '../../components/Button';
import { FilterChip } from '../../components/FilterChip';
import { FormField } from '../../components/FormField';
import { COLORS } from '../../constants';
import { isValidBirthDate } from '../../utils/validation';

const GENDERS = ['Female', 'Male', 'Other', 'Prefer not to say'];

const PatientDetailsSection: React.FC<{ userId: string }> = ({ userId }) => {
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getPatientProfile(userId)
        .then(profile => {
          if (active && profile) {
            setDateOfBirth(profile.dateOfBirth ?? '');
            setGender(profile.gender ?? '');
            setAddress(profile.address ?? '');
          }
        })
        .catch(e => active && setLoadError(e instanceof Error ? e.message : 'Could not load details'));
      return () => {
        active = false;
      };
    }, [userId])
  );

  const save = async () => {
    if (dateOfBirth && !isValidBirthDate(dateOfBirth)) {
      setError('Use the format YYYY-MM-DD, for example 1990-04-23');
      return;
    }
    setError(undefined);
    setSaving(true);
    try {
      await savePatientProfile(userId, { dateOfBirth, gender, address });
      Alert.alert('Saved', 'Your patient details were updated.');
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Patient details">
      {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
      <FormField
        label="Date of birth (YYYY-MM-DD)"
        value={dateOfBirth}
        onChangeText={setDateOfBirth}
        error={error}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />
      <Text style={styles.fieldLabel}>Gender</Text>
      <View style={styles.chips}>
        {GENDERS.map(option => (
          <FilterChip key={option} label={option} selected={gender === option} onPress={() => setGender(gender === option ? '' : option)} />
        ))}
      </View>
      <FormField label="Address" value={address} onChangeText={setAddress} multiline />
      <Button title="Save patient details" onPress={save} loading={saving} />
    </Section>
  );
};

export const PatientProfileScreen: React.FC = () => {
  const user = useAppSelector(selectUser);
  const tabBarInset = useTabBarInset();
  if (!user) {
    return null;
  }
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 + tabBarInset }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
        <Text style={styles.title} accessibilityRole="header">
          My Profile
        </Text>
        <PersonalInfoSection user={user} />
        <PatientDetailsSection userId={user.id} />
        <AboutSection />
        <AccountActionsSection />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 32 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.text, margin: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  error: { color: COLORS.danger, marginBottom: 8 },
});
