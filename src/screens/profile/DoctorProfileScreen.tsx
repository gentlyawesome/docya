import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSelector } from '../../store/hooks';
import { useTabBarInset } from '../../hooks/useTabBarInset';
import { selectUser } from '../../store/slices/authSlice';
import {
  AboutSection,
  AccountActionsSection,
} from '../../components/AccountSections';
import { ProfileForm } from '../../components/ProfileForm';
import { ReminderSettings } from '../../components/ReminderSettings';
import { COLORS } from '../../constants';

export const DoctorProfileScreen: React.FC = () => {
  const user = useAppSelector(selectUser);
  const tabBarInset = useTabBarInset();
  if (!user) {
    return null;
  }
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 32 + tabBarInset },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.title} accessibilityRole="header">
          My Profile
        </Text>
        <ProfileForm user={user} />
        <ReminderSettings />
        <AboutSection />
        <AccountActionsSection />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 32 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.text, margin: 16 },
});
