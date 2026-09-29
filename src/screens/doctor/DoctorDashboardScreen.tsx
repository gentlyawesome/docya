import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { Booking } from '../../types';
import { useAppSelector } from '../../store/hooks';
import { useTabBarInset } from '../../hooks/useTabBarInset';
import { selectUser } from '../../store/slices/authSlice';
import { listMyAppointments } from '../../services/appointmentsService';
import { Button } from '../../components/Button';
import { StatusBadge } from '../../components/StatusBadge';
import { COLORS } from '../../constants';
import { getBookingPhase } from '../../utils/bookingPhases';
import { formatDateWithDay } from '../../utils/dateHelpers';
import { formatTime12Hour } from '../../utils/timeSlotGenerator';

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

export const DoctorDashboardScreen: React.FC = () => {
  const user = useAppSelector(selectUser);
  const tabBarInset = useTabBarInset();
  const navigation = useNavigation<{ navigate: (name: string) => void }>();
  const [appointments, setAppointments] = useState<Booking[]>([]);
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
    }, [load])
  );

  const { pending, upcoming, today, next } = useMemo(() => {
    const live = appointments.filter(a => getBookingPhase(a, now) === 'upcoming');
    const sorted = [...live].sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    return {
      pending: live.filter(a => a.status === 'pending').length,
      upcoming: live.filter(a => a.status === 'confirmed').length,
      today: live.filter(a => a.date === todayKey).length,
      next: sorted.find(a => a.status === 'confirmed') ?? sorted[0],
    };
  }, [appointments, now]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 16 + tabBarInset }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.primary} />}
      >
        <Text style={styles.title} accessibilityRole="header">
          Hello, Dr. {user?.lastName || user?.fullName}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.stats}>
          <Stat label="Today" value={today} />
          <Stat label="Requests" value={pending} />
          <Stat label="Upcoming" value={upcoming} />
        </View>

        <Text style={styles.sectionTitle} accessibilityRole="header">
          Next appointment
        </Text>
        {next ? (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.patient}>{next.patientName ?? 'Patient'}</Text>
              <StatusBadge booking={next} phase="upcoming" />
            </View>
            <Text style={styles.when}>{formatDateWithDay(next.date)}</Text>
            <Text style={styles.time}>
              {formatTime12Hour(next.startTime)} - {formatTime12Hour(next.endTime)}
            </Text>
          </View>
        ) : (
          <Text style={styles.empty}>No upcoming appointments.</Text>
        )}

        {pending > 0 && (
          <Button title={`Review ${pending} request${pending === 1 ? '' : 's'}`} onPress={() => navigation.navigate('DoctorAppointments')} />
        )}
        <Button title="Manage my schedule" variant="secondary" onPress={() => navigation.navigate('DoctorSchedule')} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.text, marginBottom: 16 },
  error: { color: COLORS.danger, marginBottom: 8 },
  stats: { flexDirection: 'row', marginBottom: 20 },
  stat: { flex: 1, backgroundColor: COLORS.card, borderRadius: 12, padding: 14, alignItems: 'center', marginHorizontal: 4 },
  statValue: { fontSize: 28, fontWeight: 'bold', color: COLORS.primary },
  statLabel: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  card: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  patient: { fontSize: 18, fontWeight: '600', color: COLORS.text, flexShrink: 1, marginRight: 8 },
  when: { fontSize: 15, color: COLORS.text },
  time: { fontSize: 15, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  empty: { color: COLORS.textSecondary, marginBottom: 12 },
});
