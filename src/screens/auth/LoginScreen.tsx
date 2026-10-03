import React, { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  clearAuthMessages,
  loginUser,
  selectAuthError,
  selectAuthLoading,
} from '../../store/slices/authSlice';
import { Button } from '../../components/Button';
import { FormField } from '../../components/FormField';
import { COLORS, FONTS } from '../../constants';
import { isValidEmail } from '../../utils/validation';

interface Props {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
}

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectAuthLoading);
  const serverError = useAppSelector(selectAuthError);
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );

  // Start each visit without another screen's error
  useFocusEffect(
    useCallback(() => {
      dispatch(clearAuthMessages());
    }, [dispatch]),
  );

  const submit = () => {
    const next: typeof errors = {};
    if (!isValidEmail(email)) {
      next.email = 'Enter a valid email address';
    }
    if (!password) {
      next.password = 'Enter your password';
    }
    setErrors(next);
    if (Object.keys(next).length === 0) {
      dispatch(loginUser({ email, password }));
    }
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <Text style={styles.title} accessibilityRole="header">
            Welcome to Docya
          </Text>
          <Text style={styles.subtitle}>
            Sign in to manage your appointments
          </Text>

          {serverError ? (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Text style={styles.errorText}>{serverError}</Text>
            </View>
          ) : null}

          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="username"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <FormField
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />

          <Button title="Sign in" onPress={submit} loading={loading} />
          <Button
            title="Forgot password?"
            variant="secondary"
            onPress={() => navigation.navigate('ForgotPassword')}
            disabled={loading}
          />
          <Button
            title="Create an account"
            variant="secondary"
            onPress={() => navigation.navigate('Register')}
            disabled={loading}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingTop: 48 },
  title: {
    fontSize: 32,
    fontFamily: FONTS.serif,
    fontWeight: '400',
    color: COLORS.text,
    marginBottom: 6,
  },
  subtitle: { fontSize: 16, color: COLORS.textSecondary, marginBottom: 24 },
  errorBox: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: COLORS.danger, fontSize: 14 },
});
