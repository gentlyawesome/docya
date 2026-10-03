import React, { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { Booking } from '../../types';
import { useAppSelector } from '../../store/hooks';
import { useTabBarInset } from '../../hooks/useTabBarInset';
import { selectUser } from '../../store/slices/authSlice';
import { listMyAppointments } from '../../services/appointmentsService';
import {
  OnboardingState,
  loadOnboarding,
  updateOnboarding,
} from '../../services/onboarding';
import { getPermission, loadSettings } from '../../services/reminders';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { GettingStarted } from '../../components/GettingStarted';
import { WelcomeCards } from '../../components/WelcomeCards';
import { COLORS, RADIUS, SHADOW } from '../../constants';
import { getBookingPhase } from '../../utils/bookingPhases';
import { formatDateWithDay } from '../../utils/dateHelpers';
import { formatTime12Hour } from '../../utils/timeSlotGenerator';

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <View
    style={styles.stat}
    accessible
    accessibilityLabel={`${label}: ${value}`}
  >
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

export const DoctorDashboardScreen: React.FC = () => {
  const user = useAppSelector(selectUser);
  const tabBarInset = useTabBarInset();
  const navigation = useNavigation<{
    navigate: (name: string, params?: object) => void;
  }>();
  const [appointments, setAppointments] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [remindersOn, setRemindersOn] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAppointments(await listMyAppointments());
      setNow(Date.now());
      if (user) {
        const [state, settings, permission] = await Promise.all([
          loadOnboarding(user.id),
          loadSettings(),
          getPermission(),
        ]);
        setOnboarding(state);
        setRemindersOn(
          settings.leadMinutes !== null && permission === 'granted',
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load appointments');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const { upcoming, today, next } = useMemo(() => {
    const live = appointments.filter(
      a => getBookingPhase(a, now) === 'upcoming',
    );
    const sorted = [...live].sort((a, b) =>
      `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`),
    );
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    return {
      upcoming: live.length,
      today: live.filter(a => a.date === todayKey).length,
      next: sorted[0],
    };
  }, [appointments, now]);

  const patchOnboarding = (patch: Partial<OnboardingState>) => {
    if (!user) {
      return;
    }
    setOnboarding(current => (current ? { ...current, ...patch } : current));
    updateOnboarding(user.id, patch);
  };

  const steps = [
    {
      key: 'hours',
      label: 'Review your working hours',
      done: !!onboarding?.hoursReviewed,
      onPress: () => navigation.navigate('DoctorSchedule'),
    },
    {
      key: 'patient',
      label: 'Book your first patient',
      done: appointments.length > 0,
      onPress: () => navigation.navigate('DoctorNewAppointment'),
    },
    {
      key: 'reminders',
      label: 'Turn on appointment reminders',
      done: remindersOn,
      onPress: () => navigation.navigate('DoctorProfile'),
    },
  ];
  const showChecklist =
    !!onboarding && !onboarding.checklistHidden && !steps.every(s => s.done);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <WelcomeCards
        visible={!!onboarding && !onboarding.welcomeSeen}
        onFinish={() => patchOnboarding({ welcomeSeen: true })}
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 16 + tabBarInset },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={COLORS.primary}
          />
        }
      >
        <Text style={styles.eyebrow}>
          {format(new Date(now), 'EEEE, MMM d').toUpperCase()}
        </Text>
        <Text style={styles.title} accessibilityRole="header">
          Hello, Dr. {user?.lastName || user?.fullName}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {showChecklist ? (
          <GettingStarted
            steps={steps}
            onHide={() => patchOnboarding({ checklistHidden: true })}
          />
        ) : null}

        <Text style={styles.sectionTitle} accessibilityRole="header">
          Next appointment
        </Text>
        {next ? (
          <TouchableOpacity
            style={styles.hero}
            activeOpacity={0.85}
            onPress={() =>
              navigation.navigate('DoctorAppointmentDetail', {
                appointmentId: next.id,
              })
            }
            accessibilityRole="button"
            accessibilityLabel={`Next appointment: ${
              next.patientName ?? 'Patient'
            }, ${formatDateWithDay(next.date)}, ${formatTime12Hour(
              next.startTime,
            )}. Open details`}
          >
            <Text style={styles.heroWhen}>{formatDateWithDay(next.date)}</Text>
            <Text style={styles.heroTime}>
              {formatTime12Hour(next.startTime)}
              <Text style={styles.heroEnd}>
                {' '}
                - {formatTime12Hour(next.endTime)}
              </Text>
            </Text>
            <View style={styles.heroPatient}>
              <Avatar name={next.patientName} dark />
              <Text style={styles.heroName} numberOfLines={1}>
                {next.patientName ?? 'Patient'}
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <Text style={styles.empty}>No upcoming appointments.</Text>
        )}

        <View style={styles.stats}>
          <Stat label="Today" value={today} />
          <Stat label="Upcoming" value={upcoming} />
        </View>

        <Button
          title="New appointment"
          onPress={() => navigation.navigate('DoctorNewAppointment')}
        />
        <Button
          title="Manage my schedule"
          variant="secondary"
          onPress={() => navigation.navigate('DoctorSchedule')}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16 },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: COLORS.textSecondary,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 2,
    marginBottom: 20,
  },
  error: { color: COLORS.danger, marginBottom: 8 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
  },
  hero: {
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.card,
    padding: 20,
    marginBottom: 16,
  },
  heroWhen: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,0.7)',
  },
  heroTime: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 4,
  },
  heroEnd: { fontSize: 18, fontWeight: '500', color: 'rgba(255,255,255,0.75)' },
  heroPatient: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navySoft,
    borderRadius: RADIUS.control,
    padding: 10,
    marginTop: 16,
  },
  heroName: {
    flexShrink: 1,
    marginLeft: 12,
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stats: { flexDirection: 'row', marginHorizontal: -4, marginBottom: 12 },
  stat: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    marginHorizontal: 4,
    ...SHADOW,
  },
  statValue: { fontSize: 30, fontWeight: 'bold', color: COLORS.text },
  statLabel: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  empty: { color: COLORS.textSecondary, marginBottom: 16 },
});
