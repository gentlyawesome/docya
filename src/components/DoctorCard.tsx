import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Doctor } from '../types';
import { COLORS } from '../constants';
import { formatTimezone } from '../utils/dateHelpers';

interface DoctorCardProps {
  doctor: Doctor;
  onPress: () => void;
}

export const DoctorCard: React.FC<DoctorCardProps> = ({ doctor, onPress }) => {
  const availableDays = [...new Set(doctor.availabilities.map(a => a.day_of_week))];
  
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {doctor.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
          </Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{doctor.name}</Text>
          <Text style={styles.timezone}>📍 {formatTimezone(doctor.timezone)}</Text>
        </View>
      </View>
      
      <View style={styles.availability}>
        <Text style={styles.availabilityLabel}>Available:</Text>
        <Text style={styles.availabilityDays}>
          {availableDays.length} day{availableDays.length !== 1 ? 's' : ''} per week
        </Text>
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.viewButton}>View Schedule →</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
  info: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  timezone: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  availability: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 8,
  },
  availabilityLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginRight: 8,
  },
  availabilityDays: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  footer: {
    marginTop: 8,
  },
  viewButton: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
});
