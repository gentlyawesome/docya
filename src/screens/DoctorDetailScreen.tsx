import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { formatTimezone } from '../utils/dateHelpers';
import { RatingBadge } from '../components/RatingBadge';
import { COLORS, CURRENCY_SYMBOL } from '../constants';

const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

interface DoctorDetailScreenProps {
  route: RouteProp<RootStackParamList, 'DoctorDetail'>;
}

// Patients do not book here: their doctor schedules appointments for them. This page shows
// who the doctor is and when they work.
export const DoctorDetailScreen: React.FC<DoctorDetailScreenProps> = ({
  route,
}) => {
  const { doctor } = route.params;

  const hours = useMemo(
    () =>
      WEEKDAYS.map(day => ({
        day,
        windows: doctor.availabilities
          .filter(a => a.day_of_week === day)
          .map(a => `${a.available_at.trim()} - ${a.available_until.trim()}`),
      })).filter(d => d.windows.length > 0),
    [doctor.availabilities],
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView>
        <View style={styles.doctorInfo}>
          <View
            style={styles.avatar}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text style={styles.avatarText}>
              {doctor.name
                .split(' ')
                .map(n => n[0])
                .join('')
                .substring(0, 2)}
            </Text>
          </View>
          <Text style={styles.doctorName}>{doctor.name}</Text>
          {doctor.specialty && (
            <Text style={styles.specialty}>{doctor.specialty}</Text>
          )}
          {doctor.clinicName ? (
            <Text style={styles.clinic}>{doctor.clinicName}</Text>
          ) : null}
          <RatingBadge
            rating={doctor.rating}
            reviewCount={doctor.reviewCount}
          />
          {doctor.fee !== undefined && (
            <Text style={styles.fee}>
              Consultation {CURRENCY_SYMBOL}
              {doctor.fee}
            </Text>
          )}
          <Text style={styles.timezone}>
            📍 {formatTimezone(doctor.timezone)}
          </Text>
        </View>

        {doctor.bio ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              About
            </Text>
            <Text style={styles.body}>{doctor.bio}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Working hours
          </Text>
          {hours.length > 0 ? (
            hours.map(({ day, windows }) => (
              <View
                key={day}
                style={styles.hoursRow}
                accessible
                accessibilityLabel={`${day}, ${windows.join(' and ')}`}
              >
                <Text style={styles.day}>{day}</Text>
                <Text style={styles.windows}>{windows.join(', ')}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.body}>No working hours published yet.</Text>
          )}
          <Text style={styles.note}>
            Times are in the doctor's time zone. Your doctor schedules your
            appointments, and they will appear in My Bookings.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  doctorInfo: {
    backgroundColor: COLORS.card,
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#FFFFFF', fontSize: 32, fontWeight: '600' },
  doctorName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  specialty: { fontSize: 16, color: COLORS.textSecondary, marginBottom: 6 },
  clinic: { fontSize: 15, color: COLORS.textSecondary, marginBottom: 6 },
  fee: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
    marginTop: 6,
    marginBottom: 6,
  },
  timezone: { fontSize: 16, color: COLORS.textSecondary },
  section: { padding: 16 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  body: { fontSize: 15, color: COLORS.text, lineHeight: 22 },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  day: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  windows: { fontSize: 15, color: COLORS.primary },
  note: { fontSize: 13, color: COLORS.textSecondary, marginTop: 8 },
});
