import React, { useState } from 'react';
import { Upload, FileText, FileSpreadsheet, AlertCircle } from 'lucide-react';
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

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] bg-slate-50 p-6">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-slate-800">ברוכים הבאים ל-ToledanoEdTech</h1>
          <p className="text-slate-500">העלה את קבצי הנתונים כדי להתחיל בניתוח הכיתה</p>
        </div>

        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-sm text-blue-800 space-y-2">
            <h3 className="font-bold flex items-center gap-2">
                <AlertCircle size={16} />
                הנחיות להורדת קבצים:
            </h3>
            <ul className="list-disc list-inside space-y-1 opacity-90">
                <li><strong>קובץ התנהגות:</strong> היכנס ליומן מחנך &#8592; דוחות &#8592; פירוט אירועי התנהגות (יש לוודא שמופיעה עמודת הפירוט).</li>
                <li><strong>קובץ ציונים:</strong> היכנס למערכת הציונים &#8592; הורד קובץ "ציונים שוטפים - סדין".</li>
            </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Behavior File Input */}
          <div className="relative group">
            <input
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={(e) => setBehaviorFile(e.target.files?.[0] || null)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all h-48
              ${behaviorFile ? 'border-green-500 bg-green-50' : 'border-slate-300 group-hover:border-blue-400 bg-slate-50'}`}>
              <FileText className={`w-12 h-12 mb-3 ${behaviorFile ? 'text-green-600' : 'text-slate-400'}`} />
              <span className="font-medium text-slate-700">קובץ התנהגות</span>
              <span className="text-xs text-slate-400 mt-1">
                {behaviorFile ? behaviorFile.name : 'יומן מחנך (פירוט אירועים)'}
              </span>
            </div>
          </div>

          {/* Grades File Input */}
          <div className="relative group">
            <input
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={(e) => setGradesFile(e.target.files?.[0] || null)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
             <div className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all h-48
              ${gradesFile ? 'border-green-500 bg-green-50' : 'border-slate-300 group-hover:border-blue-400 bg-slate-50'}`}>
              <FileSpreadsheet className={`w-12 h-12 mb-3 ${gradesFile ? 'text-green-600' : 'text-slate-400'}`} />
              <span className="font-medium text-slate-700">קובץ ציונים</span>
              <span className="text-xs text-slate-400 mt-1">
                {gradesFile ? gradesFile.name : 'ציונים שוטפים - סדין'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
            <button
            onClick={handleSubmit}
            disabled={!behaviorFile || !gradesFile || loading}
            className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2
                ${(!behaviorFile || !gradesFile) ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-200'}`}
            >
            {loading ? (
                <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                מעבד נתונים...
                </>
            ) : (
                <>
                <Upload size={20} />
                נתח נתונים
                </>
            )}
            </button>

            <button
                onClick={handleSampleLoad}
                className="text-sm text-slate-500 hover:text-blue-600 underline text-center"
            >
                אין לך קבצים? טען נתונים לדוגמה
            </button>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;