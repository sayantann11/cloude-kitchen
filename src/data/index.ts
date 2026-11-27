import type { DataStore } from './store';

/**
 * Picks the backend. Firebase is used when the VITE_FIREBASE_* keys are set at build time
 * (see .env.example); otherwise the app runs in local demo mode. `?demo` forces demo mode.
 * The Firebase SDK is code-split, so demo mode never downloads it.
 */
export async function createStore(): Promise<DataStore> {
  const env = import.meta.env;
  const forceDemo = new URLSearchParams(location.search).has('demo');
  if (!forceDemo && env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID) {
    const { FirebaseStore } = await import('./firebase');
    return new FirebaseStore({
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || `${env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    });
  }
  const { LocalStore } = await import('./local');
  return new LocalStore();
}
