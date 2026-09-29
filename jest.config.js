module.exports = {
  preset: 'react-native',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native[^/]*|@react-native|@notifee|@react-navigation|react-redux|@reduxjs|immer)/)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
