import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { RouteProp } from '@react-navigation/native';
import { AuthStackParamList } from '../../types';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  clearAuthMessages,
  requestReset,
  resetPassword,
  selectAuthError,
  selectAuthLoading,
} from '../../store/slices/authSlice';
import { Button } from '../../components/Button';
import { FormField } from '../../components/FormField';
import {
  isValidCode,
  isValidPassword,
  MIN_PASSWORD_LENGTH,
} from '../../utils/validation';
import { authStyles as styles } from './authStyles';

interface Props {
  route: RouteProp<AuthStackParamList, 'ResetPassword'>;
}

type Errors = Partial<Record<'code' | 'password' | 'confirm', string>>;

export const ResetPasswordScreen: React.FC<Props> = ({ route }) => {
  const { email } = route.params;
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectAuthLoading);
  const serverError = useAppSelector(selectAuthError);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [resent, setResent] = useState(false);

  // Start each visit without another screen's error
  useFocusEffect(
    useCallback(() => {
      dispatch(clearAuthMessages());
    }, [dispatch]),
  );

  const submit = () => {
    const next: Errors = {};
    if (!isValidCode(code)) next.code = 'Enter the 6-digit code from the email';
    if (!isValidPassword(password))
      next.password = `Use at least ${MIN_PASSWORD_LENGTH} characters`;
    if (confirm !== password) next.confirm = 'Passwords do not match';
    setErrors(next);
    if (Object.keys(next).length === 0) {
      // On success the account is signed in and the app moves on by itself
      dispatch(resetPassword({ email, code, newPassword: password }));
    }
  };

  const resend = async () => {
    const result = await dispatch(requestReset(email));
    setResent(requestReset.fulfilled.match(result));
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.intro}>
          We sent a code to {email}. Enter it below and choose a new password.
        </Text>
        {resent ? (
          <View style={styles.infoBox} accessibilityRole="alert">
            <Text style={styles.infoText}>A new code is on its way.</Text>
          </View>
        ) : null}
        {serverError ? (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Text style={styles.errorText}>{serverError}</Text>
          </View>
        ) : null}
        <FormField
          label="Code"
          value={code}
          onChangeText={setCode}
          error={errors.code}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={10}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <FormField
          ref={passwordRef}
          label="New password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          secureTextEntry
          autoCapitalize="none"
          textContentType="oneTimeCode"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => confirmRef.current?.focus()}
        />
        <FormField
          ref={confirmRef}
          label="Confirm new password"
          value={confirm}
          onChangeText={setConfirm}
          error={errors.confirm}
          secureTextEntry
          autoCapitalize="none"
          textContentType="oneTimeCode"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Button title="Reset password" onPress={submit} loading={loading} />
        <Button
          title="Send a new code"
          variant="secondary"
          onPress={resend}
          disabled={loading}
        />
      </ScrollView>
    </SafeAreaView>
  );
};
