import React, { useState, useEffect } from 'react';
import { BarChart2, FileText, FileSpreadsheet, TrendingUp, ArrowLeft, ChevronRight, ChevronLeft, LogIn, LogOut, CloudCog } from 'lucide-react';
import { FileIcons } from '../constants/icons';
import { useAuth } from '../context/AuthContext';
import FirebaseConfigDialog from './FirebaseConfigDialog';

const BRAND_NAME = 'ToledanoEdTech';
const BRAND_TAGLINE = 'מערכת מעקב פדגוגית';

const LOGO_PATH = '/logo.png';

interface LandingPageProps {
  onStart: () => void;
  onOpenAuth?: () => void;
  onOpenStudentLogin?: () => void;
}

const LandingLogo: React.FC = () => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <FileIcons.LogoFallback className="w-20 h-20 text-primary-500" strokeWidth={2} />;
  }
  return (
    <img
      src={LOGO_PATH}
      alt={`לוגו ${BRAND_NAME}`}
      className="w-full h-full object-contain p-2"
      onError={() => setFailed(true)}
    />
  );
};

interface PreviewImage {
  src: string;
  label: string;
}

const PreviewCarousel: React.FC<{ images: PreviewImage[] }> = ({ images }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((i) => (i + 1) % images.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [images.length]);

  const goNext = () => setActiveIndex((i) => (i + 1) % images.length);
  const goPrev = () => setActiveIndex((i) => (i - 1 + images.length) % images.length);

  const gradients = [
    'from-primary-500/20 via-primary-50/80 to-blue-50',
    'from-emerald-500/20 via-emerald-50/80 to-teal-50',
    'from-amber-500/20 via-amber-50/80 to-orange-50',
  ];

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200/80 shadow-xl bg-slate-100 w-full h-full min-h-[320px] flex flex-col">
      <div className="flex-1 min-h-[280px] relative bg-slate-100">
        {images.map((img, i) => (
          <div
            key={img.src}
            className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${
              i === activeIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            {/* רקע placeholder מקצועי – תמיד נראה */}
            <div
              className={`absolute inset-0 bg-gradient-to-br ${gradients[i % gradients.length]} flex items-center justify-center`}
              aria-hidden="true"
            />
            {/* תמונה – אם נטענה מוצגת מעל */}
            <img
              src={img.src}
              alt={img.label}
              className="absolute inset-0 w-full h-full object-contain object-center bg-transparent"
              onLoad={() => setLoaded((p) => ({ ...p, [i]: true }))}
              onError={() => setLoaded((p) => ({ ...p, [i]: false }))}
              style={{ opacity: loaded[i] === true ? 1 : 0 }}
            />
            {/* טקסט על ה-placeholder כשהתמונה לא נטענה */}
            {loaded[i] !== true && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-600 px-4">
                <div className="w-16 h-16 rounded-2xl bg-white/80 shadow-lg flex items-center justify-center">
                  <BarChart2 size={28} className="text-primary-500" strokeWidth={2} />
                </div>
                <span className="font-bold text-lg text-slate-700">{img.label}</span>
                <span className="text-sm text-slate-500">תצוגה מקדימה</span>
              </div>
            )}
          </div>
        ))}
        {/* כפתורי ניווט */}
        <button
          type="button"
          onClick={goPrev}
          aria-label="הקודם"
          className="absolute top-1/2 right-2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-lg border border-slate-200/80 flex items-center justify-center text-slate-600 hover:text-primary-600 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
        <button
          type="button"
          onClick={goNext}
          aria-label="הבא"
          className="absolute top-1/2 left-2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-lg border border-slate-200/80 flex items-center justify-center text-slate-600 hover:text-primary-600 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
      </div>
      <div className="flex items-center justify-center gap-2 py-1.5 px-3 bg-white/95 border-t border-slate-100 flex-shrink-0">
        {images.map((img, i) => (
          <button
            key={img.src}
            type="button"
            onClick={() => setActiveIndex(i)}
            className={`px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-medium transition-all ${
              i === activeIndex
                ? 'bg-primary-100 text-primary-700'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            {img.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const LandingPage: React.FC<LandingPageProps> = ({ onStart, onOpenAuth, onOpenStudentLogin }) => {
  const { user, isConfigured, signOut } = useAuth();
  const [showFirebaseConfig, setShowFirebaseConfig] = useState(false);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden w-full">
      <div className="w-full flex flex-col flex-1 min-h-0">
        {/* Hero - מינימלי */}
        <div className="flex-shrink-0 flex items-center justify-center gap-2 py-2 px-3 animate-slide-up">
          <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-lg bg-white shadow-md border border-slate-200/80 overflow-hidden ring-1 ring-primary-100/80">
            <LandingLogo />
          </div>
          <div>
            <h1 className="font-display font-bold text-base md:text-lg text-slate-800 tracking-tight leading-tight">
              {BRAND_NAME}
            </h1>
            <p className="text-primary-600 font-medium text-[10px] md:text-xs">{BRAND_TAGLINE}</p>
          </div>
        </div>

        {/* קרוסלה – תופסת את רוב המסך, גובה מובטח */}
        <div className="flex-1 min-h-[55vh] w-full max-w-6xl mx-auto px-3 sm:px-4 flex flex-col">
          <div className="flex-1 w-full min-h-[400px] h-[55vh] max-h-[70vh]">
            <PreviewCarousel
              images={[
                { src: '/dashboard-preview.png', label: 'דשבורד כיתתי' },
                { src: '/heatmap-preview.png', label: 'מטריצות' },
                { src: '/student-profile-preview.png', label: 'פרופיל תלמיד' },
              ]}
            />
          </div>
        </div>

        {/* CTA – רק כפתור הכניסה מתחת לתמונה */}
        <div className="flex-shrink-0 text-center py-3 px-2 animate-slide-up" style={{ animationDelay: '0.15s' }}>
          <button
            type="button"
            onClick={onStart}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm md:text-base bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <ArrowLeft size={20} className="rtl:rotate-180" strokeWidth={2.5} />
            התחל – העלאת קבצים
          </button>
          <p className="text-slate-500 text-[10px] mt-1">
            אין לך קבצים? אפשר לטעון נתוני דוגמה בשלב הבא
          </p>
          <div className="mt-3 flex flex-col items-center gap-2">
            {user ? (
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <span className="text-slate-600 dark:text-slate-400 text-sm">
                  שלום, {user.email}
                </span>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <LogOut size={16} />
                  התנתק
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onOpenAuth?.()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <LogIn size={16} />
                  התחבר (Google או אימייל+סיסמה) – לשמירת נתונים בענן
                </button>
                {onOpenStudentLogin && (
                  <button
                    type="button"
                    onClick={() => onOpenStudentLogin()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    התחברות תלמיד
                  </button>
                )}
                {!isConfigured && (
                  <button
                    type="button"
                    onClick={() => setShowFirebaseConfig(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-600"
                  >
                    <CloudCog size={14} />
                    לא מצליח להתחבר? הגדר חיבור ל-Firebase
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {showFirebaseConfig && <FirebaseConfigDialog onClose={() => setShowFirebaseConfig(false)} />}
    </div>
  );
};

export default LandingPage;
