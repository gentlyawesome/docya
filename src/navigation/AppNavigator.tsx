import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  AuthStackParamList,
  DoctorStackParamList,
  DoctorTabParamList,
  MainTabParamList,
  RootStackParamList,
} from '../types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { initializeAuth, selectAuthInitialized, selectUser } from '../store/slices/authSlice';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { DoctorsListScreen } from '../screens/DoctorsListScreen';
import { DoctorDetailScreen } from '../screens/DoctorDetailScreen';
import { BookingConfirmationScreen } from '../screens/BookingConfirmationScreen';
import { MyBookingsScreen } from '../screens/MyBookingsScreen';
import { PatientProfileScreen } from '../screens/profile/PatientProfileScreen';
import { DoctorProfileScreen } from '../screens/profile/DoctorProfileScreen';
import { DoctorDashboardScreen } from '../screens/doctor/DoctorDashboardScreen';
import { DoctorAppointmentsScreen } from '../screens/doctor/DoctorAppointmentsScreen';
import { DoctorScheduleScreen } from '../screens/doctor/DoctorScheduleScreen';
import { DoctorAppointmentDetailScreen } from '../screens/doctor/DoctorAppointmentDetailScreen';
import { COLORS } from '../constants';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const PatientStack = createNativeStackNavigator<RootStackParamList>();
const PatientTab = createBottomTabNavigator<MainTabParamList>();
const DoctorStack = createNativeStackNavigator<DoctorStackParamList>();
const DoctorTab = createBottomTabNavigator<DoctorTabParamList>();

const styles = StyleSheet.create({
  tabIcon: { fontSize: 24 },
});

const TabIcon: React.FC<{ icon: string }> = ({ icon }) => <Text style={styles.tabIcon}>{icon}</Text>;

const renderDoctorsIcon = () => <TabIcon icon="👨‍⚕️" />;
const renderBookingsIcon = () => <TabIcon icon="📅" />;
const renderProfileIcon = () => <TabIcon icon="👤" />;
const renderDashboardIcon = () => <TabIcon icon="🏠" />;
const renderScheduleIcon = () => <TabIcon icon="🗓️" />;

const tabOptions = {
  tabBarActiveTintColor: COLORS.primary,
  tabBarInactiveTintColor: COLORS.textSecondary,
  tabBarStyle: { backgroundColor: COLORS.card, borderTopColor: COLORS.border },
  headerShown: false,
};

const stackOptions = {
  headerStyle: { backgroundColor: COLORS.card },
  headerTintColor: COLORS.primary,
  headerTitleStyle: { fontWeight: 'bold' as const },
};

const PatientTabs = () => (
  <PatientTab.Navigator screenOptions={tabOptions}>
    <PatientTab.Screen
      name="DoctorsList"
      component={DoctorsListScreen}
      options={{ tabBarLabel: 'Doctors', tabBarIcon: renderDoctorsIcon }}
    />
    <PatientTab.Screen
      name="MyBookings"
      component={MyBookingsScreen}
      options={{ tabBarLabel: 'My Bookings', tabBarIcon: renderBookingsIcon }}
    />
    <PatientTab.Screen
      name="Profile"
      component={PatientProfileScreen}
      options={{ tabBarLabel: 'Profile', tabBarIcon: renderProfileIcon }}
    />
  </PatientTab.Navigator>
);

const PatientNavigator = () => (
  <PatientStack.Navigator screenOptions={stackOptions}>
    <PatientStack.Screen name="MainTabs" component={PatientTabs} options={{ headerShown: false }} />
    <PatientStack.Screen
      name="DoctorDetail"
      component={DoctorDetailScreen}
      options={({ route }) => ({ title: route.params.doctor.name })}
    />
    <PatientStack.Screen
      name="BookingConfirmation"
      component={BookingConfirmationScreen}
      options={{ title: 'Confirm Booking', presentation: 'modal' }}
    />
  </PatientStack.Navigator>
);

const DoctorTabs = () => (
  <DoctorTab.Navigator screenOptions={tabOptions}>
    <DoctorTab.Screen
      name="DoctorDashboard"
      component={DoctorDashboardScreen}
      options={{ tabBarLabel: 'Dashboard', tabBarIcon: renderDashboardIcon }}
    />
    <DoctorTab.Screen
      name="DoctorAppointments"
      component={DoctorAppointmentsScreen}
      options={{ tabBarLabel: 'Appointments', tabBarIcon: renderBookingsIcon }}
    />
    <DoctorTab.Screen
      name="DoctorSchedule"
      component={DoctorScheduleScreen}
      options={{ tabBarLabel: 'Schedule', tabBarIcon: renderScheduleIcon }}
    />
    <DoctorTab.Screen
      name="DoctorProfile"
      component={DoctorProfileScreen}
      options={{ tabBarLabel: 'Profile', tabBarIcon: renderProfileIcon }}
    />
  </DoctorTab.Navigator>
);

const DoctorNavigator = () => (
  <DoctorStack.Navigator screenOptions={stackOptions}>
    <DoctorStack.Screen name="DoctorTabs" component={DoctorTabs} options={{ headerShown: false }} />
    <DoctorStack.Screen
      name="DoctorAppointmentDetail"
      component={DoctorAppointmentDetailScreen}
      options={{ title: 'Appointment' }}
    />
  </DoctorStack.Navigator>
);

const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={stackOptions}>
    <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
    <AuthStack.Screen name="Register" component={RegisterScreen} options={{ title: 'New account' }} />
  </AuthStack.Navigator>
);

// Signed out -> sign-in stack; signed in -> the app for the account's role
export const AppNavigator = () => {
  const dispatch = useAppDispatch();
  const initialized = useAppSelector(selectAuthInitialized);
  const user = useAppSelector(selectUser);

  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  if (!initialized) {
    return <LoadingSpinner message="Loading..." />;
  }

  return (
    <NavigationContainer>
      {!user ? <AuthNavigator /> : user.role === 'doctor' ? <DoctorNavigator /> : <PatientNavigator />}
    </NavigationContainer>
  );
};
