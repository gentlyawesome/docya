import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Doctor } from '../types';
import { COLORS } from '../constants';
import { formatTimezone } from '../utils/dateHelpers';
import { RatingBadge } from './RatingBadge';

interface DoctorCardProps {
  doctor: Doctor;
  onPress: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export const DoctorCard: React.FC<DoctorCardProps> = ({
  doctor,
  onPress,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const availableDays = [
    ...new Set(doctor.availabilities.map(a => a.day_of_week)),
  ];

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.content}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${doctor.name}${
          doctor.specialty ? `, ${doctor.specialty}` : ''
        }. View schedule`}
      >
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {doctor.name
                .split(' ')
                .map(n => n[0])
                .join('')
                .substring(0, 2)}
            </Text>
          </View>
          <View
            style={[styles.info, onToggleFavorite && styles.infoWithFavorite]}
          >
            <Text style={styles.name}>{doctor.name}</Text>
            {doctor.specialty && (
              <Text style={styles.specialty}>{doctor.specialty}</Text>
            )}
            <RatingBadge
              rating={doctor.rating}
              reviewCount={doctor.reviewCount}
            />
            <Text style={styles.timezone}>
              📍 {formatTimezone(doctor.timezone)}
            </Text>
          </View>
        </View>

        <View style={styles.availability}>
          <Text style={styles.availabilityLabel}>Available:</Text>
          <Text style={styles.availabilityDays}>
            {availableDays.length} day{availableDays.length !== 1 ? 's' : ''}{' '}
            per week
          </Text>
        </View>

        <View style={styles.footer}>
          {doctor.fee !== undefined && (
            <Text style={styles.fee}>${doctor.fee} consult</Text>
          )}
          <Text style={styles.viewButton}>View Schedule →</Text>
        </View>
      </TouchableOpacity>
      {onToggleFavorite && (
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={onToggleFavorite}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={
            isFavorite
              ? `Remove ${doctor.name} from favorites`
              : `Add ${doctor.name} to favorites`
          }
          accessibilityState={{ selected: isFavorite }}
        >
          <Text style={styles.favoriteIcon}>{isFavorite ? '♥' : '♡'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    padding: 16,
  },
  infoWithFavorite: {
    marginRight: 40,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteIcon: {
    fontSize: 26,
    color: COLORS.danger,
  },
  specialty: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  fee: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  viewButton: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
});
