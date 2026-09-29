import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing SUPABASE_URL / SUPABASE_ANON_KEY. Copy .env.example to .env, fill it in, ' +
      'then restart Metro with: npx react-native start --reset-cache'
  );
}

// A release build must talk to the hosted project, never to a developer's local stack
if (!__DEV__ && /^https?:\/\/(127\.0\.0\.1|localhost|10\.|192\.168\.)/.test(SUPABASE_URL)) {
  throw new Error('This release build points at a local Supabase. Check .env.production.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Only refresh the session while the app is in the foreground
AppState.addEventListener('change', state => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
