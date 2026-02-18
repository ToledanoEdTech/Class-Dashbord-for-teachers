import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isConfigured = isFirebaseConfigured();
  const auth = getFirebaseAuth();

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const init = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (cancelled) return;
        if (result) {
          // User returned from Google redirect - onAuthStateChanged will set user
        }
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'שגיאת התחברות עם Google';
        setError(msg.includes('auth/') ? `שגיאת Google: ${msg}` : msg);
      }
    };
    init();
    const unsubscribe = onAuthStateChanged(auth, (u: User | null) => {
      setUser(u);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [auth]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setError(null);
      if (!auth) {
        setError('חיבור לענן לא מוגדר. באתר Vercel: הוסף משתני VITE_FIREBASE_* ב-Settings → Environment Variables ובצע Redeploy. ראה VERCEL-SETUP.md');
        return;
      }
      try {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } catch (e: unknown) {
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'שגיאת התחברות';
        setError(msg.includes('auth/') ? 'אימייל או סיסמה לא נכונים' : msg);
        throw e;
      }
    },
    [auth]
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      setError(null);
      if (!auth) {
        setError('חיבור לענן לא מוגדר. באתר Vercel: הוסף משתני VITE_FIREBASE_* ב-Settings → Environment Variables ובצע Redeploy. ראה VERCEL-SETUP.md');
        return;
      }
      try {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } catch (e: unknown) {
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'שגיאת הרשמה';
        if (msg.includes('auth/email-already-in-use')) setError('האימייל כבר רשום. נסה להתחבר.');
        else if (msg.includes('auth/weak-password')) setError('הסיסמה חייבת להכיל 6 תווים לפחות.');
        else if (msg.includes('auth/operation-not-allowed')) setError('התחברות באימייל לא מופעלת. ב-Firebase: Authentication → Sign-in method → הפעל Email/Password.');
        else setError(msg);
        throw e;
      }
    },
    [auth]
  );

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    if (!auth) {
      setError('חיבור לענן לא מוגדר. באתר Vercel: הוסף משתני VITE_FIREBASE_* ב-Settings → Environment Variables ובצע Redeploy. ראה VERCEL-SETUP.md');
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
      // Page will redirect to Google - user returns via redirect URL
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'שגיאת התחברות עם Google';
      if (msg.includes('auth/unauthorized-domain')) {
        const domain = typeof window !== 'undefined' ? window.location.hostname : '';
        setError(domain
          ? `הדומיין לא מורשה. ב-Firebase Console: Authentication → Settings → Authorized domains → Add domain. הוסף בדיוק: ${domain}`
          : 'הדומיין לא מורשה ב-Firebase. ב-Console: Authentication → Settings → Authorized domains → Add domain.');
      } else if (msg.includes('auth/operation-not-allowed')) {
        setError('שיטת ההתחברות לא מופעלת. ב-Firebase Console: Authentication → Sign-in method → הפעל Google ו-Email/Password.');
      } else if (msg.includes('auth/api-key-expired') || msg.includes('api-key-expired')) {
        setError('מפתח ה-API פג תוקף. ב-Firebase Console: Project Settings → Your apps → צור Web app חדש או שחזר מפתח. עדכן את .env ו-Vercel Environment Variables.');
      } else if (msg.includes('auth/network-request-failed')) {
        setError('שגיאת רשת. בדוק את החיבור לאינטרנט ונסה שוב.');
      } else {
        setError(msg.includes('auth/') ? `שגיאת Google: ${msg}` : msg);
      }
      throw e;
    }
  }, [auth]);

  const signOut = useCallback(async () => {
    setError(null);
    if (!auth) return;
    await firebaseSignOut(auth);
  }, [auth]);

  const clearError = useCallback(() => setError(null), []);

  const value: AuthContextValue = {
    user,
    loading,
    isConfigured,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    error,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
