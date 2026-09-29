import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  loadBookingsFromStorage,
  cancelBooking,
  selectAllBookings,
  selectBookingsLoading,
} from '../store/slices/bookingsSlice';
import { Booking } from '../types';
import { formatDateWithDay, formatTimezone } from '../utils/dateHelpers';
import { formatTime12Hour } from '../utils/timeSlotGenerator';
import { COLORS } from '../constants';
import { describeLead } from '../services/reminders';
import { addToCalendar } from '../services/calendarExport';
import { getBookingPhase, partitionBookings } from '../utils/bookingPhases';

export const MyBookingsScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const allBookings = useAppSelector(selectAllBookings);
  const loading = useAppSelector(selectBookingsLoading);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [now, setNow] = useState(() => Date.now());

  // Appointments move from Upcoming to Past as time passes, so re-check on focus
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
    }, []),
  );

  const { upcoming, past } = useMemo(
    () => partitionBookings(allBookings, now),
    [allBookings, now],
  );
  const bookings = tab === 'upcoming' ? upcoming : past;

  useEffect(() => {
    dispatch(loadBookingsFromStorage());
  }, [dispatch]);

  const handleRefresh = () => {
    setNow(Date.now());
    dispatch(loadBookingsFromStorage());
  };

  const handleCancelBooking = (booking: Booking) => {
    Alert.alert(
      'Cancel Appointment',
      `Are you sure you want to cancel your appointment with ${booking.doctorName}?`,
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(cancelBooking(booking.id)).unwrap();
              Alert.alert('Cancelled', 'Your appointment has been cancelled.');
            } catch {
              Alert.alert(
                'Error',
                'Failed to cancel appointment. Please try again.',
              );
            }
          },
        },
      ],
    );
  };

  const handleAddToCalendar = async (booking: Booking) => {
    if ((await addToCalendar(booking)) === 'error') {
      Alert.alert(
        'Error',
        "Couldn't open the share sheet to add this appointment to your calendar.",
      );
    }
  };

  const renderBookingCard = ({ item }: { item: Booking }) => {
    const phase = getBookingPhase(item, now);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View
            style={styles.avatar}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text style={styles.avatarText}>
              {item.doctorName
                .split(' ')
                .map(n => n[0])
                .join('')
                .substring(0, 2)}
            </Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.doctorName}>{item.doctorName}</Text>
            <Text style={styles.timezone}>
              📍 {formatTimezone(item.timezone)}
            </Text>
          </View>
          {phase !== 'upcoming' && (
            <View
              style={[
                styles.badge,
                phase === 'cancelled'
                  ? styles.badgeCancelled
                  : styles.badgeCompleted,
              ]}
            >
              <Text style={styles.badgeText}>
                {phase === 'cancelled' ? 'Cancelled' : 'Completed'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📅 Date</Text>
            <Text style={styles.infoValue}>{formatDateWithDay(item.date)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>🕐 Time</Text>
            <Text style={styles.infoValue}>
              {formatTime12Hour(item.startTime)} -{' '}
              {formatTime12Hour(item.endTime)}
            </Text>
          </View>
        </View>

        {phase === 'upcoming' && item.reminderLeadMinutes !== undefined && (
          <Text style={styles.reminderText}>
            🔔 Reminder {describeLead(item.reminderLeadMinutes)}
          </Text>
        )}

        {phase === 'upcoming' && (
          <TouchableOpacity
            style={styles.calendarButton}
            onPress={() => handleAddToCalendar(item)}
            accessibilityRole="button"
            accessibilityLabel={`Add appointment with ${
              item.doctorName
            } on ${formatDateWithDay(item.date)} to your calendar`}
          >
            <Text style={styles.calendarButtonText}>Add to Calendar</Text>
          </TouchableOpacity>
        )}

        {phase === 'upcoming' && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => handleCancelBooking(item)}
            accessibilityRole="button"
            accessibilityLabel={`Cancel appointment with ${
              item.doctorName
            } on ${formatDateWithDay(item.date)}`}
          >
            <Text style={styles.cancelButtonText}>Cancel Appointment</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          My Appointments
        </Text>
        <View style={styles.tabs} accessibilityRole="tablist">
          {(['upcoming', 'past'] as const).map(key => {
            const count = key === 'upcoming' ? upcoming.length : past.length;
            const selected = tab === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.tab, selected && styles.tabSelected]}
                onPress={() => setTab(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${
                  key === 'upcoming' ? 'Upcoming' : 'Past'
                }, ${count}`}
              >
                <Text
                  style={[styles.tabText, selected && styles.tabTextSelected]}
                >
                  {key === 'upcoming' ? 'Upcoming' : 'Past'} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <FlatList
        data={bookings}
        keyExtractor={item => item.id}
        renderItem={renderBookingCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>
              {tab === 'upcoming'
                ? 'No Upcoming Appointments'
                : 'No Past Appointments'}
            </Text>
            <Text style={styles.emptyText}>
              {tab === 'upcoming'
                ? "You don't have any upcoming appointments.\nBook an appointment with a doctor to get started."
                : 'Completed and cancelled appointments will appear here.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  calendarButton: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  calendarButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  reminderText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 3,
    marginTop: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 36,
    justifyContent: 'center',
  },
  tabSelected: {
    backgroundColor: COLORS.card,
  },
  tabText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tabTextSelected: {
    color: COLORS.text,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeCancelled: {
    backgroundColor: COLORS.danger,
  },
  badgeCompleted: {
    backgroundColor: COLORS.textSecondary,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
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
  cardInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  timezone: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  cardBody: {
    marginBottom: 12,
  },
  infoRow: {
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  cancelButton: {
    backgroundColor: '#FFEBEE',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.danger,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
