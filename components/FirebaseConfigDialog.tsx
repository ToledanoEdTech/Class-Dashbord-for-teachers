import React, { useState, useEffect } from 'react';
import { X, Cloud } from 'lucide-react';
import {
  getFirebaseConfig,
  setFirebaseConfigInStorage,
  type FirebaseConfigRecord,
} from '../firebase';

interface FirebaseConfigDialogProps {
  onClose: () => void;
  onSaved?: () => void;
}

const FIELDS: { key: keyof FirebaseConfigRecord; label: string; placeholder: string }[] = [
  { key: 'apiKey', label: 'API Key', placeholder: 'AIza...' },
  { key: 'authDomain', label: 'Auth Domain', placeholder: 'dashboard-xxxxx.firebaseapp.com' },
  { key: 'projectId', label: 'Project ID', placeholder: 'dashboard-xxxxx' },
  { key: 'storageBucket', label: 'Storage Bucket', placeholder: 'dashboard-xxxxx.appspot.com' },
  { key: 'messagingSenderId', label: 'Messaging Sender ID', placeholder: '123456789' },
  { key: 'appId', label: 'App ID', placeholder: '1:123456789:web:...' },
];

const emptyConfig: FirebaseConfigRecord = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

export default function FirebaseConfigDialog({ onClose, onSaved }: FirebaseConfigDialogProps) {
  const [config, setConfig] = useState<FirebaseConfigRecord>(emptyConfig);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const current = getFirebaseConfig();
    if (current) setConfig(current);
  }, []);

  const handleChange = (key: keyof FirebaseConfigRecord, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value.trim() }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.apiKey || !config.projectId) return;
    setFirebaseConfigInStorage(config);
    setSaved(true);
    onSaved?.();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-elevated border border-slate-200 dark:border-slate-700 w-full max-w-md p-6 animate-scale-in max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
              <Cloud size={22} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">חיבור ל-Firebase</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">הדבק את הערכים מפרויקט Firebase Console</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
            aria-label="סגור"
          >
            <X size={20} />
          </button>
        </div>

        {saved ? (
          <div className="rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 p-4 text-center">
            <p className="font-medium text-primary-800 dark:text-primary-200">ההגדרות נשמרו.</p>
            <p className="text-sm text-primary-700 dark:text-primary-300 mt-1">רענן את הדף (F5) כדי להפעיל את החיבור.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 px-4 py-2 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600"
            >
              סגור
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {FIELDS.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label htmlFor={`fb-${key}`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {label}
                </label>
                <input
                  id={`fb-${key}`}
                  type="text"
                  value={config[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                />
              </div>
            ))}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ב-Firebase Console: Project Settings → Your apps → Web app → Config. העתק את הערכים לשדות למעלה.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                ביטול
              </button>
              <button
                type="submit"
                disabled={!config.apiKey || !config.projectId}
                className="flex-1 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                שמור ורענן
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
