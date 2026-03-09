import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  loadBookingsFromStorage,
  cancelBooking,
  selectUpcomingBookings,
  selectBookingsLoading,
} from '../store/slices/bookingsSlice';
import { Booking } from '../types';
import { formatDateWithDay, formatTimezone } from '../utils/dateHelpers';
import { formatTime12Hour } from '../utils/timeSlotGenerator';
import { COLORS } from '../constants';

export const MyBookingsScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const bookings = useAppSelector(selectUpcomingBookings);
  const loading = useAppSelector(selectBookingsLoading);

  useEffect(() => {
    dispatch(loadBookingsFromStorage());
  }, [dispatch]);

  const handleRefresh = () => {
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
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel appointment. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderBookingCard = ({ item }: { item: Booking }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.doctorName.split(' ').map(n => n[0]).join('').substring(0, 2)}
          </Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.doctorName}>{item.doctorName}</Text>
          <Text style={styles.timezone}>📍 {formatTimezone(item.timezone)}</Text>
        </View>
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
            {formatTime12Hour(item.startTime)} - {formatTime12Hour(item.endTime)}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => handleCancelBooking(item)}
      >
        <Text style={styles.cancelButtonText}>Cancel Appointment</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Appointments</Text>
        <Text style={styles.subtitle}>
          {bookings.length} upcoming appointment{bookings.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
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
            <Text style={styles.emptyTitle}>No Appointments</Text>
            <Text style={styles.emptyText}>
              You don't have any upcoming appointments.{'\n'}
              Book an appointment with a doctor to get started.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
