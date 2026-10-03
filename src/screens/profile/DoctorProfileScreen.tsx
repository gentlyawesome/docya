import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { Avatar } from '../../components/Avatar';
import { COLORS, RADIUS, CARD, FONTS } from '../../constants';

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
        <View style={styles.header}>
          <Avatar name={user.fullName} size={56} />
          <View style={styles.headerText}>
            <Text style={styles.name} numberOfLines={1}>
              Dr. {user.fullName}
            </Text>
            <Text style={styles.email}>Your Docya account</Text>
          </View>
        </View>
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
  title: {
    fontSize: 32,
    fontFamily: FONTS.serif,
    fontWeight: '400',
    color: COLORS.text,
    margin: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    ...CARD,
  },
  headerText: { flex: 1, marginLeft: 14 },
  name: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  email: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
});
