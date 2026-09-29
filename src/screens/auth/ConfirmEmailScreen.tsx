import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { RouteProp } from '@react-navigation/native';
import { AuthStackParamList } from '../../types';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  clearAuthMessages,
  confirmSignup,
  resendCode,
  selectAuthError,
  selectAuthLoading,
} from '../../store/slices/authSlice';
import { Button } from '../../components/Button';
import { FormField } from '../../components/FormField';
import { isValidCode } from '../../utils/validation';
import { authStyles as styles } from './authStyles';

interface Props {
  route: RouteProp<AuthStackParamList, 'ConfirmEmail'>;
}

export const ConfirmEmailScreen: React.FC<Props> = ({ route }) => {
  const { email } = route.params;
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectAuthLoading);
  const serverError = useAppSelector(selectAuthError);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | undefined>();
  const [resent, setResent] = useState(false);

  // Start each visit without another screen's error
  useFocusEffect(
    useCallback(() => {
      dispatch(clearAuthMessages());
    }, [dispatch]),
  );

  const submit = () => {
    if (!isValidCode(code)) {
      setCodeError('Enter the 6-digit code from the email');
      return;
    }
    setCodeError(undefined);
    // On success the account is signed in and the app moves on by itself
    dispatch(confirmSignup({ email, code }));
  };

  const resend = async () => {
    const result = await dispatch(resendCode(email));
    setResent(resendCode.fulfilled.match(result));
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.intro}>
          We sent a 6-digit code to {email}. Enter it to finish creating your
          account.
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
          error={codeError}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={10}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Button title="Confirm" onPress={submit} loading={loading} />
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
