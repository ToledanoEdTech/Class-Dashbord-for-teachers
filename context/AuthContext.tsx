import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured, getFirebaseDb } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export type UserRole = 'teacher' | 'student' | null;

interface AuthContextValue {
  user: User | null;
  userRole: UserRole;
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
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isConfigured = isFirebaseConfigured();
  const auth = getFirebaseAuth();
  const db = getFirebaseDb();

  // Load user role from Firestore
  const loadUserRole = useCallback(async (uid: string, email?: string | null): Promise<UserRole> => {
    if (!db) return null;
    try {
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.role !== 'student') {
          await setDoc(userDocRef, {
            role: 'teacher',
            email: email ?? data.email ?? null,
            lastLoginAt: new Date().toISOString(),
          }, { merge: true });
        }
        return data.role === 'student' ? 'student' : 'teacher';
      }

      // Create a stable teacher profile for legacy users / first login.
      await setDoc(userDocRef, {
        role: 'teacher',
        email: email ?? null,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      }, { merge: true });
      return 'teacher';
    } catch (err) {
      console.error('Error loading user role:', err);
      return 'teacher'; // Default to teacher on error
    }
  }, [db]);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (u: User | null) => {
      setUser(u);
      if (u) {
        const role = await loadUserRole(u.uid, u.email);
        setUserRole(role);
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [auth, loadUserRole]);

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
      if (!auth || !db) {
        setError('חיבור לענן לא מוגדר. באתר Vercel: הוסף משתני VITE_FIREBASE_* ב-Settings → Environment Variables ובצע Redeploy. ראה VERCEL-SETUP.md');
        return;
      }
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const uid = userCredential.user.uid;
        
        // Set teacher role for new users (unless it's a student email)
        if (!email.includes('@student.toledanoedtech.local')) {
          const userDocRef = doc(db, 'users', uid);
          await setDoc(userDocRef, {
            role: 'teacher',
            email: email.trim(),
            createdAt: new Date().toISOString(),
          });
        }
      } catch (e: unknown) {
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'שגיאת הרשמה';
        if (msg.includes('auth/email-already-in-use')) setError('האימייל כבר רשום. נסה להתחבר.');
        else if (msg.includes('auth/weak-password')) setError('הסיסמה חייבת להכיל 6 תווים לפחות.');
        else if (msg.includes('auth/operation-not-allowed')) setError('התחברות באימייל לא מופעלת. ב-Firebase: Authentication → Sign-in method → הפעל Email/Password.');
        else setError(msg);
        throw e;
      }
    },
    [auth, db]
  );

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    if (!auth || !db) {
      setError('חיבור לענן לא מוגדר. באתר Vercel: הוסף משתני VITE_FIREBASE_* ב-Settings → Environment Variables ובצע Redeploy. ראה VERCEL-SETUP.md');
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const uid = userCredential.user.uid;
      
      // Set teacher role for Google sign-in if user doesn't exist
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          role: 'teacher',
          email: userCredential.user.email,
          displayName: userCredential.user.displayName,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'שגיאת התחברות עם Google';
      if (msg.includes('auth/popup-closed-by-user')) {
        setError('ההתחברות בוטלה.');
      } else if (msg.includes('auth/popup-blocked')) {
        setError('הדפדפן חסם את חלון ההתחברות. נסה לאפשר popups.');
      } else if (msg.includes('auth/unauthorized-domain')) {
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
      } else if (msg.includes('auth/cancelled-popup-request')) {
        setError('ההתחברות בוטלה. נסה שוב.');
      } else {
        setError(msg.includes('auth/') ? `שגיאת Google: ${msg}` : msg);
      }
      throw e;
    }
  }, [auth, db]);

  const signOut = useCallback(async () => {
    setError(null);
    if (!auth) return;
    await firebaseSignOut(auth);
  }, [auth]);

  const clearError = useCallback(() => setError(null), []);

  const value: AuthContextValue = {
    user,
    userRole,
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
