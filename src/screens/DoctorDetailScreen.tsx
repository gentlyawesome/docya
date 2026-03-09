import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { format } from 'date-fns';
import { RootStackParamList, TimeSlot } from '../types';
import { useAppSelector } from '../store/hooks';
import { selectAllBookings } from '../store/slices/bookingsSlice';
import { generateDoctorTimeSlots } from '../utils/timeSlotGenerator';
import { formatTimezone, getNextDays } from '../utils/dateHelpers';
import { TimeSlotButton } from '../components/TimeSlotButton';
import { COLORS } from '../constants';

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
  const bookings = useAppSelector(selectAllBookings);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // Generate next 14 days
  const dates = useMemo(() => getNextDays(14), []);

  // Generate time slots for the doctor
  const allSlots = useMemo(() => {
    return generateDoctorTimeSlots(
      doctor.id,
      doctor.name,
      doctor.availabilities,
      new Date(),
      14,
      bookings
    );
  }, [doctor, bookings]);

  // Filter slots by selected date
  const slotsForSelectedDate = useMemo(() => {
    return allSlots.filter(slot => slot.date === selectedDate);
  }, [allSlots, selectedDate]);

  const handleSlotPress = (slot: TimeSlot) => {
    if (!slot.isBooked) {
      navigation.navigate('BookingConfirmation', { doctor, timeSlot: slot });
    }
  };

  const handleDatePress = (date: Date) => {
    setSelectedDate(format(date, 'yyyy-MM-dd'));
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Doctor Info */}
        <View style={styles.doctorInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {doctor.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
            </Text>
          </View>
          <Text style={styles.doctorName}>{doctor.name}</Text>
          <Text style={styles.timezone}>📍 {formatTimezone(doctor.timezone)}</Text>
        </View>

        {/* Date Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.dateList}>
              {dates.map((date) => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const isSelected = dateStr === selectedDate;
                const dayName = format(date, 'EEE');
                const dayNum = format(date, 'd');
                const monthName = format(date, 'MMM');

                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[styles.dateCard, isSelected && styles.dateCardSelected]}
                    onPress={() => handleDatePress(date)}
                  >
                    <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>
                      {dayName}
                    </Text>
                    <Text style={[styles.dayNum, isSelected && styles.dayNumSelected]}>
                      {dayNum}
                    </Text>
                    <Text style={[styles.monthName, isSelected && styles.monthNameSelected]}>
                      {monthName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Time Slots */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Time Slots</Text>
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
  dateList: {
    flexDirection: 'row',
  },
  dateCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginRight: 8,
    minWidth: 70,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  dateCardSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayName: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  dayNameSelected: {
    color: '#FFFFFF',
  },
  dayNum: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginVertical: 4,
  },
  dayNumSelected: {
    color: '#FFFFFF',
  },
  monthName: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  monthNameSelected: {
    color: '#FFFFFF',
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
