import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  loadDoctors,
  selectFilteredDoctors,
  selectDoctorsLoading,
  selectDoctorsError,
  setSearchQuery,
  selectSearchQuery,
  hydrateDoctorsFromCache,
  selectDoctorsFromCache,
  selectDoctorsLastUpdated,
  selectSpecialties,
  selectHasRatings,
  selectHasActiveFilters,
  selectSpecialty,
  selectMinRating,
  selectFavoritesOnly,
  setSpecialty,
  setMinRating,
  setFavoritesOnly,
  clearFilters,
} from '../store/slices/doctorsSlice';
import {
  loadFavorites,
  toggleFavorite,
  selectFavoriteIds,
} from '../store/slices/favoritesSlice';
import { FilterChip } from '../components/FilterChip';
import { haptics } from '../utils/haptics';
import { RootStackParamList } from '../types';
import { DoctorCard } from '../components/DoctorCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { COLORS } from '../constants';
import { format } from 'date-fns';

type DoctorsListScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'MainTabs'
>;

interface DoctorsListScreenProps {
  navigation: DoctorsListScreenNavigationProp;
}

export const DoctorsListScreen: React.FC<DoctorsListScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const doctors = useAppSelector(selectFilteredDoctors);
  const loading = useAppSelector(selectDoctorsLoading);
  const error = useAppSelector(selectDoctorsError);
  const searchQuery = useAppSelector(selectSearchQuery);

  const favoriteIds = useAppSelector(selectFavoriteIds);
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const specialties = useAppSelector(selectSpecialties);
  const hasRatings = useAppSelector(selectHasRatings);
  const hasActiveFilters = useAppSelector(selectHasActiveFilters);
  const specialty = useAppSelector(selectSpecialty);
  const minRating = useAppSelector(selectMinRating);
  const favoritesOnly = useAppSelector(selectFavoritesOnly);
  const fromCache = useAppSelector(selectDoctorsFromCache);
  const lastUpdated = useAppSelector(selectDoctorsLastUpdated);

  useEffect(() => {
    const start = async () => {
      await dispatch(hydrateDoctorsFromCache());
      dispatch(loadDoctors());
    };
    dispatch(loadFavorites());
    start();
  }, [dispatch]);

  const handleRefresh = () => {
    dispatch(loadDoctors());
  };

  const handleSearch = (text: string) => {
    dispatch(setSearchQuery(text));
  };

  const handleDoctorPress = (doctor: any) => {
    navigation.navigate('DoctorDetail', { doctor });
  };

  if (loading && doctors.length === 0) {
    return <LoadingSpinner message="Loading doctors..." />;
  }

  if (error && doctors.length === 0) {
    return <ErrorMessage message={error} onRetry={handleRefresh} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Find a Doctor
        </Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or location..."
          accessibilityLabel="Search doctors by name or location"
          returnKeyType="search"
          value={searchQuery}
          onChangeText={handleSearch}
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterContent}
        keyboardShouldPersistTaps="handled"
      >
        {hasActiveFilters && (
          <TouchableOpacity
            onPress={() => dispatch(clearFilters())}
            style={styles.clearButton}
            accessibilityRole="button"
            accessibilityLabel="Clear all filters"
          >
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
        <FilterChip
          label="♥ Favorites"
          selected={favoritesOnly}
          onPress={() => dispatch(setFavoritesOnly(!favoritesOnly))}
        />
        {hasRatings &&
          [4, 4.5].map(value => (
            <FilterChip
              key={value}
              label={`★ ${value}+`}
              selected={minRating === value}
              onPress={() => dispatch(setMinRating(minRating === value ? null : value))}
            />
          ))}
        {specialties.map(name => (
          <FilterChip
            key={name}
            label={name}
            selected={specialty === name}
            onPress={() => dispatch(setSpecialty(specialty === name ? null : name))}
          />
        ))}
      </ScrollView>

      {fromCache && lastUpdated !== null && (
        <View style={styles.offlineBanner} accessibilityRole="alert">
          <Text style={styles.offlineText}>
            Showing saved doctors from {format(lastUpdated, 'MMM d, h:mm a')}. Pull down to refresh.
          </Text>
        </View>
      )}

      <FlatList
        data={doctors}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DoctorCard
            doctor={item}
            onPress={() => handleDoctorPress(item)}
            isFavorite={favoriteSet.has(item.id)}
            onToggleFavorite={() => {
              haptics.selection();
              dispatch(toggleFavorite(item.id));
            }}
          />
        )}
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
            <Text style={styles.emptyText}>
              {searchQuery || hasActiveFilters
                ? 'No doctors match your search or filters'
                : 'No doctors available'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  filterBar: {
    flexGrow: 0,
    paddingVertical: 8,
  },
  filterContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  clearButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  clearText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  offlineBanner: {
    backgroundColor: COLORS.warning,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  offlineText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '500',
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
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
