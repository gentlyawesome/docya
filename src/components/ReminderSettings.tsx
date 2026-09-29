import React, { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../constants';
import { listMyAppointments } from '../services/appointmentsService';
import {
  DEFAULT_SETTINGS,
  PermissionState,
  REMINDER_LEADS,
  ReminderSettings as Settings,
  ensurePermission,
  getPermission,
  loadSettings,
  saveSettings,
} from '../services/reminders';
import { FilterChip } from './FilterChip';
import { Section } from './AccountSections';

const LABELS: Record<number, string> = {
  15: '15 min',
  30: '30 min',
  60: '1 hour',
};

// Local reminders before each appointment, on this phone only
export const ReminderSettings: React.FC = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [permission, setPermission] = useState<PermissionState>('undecided');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([loadSettings(), getPermission()]).then(([loaded, perm]) => {
        if (active) {
          setSettings(loaded);
          setPermission(perm);
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  // Save the choice, ask for permission when reminders are being turned on, then re-plan every reminder
  const apply = async (next: Settings) => {
    const previous = settings;
    setSettings(next);
    try {
      await saveSettings(next);
      if (next.leadMinutes !== null) {
        await ensurePermission();
      }
      setPermission(await getPermission());
      // Fetching the list re-plans the reminders with the new settings
      await listMyAppointments();
    } catch (e) {
      setSettings(previous);
      Alert.alert(
        'Could not update reminders',
        e instanceof Error ? e.message : 'Please try again.',
      );
    }
  };

  const on = settings.leadMinutes !== null;
  return (
    <Section title="Reminders">
      <Text style={styles.label} accessibilityRole="header">
        Remind me before each appointment
      </Text>
      <View style={styles.chips}>
        <FilterChip
          label="Off"
          selected={!on}
          onPress={() => apply({ ...settings, leadMinutes: null })}
        />
        {REMINDER_LEADS.map(minutes => (
          <FilterChip
            key={minutes}
            label={LABELS[minutes]}
            selected={settings.leadMinutes === minutes}
            onPress={() => apply({ ...settings, leadMinutes: minutes })}
          />
        ))}
      </View>

      {on && permission === 'denied' ? (
        <View style={styles.warning} accessibilityRole="alert">
          <Text style={styles.warningText}>
            Notifications are turned off for Docya, so no reminder will appear.
            Turn them on in iOS Settings.
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openSettings()}
            accessibilityRole="link"
            style={styles.linkRow}
          >
            <Text style={styles.link}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.switchLabel}>Show patient name in reminders</Text>
          <Text style={styles.hint}>
            Reminders can appear on your lock screen. Leave this off to keep
            names private.
          </Text>
        </View>
        <Switch
          value={settings.showPatientName}
          onValueChange={value =>
            apply({ ...settings, showPatientName: value })
          }
          disabled={!on}
          accessibilityLabel="Show patient name in reminders"
        />
      </View>
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
  warning: {
    backgroundColor: '#FFF4E5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  warningText: { color: COLORS.text, fontSize: 14 },
  linkRow: { minHeight: 44, justifyContent: 'center' },
  link: { fontSize: 16, color: COLORS.primary },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  switchText: { flex: 1, marginRight: 12 },
  switchLabel: { fontSize: 16, color: COLORS.text },
  hint: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
});
