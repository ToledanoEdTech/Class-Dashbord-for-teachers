import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
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
    const unsubscribe = onAuthStateChanged(auth, (u: User | null) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [auth]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setError(null);
      if (!auth) {
        setError('Firebase לא מוגדר. בדוק את קובץ .env');
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
        setError('Firebase לא מוגדר. בדוק את קובץ .env');
        return;
      }
      try {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } catch (e: unknown) {
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'שגיאת הרשמה';
        if (msg.includes('auth/email-already-in-use')) setError('האימייל כבר רשום. נסה להתחבר.');
        else if (msg.includes('auth/weak-password')) setError('הסיסמה חייבת להכיל 6 תווים לפחות.');
        else setError(msg);
        throw e;
      }
    },
    [auth]
  );

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    if (!auth) {
      setError('Firebase לא מוגדר.');
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'שגיאת התחברות עם Google';
      if (msg.includes('auth/popup-closed-by-user')) {
        setError('ההתחברות בוטלה.');
      } else if (msg.includes('auth/popup-blocked')) {
        setError('הדפדפן חסם את חלון ההתחברות. נסה לאפשר popups.');
      } else {
        setError(msg.includes('auth/') ? 'לא הצלחנו להתחבר עם Google' : msg);
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
