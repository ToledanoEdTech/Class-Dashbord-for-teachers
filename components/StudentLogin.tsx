import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, ArrowRight } from 'lucide-react';

interface StudentLoginProps {
  onBackToTeacher?: () => void;
}

export default function StudentLogin({ onBackToTeacher }: StudentLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { signIn, error, clearError, isConfigured } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!username.trim() || !password) return;
    setSubmitting(true);
    try {
      // Convert username to Firebase email format
      const email = `${username.trim()}@student.toledanoedtech.local`;
      await signIn(email, password);
      // Navigation will be handled by App.tsx based on role
    } catch {
      // error is set in context
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary-50/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-elevated border border-slate-200 w-full max-w-md p-8 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">התחברות תלמיד</h1>
          <p className="text-slate-600 text-sm">הזן שם משתמש וסיסמה</p>
        </div>

        {!isConfigured && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <strong>חיבור לענן לא מוגדר.</strong>
            <p className="mt-1">אנא פנה למורה שלך.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="student-username" className="block text-sm font-medium text-slate-700 mb-1">
              שם משתמש
            </label>
            <input
              id="student-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="הזן שם משתמש"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 text-right"
              autoComplete="username"
              required
              dir="rtl"
            />
          </div>
          <div>
            <label htmlFor="student-password" className="block text-sm font-medium text-slate-700 mb-1">
              סיסמה
            </label>
            <input
              id="student-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="הזן סיסמה"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 text-right"
              autoComplete="current-password"
              required
              dir="rtl"
            />
          </div>
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm" role="alert">
              {error.includes('auth/') 
                ? error.includes('user-not-found') || error.includes('wrong-password')
                  ? 'שם משתמש או סיסמה לא נכונים'
                  : error.includes('too-many-requests')
                  ? 'יותר מדי ניסיונות. נסה שוב מאוחר יותר'
                  : 'שגיאת התחברות. אנא נסה שוב'
                : error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <LogIn size={18} />
            {submitting ? 'מתחבר...' : 'התחבר'}
          </button>
        </form>

        {onBackToTeacher && (
          <div className="mt-6 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={onBackToTeacher}
              className="w-full flex items-center justify-center gap-2 text-slate-600 hover:text-primary-600 text-sm font-medium transition-colors"
            >
              <ArrowRight size={16} />
              חזרה להתחברות מורה
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
