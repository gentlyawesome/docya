import { StyleSheet } from 'react-native';
import { COLORS } from '../../constants';

// Shared by the small forms that live in the sign-in stack
export const authStyles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24 },
  intro: { fontSize: 16, color: COLORS.textSecondary, marginBottom: 20 },
  errorBox: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: COLORS.danger, fontSize: 14 },
  infoBox: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  infoText: { color: COLORS.primary, fontSize: 14 },
});
