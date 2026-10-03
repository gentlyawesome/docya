import React, { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  clearAuthMessages,
  registerUser,
  selectAuthError,
  selectAuthLoading,
} from '../../store/slices/authSlice';
import { Button } from '../../components/Button';
import { FormField } from '../../components/FormField';
import { COLORS, PRIVACY_POLICY_URL } from '../../constants';
import {
  isValidEmail,
  isValidPassword,
  isValidPhone,
  MIN_PASSWORD_LENGTH,
} from '../../utils/validation';

// Real builds get the password manager's "strong password" suggestion. That overlay swallows typing
// in the iOS Simulator, so development builds (used by the automated tests) turn it off.
const PASSWORD_HINT = __DEV__ ? 'oneTimeCode' : 'newPassword';

interface Props {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>;
}

type Errors = Partial<
  Record<
    | 'firstName'
    | 'lastName'
    | 'email'
    | 'phone'
    | 'password'
    | 'confirm'
    | 'specialization',
    string
  >
>;

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectAuthLoading);
  const serverError = useAppSelector(selectAuthError);

  const lastRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const specializationRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  // Start each visit without another screen's error
  useFocusEffect(
    useCallback(() => {
      dispatch(clearAuthMessages());
    }, [dispatch]),
  );

  const submit = async () => {
    const next: Errors = {};
    if (!firstName.trim()) next.firstName = 'Enter your first name';
    if (!lastName.trim()) next.lastName = 'Enter your last name';
    if (!isValidEmail(email)) next.email = 'Enter a valid email address';
    if (!isValidPhone(phone)) next.phone = 'Enter a valid phone number';
    if (!isValidPassword(password)) {
      next.password = `Use at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    if (confirm !== password) next.confirm = 'Passwords do not match';
    if (!specialization.trim())
      next.specialization = 'Enter your specialization';
    setErrors(next);
    if (Object.keys(next).length > 0) {
      return;
    }
    const result = await dispatch(
      registerUser({
        email,
        password,
        firstName,
        lastName,
        phone,
        specialization,
      }),
    );
    // The project asks for the emailed code before the account can be used
    if (
      registerUser.fulfilled.match(result) &&
      result.payload.status === 'confirm_email'
    ) {
      navigation.navigate('ConfirmEmail', { email: email.trim() });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {serverError ? (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Text style={styles.errorText}>{serverError}</Text>
            </View>
          ) : null}

          <FormField
            label="First name"
            value={firstName}
            onChangeText={setFirstName}
            error={errors.firstName}
            autoComplete="given-name"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => lastRef.current?.focus()}
          />
          <FormField
            ref={lastRef}
            label="Last name"
            value={lastName}
            onChangeText={setLastName}
            error={errors.lastName}
            autoComplete="family-name"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => emailRef.current?.focus()}
          />
          <FormField
            ref={emailRef}
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => phoneRef.current?.focus()}
          />
          <FormField
            ref={phoneRef}
            label="Phone (optional)"
            value={phone}
            onChangeText={setPhone}
            error={errors.phone}
            keyboardType="numbers-and-punctuation"
            autoComplete="tel"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => specializationRef.current?.focus()}
          />
          <FormField
            ref={specializationRef}
            label="Specialization"
            value={specialization}
            onChangeText={setSpecialization}
            error={errors.specialization}
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
            textContentType={PASSWORD_HINT}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => confirmRef.current?.focus()}
          />
          <FormField
            ref={confirmRef}
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            error={errors.confirm}
            secureTextEntry
            autoCapitalize="none"
            textContentType={PASSWORD_HINT}
            returnKeyType="go"
            onSubmitEditing={submit}
          />

          <Button title="Create account" onPress={submit} loading={loading} />
          <Button
            title="I already have an account"
            variant="secondary"
            onPress={() => navigation.goBack()}
            disabled={loading}
          />

          <TouchableOpacity
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
            accessibilityRole="link"
            accessibilityLabel="Read the privacy policy"
            style={styles.privacy}
          >
            <Text style={styles.privacyText}>
              By creating an account you agree to our privacy policy.
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  errorBox: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: COLORS.danger, fontSize: 14 },
  privacy: {
    marginTop: 16,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  privacyText: { color: COLORS.primary, fontSize: 13, textAlign: 'center' },
});
