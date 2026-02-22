import React, { useState, useEffect } from 'react';
import {
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  FileSpreadsheet,
  Grid3X3,
  LayoutDashboard,
  LogIn,
  CloudCog,
  User,
  Upload,
  ArrowLeft,
} from 'lucide-react';
import { FileIcons } from '../constants/icons';
import { useAuth } from '../context/AuthContext';
import FirebaseConfigDialog from './FirebaseConfigDialog';

const BRAND_NAME = 'ClassMap';
const BRAND_TAGLINE = 'מערכת מעקב פדגוגית';
const COMPANY_NAME = 'ToledanoEdTech';
const LOGO_PATH = '/logo.png';

const PREVIEW_IMAGES: { src: string; label: string }[] = [
  { src: '/dashboard-preview.png', label: 'דשבורד כיתתי' },
  { src: '/heatmap-preview.png', label: 'מטריצות' },
  { src: '/student-profile-preview.png', label: 'פרופיל תלמיד' },
];

interface LandingPageProps {
  onStart: () => void;
  onOpenAuth?: () => void;
  onOpenStudentLogin?: () => void;
}

const LandingLogo: React.FC<{ className?: string }> = ({ className }) => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <FileIcons.LogoFallback
        className={`${className ?? 'w-16 h-16'} text-primary-500 dark:text-primary-400`}
        strokeWidth={2}
      />
    );
  }
  return (
    <img
      src={LOGO_PATH}
      alt={`לוגו ${BRAND_NAME}`}
      className={`${className ?? 'w-16 h-16'} object-contain p-1`}
      onError={() => setFailed(true)}
    />
  );
};

const PreviewCarousel: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((i) => (i + 1) % PREVIEW_IMAGES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const goNext = () => setActiveIndex((i) => (i + 1) % PREVIEW_IMAGES.length);
  const goPrev = () => setActiveIndex((i) => (i - 1 + PREVIEW_IMAGES.length) % PREVIEW_IMAGES.length);

  const gradients = [
    'from-primary-500/20 via-primary-50/80 to-blue-50 dark:from-primary-500/20 dark:via-primary-900/40 dark:to-slate-900',
    'from-emerald-500/20 via-emerald-50/80 to-teal-50 dark:from-emerald-500/20 dark:via-emerald-900/30 dark:to-slate-900',
    'from-amber-500/20 via-amber-50/80 to-orange-50 dark:from-amber-500/20 dark:via-amber-900/30 dark:to-slate-900',
  ];

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-700 shadow-xl bg-slate-100 dark:bg-slate-800 w-full max-w-2xl sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto min-h-[320px] sm:min-h-[380px] md:min-h-[420px] lg:min-h-[480px] flex flex-col">
      <div className="flex-1 min-h-[280px] sm:min-h-[340px] md:min-h-[380px] lg:min-h-[440px] relative">
        {PREVIEW_IMAGES.map((img, i) => (
          <div
            key={img.src}
            className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${
              i === activeIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            <div
              className={`absolute inset-0 bg-gradient-to-br ${gradients[i % gradients.length]} flex items-center justify-center`}
              aria-hidden="true"
            />
            <img
              src={img.src}
              alt={img.label}
              className="absolute inset-0 w-full h-full object-contain object-center bg-transparent"
              onLoad={() => setLoaded((p) => ({ ...p, [i]: true }))}
              onError={() => setLoaded((p) => ({ ...p, [i]: false }))}
              style={{ opacity: loaded[i] === true ? 1 : 0 }}
            />
            {loaded[i] !== true && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-600 dark:text-slate-400 px-4">
                <div className="w-16 h-16 rounded-2xl bg-white/80 dark:bg-slate-700/80 shadow-lg flex items-center justify-center">
                  <BarChart2 size={28} className="text-primary-500 dark:text-primary-400" strokeWidth={2} />
                </div>
                <span className="font-bold text-lg text-slate-700 dark:text-slate-200">{img.label}</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">תצוגה מקדימה</span>
              </div>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={goPrev}
          aria-label="הקודם"
          className="absolute top-1/2 right-2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 dark:bg-slate-700/90 hover:bg-white dark:hover:bg-slate-600 shadow-lg border border-slate-200/80 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
        <button
          type="button"
          onClick={goNext}
          aria-label="הבא"
          className="absolute top-1/2 left-2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 dark:bg-slate-700/90 hover:bg-white dark:hover:bg-slate-600 shadow-lg border border-slate-200/80 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
      </div>
      <div className="flex items-center justify-center gap-2 py-2 px-3 bg-white/95 dark:bg-slate-800/95 border-t border-slate-100 dark:border-slate-700 flex-shrink-0">
        {PREVIEW_IMAGES.map((img, i) => (
          <button
            key={img.src}
            type="button"
            onClick={() => setActiveIndex(i)}
            className={`px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-medium transition-all ${
              i === activeIndex
                ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {img.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const FEATURES = [
  {
    icon: FileSpreadsheet,
    title: 'העלאת קבצי אקסל',
    description: 'העלה קבצי ציונים והתנהגות מאקסל במהירות ובעיבוד אוטומטי.',
  },
  {
    icon: LayoutDashboard,
    title: 'דשבורד כיתתי',
    description: 'תצוגה ברורה של הכיתה עם ממוצעים, סיכונים ומגמות לפי תקופות.',
  },
  {
    icon: User,
    title: 'פרופיל תלמיד',
    description: 'פרופיל מפורט לכל תלמיד עם היסטוריה, ציונים ואירועי התנהגות.',
  },
  {
    icon: BarChart2,
    title: 'אנליטיקת מורים',
    description: 'תובנות וסטטיסטיקות ברמת המורה והכיתה בזמן אמת.',
  },
  {
    icon: Grid3X3,
    title: 'מטריצת מקצועות',
    description: 'תצוגת מטריצה לפי מקצועות ותקופות לזיהוי פערים וחוזקות.',
  },
  {
    icon: Cloud,
    title: 'שמירה בענן',
    description: 'גיבוי וסנכרון נתונים בענן עם התחברות מאובטחת (Google או אימייל).',
  },
] as const;

const LandingPage: React.FC<LandingPageProps> = ({
  onStart,
  onOpenAuth,
  onOpenStudentLogin,
}) => {
  const { user, isConfigured } = useAuth();
  const [showFirebaseConfig, setShowFirebaseConfig] = useState(false);

  return (
    <div
      className="min-h-[calc(100vh-4rem)] flex flex-col w-full text-right"
      dir="rtl"
    >
      {/* Hero – פריסה כמו Local: שמאל = לוגו + CTA, ימין = תמונות */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-primary-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-primary-950/20 px-4 sm:px-6 py-8 sm:py-12 md:py-16">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center md:gap-10 lg:gap-14">
          {/* מובייל: תוכן למעלה (order-1), קרוסלה למטה (order-2). דסקטופ RTL: קרוסלה ימין (order-1), תוכן שמאל (order-2) */}
          <div className="order-1 md:order-2 flex-1 min-w-0 flex flex-col md:justify-center text-center md:text-right">
            {/* כותרת ראשית – שם האתר */}
            <div className="mb-6 sm:mb-8">
              <div className="text-center md:text-right min-w-0">
                <h1
                  className="font-brand font-extrabold tracking-tight text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-[7rem] leading-[1.1] whitespace-nowrap"
                  style={{ letterSpacing: '-0.03em' }}
                  dir="ltr"
                >
                  <span className="text-primary-800 dark:text-primary-300">{BRAND_NAME[0]}</span>
                  <span className="bg-gradient-to-br from-slate-900 via-primary-700 to-primary-600 dark:from-slate-100 dark:via-primary-300 dark:to-primary-400 bg-clip-text text-transparent">
                    {BRAND_NAME.slice(1)}
                  </span>
                </h1>
                <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-2 sm:gap-4 mt-3 sm:mt-4">
                  <span className="text-primary-600 dark:text-primary-400 font-medium text-base sm:text-lg">
                    {BRAND_TAGLINE}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm hidden sm:inline">•</span>
                  <span className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
                    מבית {COMPANY_NAME}
                  </span>
                </div>
              </div>
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-3xl lg:text-4xl text-slate-900 dark:text-slate-50 tracking-tight leading-tight mb-2 sm:mb-3">
              מערכת המעקב הפדגוגית למורים
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg max-w-xl md:mr-0 mx-auto mb-6 sm:mb-8">
              מעקב ציונים, התנהגות ואנליטיקה בכיתה – במקום אחד.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-3 sm:gap-4">
              <button
                type="button"
                onClick={user ? onStart : () => onOpenAuth?.()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-base bg-primary-500 hover:bg-primary-600 dark:bg-primary-500 dark:hover:bg-primary-400 text-white shadow-lg shadow-primary-500/25 hover:shadow-primary-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 min-h-[48px] w-full sm:w-auto"
              >
                {user ? (
                  <>
                    <LayoutDashboard size={22} strokeWidth={2.5} />
                    כניסה לאתר
                  </>
                ) : (
                  <>
                    <LogIn size={22} strokeWidth={2.5} />
                    כניסה לחשבון
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onStart}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-base bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 border-2 border-primary-200 dark:border-primary-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50/50 dark:hover:bg-primary-900/20 transition-all duration-200 min-h-[48px] w-full sm:w-auto"
              >
                <ArrowLeft size={20} className="rtl:rotate-180" strokeWidth={2.5} />
                התחל בלי חשבון – העלאת קבצים
              </button>
            </div>
            {onOpenStudentLogin && (
              <button
                type="button"
                onClick={() => onOpenStudentLogin()}
                className="mt-3 w-max shrink-0 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-700/60 hover:bg-slate-200/80 dark:hover:bg-slate-600 border border-slate-200/60 dark:border-slate-600/80 transition-colors"
              >
                כניסת תלמיד
              </button>
            )}
            {!user && !isConfigured && (
              <button
                type="button"
                onClick={() => setShowFirebaseConfig(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-600"
              >
                <CloudCog size={14} />
                לא מצליח להתחבר? הגדר חיבור ל-Firebase
              </button>
            )}
          </div>
          {/* קרוסלה – בדסקטופ מופיעה בצד ימין (order-1 ב-RTL), במובייל למטה */}
          <div className="order-2 md:order-1 flex-1 min-w-0 w-full max-w-3xl sm:max-w-4xl md:max-w-none mx-auto">
            <PreviewCarousel />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 md:py-20 bg-white dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
            <p className="font-display font-bold text-xl sm:text-2xl md:text-3xl text-slate-900 dark:text-slate-50 leading-snug mb-4">
              רואים את כל הכיתה, מזהים כל תלמיד.
            </p>
            <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg leading-relaxed">
              מפסיקים לנחש מי מתקשה – המערכת מזהה את הפערים עבורכם ומאפשרת לכם להשיק תוכנית עבודה אישית לכל תלמיד.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 p-5 sm:p-6 hover:border-primary-200 dark:hover:border-primary-800 hover:shadow-card-hover transition-all duration-200"
              >
                <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center mb-4">
                  <Icon size={24} className="text-primary-600 dark:text-primary-400" strokeWidth={2} />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base sm:text-lg mb-2">
                  {title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 bg-gradient-to-b from-primary-50/50 to-slate-50 dark:from-primary-950/30 dark:to-slate-900 border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-slate-50 mb-4">
            מוכנים להתחיל?
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base mb-6">
            {user
              ? 'היכנסו לאתר או העלו קבצים.'
              : 'התחברו לחשבון כדי לשמור ולסנכרן את הנתונים בענן, או התחילו בהעלאת קבצים.'}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={user ? onStart : () => onOpenAuth?.()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-base bg-primary-500 hover:bg-primary-600 dark:bg-primary-500 dark:hover:bg-primary-400 text-white shadow-lg shadow-primary-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 min-h-[48px] w-full sm:w-auto"
            >
              {user ? (
                <>
                  <LayoutDashboard size={20} strokeWidth={2.5} />
                  כניסה לאתר
                </>
              ) : (
                <>
                  <LogIn size={20} strokeWidth={2.5} />
                  כניסה לחשבון
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onStart}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-base text-primary-600 dark:text-primary-400 hover:bg-primary-100/80 dark:hover:bg-primary-900/30 transition-colors min-h-[48px] w-full sm:w-auto"
            >
              <Upload size={20} strokeWidth={2.5} />
              העלאת קבצים
            </button>
          </div>
        </div>
      </section>

      {/* לוגו בתחתית העמוד */}
      <footer className="px-4 sm:px-6 py-8 sm:py-10 bg-slate-100/80 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700">
        <div className="max-w-6xl mx-auto flex flex-col items-center justify-center gap-2">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white dark:bg-slate-800 shadow-lg border border-slate-200/60 dark:border-slate-600/80 overflow-hidden flex items-center justify-center p-2">
            <LandingLogo className="w-full h-full" />
          </div>
          <span className="text-slate-600 dark:text-slate-400 text-sm font-medium">מבית {COMPANY_NAME}</span>
        </div>
      </footer>

      {showFirebaseConfig && (
        <FirebaseConfigDialog onClose={() => setShowFirebaseConfig(false)} />
      )}
    </div>
  );
};

export default LandingPage;
