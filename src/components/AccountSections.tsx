import React from 'react';
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Share,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  deleteAccount,
  logoutUser,
  selectAuthLoading,
} from '../store/slices/authSlice';
import { Button } from './Button';
import { buildDataExport } from '../services/dataExport';
import { selectUser } from '../store/slices/authSlice';
import {
  COLORS,
  RADIUS,
  CARD,
  FONTS,
  PRIVACY_POLICY_URL,
  TERMS_URL,
  USER_GUIDE_URL,
} from '../constants';

export const Section: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle} accessibilityRole="header">
      {title}
    </Text>
    {children}
  </View>
);

export const AboutSection: React.FC = () => (
  <Section title="About">
    <TouchableOpacity
      style={styles.linkRow}
      onPress={() => Linking.openURL(USER_GUIDE_URL)}
      accessibilityRole="link"
      accessibilityLabel="User guide"
    >
      <Text style={styles.linkText}>User guide</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={styles.linkRow}
      onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
      accessibilityRole="link"
      accessibilityLabel="Privacy policy"
    >
      <Text style={styles.linkText}>Privacy policy</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={styles.linkRow}
      onPress={() => Linking.openURL(TERMS_URL)}
      accessibilityRole="link"
      accessibilityLabel="Terms of service"
    >
      <Text style={styles.linkText}>Terms of service</Text>
    </TouchableOpacity>
  </Section>
);

export const AccountActionsSection: React.FC = () => {
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectAuthLoading);
  const user = useAppSelector(selectUser);
  const [exporting, setExporting] = React.useState(false);

  // A copy of everything held about this doctor, shared as text (Save to Files, Mail, AirDrop...)
  const exportData = async () => {
    if (!user) {
      return;
    }
    setExporting(true);
    try {
      const json = await buildDataExport(user);
      await Share.share({ title: 'My Docya data', message: json });
    } catch (e) {
      Alert.alert(
        'Could not export your data',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setExporting(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your account and all of your appointments. This cannot be undone.',
      [
        { text: 'Keep my account', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: async () => {
            const result = await dispatch(deleteAccount());
            if (deleteAccount.rejected.match(result)) {
              Alert.alert(
                'Could not delete your account',
                String(result.payload ?? 'Please try again.'),
              );
            }
          },
        },
      ],
    );
  };

  return (
    <Section title="Account">
      <Button
        title="Export my data"
        variant="secondary"
        onPress={exportData}
        loading={exporting}
        disabled={loading}
      />
      <Button
        title="Sign out"
        variant="secondary"
        onPress={() => dispatch(logoutUser())}
        disabled={loading}
      />
      <Button
        title="Delete account"
        variant="danger"
        onPress={confirmDelete}
        loading={loading}
      />
    </Section>
  );
};

const styles = StyleSheet.create({
  section: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    ...CARD,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: FONTS.serif,
    fontWeight: '400',
    color: COLORS.text,
    marginBottom: 12,
  },
  linkRow: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 16, color: COLORS.primary },
});
