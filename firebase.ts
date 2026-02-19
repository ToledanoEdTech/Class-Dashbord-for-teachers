import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { FIREBASE_CONFIG_PASTE } from './firebase-config.paste';

const FIREBASE_CONFIG_STORAGE_KEY = 'toledano-firebase-config';

export interface FirebaseConfigRecord {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

function getConfigFromEnv(): FirebaseConfigRecord {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
  };
}

function getConfigFromStorage(): FirebaseConfigRecord | null {
  try {
    const raw = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FirebaseConfigRecord;
    if (parsed?.apiKey && parsed?.projectId) return parsed;
    return null;
  } catch {
    return null;
  }
}

function getConfigFromPasteFile(): FirebaseConfigRecord | null {
  if (!FIREBASE_CONFIG_PASTE?.apiKey || FIREBASE_CONFIG_PASTE.apiKey === 'your-api-key') return null;
  return FIREBASE_CONFIG_PASTE as FirebaseConfigRecord;
}

export function getFirebaseConfig(): FirebaseConfigRecord | null {
  const fromEnv = getConfigFromEnv();
  if (fromEnv.apiKey && fromEnv.apiKey !== 'your-api-key') return fromEnv;
  const fromPaste = getConfigFromPasteFile();
  if (fromPaste) return fromPaste;
  return getConfigFromStorage();
}

export function setFirebaseConfigInStorage(config: FirebaseConfigRecord): void {
  localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let secondaryAuthApp: FirebaseApp | null = null;
let secondaryAuth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  const config = getFirebaseConfig();
  if (!config?.apiKey || config.apiKey === 'your-api-key') return null;
  if (!app) {
    app = initializeApp(config);
  }
  return app;
}

export function getFirebaseAuth(): Auth | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!auth) {
    auth = getAuth(firebaseApp);
  }
  return auth;
}

/**
 * Secondary Auth instance used for creating student users (Email/Password)
 * without signing out the teacher from the primary auth instance.
 * Must use the same project as the primary app.
 */
export function getSecondaryFirebaseAuth(): Auth | null {
  const primaryApp = getFirebaseApp();
  if (!primaryApp) return null;
  const config = getFirebaseConfig();
  if (!config?.apiKey || config.apiKey === 'your-api-key') return null;
  if (!secondaryAuthApp) {
    const existing = getApps().find((a) => a.name === 'secondary-auth-app');
    secondaryAuthApp = existing ?? initializeApp(config, 'secondary-auth-app');
  }
  if (!secondaryAuth) {
    secondaryAuth = getAuth(secondaryAuthApp);
  }
  return secondaryAuth;
}

export function getFirebaseDb(): Firestore | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!db) {
    db = getFirestore(firebaseApp);
  }
  return db;
}

export function isFirebaseConfigured(): boolean {
  const config = getFirebaseConfig();
  return !!(config?.apiKey && config.apiKey !== 'your-api-key');
}
