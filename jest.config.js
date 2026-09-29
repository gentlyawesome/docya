module.exports = {
  preset: 'react-native',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native[^/]*|@react-native|@notifee|@react-navigation|react-redux|@reduxjs|immer)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/helpers/'],
  // The first test in a file pays for loading the whole app; GitHub's runners need more than the 5s default
  testTimeout: 20000,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
