import RNHapticFeedback, { HapticFeedbackTypes } from 'react-native-haptic-feedback';

const options = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

const trigger = (type: keyof typeof HapticFeedbackTypes) => {
  try {
    RNHapticFeedback.trigger(type, options);
  } catch {
    // Haptics are best-effort; never break the interaction
  }
};

export const haptics = {
  selection: () => trigger('selection'),
  success: () => trigger('notificationSuccess'),
  warning: () => trigger('notificationWarning'),
  error: () => trigger('notificationError'),
};
