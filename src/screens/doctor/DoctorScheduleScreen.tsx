import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AvailabilityWindow, DayOfWeek } from '../../types';
import { useAppSelector } from '../../store/hooks';
import { useTabBarInset } from '../../hooks/useTabBarInset';
import { selectUser } from '../../store/slices/authSlice';
import {
  addAvailability,
  deleteAvailability,
  listMyAvailability,
  setAvailabilityEnabled,
} from '../../services/availabilityService';
import { Button } from '../../components/Button';
import { FilterChip } from '../../components/FilterChip';
import { FormField } from '../../components/FormField';
import { COLORS, DAYS_OF_WEEK } from '../../constants';
import { formatTime12Hour } from '../../utils/timeSlotGenerator';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DoctorScheduleScreen: React.FC = () => {
  const user = useAppSelector(selectUser);
  const tabBarInset = useTabBarInset();
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [day, setDay] = useState<DayOfWeek>('Monday');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [formError, setFormError] = useState<string | undefined>();
  const [adding, setAdding] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setWindows(await listMyAvailability(user.id));
      setLoadError(null);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : 'Could not load your schedule',
      );
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const byDay = useMemo(
    () =>
      DAYS_OF_WEEK.map(name => ({
        name,
        windows: windows
          .filter(w => w.dayOfWeek === name)
          .sort((a, b) => a.startTime.localeCompare(b.startTime)),
      })).filter(d => d.windows.length > 0),
    [windows],
  );

  const add = async () => {
    if (!user) return;
    if (!TIME.test(start) || !TIME.test(end)) {
      setFormError('Use 24-hour times like 09:00 and 17:30');
      return;
    }
    if (start >= end) {
      setFormError('The end time must be after the start time');
      return;
    }
    setFormError(undefined);
    setAdding(true);
    try {
      await addAvailability(user.id, day, start, end);
      await load();
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : 'Could not add this window',
      );
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (w: AvailabilityWindow, value: boolean) => {
    setWindows(prev =>
      prev.map(x => (x.id === w.id ? { ...x, isAvailable: value } : x)),
    );
    try {
      await setAvailabilityEnabled(w.id, value);
    } catch (e) {
      Alert.alert(
        'Could not update',
        e instanceof Error ? e.message : 'Please try again.',
      );
      await load();
    }
  };

  const remove = (w: AvailabilityWindow) => {
    Alert.alert(
      'Remove this window?',
      `${w.dayOfWeek} ${formatTime12Hour(w.startTime)} - ${formatTime12Hour(
        w.endTime,
      )}`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAvailability(w.id);
              await load();
            } catch (e) {
              Alert.alert(
                'Could not remove',
                e instanceof Error ? e.message : 'Please try again.',
              );
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 32 + tabBarInset },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.title} accessibilityRole="header">
          My Schedule
        </Text>
        <Text style={styles.hint}>
          Patients can book 30-minute slots inside these weekly windows, in your
          time zone.
        </Text>
        {loadError ? <Text style={styles.error}>{loadError}</Text> : null}

        {byDay.length === 0 && !loadError ? (
          <Text style={styles.empty}>
            No availability yet. Add your first window below.
          </Text>
        ) : null}
        {byDay.map(d => (
          <View key={d.name} style={styles.card}>
            <Text style={styles.dayName} accessibilityRole="header">
              {d.name}
            </Text>
            {d.windows.map(w => (
              <View key={w.id} style={styles.windowRow}>
                <Text style={[styles.windowText, !w.isAvailable && styles.off]}>
                  {formatTime12Hour(w.startTime)} -{' '}
                  {formatTime12Hour(w.endTime)}
                </Text>
                <Switch
                  value={w.isAvailable}
                  onValueChange={value => toggle(w, value)}
                  accessibilityLabel={`${d.name} ${formatTime12Hour(
                    w.startTime,
                  )} to ${formatTime12Hour(w.endTime)} available`}
                />
                <TouchableOpacity
                  onPress={() => remove(w)}
                  style={styles.remove}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${d.name} ${formatTime12Hour(
                    w.startTime,
                  )} to ${formatTime12Hour(w.endTime)}`}
                >
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.card}>
          <Text style={styles.dayName} accessibilityRole="header">
            Add a window
          </Text>
          <View style={styles.chips}>
            {DAYS_OF_WEEK.map(name => (
              <FilterChip
                key={name}
                label={name.slice(0, 3)}
                selected={day === name}
                onPress={() => setDay(name)}
              />
            ))}
          </View>
          <FormField
            label="Start (HH:mm)"
            value={start}
            onChangeText={setStart}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          <FormField
            label="End (HH:mm)"
            value={end}
            onChangeText={setEnd}
            error={formError}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          <Button title="Add window" onPress={add} loading={adding} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 32 },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  hint: { color: COLORS.textSecondary, marginBottom: 16 },
  error: { color: COLORS.danger, marginBottom: 8 },
  empty: { color: COLORS.textSecondary, marginBottom: 16 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  dayName: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  windowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  windowText: { fontSize: 16, color: COLORS.text, flex: 1 },
  off: { color: COLORS.textSecondary, textDecorationLine: 'line-through' },
  remove: { marginLeft: 12, minHeight: 44, justifyContent: 'center' },
  removeText: { color: COLORS.danger, fontSize: 15 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
    marginBottom: 12,
  },
});
