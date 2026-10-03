import AsyncStorage from '@react-native-async-storage/async-storage';

// What a doctor has already been shown or done on this phone, remembered per account
export interface OnboardingState {
  welcomeSeen: boolean;
  hoursReviewed: boolean;
  checklistHidden: boolean;
}

const DEFAULT_STATE: OnboardingState = {
  welcomeSeen: false,
  hoursReviewed: false,
  checklistHidden: false,
};

const keyFor = (userId: string) => `@docya_onboarding_${userId}`;

export const loadOnboarding = async (
  userId: string,
): Promise<OnboardingState> => {
  try {
    const stored = JSON.parse(
      (await AsyncStorage.getItem(keyFor(userId))) ?? 'null',
    );
    return { ...DEFAULT_STATE, ...(stored ?? {}) };
  } catch {
    return DEFAULT_STATE;
  }
};

export const updateOnboarding = async (
  userId: string,
  patch: Partial<OnboardingState>,
): Promise<OnboardingState> => {
  const next = { ...(await loadOnboarding(userId)), ...patch };
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(next));
  } catch {
    // Not being able to remember this only means the tips show again
  }
  return next;
};
