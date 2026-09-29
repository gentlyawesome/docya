import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { addDays, format } from 'date-fns';
import { RootStackParamList, TimeSlot } from '../types';
import { useAppSelector } from '../store/hooks';
import { selectActiveBookings } from '../store/slices/bookingsSlice';
import { filterFutureSlots, generateDoctorTimeSlots, HeldSlot } from '../utils/timeSlotGenerator';
import { fetchBookedSlots } from '../services/doctorsService';
import { formatTimezone } from '../utils/dateHelpers';
import { TimeSlotButton } from '../components/TimeSlotButton';
import { DoctorCalendar } from '../components/DoctorCalendar';
import { RatingBadge } from '../components/RatingBadge';
import { COLORS, CURRENCY_SYMBOL } from '../constants';

type DoctorDetailScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'DoctorDetail'
>;

type DoctorDetailScreenRouteProp = RouteProp<RootStackParamList, 'DoctorDetail'>;

interface DoctorDetailScreenProps {
  navigation: DoctorDetailScreenNavigationProp;
  route: DoctorDetailScreenRouteProp;
}

export const DoctorDetailScreen: React.FC<DoctorDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { doctor } = route.params;
  const bookings = useAppSelector(selectActiveBookings);
  const [heldByOthers, setHeldByOthers] = useState<HeldSlot[]>([]);

  // Slots other patients already hold; refreshed whenever this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const today = new Date();
      fetchBookedSlots(
        doctor.id,
        format(today, 'yyyy-MM-dd'),
        format(addDays(today, 13), 'yyyy-MM-dd')
      )
        .then(slots => {
          if (active) {
            setHeldByOthers(slots.map(s => ({ doctorId: doctor.id, ...s })));
          }
        })
        .catch(() => {
          // Your own bookings still block their slots; the server rejects any double booking
        });
      return () => {
        active = false;
      };
    }, [doctor.id])
  );

  // Generate time slots for the doctor
  const allSlots = useMemo(() => {
    return filterFutureSlots(
      generateDoctorTimeSlots(
        doctor.id,
        doctor.name,
        doctor.availabilities,
        new Date(),
        14,
        [...bookings, ...heldByOthers]
      )
    );
  }, [doctor, bookings, heldByOthers]);

  const availableDates = useMemo(
    () => [...new Set(allSlots.filter(slot => !slot.isBooked).map(slot => slot.date))],
    [allSlots]
  );

  // Open on the first day that actually has an open slot, not simply today
  const [selectedDate, setSelectedDate] = useState<string>(
    () => availableDates[0] ?? format(new Date(), 'yyyy-MM-dd')
  );

  // Filter slots by selected date
  const slotsForSelectedDate = useMemo(() => {
    return allSlots.filter(slot => slot.date === selectedDate);
  }, [allSlots, selectedDate]);

  const handleSlotPress = (slot: TimeSlot) => {
    if (!slot.isBooked) {
      navigation.navigate('BookingConfirmation', { doctor, timeSlot: slot });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView>
        {/* Doctor Info */}
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
          <Text style={styles.doctorName}>{doctor.name}</Text>
          {doctor.specialty && <Text style={styles.specialty}>{doctor.specialty}</Text>}
          <RatingBadge rating={doctor.rating} reviewCount={doctor.reviewCount} />
          {doctor.fee !== undefined && <Text style={styles.fee}>Consultation {CURRENCY_SYMBOL}{doctor.fee}</Text>}
          <Text style={styles.timezone}>📍 {formatTimezone(doctor.timezone)}</Text>
        </View>

        {/* Date Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Select Date
          </Text>
          <DoctorCalendar
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            availableDates={availableDates}
          />
        </View>

        {/* Time Slots */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Available Time Slots
          </Text>
          {slotsForSelectedDate.length > 0 ? (
            <View style={styles.slotsContainer}>
              {slotsForSelectedDate.map((slot) => (
                <TimeSlotButton
                  key={slot.id}
                  slot={slot}
                  onPress={() => handleSlotPress(slot)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptySlots}>
              <Text style={styles.emptyText}>No available slots for this date</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
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
  avatarText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '600',
  },
  doctorName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  timezone: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  specialty: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  fee: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
    marginTop: 6,
    marginBottom: 6,
  },
  slotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptySlots: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
