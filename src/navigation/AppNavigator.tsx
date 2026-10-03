import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  AuthStackParamList,
  DoctorStackParamList,
  DoctorTabParamList,
} from '../types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  initializeAuth,
  selectAuthInitialized,
  selectUser,
} from '../store/slices/authSlice';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen';
import { ConfirmEmailScreen } from '../screens/auth/ConfirmEmailScreen';
import { DoctorProfileScreen } from '../screens/profile/DoctorProfileScreen';
import { DoctorDashboardScreen } from '../screens/doctor/DoctorDashboardScreen';
import { DoctorAppointmentsScreen } from '../screens/doctor/DoctorAppointmentsScreen';
import { DoctorScheduleScreen } from '../screens/doctor/DoctorScheduleScreen';
import { DoctorNewAppointmentScreen } from '../screens/doctor/DoctorNewAppointmentScreen';
import { DoctorAppointmentDetailScreen } from '../screens/doctor/DoctorAppointmentDetailScreen';
import { COLORS, SHADOW } from '../constants';
import {
  CalendarIcon,
  ClockIcon,
  HomeIcon,
  UserIcon,
} from '../components/TabIcons';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const DoctorStack = createNativeStackNavigator<DoctorStackParamList>();
const DoctorTab = createBottomTabNavigator<DoctorTabParamList>();

// The current tab's icon sits on a soft blue circle
const TabIconCircle: React.FC<{
  focused: boolean;
  children: React.ReactNode;
}> = ({ focused, children }) => (
  <View style={[styles.iconCircle, focused && styles.iconCircleActive]}>
    {children}
  </View>
);

type IconArgs = { color: string; focused: boolean };

const renderBookingsIcon = ({ color, focused }: IconArgs) => (
  <TabIconCircle focused={focused}>
    <CalendarIcon color={color} />
  </TabIconCircle>
);
const renderProfileIcon = ({ color, focused }: IconArgs) => (
  <TabIconCircle focused={focused}>
    <UserIcon color={color} />
  </TabIconCircle>
);
const renderDashboardIcon = ({ color, focused }: IconArgs) => (
  <TabIconCircle focused={focused}>
    <HomeIcon color={color} />
  </TabIconCircle>
);
const renderScheduleIcon = ({ color, focused }: IconArgs) => (
  <TabIconCircle focused={focused}>
    <ClockIcon color={color} />
  </TabIconCircle>
);

const styles = StyleSheet.create({
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleActive: { backgroundColor: COLORS.primarySoft },
});

// A rounded bar that floats above the bottom edge, with the current tab on a soft blue pill
const tabOptions = {
  tabBarActiveTintColor: COLORS.primary,
  tabBarInactiveTintColor: COLORS.textSecondary,
  tabBarStyle: {
    position: 'absolute' as const,
    left: 12,
    right: 12,
    bottom: 12,
    height: 68,
    paddingTop: 0,
    paddingBottom: 0,
    borderTopWidth: 0,
    borderRadius: 24,
    backgroundColor: COLORS.card,
    ...SHADOW,
    shadowOpacity: 0.1,
  },
  tabBarItemStyle: { paddingVertical: 6 },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const },
  headerShown: false,
};

const stackOptions = {
  headerStyle: { backgroundColor: COLORS.card },
  headerTintColor: COLORS.text,
  headerTitleStyle: { fontWeight: '600' as const },
};

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
    <DoctorStack.Screen
      name="DoctorTabs"
      component={DoctorTabs}
      options={{ headerShown: false }}
    />
    <DoctorStack.Screen
      name="DoctorNewAppointment"
      component={DoctorNewAppointmentScreen}
      options={{ title: 'New appointment', headerBackTitle: 'Back' }}
    />
    <DoctorStack.Screen
      name="DoctorAppointmentDetail"
      component={DoctorAppointmentDetailScreen}
      options={{ title: 'Appointment', headerBackTitle: 'Back' }}
    />
  </DoctorStack.Navigator>
);

const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={stackOptions}>
    <AuthStack.Screen
      name="Login"
      component={LoginScreen}
      options={{ headerShown: false }}
    />
    <AuthStack.Screen
      name="Register"
      component={RegisterScreen}
      options={{ title: 'New account', headerBackTitle: 'Back' }}
    />
    <AuthStack.Screen
      name="ForgotPassword"
      component={ForgotPasswordScreen}
      options={{ title: 'Forgot password', headerBackTitle: 'Back' }}
    />
    <AuthStack.Screen
      name="ResetPassword"
      component={ResetPasswordScreen}
      options={{ title: 'New password', headerBackTitle: 'Back' }}
    />
    <AuthStack.Screen
      name="ConfirmEmail"
      component={ConfirmEmailScreen}
      options={{ title: 'Confirm your email', headerBackTitle: 'Back' }}
    />
  </AuthStack.Navigator>
);

// Signed out -> sign-in stack; signed in -> the doctor app
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
      {user ? <DoctorNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};
