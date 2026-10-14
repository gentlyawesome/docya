import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../constants';
import {
  NO_SMS,
  SMS_LEADS,
  SmsLead,
  SmsSettings,
  getSmsSettings,
  leadText,
  saveSmsLead,
} from '../services/patientReminders';
import { FilterChip } from './FilterChip';
import { Section } from './AccountSections';

// Text reminders to patients. Only doctors the operator switched on can use them; everyone else sees why not.
export const PatientReminderSettings: React.FC<{ userId: string }> = ({
  userId,
}) => {
  const [settings, setSettings] = useState<SmsSettings | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getSmsSettings(userId).then(loaded => active && setSettings(loaded));
      return () => {
        active = false;
      };
    }, [userId]),
  );

  const choose = async (leadMinutes: SmsLead) => {
    const previous = settings ?? NO_SMS;
    setSettings({ ...previous, leadMinutes });
    try {
      await saveSmsLead(userId, leadMinutes);
    } catch (e) {
      setSettings(previous);
      Alert.alert(
        'Could not update',
        e instanceof Error ? e.message : 'Please try again.',
      );
    }
  };

  if (!settings) {
    return null; // still loading; nothing to flash
  }
  return (
    <Section title="Patient text reminders">
      {settings.allowed ? (
        <>
          <Text style={styles.label} accessibilityRole="header">
            Text the patient
          </Text>
          <View style={styles.chips}>
            {SMS_LEADS.map(minutes => (
              <FilterChip
                key={minutes}
                label={leadText(minutes)}
                selected={settings.leadMinutes === minutes}
                onPress={() => choose(minutes)}
              />
            ))}
          </View>
          <Text style={styles.hint}>
            When you book a patient and tick that they agreed, Docya texts them
            your name, the day and the time. It never says what the visit is
            for. Texts are sent between 7 am and 8 pm.
          </Text>
        </>
      ) : (
        <Text style={styles.hint}>
          Not switched on for your account yet. Texting patients is being tried
          with a small group of clinics first.
        </Text>
      )}
    </Section>
  );
};

const styles = StyleSheet.create({
  label: { fontSize: 15, color: COLORS.text, marginBottom: 10 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
    marginBottom: 12,
  },
  hint: { fontSize: 13, color: COLORS.textSecondary },
});
