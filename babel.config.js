// Release bundles (NODE_ENV=production) read .env.production; everything else reads .env.
// Both are git-ignored, so hosted keys never end up in the repository.
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module:react-native-dotenv',
      { moduleName: '@env', path: envFile, safe: false, allowUndefined: true },
    ],
  ],
};
