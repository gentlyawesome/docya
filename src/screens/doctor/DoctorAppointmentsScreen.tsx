import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Booking, BookingStatus, DoctorStackParamList } from '../../types';
import { useTabBarInset } from '../../hooks/useTabBarInset';
import {
  listMyAppointments,
  updateAppointmentStatus,
} from '../../services/appointmentsService';
import { StatusBadge, statusLabel } from '../../components/StatusBadge';
import { FilterChip } from '../../components/FilterChip';
import { Button } from '../../components/Button';
import { COLORS } from '../../constants';
import { getBookingPhase } from '../../utils/bookingPhases';
import { formatDateWithDay } from '../../utils/dateHelpers';
import { formatTime12Hour } from '../../utils/timeSlotGenerator';

type Bucket = 'pending' | 'upcoming' | 'past';

export const DoctorAppointmentsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<DoctorStackParamList>>();
  const tabBarInset = useTabBarInset();
  const [appointments, setAppointments] = useState<Booking[]>([]);
  const [bucket, setBucket] = useState<Bucket>('pending');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAppointments(await listMyAppointments());
      setNow(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load appointments');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const buckets = useMemo(() => {
    const result: Record<Bucket, Booking[]> = {
      pending: [],
      upcoming: [],
      past: [],
    };
    appointments.forEach(a => {
      const phase = getBookingPhase(a, now);
      if (phase !== 'upcoming') result.past.push(a);
      else if (a.status === 'pending') result.pending.push(a);
      else result.upcoming.push(a);
    });
    const key = (a: Booking) => `${a.date} ${a.startTime}`;
    result.pending.sort((a, b) => key(a).localeCompare(key(b)));
    result.upcoming.sort((a, b) => key(a).localeCompare(key(b)));
    result.past.sort((a, b) => key(b).localeCompare(key(a)));
    return result;
  }, [appointments, now]);

  const change = (
    booking: Booking,
    status: BookingStatus,
    title: string,
    message: string,
    actionLabel: string,
  ) => {
    Alert.alert(title, message, [
      { text: 'Back', style: 'cancel' },
      {
        text: actionLabel,
        style: status === 'cancelled' ? 'destructive' : 'default',
        onPress: async () => {
          try {
            await updateAppointmentStatus(booking.id, status);
            await load();
          } catch (e) {
            Alert.alert(
              'Could not update',
              e instanceof Error ? e.message : 'Please try again.',
            );
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Booking }) => {
    const phase = getBookingPhase(item, now);
    const who = item.patientName ?? 'Patient';
    return (
      <View style={styles.card}>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('DoctorAppointmentDetail', {
              appointmentId: item.id,
            })
          }
          accessibilityRole="button"
          accessibilityLabel={`${who}, ${statusLabel(item, phase)}, ${formatDateWithDay(
            item.date,
          )}, ${formatTime12Hour(item.startTime)}. Open details`}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.patient}>{who}</Text>
            <StatusBadge booking={item} phase={phase} />
          </View>
          <Text style={styles.when}>{formatDateWithDay(item.date)}</Text>
          <Text style={styles.time}>
            {formatTime12Hour(item.startTime)} -{' '}
            {formatTime12Hour(item.endTime)}
          </Text>
        </TouchableOpacity>

        {phase === 'upcoming' && item.status === 'pending' && (
          <>
            <Button
              title="Confirm"
              accessibilityLabel={`Confirm appointment with ${who}`}
              onPress={() =>
                change(
                  item,
                  'confirmed',
                  'Confirm appointment?',
                  `Confirm the appointment with ${who}?`,
                  'Yes, confirm',
                )
              }
            />
            <Button
              title="Decline"
              variant="danger"
              accessibilityLabel={`Decline appointment with ${who}`}
              onPress={() =>
                change(
                  item,
                  'cancelled',
                  'Decline appointment?',
                  `Decline the appointment with ${who}?`,
                  'Yes, decline',
                )
              }
            />
          </>
        )}
        {phase === 'upcoming' && item.status === 'confirmed' && (
          <Button
            title="Cancel appointment"
            variant="danger"
            accessibilityLabel={`Cancel appointment with ${who}`}
            onPress={() =>
              change(
                item,
                'cancelled',
                'Cancel appointment?',
                `Cancel the appointment with ${who}?`,
                'Yes, cancel',
              )
            }
          />
        )}
        {phase === 'completed' && item.status !== 'completed' && (
          <Button
            title="Mark as completed"
            variant="secondary"
            accessibilityLabel={`Mark appointment with ${who} as completed`}
            onPress={() =>
              change(
                item,
                'completed',
                'Mark as completed?',
                `Mark the appointment with ${who} as completed?`,
                'Yes, mark completed',
              )
            }
          />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Appointments
        </Text>
        <View style={styles.chips}>
          {(['pending', 'upcoming', 'past'] as const).map(key => (
            <FilterChip
              key={key}
              label={`${key[0].toUpperCase()}${key.slice(1)} (${
                buckets[key].length
              })`}
              selected={bucket === key}
              onPress={() => setBucket(key)}
            />
          ))}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <FlatList
        data={buckets[bucket]}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: 16 + tabBarInset },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {bucket === 'pending'
              ? 'No requests waiting for you.'
              : bucket === 'upcoming'
              ? 'No upcoming appointments.'
              : 'Nothing here yet.'}
          </Text>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  error: { color: COLORS.danger, marginTop: 8 },
  list: { padding: 16 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  patient: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    flexShrink: 1,
    marginRight: 8,
  },
  when: { fontSize: 15, color: COLORS.text },
  time: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  empty: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginTop: 48,
    fontSize: 16,
  },
});
