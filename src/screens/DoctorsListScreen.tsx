import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  loadDoctors,
  selectFilteredDoctors,
  selectDoctorsLoading,
  selectDoctorsError,
  setSearchQuery,
  selectSearchQuery,
} from '../store/slices/doctorsSlice';
import { RootStackParamList } from '../types';
import { DoctorCard } from '../components/DoctorCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { COLORS } from '../constants';

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

  useEffect(() => {
    dispatch(loadDoctors());
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Find a Doctor</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or location..."
          value={searchQuery}
          onChangeText={handleSearch}
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      <FlatList
        data={doctors}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DoctorCard doctor={item} onPress={() => handleDoctorPress(item)} />
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
              {searchQuery ? 'No doctors found matching your search' : 'No doctors available'}
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
