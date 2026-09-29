import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants';

interface RatingBadgeProps {
  rating?: number;
  reviewCount?: number;
}

export const RatingBadge: React.FC<RatingBadgeProps> = ({ rating, reviewCount }) => {
  if (rating === undefined) {
    return null;
  }

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={`Rated ${rating.toFixed(1)} out of 5${
        reviewCount ? ` from ${reviewCount} reviews` : ''
      }`}
    >
      <Text style={styles.star}>★</Text>
      <Text style={styles.rating}>{rating.toFixed(1)}</Text>
      {reviewCount !== undefined && <Text style={styles.count}>({reviewCount})</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  star: {
    color: COLORS.warning,
    fontSize: 14,
    marginRight: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  count: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
});
