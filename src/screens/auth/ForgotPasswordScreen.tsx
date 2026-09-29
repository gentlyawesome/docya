import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  clearAuthMessages,
  requestReset,
  selectAuthError,
  selectAuthLoading,
} from '../../store/slices/authSlice';
import { Button } from '../../components/Button';
import { FormField } from '../../components/FormField';
import { isValidEmail } from '../../utils/validation';
import { authStyles as styles } from './authStyles';

interface Props {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;
}

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectAuthLoading);
  const serverError = useAppSelector(selectAuthError);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();

  // Start each visit without another screen's error
  useFocusEffect(
    useCallback(() => {
      dispatch(clearAuthMessages());
    }, [dispatch]),
  );

  const submit = async () => {
    if (!isValidEmail(email)) {
      setEmailError('Enter a valid email address');
      return;
    }
    setEmailError(undefined);
    const result = await dispatch(requestReset(email));
    if (requestReset.fulfilled.match(result)) {
      navigation.navigate('ResetPassword', { email: email.trim() });
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
        >
          <Text style={styles.intro}>
            Enter the email you signed up with. We will send you a code to
            choose a new password.
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
            error={emailError}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            returnKeyType="send"
            onSubmitEditing={submit}
          />
          <Button title="Send code" onPress={submit} loading={loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
