import React, { useState } from 'react';
import { Upload, FileText, FileSpreadsheet, AlertCircle, Sparkles, ArrowRight } from 'lucide-react';
import { generateSampleData } from '../utils/processing';

interface FileUploadProps {
  onProcess: (behaviorFile: File | string, gradesFile: File | string) => void;
  loading: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onProcess, loading }) => {
  const [behaviorFile, setBehaviorFile] = useState<File | null>(null);
  const [gradesFile, setGradesFile] = useState<File | null>(null);

  const handleSubmit = () => {
    if (behaviorFile && gradesFile) {
      onProcess(behaviorFile, gradesFile);
    }
  };

  const handleSampleLoad = () => {
    const { behaviorCSV, gradesCSV } = generateSampleData();
    onProcess(behaviorCSV, gradesCSV);
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

        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-elevated border border-slate-100/80 overflow-hidden animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="p-6 md:p-10 space-y-8">
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

            {/* File Drop Zones */}
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

            {/* Actions */}
            <div className="space-y-4 pt-2">
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
