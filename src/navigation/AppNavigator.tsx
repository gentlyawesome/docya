import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { RootStackParamList, MainTabParamList } from '../types';
import { DoctorsListScreen } from '../screens/DoctorsListScreen';
import { DoctorDetailScreen } from '../screens/DoctorDetailScreen';
import { BookingConfirmationScreen } from '../screens/BookingConfirmationScreen';
import { MyBookingsScreen } from '../screens/MyBookingsScreen';
import { COLORS } from '../constants';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Main Tabs Navigator
const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="DoctorsList"
        component={DoctorsListScreen}
        options={{
          tabBarLabel: 'Doctors',
          tabBarIcon: ({ color }) => <TabIcon icon="👨‍⚕️" color={color} />,
        }}
      />
      <Tab.Screen
        name="MyBookings"
        component={MyBookingsScreen}
        options={{
          tabBarLabel: 'My Bookings',
          tabBarIcon: ({ color }) => <TabIcon icon="📅" color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};

// Simple icon component using emoji
const TabIcon: React.FC<{ icon: string; color: string }> = ({ icon }) => {
  return <Text style={{ fontSize: 24 }}>{icon}</Text>;
};

// Root Stack Navigator
export const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: COLORS.card,
          },
          headerTintColor: COLORS.primary,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DoctorDetail"
          component={DoctorDetailScreen}
          options={({ route }) => ({
            title: route.params.doctor.name,
          })}
        />
        <Stack.Screen
          name="BookingConfirmation"
          component={BookingConfirmationScreen}
          options={{
            title: 'Confirm Booking',
            presentation: 'modal',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
