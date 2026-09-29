module.exports = {
  preset: 'react-native',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native[^/]*|@react-native|@notifee|@react-navigation|react-redux|@reduxjs|immer)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/helpers/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
