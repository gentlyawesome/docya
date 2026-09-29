module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    // Jest's global `jest` in the shared test setup
    { files: ['jest.setup.js'], env: { jest: true } },
    // Maestro injects these into its E2E helper scripts
    {
      files: ['e2e/scripts/*.js'],
      globals: { http: 'readonly', json: 'readonly', output: 'writable', EMAIL: 'readonly' },
    },
  ],
};
