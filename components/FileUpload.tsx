import React, { useState } from 'react';
import { Upload, FileText, FileSpreadsheet, AlertCircle, Sparkles, ArrowRight, LogIn, Download, Loader2 } from 'lucide-react';
import { generateSampleData } from '../utils/processing';

interface FileUploadProps {
  onProcess: (behaviorFile: File | string, gradesFile: File | string, className: string) => void;
  loading: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const FileUpload: React.FC<FileUploadProps> = ({ onProcess, loading }) => {
  const [mode, setMode] = useState<'manual' | 'misbo'>('manual');
  const [behaviorFile, setBehaviorFile] = useState<File | null>(null);
  const [gradesFile, setGradesFile] = useState<File | null>(null);
  const [className, setClassName] = useState('');
  
  // מצב משוב
  const [misboUrl, setMisboUrl] = useState('');
  const [misboYear, setMisboYear] = useState('');
  const [misboSchool, setMisboSchool] = useState('');
  const [misboUsername, setMisboUsername] = useState('');
  const [misboPassword, setMisboPassword] = useState('');
  const [misboGrade, setMisboGrade] = useState('');
  const [misboClassName, setMisboClassName] = useState('');
  const [misboLoading, setMisboLoading] = useState(false);
  const [misboError, setMisboError] = useState('');
  const [misboSuccess, setMisboSuccess] = useState(false);
  const [misboSessionId, setMisboSessionId] = useState<string | null>(null);

  const handleSubmit = () => {
    if (behaviorFile && gradesFile) {
      onProcess(behaviorFile, gradesFile, className.trim() || 'כיתה חדשה');
    }
  };

  const handleSampleLoad = () => {
    const { behaviorCSV, gradesCSV } = generateSampleData();
    onProcess(behaviorCSV, gradesCSV, className.trim() || 'נתוני דוגמה');
  };

  const handleMisboLogin = async () => {
    if (!misboUrl || !misboYear || !misboSchool || !misboUsername || !misboPassword || !misboGrade || !misboClassName) {
      setMisboError('אנא מלא את כל השדות');
      return;
    }

    setMisboLoading(true);
    setMisboError('');
    setMisboSuccess(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/misbo/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: misboUsername,
          password: misboPassword,
          misboUrl: misboUrl.trim(),
          year: misboYear.trim(),
          schoolName: misboSchool.trim(),
          grade: misboGrade.trim(),
          className: misboClassName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'שגיאה בהתחברות');
      }

      setMisboSessionId(data.sessionId);
      setMisboSuccess(true);
      setMisboError('');

      // ניסיון להוריד קבצים אוטומטית
      await handleMisboDownload();
    } catch (error: any) {
      setMisboError(error.message || 'שגיאה בהתחברות למשוב');
      setMisboSuccess(false);
    } finally {
      setMisboLoading(false);
    }
  };

  const handleMisboDownload = async () => {
    if (!misboSessionId) {
      setMisboError('אנא התחבר קודם למשוב');
      return;
    }

    setMisboLoading(true);
    setMisboError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/misbo/download-files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: misboSessionId,
          className: className.trim() || 'כיתה חדשה',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'שגיאה בהורדת קבצים');
      }

      if (data.success && data.files) {
        // אם יש קבצים שהורדו, נצטרך לטעון אותם
        // כרגע נציג הודעה למשתמש
        setMisboSuccess(true);
        setMisboError('');
        
        // TODO: טעינת קבצים מה-API ועיבודם
        // זה דורש endpoint נוסף להעברת הקבצים ל-frontend
        alert('הקבצים נמצאו! כרגע יש צורך להוריד אותם ידנית. שיפור זה יגיע בגרסה הבאה.');
      } else {
        setMisboError(data.message || 'לא נמצאו קבצים להורדה אוטומטית. אנא הורד ידנית.');
      }
    } catch (error: any) {
      setMisboError(error.message || 'שגיאה בהורדת קבצים');
    } finally {
      setMisboLoading(false);
    }
  };

  const isReady = behaviorFile && gradesFile;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-5rem)] p-4 md:p-8">
      <div className="w-full max-w-2xl">
        {/* Hero Section */}
        <div className="text-center mb-8 md:mb-12 animate-slide-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 mb-6">
            <Sparkles className="w-8 h-8 text-primary-600" strokeWidth={2} />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800 tracking-tight mb-3">
            ברוכים הבאים ל-ToledanoEdTech
          </h1>
          <p className="text-slate-600 text-base md:text-lg max-w-md mx-auto leading-relaxed">
            העלה את קבצי הנתונים כדי להתחיל בניתוח מקצועי של הכיתה
          </p>
        </div>

        {/* Mode Selector */}
        <div className="mb-6 flex items-center gap-2 p-1 bg-slate-100 rounded-2xl w-full max-w-md mx-auto">
          <button
            type="button"
            onClick={() => {
              setMode('manual');
              setMisboError('');
              setMisboSuccess(false);
              setMisboSessionId(null);
            }}
            className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all ${
              mode === 'manual'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            העלאה ידנית
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('misbo');
              setMisboError('');
              setMisboSuccess(false);
              setMisboSessionId(null);
            }}
            className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all ${
              mode === 'misbo'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <LogIn size={16} />
              התחברות למשוב
            </span>
          </button>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-elevated border border-slate-100/80 overflow-hidden animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="p-6 md:p-10 space-y-8">
            {mode === 'manual' ? (
              <>
                {/* Instructions */}
                <div className="bg-gradient-to-br from-primary-50 to-blue-50/50 border border-primary-100 rounded-2xl p-5 md:p-6">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3 text-base">
                    <AlertCircle size={20} className="text-primary-500 shrink-0" />
                    הנחיות להורדת קבצים
                  </h3>
                  <ul className="space-y-2 text-sm text-slate-600 leading-relaxed">
                    <li className="flex gap-2">
                      <span className="text-primary-500 font-bold">•</span>
                      <span><strong className="text-slate-700">קובץ התנהגות:</strong> יומן מחנך ← דוחות ← פירוט אירועי התנהגות (לוודא שמופיעה עמודת הפירוט)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary-500 font-bold">•</span>
                      <span><strong className="text-slate-700">קובץ ציונים:</strong> מערכת הציונים ← הורד קובץ "ציונים שוטפים - סדין"</span>
                    </li>
                  </ul>
                </div>
              </>
            ) : (
              <>
                {/* Misbo Login Form */}
                <div className="bg-gradient-to-br from-primary-50 to-blue-50/50 border border-primary-100 rounded-2xl p-5 md:p-6 space-y-4">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
                    <LogIn size={20} className="text-primary-500 shrink-0" />
                    התחברות למשוב
                  </h3>
                  
                  {misboError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                      {misboError}
                    </div>
                  )}
                  
                  {misboSuccess && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm">
                      ✓ התחברות הצליחה! מנסה להוריד קבצים...
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">כתובת משוב (URL)</label>
                    <input
                      type="url"
                      value={misboUrl}
                      onChange={(e) => setMisboUrl(e.target.value)}
                      placeholder="https://misbo.example.com"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-medium placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">שנת לימודים</label>
                    <input
                      type="text"
                      value={misboYear}
                      onChange={(e) => setMisboYear(e.target.value)}
                      placeholder="למשל: 2024-2025"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-medium placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">שם בית ספר</label>
                    <input
                      type="text"
                      value={misboSchool}
                      onChange={(e) => setMisboSchool(e.target.value)}
                      placeholder="הזן שם בית ספר"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-medium placeholder:text-slate-400"
                    />
                    <p className="text-xs text-slate-500 mt-1">בחר מהרשימה במשוב</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">שכבה</label>
                    <input
                      type="text"
                      value={misboGrade}
                      onChange={(e) => setMisboGrade(e.target.value)}
                      placeholder="למשל: ח' או 8"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-medium placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">כיתה</label>
                    <input
                      type="text"
                      value={misboClassName}
                      onChange={(e) => setMisboClassName(e.target.value)}
                      placeholder="למשל: ח'1 או 8-1"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-medium placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">שם משתמש</label>
                    <input
                      type="text"
                      value={misboUsername}
                      onChange={(e) => setMisboUsername(e.target.value)}
                      placeholder="הזן שם משתמש"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-medium placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">סיסמה</label>
                    <input
                      type="password"
                      value={misboPassword}
                      onChange={(e) => setMisboPassword(e.target.value)}
                      placeholder="הזן סיסמה"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-medium placeholder:text-slate-400"
                    />
                  </div>

                  <button
                    onClick={handleMisboLogin}
                    disabled={misboLoading || !misboUrl || !misboYear || !misboSchool || !misboUsername || !misboPassword || !misboGrade || !misboClassName}
                    className={`w-full py-3 rounded-xl font-bold text-base shadow-lg transition-all duration-200 flex items-center justify-center gap-3
                      ${misboLoading || !misboUrl || !misboUsername || !misboPassword
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-primary-500/25 hover:shadow-primary-500/40'}`}
                  >
                    {misboLoading ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        מתחבר למשוב...
                      </>
                    ) : (
                      <>
                        <LogIn size={20} />
                        התחבר והורד קבצים
                      </>
                    )}
                  </button>

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
                    <p className="text-xs text-blue-800 font-medium mb-2">🔒 בטיחות:</p>
                    <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                      <li>המערכת רק קוראת ומורידה קבצים</li>
                      <li>המערכת לא משנה או מוחקת נתונים במשוב</li>
                      <li>כל פעולה נבדקת לפני ביצוע</li>
                    </ul>
                  </div>
                  
                  <p className="text-xs text-slate-500 text-center mt-2">
                    לאחר ההתחברות, המערכת תנסה להוריד את הקבצים אוטומטית ממשוב
                  </p>
                </div>
              </>
            )}

            {/* Class Name */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">שם הכיתה</label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="למשל: כיתה ח׳1"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-medium placeholder:text-slate-400"
              />
            </div>

            {/* File Drop Zones - רק במצב ידני */}
            {mode === 'manual' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                <FileDropZone
                  file={behaviorFile}
                  onFileChange={setBehaviorFile}
                  icon={FileText}
                  label="קובץ התנהגות"
                  placeholder="יומן מחנך (פירוט אירועים)"
                />
                <FileDropZone
                  file={gradesFile}
                  onFileChange={setGradesFile}
                  icon={FileSpreadsheet}
                  label="קובץ ציונים"
                  placeholder="ציונים שוטפים - סדין"
                />
              </div>
            )}

            {/* Actions */}
            <div className="space-y-4 pt-2">
              {mode === 'manual' ? (
                <>
                  <button
                    onClick={handleSubmit}
                    disabled={!isReady || loading}
                    className={`w-full py-4 rounded-2xl font-bold text-base md:text-lg shadow-lg transition-all duration-200 flex items-center justify-center gap-3
                      ${!isReady || loading
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-primary-500/25 hover:shadow-primary-500/40 hover:scale-[1.01] active:scale-[0.99]'}`}
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                        מעבד נתונים...
                      </>
                    ) : (
                      <>
                        <Upload size={22} strokeWidth={2.5} />
                        נתח נתונים
                        <ArrowRight size={18} className="opacity-80" />
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleSampleLoad}
                    disabled={loading}
                    className="w-full py-3 text-sm text-slate-500 hover:text-primary-600 hover:bg-primary-50/50 rounded-xl transition-colors font-medium disabled:opacity-50"
                  >
                    אין לך קבצים? טען נתונים לדוגמה
                  </button>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-slate-600 mb-4">
                    לאחר התחברות מוצלחת, הקבצים יועלו אוטומטית
                  </p>
                  <button
                    onClick={() => setMode('manual')}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    או העלה קבצים ידנית
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface FileDropZoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  icon: React.ElementType;
  label: string;
  placeholder: string;
}

const FileDropZone: React.FC<FileDropZoneProps> = ({ file, onFileChange, icon: Icon, label, placeholder }) => (
  <label className="relative block group cursor-pointer">
    <input
      type="file"
      accept=".csv, .xlsx, .xls"
      onChange={(e) => onFileChange(e.target.files?.[0] || null)}
      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
    />
    <div className={`relative border-2 border-dashed rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center min-h-[180px] transition-all duration-300
      ${file
        ? 'border-accent-success bg-emerald-50/80'
        : 'border-slate-200 group-hover:border-primary-300 group-hover:bg-primary-50/30 bg-slate-50/50'}`}
    >
      <div className={`mb-4 p-3 rounded-xl transition-colors
        ${file ? 'bg-emerald-100' : 'bg-slate-100 group-hover:bg-primary-100'}`}>
        <Icon className={`w-10 h-10 md:w-12 md:h-12 transition-colors
          ${file ? 'text-emerald-600' : 'text-slate-400 group-hover:text-primary-500'}`} strokeWidth={1.5} />
      </div>
      <span className="font-semibold text-slate-700 text-sm md:text-base mb-1">{label}</span>
      <span className="text-xs text-slate-500 truncate max-w-full px-2 text-center">
        {file ? file.name : placeholder}
      </span>
      {file && (
        <span className="absolute top-3 right-3 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-lg">
          ✓ נבחר
        </span>
      )}
    </div>
  </label>
);

export default FileUpload;
