export const logError = (message: string, error?: unknown) => {
  if (__DEV__) {
    console.error(message, error);
  }
};
