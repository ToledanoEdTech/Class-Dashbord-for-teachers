import React, { useState } from 'react';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { FileIcons } from '../constants/icons';
import { generateSampleData } from '../utils/processing';

const BRAND_NAME = 'ToledanoEdTech';
const BRAND_TAGLINE = 'מערכת מעקב פדגוגית';

interface FileUploadProps {
  onProcess: (behaviorFile: File | string, gradesFile: File | string, className: string) => void;
  loading: boolean;
}

const LOGO_PATH = '/logo.png';

const UploadHeaderLogo: React.FC = () => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <FileIcons.LogoFallback className="w-8 h-8 md:w-10 md:h-10 text-primary-500 dark:text-primary-400" strokeWidth={2.5} />;
  }
  return (
    <img
      src={LOGO_PATH}
      alt={`לוגו ${BRAND_NAME}`}
      className="w-full h-full object-contain p-1"
      onError={() => setFailed(true)}
    />
  );
};

const FileUpload: React.FC<FileUploadProps> = ({ onProcess, loading }) => {
  const [behaviorFile, setBehaviorFile] = useState<File | null>(null);
  const [gradesFile, setGradesFile] = useState<File | null>(null);
  const [className, setClassName] = useState('');

  const handleSubmit = () => {
    if (behaviorFile && gradesFile) {
      onProcess(behaviorFile, gradesFile, className.trim() || 'כיתה חדשה');
    }
  };

  const handleSampleLoad = () => {
    const { behaviorCSV, gradesCSV } = generateSampleData();
    onProcess(behaviorCSV, gradesCSV, className.trim() || 'נתוני דוגמה');
  };

  const isReady = behaviorFile && gradesFile;

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-4rem)] px-3 py-1 md:px-6 md:py-2">
      <div className="w-full max-w-2xl">
        {/* Hero: Logo + Branding */}
        <div className="text-center mb-2 md:mb-3 animate-slide-up flex flex-col items-center">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-white shadow-elevated border border-slate-200/80 overflow-hidden shrink-0 mb-3 ring-2 ring-primary-100/80">
            <UploadHeaderLogo />
          </div>
          <h1 className="font-display font-bold text-xl md:text-2xl text-slate-800 tracking-tight">
            {BRAND_NAME}
          </h1>
          <p className="text-primary-600 font-semibold text-sm md:text-base mt-0.5">
            {BRAND_TAGLINE}
          </p>
          <p className="text-slate-600 text-xs md:text-sm max-w-md mt-1">
            ברוכים הבאים • העלה את קבצי הנתונים כדי להתחיל בניתוח מקצועי של הכיתה
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-elevated border border-slate-100/80 overflow-hidden animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="p-3 md:p-4 space-y-3 md:space-y-4">
            {/* Instructions - compact */}
            <div className="bg-gradient-to-br from-primary-50 to-blue-50/50 border border-primary-100 rounded-xl p-2.5 md:p-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-1 text-sm">
                <AlertCircle size={16} className="text-primary-500 shrink-0" />
                הנחיות להורדת קבצים
              </h3>
              <ul className="space-y-0.5 text-xs text-slate-600 leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-primary-500 font-bold">•</span>
                  <span><strong className="text-slate-700">קובץ התנהגות:</strong> יומן מחנך ← דוחות ← פירוט אירועי התנהגות</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary-500 font-bold">•</span>
                  <span><strong className="text-slate-700">קובץ ציונים:</strong> מערכת הציונים ← "ציונים שוטפים - סדין"</span>
                </li>
              </ul>
            </div>

            {/* Class Name */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">שם הכיתה</label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="למשל: כיתה ח׳1"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-medium placeholder:text-slate-400 text-sm"
              />
            </div>

            {/* File Drop Zones */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 md:gap-3">
              <FileDropZone
                file={behaviorFile}
                onFileChange={setBehaviorFile}
                icon={FileIcons.Behavior}
                label="קובץ התנהגות"
                placeholder="יומן מחנך (פירוט אירועים)"
              />
              <FileDropZone
                file={gradesFile}
                onFileChange={setGradesFile}
                icon={FileIcons.Grades}
                label="קובץ ציונים"
                placeholder="ציונים שוטפים - סדין"
              />
            </div>

            {/* Actions */}
            <div className="space-y-1.5 pt-0">
              <button
                onClick={handleSubmit}
                disabled={!isReady || loading}
                className={`w-full py-2.5 rounded-xl font-bold text-sm md:text-base shadow-lg transition-all duration-200 flex items-center justify-center gap-2
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
                    <FileIcons.Upload size={22} strokeWidth={2.5} />
                    נתח נתונים
                    <ArrowRight size={18} className="opacity-80" />
                  </>
                )}
              </button>

              <button
                onClick={handleSampleLoad}
                disabled={loading}
                className="w-full py-2 text-xs text-slate-500 hover:text-primary-600 hover:bg-primary-50/50 rounded-lg transition-colors font-medium disabled:opacity-50"
              >
                אין לך קבצים? טען נתונים לדוגמה
              </button>
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
    <div className={`relative border-2 border-dashed rounded-xl p-2.5 md:p-3 flex flex-col items-center justify-center min-h-[100px] md:min-h-[110px] transition-all duration-300
      ${file
        ? 'border-accent-success bg-emerald-50/80'
        : 'border-slate-200 group-hover:border-primary-300 group-hover:bg-primary-50/30 bg-slate-50/50'}`}
    >
      <div className={`mb-2 p-2 rounded-lg transition-colors
        ${file ? 'bg-emerald-100' : 'bg-slate-100 group-hover:bg-primary-100'}`}>
        <Icon className={`w-6 h-6 md:w-8 md:h-8 transition-colors
          ${file ? 'text-emerald-600' : 'text-slate-400 group-hover:text-primary-500'}`} strokeWidth={1.5} />
      </div>
      <span className="font-semibold text-slate-700 text-xs md:text-sm mb-0.5">{label}</span>
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
