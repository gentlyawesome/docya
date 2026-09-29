import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { useAppDispatch } from '../store/hooks';
import { createBooking } from '../store/slices/bookingsSlice';
import { formatDateWithDay, formatTimezone } from '../utils/dateHelpers';
import { formatTime12Hour } from '../utils/timeSlotGenerator';
import { COLORS, DEFAULT_REMINDER_MINUTES, REMINDER_OPTIONS } from '../constants';
import { FilterChip } from '../components/FilterChip';
import { describeLead, ReminderResult } from '../services/reminders';
import { getReminderTime } from '../utils/bookingPhases';
import { haptics } from '../utils/haptics';

type BookingConfirmationScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'BookingConfirmation'
>;

type BookingConfirmationScreenRouteProp = RouteProp<
  RootStackParamList,
  'BookingConfirmation'
>;

interface BookingConfirmationScreenProps {
  navigation: BookingConfirmationScreenNavigationProp;
  route: BookingConfirmationScreenRouteProp;
}

export const BookingConfirmationScreen: React.FC<BookingConfirmationScreenProps> = ({
  navigation,
  route,
}) => {
  const { doctor, timeSlot } = route.params;
  const dispatch = useAppDispatch();
  const [isBooking, setIsBooking] = useState(false);

  // Only offer reminder times that are still in the future
  const reminderOptions = useMemo(
    () =>
      REMINDER_OPTIONS.filter(
        option =>
          option.minutes === null ||
          getReminderTime(timeSlot.date, timeSlot.startTime, timeSlot.timezone, option.minutes) !==
            null
      ),
    [timeSlot]
  );
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(() =>
    reminderOptions.some(o => o.minutes === DEFAULT_REMINDER_MINUTES)
      ? DEFAULT_REMINDER_MINUTES
      : null
  );

  const reminderNote = (reminder: ReminderResult | null): string => {
    switch (reminder?.status) {
      case 'scheduled':
        return `\n\nWe'll remind you ${describeLead(reminder.leadMinutes)}.`;
      case 'denied':
        return '\n\nNo reminder was set because notifications are turned off for this app. You can enable them in Settings.';
      case 'error':
        return "\n\nWe couldn't set a reminder for this appointment.";
      default:
        return '';
    }
  };

  const handleConfirmBooking = async () => {
    setIsBooking(true);
    try {
      const { reminder } = await dispatch(
        createBooking({ timeSlot, reminderLeadMinutes: reminderMinutes })
      ).unwrap();
      haptics.success();
      
      Alert.alert(
        'Appointment Requested ✅',
        `Your appointment with ${doctor.name} has been requested. It will show as confirmed once the doctor accepts it.${reminderNote(reminder)}`,
        [
          {
            text: 'View My Bookings',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs' }],
              });
              // Navigate to bookings tab would require tab navigation reference
            },
          },
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      haptics.error();
      Alert.alert(
        'Booking Failed',
        error || 'Unable to book this appointment. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsBooking(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerIcon}>📅</Text>
          <Text style={styles.headerTitle} accessibilityRole="header">
            Confirm Appointment
          </Text>
          <Text style={styles.headerSubtitle}>
            Please review your appointment details
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.section}>
            <Text style={styles.label}>Doctor</Text>
            <View style={styles.doctorInfo}>
              <View
                style={styles.avatar}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Text style={styles.avatarText}>
                  {doctor.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                </Text>
              </View>
              <View>
                <Text style={styles.doctorName}>{doctor.name}</Text>
                <Text style={styles.timezone}>📍 {formatTimezone(doctor.timezone)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.label}>Date & Time</Text>
            <Text style={styles.value}>{formatDateWithDay(timeSlot.date)}</Text>
            <Text style={styles.timeValue}>
              {formatTime12Hour(timeSlot.startTime)} - {formatTime12Hour(timeSlot.endTime)}
            </Text>
            <Text style={styles.duration}>Duration: 30 minutes</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.label}>Timezone</Text>
            <Text style={styles.value}>{timeSlot.timezone}</Text>
          </View>
        </View>

        <View style={[styles.card, styles.reminderCard]}>
          <View style={styles.section}>
            <Text style={styles.label} accessibilityRole="header">
              Reminder
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {reminderOptions.map(option => (
                <FilterChip
                  key={option.label}
                  label={option.label}
                  selected={reminderMinutes === option.minutes}
                  onPress={() => setReminderMinutes(option.minutes)}
                />
              ))}
            </ScrollView>
          </View>
        </View>

        <View style={styles.note}>
          <Text style={styles.noteIcon}>ℹ️</Text>
          <Text style={styles.noteText}>
            Please arrive 5 minutes before your scheduled appointment time.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          disabled={isBooking}
          accessibilityRole="button"
          accessibilityLabel="Cancel and go back"
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.confirmButton, isBooking && styles.confirmButtonDisabled]}
          onPress={handleConfirmBooking}
          disabled={isBooking}
          accessibilityRole="button"
          accessibilityLabel={`Confirm booking with ${doctor.name}`}
          accessibilityState={{ disabled: isBooking, busy: isBooking }}
        >
          <Text style={styles.confirmButtonText}>
            {isBooking ? 'Booking...' : 'Confirm Booking'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reminderCard: {
    marginTop: 16,
  },
  section: {
    marginVertical: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  value: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  timeValue: {
    fontSize: 20,
    color: COLORS.primary,
    fontWeight: 'bold',
    marginTop: 4,
  },
  duration: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  doctorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  doctorName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  timezone: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 16,
  },
  note: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  noteIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 14,
    color: '#1976D2',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  confirmButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: COLORS.disabled,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
