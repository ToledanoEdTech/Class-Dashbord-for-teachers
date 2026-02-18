/**
 * גיבוי ידני – מומלץ להגדיר את ההרשאות ב-.env (ראה .env.example).
 * רק אם אין .env, אפשר להדביק כאן (לא מומלץ – נחשף ב-Git).
 */
export const FIREBASE_CONFIG_PASTE: {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
} | null = null; // הגדר ב-.env (ראה .env.example)
