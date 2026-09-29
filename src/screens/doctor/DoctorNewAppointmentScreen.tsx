import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import {
  FoundPatient,
  findPatientByEmail,
  getDoctorProfile,
} from '../../services/userService';
import {
  filterFutureSlots,
  formatTime12Hour,
  generateDoctorTimeSlots,
} from '../../utils/timeSlotGenerator';
import { formatDateWithDay } from '../../utils/dateHelpers';
import { isValidEmail } from '../../utils/validation';
import { Button } from '../../components/Button';
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

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [patient, setPatient] = useState<FoundPatient | null>(null);
  const [searching, setSearching] = useState(false);

  const [availabilities, setAvailabilities] = useState<DoctorAvailability[]>(
    [],
  );
  const [timezone, setTimezone] = useState('UTC');
  const [held, setHeld] = useState<Booking[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() =>
    format(new Date(), 'yyyy-MM-dd'),
  );
  const [booking, setBooking] = useState(false);
  const pickedByUser = useRef(false);

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
  // Open on the first day that has room, unless the doctor has already chosen a day
  useEffect(() => {
    if (!pickedByUser.current && availableDates.length > 0) {
      setSelectedDate(availableDates[0]);
    }
  }, [availableDates]);
  const chooseDate = (date: string) => {
    pickedByUser.current = true;
    setSelectedDate(date);
  };
  const daySlots = slots.filter(s => s.date === selectedDate);

  const findPatient = async () => {
    if (!isValidEmail(email)) {
      setEmailError("Enter the patient's full email address");
      return;
    }
    setSearching(true);
    setEmailError(null);
    try {
      const found = await findPatientByEmail(email);
      if (found) {
        setPatient(found);
      } else {
        setEmailError(
          'No patient with that email. They need to create a Docya account first.',
        );
      }
    } catch (e) {
      setEmailError(
        e instanceof Error ? e.message : 'Could not look up the patient',
      );
    } finally {
      setSearching(false);
    }
  };

  const schedule = (slot: TimeSlot) => {
    if (!patient || slot.isBooked) return;
    Alert.alert(
      'Schedule appointment?',
      `${patient.fullName}\n${formatDateWithDay(slot.date)}, ${formatTime12Hour(
        slot.startTime,
      )}`,
      [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Yes, schedule',
          onPress: async () => {
            setBooking(true);
            try {
              await createAppointment(slot, patient.id);
              Alert.alert(
                'Appointment scheduled ✅',
                `${patient.fullName} will see it in their bookings.`,
                [{ text: 'OK', onPress: () => navigation.goBack() }],
              );
            } catch (e) {
              Alert.alert(
                'Could not schedule',
                e instanceof Error ? e.message : 'Please try again.',
              );
            } finally {
              setBooking(false);
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
        {patient ? (
          <View style={styles.found}>
            <Text style={styles.foundName}>{patient.fullName}</Text>
            <Button
              title="Change patient"
              variant="secondary"
              onPress={() => setPatient(null)}
            />
          </View>
        ) : (
          <>
            <FormField
              label="Patient email"
              value={email}
              onChangeText={setEmail}
              error={emailError ?? undefined}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={findPatient}
            />
            <Button
              title="Find patient"
              onPress={findPatient}
              loading={searching}
            />
          </>
        )}

        {patient && (
          <>
            {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Select Date
            </Text>
            <DoctorCalendar
              selectedDate={selectedDate}
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
                style={[styles.slots, booking && styles.disabled]}
                pointerEvents={booking ? 'none' : 'auto'}
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
          </>
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
  found: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16 },
  foundName: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  slots: { flexDirection: 'row', flexWrap: 'wrap' },
  disabled: { opacity: 0.5 },
  empty: { color: COLORS.textSecondary, textAlign: 'center', padding: 24 },
  error: { color: COLORS.danger, marginTop: 8 },
});
