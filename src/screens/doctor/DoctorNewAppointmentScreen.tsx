import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import {
  Booking,
  DoctorAvailability,
  DoctorStackParamList,
  TimeSlot,
} from '../../types';
import { useAppSelector } from '../../store/hooks';
import { selectUser } from '../../store/slices/authSlice';
import {
  createAppointment,
  listMyAppointments,
} from '../../services/appointmentsService';
import { listMyAvailability } from '../../services/availabilityService';
import { AvailabilityRow, toAvailabilities } from '../../services/mappers';
import { syncReminders } from '../../services/reminders';
import { getDoctorProfile } from '../../services/userService';
import {
  filterFutureSlots,
  formatTime12Hour,
  generateDoctorTimeSlots,
} from '../../utils/timeSlotGenerator';
import { formatDateWithDay } from '../../utils/dateHelpers';
import { isValidPhone } from '../../utils/validation';
import { FormField } from '../../components/FormField';
import { DoctorCalendar } from '../../components/DoctorCalendar';
import { TimeSlotButton } from '../../components/TimeSlotButton';
import { COLORS } from '../../constants';

const DAYS_AHEAD = 30;

export const DoctorNewAppointmentScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<DoctorStackParamList>>();
  const user = useAppSelector(selectUser);
  const doctorId = user?.id ?? '';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [phoneError, setPhoneError] = useState<string | undefined>();

  const [availabilities, setAvailabilities] = useState<DoctorAvailability[]>(
    [],
  );
  const [timezone, setTimezone] = useState('UTC');
  const [held, setHeld] = useState<Booking[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() =>
    format(new Date(), 'yyyy-MM-dd'),
  );
  const [saving, setSaving] = useState(false);
  const [pickedByUser, setPickedByUser] = useState(false);
  const phoneRef = useRef<TextInput>(null);

  // Your working hours and the slots you already gave out; refreshed whenever the screen is focused
  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([
        getDoctorProfile(doctorId),
        listMyAvailability(doctorId),
        listMyAppointments(),
      ])
        .then(([profile, windows, appointments]) => {
          if (!active) return;
          const tz = profile?.timezone ?? 'UTC';
          const rows: AvailabilityRow[] = windows.map(w => ({
            day_of_week: w.dayOfWeek,
            start_time: w.startTime,
            end_time: w.endTime,
            is_available: w.isAvailable,
          }));
          setTimezone(tz);
          setAvailabilities(
            toAvailabilities(user?.fullName ?? 'Doctor', tz, rows),
          );
          setHeld(appointments.filter(a => a.status !== 'cancelled'));
          setLoadError(null);
        })
        .catch(
          e =>
            active &&
            setLoadError(
              e instanceof Error ? e.message : 'Could not load your schedule',
            ),
        );
      return () => {
        active = false;
      };
    }, [doctorId, user?.fullName]),
  );

  const slots = useMemo(
    () =>
      filterFutureSlots(
        generateDoctorTimeSlots(
          doctorId,
          user?.fullName ?? 'Doctor',
          availabilities,
          new Date(),
          DAYS_AHEAD,
          held,
        ),
      ).map(s => ({ ...s, timezone })),
    [doctorId, user?.fullName, availabilities, held, timezone],
  );
  const availableDates = useMemo(
    () => [...new Set(slots.filter(s => !s.isBooked).map(s => s.date))],
    [slots],
  );

  // Until the doctor picks a day, show the first day that still has slots to offer or that
  // already holds one of theirs. Working it out while rendering avoids flashing today's slots first.
  const firstDay = slots.map(x => x.date).sort()[0];
  const shownDate = pickedByUser ? selectedDate : firstDay ?? selectedDate;
  const chooseDate = (date: string) => {
    setPickedByUser(true);
    setSelectedDate(date);
  };
  const daySlots = slots.filter(s => s.date === shownDate);

  const schedule = (slot: TimeSlot) => {
    if (slot.isBooked) return;
    const patientName = name.trim();
    setNameError(patientName ? undefined : "Enter the patient's name");
    setPhoneError(
      isValidPhone(phone) ? undefined : 'Enter a valid phone number',
    );
    if (!patientName || !isValidPhone(phone)) return;

    Alert.alert(
      'Schedule appointment?',
      `${patientName}\n${formatDateWithDay(slot.date)}, ${formatTime12Hour(
        slot.startTime,
      )}`,
      [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Yes, schedule',
          onPress: async () => {
            setSaving(true);
            try {
              const created = await createAppointment(slot, {
                name: patientName,
                phone,
              });
              // Remind the doctor about it (and ask for notification permission at this natural moment)
              await syncReminders([...held, created]);
              Alert.alert(
                'Appointment scheduled ✅',
                `${patientName} is booked.`,
                [{ text: 'OK', onPress: () => navigation.goBack() }],
              );
            } catch (e) {
              Alert.alert(
                'Could not schedule',
                e instanceof Error ? e.message : 'Please try again.',
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Patient
        </Text>
        <FormField
          label="Patient name"
          value={name}
          onChangeText={setName}
          error={nameError}
          autoCapitalize="words"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => phoneRef.current?.focus()}
        />
        <FormField
          ref={phoneRef}
          label="Phone (optional)"
          value={phone}
          onChangeText={setPhone}
          error={phoneError}
          keyboardType="phone-pad"
          autoComplete="tel"
        />

        {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Select Date
        </Text>
        <DoctorCalendar
          selectedDate={shownDate}
          onDateSelect={chooseDate}
          availableDates={availableDates}
        />
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Available Time Slots
        </Text>
        {availabilities.length === 0 && !loadError ? (
          <Text style={styles.empty}>
            Add your working hours in the Schedule tab first.
          </Text>
        ) : daySlots.length > 0 ? (
          <View
            style={[styles.slots, saving && styles.disabled]}
            pointerEvents={saving ? 'none' : 'auto'}
          >
            {daySlots.map(slot => (
              <TimeSlotButton
                key={slot.id}
                slot={slot}
                onPress={() => schedule(slot)}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>No available slots for this date</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 32 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginVertical: 12,
  },
  slots: { flexDirection: 'row', flexWrap: 'wrap' },
  disabled: { opacity: 0.5 },
  empty: { color: COLORS.textSecondary, textAlign: 'center', padding: 24 },
  error: { color: COLORS.danger, marginTop: 8 },
});
