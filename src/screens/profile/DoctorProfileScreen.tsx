import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAppSelector } from '../../store/hooks';
import { useTabBarInset } from '../../hooks/useTabBarInset';
import { selectUser } from '../../store/slices/authSlice';
import { getDoctorProfile, saveDoctorProfile } from '../../services/userService';
import { AboutSection, AccountActionsSection, PersonalInfoSection, Section } from '../../components/AccountSections';
import { Button } from '../../components/Button';
import { ApprovalBanner } from '../../components/ApprovalBanner';
import { FormField } from '../../components/FormField';
import { COLORS, CURRENCY_SYMBOL } from '../../constants';
import { isValidFee, isValidTimezone } from '../../utils/validation';

type Errors = Partial<Record<'specialization' | 'license' | 'fee' | 'timezone', string>>;

const ProfessionalSection: React.FC<{ userId: string }> = ({ userId }) => {
  const [specialization, setSpecialization] = useState('');
  const [license, setLicense] = useState('');
  const [clinic, setClinic] = useState('');
  const [fee, setFee] = useState('');
  const [bio, setBio] = useState('');
  const [timezone, setTimezone] = useState('Australia/Sydney');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getDoctorProfile(userId)
        .then(profile => {
          if (active && profile) {
            setSpecialization(profile.specialization);
            setLicense(profile.licenseNumber);
            setClinic(profile.clinicName ?? '');
            setFee(profile.consultationFee !== undefined ? String(profile.consultationFee) : '');
            setBio(profile.bio ?? '');
            setTimezone(profile.timezone);
          }
        })
        .catch(e => active && setLoadError(e instanceof Error ? e.message : 'Could not load details'));
      return () => {
        active = false;
      };
    }, [userId])
  );

  const save = async () => {
    const next: Errors = {};
    if (!specialization.trim()) next.specialization = 'Enter your specialization';
    if (!license.trim()) next.license = 'Enter your license number';
    if (fee.trim() && !isValidFee(fee)) next.fee = 'Enter an amount such as 1200 or 1200.50';
    if (!isValidTimezone(timezone)) next.timezone = 'Use a time zone name such as Asia/Manila';
    setErrors(next);
    if (Object.keys(next).length > 0) {
      return;
    }
    setSaving(true);
    try {
      await saveDoctorProfile(userId, {
        specialization,
        licenseNumber: license,
        clinicName: clinic,
        consultationFee: fee.trim() ? Number(fee) : undefined,
        bio,
        timezone,
      });
      Alert.alert('Saved', 'Your professional details were updated.');
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Professional details">
      <ApprovalBanner userId={userId} />
      {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
      <FormField label="Specialization" value={specialization} onChangeText={setSpecialization} error={errors.specialization} />
      <FormField label="License number" value={license} onChangeText={setLicense} error={errors.license} autoCapitalize="characters" />
      <FormField label="Clinic name" value={clinic} onChangeText={setClinic} />
      <FormField
        label={`Consultation fee (${CURRENCY_SYMBOL})`}
        value={fee}
        onChangeText={setFee}
        error={errors.fee}
        keyboardType="decimal-pad"
      />
      <FormField
        label="Time zone"
        value={timezone}
        onChangeText={setTimezone}
        error={errors.timezone}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <FormField label="About you" value={bio} onChangeText={setBio} multiline />
      <Button title="Save professional details" onPress={save} loading={saving} />
    </Section>
  );
};

export const DoctorProfileScreen: React.FC = () => {
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
        <ProfessionalSection userId={user.id} />
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
  error: { color: COLORS.danger, marginBottom: 8 },
});
