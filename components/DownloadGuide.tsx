import React, { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react';

interface GuidePdf {
  title: string;
  description: string;
  path: string;
}

const GUIDE_PDFS: GuidePdf[] = [
  {
    title: 'שלב 1 – כניסה ליומן מחנך',
    description: 'היכנסו למשוב, בחרו «יומן מחנך», את הכיתה ו«מתחילת השנה».',
    path: '/guides/guide-1.pdf',
  },
  {
    title: 'שלב 2 – הורדת קובץ ציונים',
    description: 'בחרו «ציונים – תצוגת סדין» והורידו את קובץ ה-Excel.',
    path: '/guides/guide-2.pdf',
  },
  {
    title: 'שלב 3 – הורדת קובץ התנהגות',
    description: 'בחרו «פירוט» והורידו את קובץ ה-Excel התחתון.',
    path: '/guides/guide-3.pdf',
  },
];

const PdfViewer: React.FC<{ pdf: GuidePdf }> = ({ pdf }) => (
  <div className="space-y-2">
    <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
      <iframe
        src={`${pdf.path}#view=FitH`}
        title={pdf.title}
        className="w-full h-[min(420px,55vh)] bg-slate-50"
      />
    </div>
    <a
      href={pdf.path}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-700 hover:text-primary-800 hover:underline"
    >
      <Download size={13} />
      פתח / הורד PDF
    </a>
  </div>
);

const DownloadGuide: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const pdf = GUIDE_PDFS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === GUIDE_PDFS.length - 1;

  return (
    <div className="bg-gradient-to-br from-primary-50 to-blue-50/50 border border-primary-100 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full p-2.5 md:p-3 flex items-start gap-2 text-right hover:bg-primary-50/60 transition-colors"
        aria-expanded={expanded}
      >
        <AlertCircle size={16} className="text-primary-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-800 text-sm mb-1">הנחיות להורדת קבצים ממשוב</h3>
          {!expanded && (
            <ul className="space-y-0.5 text-xs text-slate-600 leading-relaxed text-right">
              <li>
                <strong className="text-slate-700">קובץ ציונים:</strong>{' '}
                יומן מחנך → מתחילת השנה → ציונים תצוגת סדין → הורדת Excel
              </li>
              <li>
                <strong className="text-slate-700">קובץ התנהגות:</strong>{' '}
                יומן מחנך → מתחילת השנה → פירוט → הורדת Excel התחתון
              </li>
            </ul>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`text-slate-400 shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-2.5 md:px-3 pb-2.5 md:pb-3 space-y-3 border-t border-primary-100/80 pt-2.5">
          <div className="flex items-center justify-center gap-1.5">
            {GUIDE_PDFS.map((item, index) => (
              <button
                key={item.path}
                type="button"
                onClick={() => setCurrentStep(index)}
                className={`h-1.5 rounded-full transition-all ${
                  index === currentStep ? 'w-6 bg-primary-600' : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                }`}
                aria-label={item.title}
              />
            ))}
          </div>

          <div className="flex items-start gap-2">
            <FileText size={16} className="text-primary-500 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800">{pdf.title}</p>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{pdf.description}</p>
              <p className="text-[10px] text-slate-400 mt-1">
                {currentStep + 1} מתוך {GUIDE_PDFS.length}
              </p>
            </div>
          </div>

          <PdfViewer pdf={pdf} />

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-primary-100/60">
            <button
              type="button"
              onClick={() => setCurrentStep((step) => step - 1)}
              disabled={isFirst}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed
                bg-white/80 text-slate-600 hover:bg-white border border-slate-200"
            >
              <ChevronRight size={14} />
              הקודם
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep((step) => step + 1)}
              disabled={isLast}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed
                bg-primary-600 text-white hover:bg-primary-700 shadow-sm"
            >
              הבא
              <ChevronLeft size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DownloadGuide;
