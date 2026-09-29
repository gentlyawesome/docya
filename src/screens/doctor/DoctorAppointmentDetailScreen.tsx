import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import {
  Booking,
  BookingStatus,
  DoctorStackParamList,
  User,
} from '../../types';
import {
  getAppointment,
  saveAppointmentNotes,
  updateAppointmentStatus,
} from '../../services/appointmentsService';
import { getUserProfile } from '../../services/userService';
import { Button } from '../../components/Button';
import { FormField } from '../../components/FormField';
import { StatusBadge } from '../../components/StatusBadge';
import { COLORS } from '../../constants';
import { getBookingPhase } from '../../utils/bookingPhases';
import { formatDateWithDay, formatTimezone } from '../../utils/dateHelpers';
import { formatTime12Hour } from '../../utils/timeSlotGenerator';

interface Props {
  route: RouteProp<DoctorStackParamList, 'DoctorAppointmentDetail'>;
}

export const DoctorAppointmentDetailScreen: React.FC<Props> = ({ route }) => {
  const { appointmentId } = route.params;
  const [appointment, setAppointment] = useState<Booking | null>(null);
  const [patient, setPatient] = useState<User | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const a = await getAppointment(appointmentId);
      setAppointment(a);
      setNotes(a.notes ?? '');
      if (a.patientId) {
        setPatient(await getUserProfile(a.patientId));
      }
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not load this appointment',
      );
    }
  }, [appointmentId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const setStatus = async (status: BookingStatus) => {
    setBusy(true);
    try {
      setAppointment(await updateAppointmentStatus(appointmentId, status));
    } catch (e) {
      Alert.alert(
        'Could not update',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const saveNotes = async () => {
    setBusy(true);
    try {
      setAppointment(await saveAppointmentNotes(appointmentId, notes));
      Alert.alert('Saved', 'Your notes were saved.');
    } catch (e) {
      Alert.alert(
        'Could not save',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (!appointment) {
    return (
      <SafeAreaView
        style={styles.container}
        edges={['left', 'right', 'bottom']}
      >
        <Text style={styles.message}>{error ?? 'Loading...'}</Text>
      </SafeAreaView>
    );
  }

  const phase = getBookingPhase(appointment);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <StatusBadge phase={phase} />
          <Text style={styles.label}>Patient</Text>
          <Text style={styles.value}>
            {patient?.fullName ?? appointment.patientName ?? 'Patient'}
          </Text>
          {patient?.phone ? (
            <Text style={styles.sub}>{patient.phone}</Text>
          ) : null}
          {patient?.email ? (
            <Text style={styles.sub}>{patient.email}</Text>
          ) : null}

          <Text style={styles.label}>When</Text>
          <Text style={styles.value}>
            {formatDateWithDay(appointment.date)}
          </Text>
          <Text style={styles.time}>
            {formatTime12Hour(appointment.startTime)} -{' '}
            {formatTime12Hour(appointment.endTime)} (
            {formatTimezone(appointment.timezone)} time)
          </Text>

          {appointment.reason ? (
            <>
              <Text style={styles.label}>Reason</Text>
              <Text style={styles.value}>{appointment.reason}</Text>
            </>
          ) : null}
        </View>

        {phase === 'upcoming' && appointment.status === 'confirmed' && (
          <Button
            title="Cancel appointment"
            variant="danger"
            onPress={() => setStatus('cancelled')}
            loading={busy}
          />
        )}
        {phase === 'completed' && appointment.status !== 'completed' && (
          <Button
            title="Mark as completed"
            variant="secondary"
            onPress={() => setStatus('completed')}
            loading={busy}
          />
        )}

        <View style={[styles.card, styles.notesCard]}>
          <FormField
            label="Private notes"
            value={notes}
            onChangeText={setNotes}
            multiline
            style={styles.notesInput}
          />
          <Button
            title="Save notes"
            variant="secondary"
            onPress={saveNotes}
            disabled={busy || notes === (appointment.notes ?? '')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 32 },
  message: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 48 },
  card: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16 },
  notesCard: { marginTop: 16 },
  notesInput: { minHeight: 90, textAlignVertical: 'top' },
  label: { fontSize: 13, color: COLORS.textSecondary, marginTop: 14 },
  value: { fontSize: 17, color: COLORS.text, marginTop: 2 },
  sub: { fontSize: 15, color: COLORS.textSecondary, marginTop: 2 },
  time: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
});
